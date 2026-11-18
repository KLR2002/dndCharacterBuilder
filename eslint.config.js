// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@expo/vector-icons",
          message: "Import the icon set's own entry point, e.g. @expo/vector-icons/Ionicons. The bare path bundles every icon font.",
        }],
      }],
    },
  },
]);
