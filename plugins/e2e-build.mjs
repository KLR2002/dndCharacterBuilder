import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import configPlugins from "@expo/config-plugins";
import { withE2eBuildSettings, withUpdatesEnabledPlaceholder } from "./lib/e2e-build-transforms.mjs";

const { createRunOncePlugin, withFinalizedMod } = configPlugins;

// The android finalized mod runs after every other mod, including expo-updates' manifest mod,
// so the placeholder is written once the Updates flag already sits in the generated manifest.
const withE2eBuild = (config) =>
  withFinalizedMod(config, [
    "android",
    (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const manifestPath = join(root, "app", "src", "main", "AndroidManifest.xml");
      writeFileSync(manifestPath, withUpdatesEnabledPlaceholder(readFileSync(manifestPath, "utf8")));
      const gradlePath = join(root, "app", "build.gradle");
      writeFileSync(gradlePath, withE2eBuildSettings(readFileSync(gradlePath, "utf8")));
      return cfg;
    },
  ]);

export default createRunOncePlugin(withE2eBuild, "e2e-build", "1.0.0");
