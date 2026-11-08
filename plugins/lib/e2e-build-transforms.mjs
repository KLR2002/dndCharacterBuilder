// Pure string transforms that wire the two E2E build settings (Expo Updates off, release
// debuggable) to the Gradle project property passed as `-Pe2e`, and declare that property (and
// EXPO_PUBLIC_E2E) as inputs of the bundle task so a flag change rebuilds the bundle. The config
// plugin in plugins/e2e-build.mjs applies them to the generated android/ files at prebuild time;
// the unit test in checks/ drives them with fixture manifest and Gradle strings. The Gradle
// property only exists at build time, so the generated files carry Gradle expressions and
// both settings resolve per build: with `-Pe2e` the APK is debuggable with updates off,
// without it neither setting differs from a plain release build.

export const E2E_PROPERTY = "e2e";
export const UPDATES_ENABLED_META_NAME = "expo.modules.updates.ENABLED";
export const UPDATES_ENABLED_PLACEHOLDER = "expoUpdatesEnabled";
// Groovy truth of a `-P` flag is unreliable (`-Pe2e` may be an empty string), so presence is
// what the generated expressions test.
export const E2E_PRESENT_EXPRESSION = `findProperty('${E2E_PROPERTY}') != null`;

// First line of the appended block that makes the E2E flag an input of Gradle's bundle task, so a
// build with the other flag value cannot report it UP-TO-DATE and keep the stale bundle.
export const E2E_BUNDLE_INPUTS_MARKER = "// e2e-build: bundle inputs";
const E2E_BUNDLE_INPUTS_BLOCK = `${E2E_BUNDLE_INPUTS_MARKER}
tasks.configureEach { task ->
    if (task.name == 'createBundleReleaseJsAndAssets') {
        task.inputs.property('e2e', findProperty('${E2E_PROPERTY}') != null)
        task.inputs.property('expoPublicE2e', System.getenv('EXPO_PUBLIC_E2E') ?: '')
    }
}
`;

const placeholderRef = `\${${UPDATES_ENABLED_PLACEHOLDER}}`;
const placeholderLine = `manifestPlaceholders = [${UPDATES_ENABLED_PLACEHOLDER}: ${E2E_PRESENT_EXPRESSION} ? '${updatesEnabledValue(true)}' : '${updatesEnabledValue(false)}']`;
const debuggableLine = `debuggable ${E2E_PRESENT_EXPRESSION}`;

/** The meta-data value a build ends up with: Expo Updates off only in the E2E build. */
export function updatesEnabledValue(e2e) {
  return e2e ? "false" : "true";
}

/** Whether the release build type is debuggable: only in the E2E build. */
export function releaseDebuggable(e2e) {
  return e2e;
}

/**
 * Prebuild transform: point the Updates flag meta-data at the Gradle placeholder, so the
 * manifest merger substitutes it per build. Throws when the meta-data is missing, so a
 * template change fails the prebuild instead of silently shipping updates on.
 */
export function withUpdatesEnabledPlaceholder(manifestXml) {
  let found = false;
  const out = manifestXml.replace(/<meta-data\b[^>]*>/g, (element) => {
    if (!element.includes(`android:name="${UPDATES_ENABLED_META_NAME}"`)) return element;
    found = true;
    if (!/android:value="[^"]*"/.test(element)) {
      throw new Error(`meta-data ${UPDATES_ENABLED_META_NAME} has no android:value to replace`);
    }
    return element.replace(/android:value="[^"]*"/, `android:value="${placeholderRef}"`);
  });
  if (!found) throw new Error(`no meta-data named ${UPDATES_ENABLED_META_NAME} in the manifest`);
  return out;
}

/** Build-time model of the manifest merger: substitute the placeholder for one build. */
export function resolveUpdatesEnabledPlaceholder(manifestXml, e2e) {
  return manifestXml.split(placeholderRef).join(updatesEnabledValue(e2e));
}

/** The [start, end) extent of the braced block whose opening line matches `header` within [from, to), or null. */
function blockExtent(text, header, from = 0, to = text.length) {
  const match = header.exec(text.slice(from, to));
  if (!match) return null;
  const start = from + match.index;
  const open = start + match[0].length - 1;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return [start, i + 1];
    }
  }
  return null;
}

/**
 * Insert `line` as the first statement of the block `header` opens inside [from, to), unless the block
 * already carries `presentKey` (idempotent re-prebuild) or a conflicting `conflict` line (loud failure
 * instead of silently dropping the other setting).
 */
function insertIntoBlock(text, header, line, presentKey, conflict, from = 0, to = text.length) {
  const extent = blockExtent(text, header, from, to);
  if (!extent) throw new Error(`no block matching ${header} in app/build.gradle`);
  const block = text.slice(extent[0], extent[1]);
  if (block.includes(presentKey)) return text;
  if (conflict.test(block)) throw new Error(`app/build.gradle already sets ${conflict} outside this plugin`);
  const lineEnd = text.indexOf("\n", extent[0]);
  const indent = text.slice(extent[0], lineEnd).match(/^[ \t]*/)[0] + "    ";
  return text.slice(0, lineEnd) + "\n" + indent + line + text.slice(lineEnd);
}

/**
 * Prebuild transform: wire both settings to the e2e Gradle property — a manifest placeholder
 * in defaultConfig and `debuggable` in the release build type — and append the block that makes
 * the flag an input of the bundle task. The release match is scoped to the buildTypes block, so
 * a signingConfigs.release earlier in the file is never touched. The appended block is keyed on
 * its marker line, so re-prebuild leaves the file unchanged.
 */
export function withE2eBuildSettings(appBuildGradle) {
  let out = appBuildGradle;
  out = insertIntoBlock(out, /^[ \t]*defaultConfig[ \t]*\{/m, placeholderLine, UPDATES_ENABLED_PLACEHOLDER, /^[ \t]*manifestPlaceholders\b/m);
  const buildTypes = blockExtent(out, /^[ \t]*buildTypes[ \t]*\{/m);
  if (!buildTypes) throw new Error("no buildTypes block in app/build.gradle");
  out = insertIntoBlock(out, /^[ \t]*release[ \t]*\{/m, debuggableLine, E2E_PRESENT_EXPRESSION, /^[ \t]*debuggable\b/m, buildTypes[0], buildTypes[1]);
  if (!out.includes(E2E_BUNDLE_INPUTS_MARKER)) {
    out = out.replace(/\s+$/, "") + "\n\n" + E2E_BUNDLE_INPUTS_BLOCK;
  }
  return out;
}
