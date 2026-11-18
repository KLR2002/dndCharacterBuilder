import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import configPlugins from "@expo/config-plugins";
import { withE2eBuildSettings } from "./lib/e2e-build-transforms.mjs";

const { createRunOncePlugin, withFinalizedMod } = configPlugins;

const withE2eBuild = (config) =>
  withFinalizedMod(config, [
    "android",
    (cfg) => {
      const gradlePath = join(cfg.modRequest.platformProjectRoot, "app", "build.gradle");
      writeFileSync(gradlePath, withE2eBuildSettings(readFileSync(gradlePath, "utf8")));
      return cfg;
    },
  ]);

export default createRunOncePlugin(withE2eBuild, "e2e-build", "1.0.0");
