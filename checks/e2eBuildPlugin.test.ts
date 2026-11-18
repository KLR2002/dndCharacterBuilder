import test from "node:test";
import assert from "node:assert/strict";
import {
  E2E_BUNDLE_INPUTS_MARKER,
  E2E_PRESENT_EXPRESSION,
  E2E_PROPERTY,
  releaseDebuggable,
  withE2eBuildSettings,
} from "../plugins/lib/e2e-build-transforms.mjs";
import * as transforms from "../plugins/lib/e2e-build-transforms.mjs";
import { gradleArgs } from "../scripts/lib/android-runner.mjs";

// The config plugin (plugins/e2e-build.mjs) applies the pure transforms below to the generated
// app/build.gradle at prebuild time. The Gradle property `-Pe2e` is only known at build time, so
// the generated file carries a Gradle expression; these tests drive the transform with a fixture
// string shaped like the generated app/build.gradle.

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

/** Index just past the brace that closes the block opened at or after `start`. */
function braceEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = text.indexOf("{", start); i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i + 1;
  }
  throw new Error("unbalanced braces");
}

test("prebuild: app/build.gradle wires debuggable to the -Pe2e property and sets no manifest placeholder", () => {
  const out = withE2eBuildSettings(FIXTURE_GRADLE);
  const expectedDebuggableLine = `debuggable ${E2E_PRESENT_EXPRESSION}`;
  assert.ok(E2E_PRESENT_EXPRESSION.includes(`'${E2E_PROPERTY}'`), "the Gradle expression reads the e2e property");
  assert.ok(out.includes(expectedDebuggableLine), "the release build type must read debuggable from the e2e property");
  assert.ok(!out.includes("manifestPlaceholders"), "no manifest placeholder line is written");
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
  assert.deepEqual(inserted.map((line) => line.trim()), [
    "dependenciesInfo {",
    "includeInApk = false",
    "includeInBundle = false",
    expectedDebuggableLine,
  ]);
  assert.equal(withE2eBuildSettings(out), out, "the transform is idempotent");
});

test("prebuild: the manifest transform is gone from the transforms module", () => {
  assert.equal("withUpdatesEnabledPlaceholder" in transforms, false);
  assert.equal("resolveUpdatesEnabledPlaceholder" in transforms, false);
  assert.equal("updatesEnabledValue" in transforms, false);
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
  assert.equal(withE2eBuildSettings(out), out, "the transform is idempotent");
});

test("prebuild: the fdroid property changes nothing in the generated Gradle", () => {
  const out = withE2eBuildSettings(FIXTURE_GRADLE);
  assert.ok(!out.includes("fdroid"), "no line reads the fdroid property");
  assert.equal(releaseDebuggable(false), false);
});

test("prebuild: dependenciesInfo opts out of the APK and bundle dependency metadata, once, inside android", () => {
  const out = withE2eBuildSettings(FIXTURE_GRADLE);
  const block = [
    "dependenciesInfo {",
    "        includeInApk = false",
    "        includeInBundle = false",
    "    }",
  ].join("\n");
  assert.equal(out.split("dependenciesInfo {").length - 1, 1, "the block appears exactly once");
  assert.ok(out.includes(block), "the block carries both opt-outs at the Groovy indentation");
  const androidStart = out.search(/^android[ \t]*\{/m);
  const androidEnd = braceEnd(out, androidStart);
  const at = out.indexOf("dependenciesInfo {");
  assert.ok(at > androidStart && at < androidEnd, "the block sits inside the top-level android block");
  assert.equal(withE2eBuildSettings(out), out, "re-prebuild leaves the file unchanged");
  assert.equal(withE2eBuildSettings(withE2eBuildSettings(FIXTURE_GRADLE)).split("dependenciesInfo {").length - 1, 1, "two applications insert it once");
});

test("prebuild: a build.gradle without a top-level android block fails loudly", () => {
  const noAndroid = FIXTURE_GRADLE.replace(/^android \{/m, "allprojects {");
  assert.throws(() => withE2eBuildSettings(noAndroid), /android/);
});

test("build with -Pe2e: the release build is debuggable", () => {
  assert.equal(releaseDebuggable(true), true, "the -Pe2e release build is debuggable");
  assert.ok(withE2eBuildSettings(FIXTURE_GRADLE).includes(`debuggable ${E2E_PRESENT_EXPRESSION}`));
});

test("build without -Pe2e: today's release build has no debuggable line", () => {
  assert.equal(releaseDebuggable(false), false);
  const releaseBlock = FIXTURE_GRADLE.slice(FIXTURE_GRADLE.search(/^[ \t]*release[ \t]*\{/m));
  assert.ok(!/^[ \t]*debuggable\b/m.test(releaseBlock), "today's release build has no debuggable line, i.e. false");
});

// Independent oracle: the property name and the Gradle expression are written out as literals here,
// so a renamed constant in the transforms module fails this test instead of moving with the code.
test("oracle: the runner passes -Pe2e and the generated Gradle carries the literal expression", () => {
  assert.ok(gradleArgs().includes("-Pe2e"), "the runner's Gradle arguments pass the e2e property as -Pe2e");
  assert.ok(gradleArgs().includes(`-P${E2E_PROPERTY}`), "gradleArgs uses the transforms module's property name");
  const out = withE2eBuildSettings(FIXTURE_GRADLE);
  assert.ok(out.includes("debuggable findProperty('e2e') != null"), "literal: the release build type's debuggable expression");
  assert.ok(!out.includes("manifestPlaceholders"), "literal: no manifest placeholder in the generated Gradle");
});
