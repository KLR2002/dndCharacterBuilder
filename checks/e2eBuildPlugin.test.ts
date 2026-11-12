import test from "node:test";
import assert from "node:assert/strict";
import {
  E2E_BUNDLE_INPUTS_MARKER,
  E2E_PRESENT_EXPRESSION,
  E2E_PROPERTY,
  UPDATES_ENABLED_META_NAME,
  UPDATES_ENABLED_PLACEHOLDER,
  releaseDebuggable,
  resolveUpdatesEnabledPlaceholder,
  updatesEnabledValue,
  withE2eBuildSettings,
  withUpdatesEnabledPlaceholder,
} from "../plugins/lib/e2e-build-transforms.mjs";
import { gradleArgs } from "../scripts/lib/android-runner.mjs";

// The config plugin (plugins/e2e-build.mjs) applies the pure transforms below to the generated
// android/ files at prebuild time. The Gradle property `-Pe2e` is only known at build time, so
// the generated files carry Gradle expressions; these tests drive both layers with fixture
// strings shaped like the generated AndroidManifest.xml and app/build.gradle.

const FIXTURE_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.INTERNET"/>
  <application android:name=".MainApplication" android:label="@string/app_name" android:allowBackup="true">
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/d9666891-68f0-45d6-95df-23f06bc7493a"/>
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
`;

const FIXTURE_GRADLE = `apply plugin: "com.android.application"

android {
    defaultConfig {
        applicationId 'io.github.klr2002.cb5e'
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0.0"

        buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", "\\"\${findProperty('reactNativeReleaseLevel') ?: 'stable'}\\""
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

// The usual shape once a real keystore is added: a signingConfigs block with its own release block
// before buildTypes.
const FIXTURE_GRADLE_SIGNED = `apply plugin: "com.android.application"

android {
    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword 'keystore'
            keyAlias 'key'
            keyPassword 'key'
        }
    }
    defaultConfig {
        applicationId 'io.github.klr2002.cb5e'
        minSdkVersion rootProject.ext.minSdkVersion
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

/** The lines of `a` that differ from `b` at the same index, paired with their index. */
function changedLines(a: string, b: string): { index: number; from: string; to: string }[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  assert.equal(aLines.length, bLines.length, "line count changed");
  return aLines.flatMap((line, index) => (line === bLines[index] ? [] : [{ index, from: bLines[index], to: line }]));
}

test("prebuild: the Updates flag meta-data is repointed at the Gradle placeholder", () => {
  const out = withUpdatesEnabledPlaceholder(FIXTURE_MANIFEST);
  assert.ok(
    out.includes(`<meta-data android:name="${UPDATES_ENABLED_META_NAME}" android:value="\${${UPDATES_ENABLED_PLACEHOLDER}}"/>`),
    `the ENABLED meta-data must carry the \${${UPDATES_ENABLED_PLACEHOLDER}} placeholder`,
  );
  const changed = changedLines(out, FIXTURE_MANIFEST);
  assert.equal(changed.length, 1, "exactly one line of the manifest may change");
  assert.equal(changed[0].from, `    <meta-data android:name="${UPDATES_ENABLED_META_NAME}" android:value="true"/>`);
  assert.ok(out.includes('<meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>'));
  assert.equal(withUpdatesEnabledPlaceholder(out), out, "the transform is idempotent");
});

test("prebuild: a manifest without the Updates flag fails loudly", () => {
  assert.throws(() => withUpdatesEnabledPlaceholder("<manifest>\n</manifest>\n"), new RegExp(UPDATES_ENABLED_META_NAME));
});

test("prebuild: app/build.gradle wires both settings to the -Pe2e property", () => {
  const out = withE2eBuildSettings(FIXTURE_GRADLE);
  const expectedPlaceholderLine = `manifestPlaceholders = [${UPDATES_ENABLED_PLACEHOLDER}: ${E2E_PRESENT_EXPRESSION} ? '${updatesEnabledValue(true)}' : '${updatesEnabledValue(false)}']`;
  const expectedDebuggableLine = `debuggable ${E2E_PRESENT_EXPRESSION}`;
  assert.ok(E2E_PRESENT_EXPRESSION.includes(`'${E2E_PROPERTY}'`), "the Gradle expression reads the e2e property");
  assert.ok(out.includes(expectedPlaceholderLine), "defaultConfig must set the placeholder from the e2e property");
  assert.ok(out.includes(expectedDebuggableLine), "the release build type must read debuggable from the e2e property");
  const releaseBlock = out.slice(out.search(/^[ \t]*release[ \t]*\{/m));
  assert.ok(releaseBlock.includes(expectedDebuggableLine));
  const debugBlock = out.slice(out.search(/^[ \t]*debug[ \t]*\{/m), out.search(/^[ \t]*release[ \t]*\{/m));
  assert.ok(!debugBlock.includes("debuggable"), "the debug build type is untouched");
  // The appended bundle-inputs block sits after the android block; the inserted-lines check runs on that part only.
  const androidPart = out.slice(0, out.indexOf(E2E_BUNDLE_INPUTS_MARKER));
  const outLines = androidPart.split("\n");
  const fixtureLines = FIXTURE_GRADLE.split("\n");
  let consumed = 0;
  for (const line of outLines) {
    if (line === fixtureLines[consumed]) consumed++;
  }
  assert.equal(consumed, fixtureLines.length, "every original line remains, in order: the transform only inserts");
  const inserted = outLines.filter((line) => !fixtureLines.includes(line));
  assert.deepEqual(inserted.map((line) => line.trim()), [expectedPlaceholderLine, expectedDebuggableLine]);
  assert.equal(withE2eBuildSettings(out), out, "the transform is idempotent");
});

test("prebuild: the bundle task gets the e2e flag as an input, appended once at the end of the file", () => {
  const out = withE2eBuildSettings(FIXTURE_GRADLE);
  assert.ok(out.includes(E2E_BUNDLE_INPUTS_MARKER), "the marker line is present");
  assert.equal(out.split(E2E_BUNDLE_INPUTS_MARKER).length - 1, 1, "the marker appears exactly once");
  const appended = out.slice(out.indexOf(E2E_BUNDLE_INPUTS_MARKER));
  assert.ok(appended.startsWith(`${E2E_BUNDLE_INPUTS_MARKER}\n`), "the marker is the first line of the appended block");
  assert.equal(appended, `${E2E_BUNDLE_INPUTS_MARKER}
tasks.configureEach { task ->
    if (task.name == 'createBundleReleaseJsAndAssets') {
        task.inputs.property('e2e', findProperty('e2e') != null)
        task.inputs.property('expoPublicE2e', System.getenv('EXPO_PUBLIC_E2E') ?: '')
    }
}
`, "the appended block wires both flag sources into the bundle task inputs");
  assert.ok(out.indexOf(E2E_BUNDLE_INPUTS_MARKER) > out.search(/^[ \t]*buildTypes[ \t]*\{/m), "the block is appended after the android block");
  assert.equal(withE2eBuildSettings(out), out, "the transform is idempotent: the block is added once");
  const signed = withE2eBuildSettings(FIXTURE_GRADLE_SIGNED);
  assert.equal(signed.split(E2E_BUNDLE_INPUTS_MARKER).length - 1, 1, "the signed-keystore shape gets the block too");
});

test("prebuild: with a signingConfigs.release before buildTypes, debuggable still lands in the build type's release", () => {
  const out = withE2eBuildSettings(FIXTURE_GRADLE_SIGNED);
  const expectedDebuggableLine = `debuggable ${E2E_PRESENT_EXPRESSION}`;
  const signingRegion = out.slice(out.search(/^[ \t]*signingConfigs[ \t]*\{/m), out.search(/^[ \t]*buildTypes[ \t]*\{/m));
  assert.ok(!signingRegion.includes("debuggable"), "signingConfigs.release must not gain a debuggable line");
  const buildTypesRegion = out.slice(out.search(/^[ \t]*buildTypes[ \t]*\{/m));
  assert.ok(buildTypesRegion.includes(expectedDebuggableLine), "the release build type must read debuggable from the e2e property");
  const releaseInBuildTypes = buildTypesRegion.slice(buildTypesRegion.search(/^[ \t]*release[ \t]*\{/m));
  assert.ok(releaseInBuildTypes.includes(expectedDebuggableLine), "the line sits inside buildTypes.release");
  assert.ok(out.includes(`manifestPlaceholders = [${UPDATES_ENABLED_PLACEHOLDER}: ${E2E_PRESENT_EXPRESSION} ? '${updatesEnabledValue(true)}' : '${updatesEnabledValue(false)}']`),
    "defaultConfig still gets the placeholder line");
  assert.equal(withE2eBuildSettings(out), out, "the transform is idempotent");
});

test("build with -Pe2e: Expo Updates is off and the release build is debuggable", () => {
  const manifest = resolveUpdatesEnabledPlaceholder(withUpdatesEnabledPlaceholder(FIXTURE_MANIFEST), true);
  assert.ok(
    manifest.includes(`<meta-data android:name="${UPDATES_ENABLED_META_NAME}" android:value="false"/>`),
    "the -Pe2e build resolves the placeholder to false",
  );
  assert.equal(updatesEnabledValue(true), "false");
  assert.equal(releaseDebuggable(true), true, "the -Pe2e release build is debuggable");
  assert.ok(withE2eBuildSettings(FIXTURE_GRADLE).includes(`debuggable ${E2E_PRESENT_EXPRESSION}`));
});

test("build without -Pe2e: both settings equal today's release build", () => {
  const manifest = resolveUpdatesEnabledPlaceholder(withUpdatesEnabledPlaceholder(FIXTURE_MANIFEST), false);
  assert.equal(manifest, FIXTURE_MANIFEST, "the resolved manifest equals the unchanged input");
  assert.equal(updatesEnabledValue(false), "true");
  assert.equal(releaseDebuggable(false), false);
  const releaseBlock = FIXTURE_GRADLE.slice(FIXTURE_GRADLE.search(/^[ \t]*release[ \t]*\{/m));
  assert.ok(!/^[ \t]*debuggable\b/m.test(releaseBlock), "today's release build has no debuggable line, i.e. false");
});

// Independent oracle: the property name and the Gradle expression are written out as literals here,
// so a renamed constant in the transforms module fails this test instead of moving with the code.
test("oracle: the runner passes -Pe2e and the generated Gradle carries the literal expressions", () => {
  assert.ok(gradleArgs().includes("-Pe2e"), "the runner's Gradle arguments pass the e2e property as -Pe2e");
  assert.ok(gradleArgs().includes(`-P${E2E_PROPERTY}`), "gradleArgs uses the transforms module's property name");
  const out = withE2eBuildSettings(FIXTURE_GRADLE);
  assert.ok(out.includes("debuggable findProperty('e2e') != null"), "literal: the release build type's debuggable expression");
  assert.ok(
    out.includes("manifestPlaceholders = [expoUpdatesEnabled: findProperty('e2e') != null ? 'false' : 'true']"),
    "literal: the defaultConfig placeholder expression",
  );
});
