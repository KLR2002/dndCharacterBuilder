# 01: Import only the Ionicons font

**What to build:** 35 files under `src/` import `{ Ionicons } from "@expo/vector-icons"`. That entry point references every icon set, so Metro bundles all 19 icon fonts (2.6 MB in the APK) although only Ionicons is drawn. Change every import to the per-set entry point, `import Ionicons from "@expo/vector-icons/Ionicons"` (check the default export and the `glyphMap` typing with `npm run typecheck`; `React.ComponentProps<typeof Ionicons>["name"]` and `keyof typeof Ionicons.glyphMap` uses must keep compiling). Add an ESLint `no-restricted-imports` rule in `eslint.config.js` that forbids the bare `@expo/vector-icons` path (message: import the icon set's own entry point, e.g. `@expo/vector-icons/Ionicons`), so a new file cannot bring the other fonts back.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** 9b3b694. Lint rule red then green; check:all passed. The export ships Ionicons, Source Serif and MaterialSymbols_400Regular.ttf (967 KB): expo-router 57 depends on expo-symbols, whose Android icon converter imports it. Left in place.

- [x] `grep -rn 'from "@expo/vector-icons"' src` lists nothing.
- [x] The lint rule fails on a bare import: show it failing on one file before the import is changed (paste the output).
- [ ] `npx expo export --platform android --output-dir <scratch dir>` lists exactly one icon font among the exported assets (`Ionicons.ttf`) besides the Source Serif font; paste the asset list. Delete the export afterwards.
- [x] `npm run check:all` passes.
