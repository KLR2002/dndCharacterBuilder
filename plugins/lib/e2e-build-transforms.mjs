// Pure string transforms for the generated app/build.gradle. They make the release build type
// debuggable when the Gradle project property `-Pe2e` is present, declare that property (and
// EXPO_PUBLIC_E2E) as inputs of the bundle task so a flag change rebuilds the bundle, and opt the
// APK and bundle out of dependency metadata (`dependenciesInfo`). The config plugin in
// plugins/e2e-build.mjs applies them at prebuild time; the unit test in checks/ drives them with a
// fixture Gradle string. The Gradle property only exists at build time, so the generated file
// carries a Gradle expression that resolves per build: without `-Pe2e` the release build is a plain
// release build.

export const E2E_PROPERTY = "e2e";
// Kept exported so a recipe that still passes `-Pfdroid` builds; the generated Gradle does not read it.
export const FDROID_PROPERTY = "fdroid";
// Groovy truth of a `-P` flag is unreliable (`-Pe2e` may be an empty string), so presence is
// what the generated expression tests.
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

const debuggableLine = `debuggable ${E2E_PRESENT_EXPRESSION}`;

/** Whether the release build type is debuggable: only in the E2E build. */
export function releaseDebuggable(e2e) {
  return e2e;
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
 * Prebuild transform: opt the APK and the bundle out of dependency metadata, as the first statement
 * of the top-level android block. Keyed on the block's own `dependenciesInfo`, so re-prebuild
 * leaves the file unchanged; throws when there is no android block.
 */
export function withDependenciesInfoOptOut(appBuildGradle) {
  const android = blockExtent(appBuildGradle, /^android[ \t]*\{/m);
  if (!android) throw new Error("no top-level android block in app/build.gradle");
  if (appBuildGradle.slice(android[0], android[1]).includes("dependenciesInfo")) return appBuildGradle;
  const lineEnd = appBuildGradle.indexOf("\n", android[0]);
  return `${appBuildGradle.slice(0, lineEnd)}
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }${appBuildGradle.slice(lineEnd)}`;
}

/**
 * Prebuild transform: make the release build type debuggable when the e2e Gradle property is present,
 * and append the block that makes the flag an input of the bundle task. The release match is scoped
 * to the buildTypes block, so a signingConfigs.release earlier in the file is never touched. The
 * appended block is keyed on its marker line, so re-prebuild leaves the file unchanged.
 */
export function withE2eBuildSettings(appBuildGradle) {
  let out = appBuildGradle;
  const buildTypes = blockExtent(out, /^[ \t]*buildTypes[ \t]*\{/m);
  if (!buildTypes) throw new Error("no buildTypes block in app/build.gradle");
  out = insertIntoBlock(out, /^[ \t]*release[ \t]*\{/m, debuggableLine, E2E_PRESENT_EXPRESSION, /^[ \t]*debuggable\b/m, buildTypes[0], buildTypes[1]);
  out = withDependenciesInfoOptOut(out);
  if (!out.includes(E2E_BUNDLE_INPUTS_MARKER)) {
    out = out.replace(/\s+$/, "") + "\n\n" + E2E_BUNDLE_INPUTS_BLOCK;
  }
  return out;
}
