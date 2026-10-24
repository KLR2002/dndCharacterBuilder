# D&D 5e Character Builder

A character builder and sheet for **Dungeons & Dragons 5th Edition (2014 rules)**. It runs on Android and the web, and character data stays on your device.

**Try it:** [Web version](https://characterbuilder5e.expo.app/)

**Download:** [Android APK (GitHub Releases)](https://github.com/KLR2002/dndCharacterBuilder/releases)

## Features

- Build a character step by step: race, class, background, ability scores, skills, and starting equipment.
- Character sheet with tabs for Builder, Stats, Actions, Spells, Features, Inventory and Journal.
- Calculated armor class, attacks, proficiencies, spell slots and level-up progression.
- Ships with the SRD rules. You can also sync a larger catalog from inside the app. That sync needs an internet connection.

## Build from source

Requirements: Node.js 24+ and npm. For Android builds you also need JDK 17 and the Android SDK.

```bash
git clone https://github.com/KLR2002/dndCharacterBuilder.git
cd dndCharacterBuilder
npm install
```

### Run it

```bash
npm run web       # web version in the browser
npm run android   # Android device or emulator (needs the Android SDK)
```

### Build an APK locally
setup ANDROID_HOME variable
```bash
# EAS unpacks the project in /tmp by default, which can be a small RAM disk.
# The native build needs several GB, so use a directory on disk instead.
export EAS_LOCAL_BUILD_WORKINGDIR=$HOME/.cache/eas-local-build
mkdir -p "$EAS_LOCAL_BUILD_WORKINGDIR"

npx eas-cli build --platform android --profile preview --local --output app.apk
```

This needs an Expo account (`npx eas-cli login`). Expect several minutes on the first run.

### Static web build

```bash
npx expo export --platform web   # output goes to dist/
```

## Checks

```bash
npm run check:all     # lint, type checks and tests
npm run layout:check  # UI layout check in a browser (first run: npx playwright install chromium)
```

## Project layout

- `src/rules/`: game rules (proficiencies, spells, armor class, equipment).
- `src/components/`: UI. Character tabs are in `tabs/` and builder steps in `builder/`.
- `src/data/`: bundled SRD data.
- `dnd5eToolsScrap/`: scraper that builds the expanded catalog.
- `docs/`: architecture decisions and contributor notes.

## Disclaimer

## Legal disclaimer

Dungeons & Dragons, D&D and all related names, rules and content are the property of Wizards of the Coast LLC. This is an unofficial, fan-made project. It is not affiliated with, endorsed by or sponsored by Wizards of the Coast.

The app is meant only as a reference and helper for sourcebooks you already own. It does not replace them, and you should have legal access to any material you use with it. Content beyond the SRD is not included in the app. It comes from third-party data that you choose to sync yourself.

I make no money from this app. It is free, has no ads or paid features, and I receive no financial benefit from it.


Unofficial fan project, not affiliated with Wizards of the Coast. Game content beyond the SRD comes from third-party data the user syncs themselves.
