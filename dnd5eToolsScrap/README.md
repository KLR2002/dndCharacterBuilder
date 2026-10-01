# 5e.tools Data Scraper & Converter (TypeScript)

A modular TypeScript scraper and converter for **https://2014.5e.tools/**. It extracts player-focused content directly from the official 2014 site and converts it into convenient, clean, and well-structured JSON format files.

## 🎯 Features

- **Direct Site Scraping**: Connects directly to `https://2014.5e.tools/` with HTTP/2 and standard browser headers (fully compatible with Cloudflare protection without depending on external mirrors).
- **Player Content Focused**:
  - 🧝 **Races**: 130+ base races with all 90+ subraces nested, speed types, ability score increases, darkvision, languages, and traits.
  - ⚔️ **Classes**: All 15 classes (Wizard, Fighter, Rogue, Artificer, etc.) with hit dice, proficiencies, spellcasting progression, level 1-20 features, and all subclasses + archetype features.
  - 🎖️ **Feats**: 100+ feats with parsed prerequisites, ability bonuses, and full benefit descriptions.
  - 🔮 **Options & Features**: Eldritch Invocations, Metamagic, Fighting Styles, Maneuvers, Infusions, Runes, and Character Options (Dark Gifts, Supernatural Gifts).
  - 📜 **Backgrounds**: 100+ backgrounds with skill proficiencies, tools, languages, starting equipment, special background features, and personality tables.
  - 🎒 **Items**: 1,700+ mundane and magic items (weapons, armor, potions, rings, wondrous items) with human-readable categories, rarities, attunement requirements, damage, AC, cost, and weight.
  - ✨ **Spells**: All spells across all official books (PHB, XGE, TCE, etc.) unified with full school names, casting times, ranges, components, duration, concentration, ritual tags, and linked class/subclass lists.
- **Convenient JSON Format**:
  - **Tag Resolution**: Cleans internal 5e.tools tags (`{@spell fireball}`, `{@damage 1d6}`, `{@dc 15}`, `{@filter ...}`) into clean, readable text.
  - **Markdown Descriptions**: Converts complex nested AST entry structures into formatted GitHub-flavored Markdown (preserving tables, lists, blockquotes, and headings).
  - **Inheritance Resolution**: Automatically merges `_copy` and `_mod` patches so variant entries inherit parent stats and text.
  - **Dual Structure**: Contains both human-friendly formatted fields (`description`, `traits`, `features`) and the original `rawEntries` for applications that want to perform custom AST rendering.
- **Local Smart Caching**: Downloads are cached in `.cache/` to minimize network traffic and enable instant rebuilds.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended, tested on Node v24)
- `curl` (standard on Linux/macOS)

### Installation
```bash
npm install
```

### Build TypeScript
```bash
npm run build
```

---

## 💻 Usage

### Scrape All Categories
```bash
npm run scrape
```

### Scrape Specific Categories
```bash
# Individual npm shortcuts:
npm run scrape:races
npm run scrape:classes
npm run scrape:feats
npm run scrape:options
npm run scrape:backgrounds
npm run scrape:items
npm run scrape:spells

# Or use CLI flags directly:
npx tsx src/index.ts --only races,classes,spells
```

### CLI Options
| Flag | Description | Default |
|------|-------------|---------|
| `--only <categories>` | Comma-separated list of categories (`races`, `classes`, `feats`, `options`, `backgrounds`, `items`, `spells`) | All |
| `--no-cache` | Force re-downloading from the site, ignoring `.cache/` | `false` |
| `--output <dir>` | Destination folder for JSON output | `./data` |
| `--help, -h` | Display help message | |

---

## 📁 Output Structure

The generated files are saved to `./data/`:

| File | Items | Description |
|------|-------|-------------|
| [`races.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/races.json) | ~134 | Races with nested subraces, speeds, ability bonuses, darkvision, languages |
| [`classes.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/classes.json) | 15 | Classes with hit dice, proficiencies, features (levels 1-20), and all subclasses |
| [`feats.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/feats.json) | ~108 | Feats with formatted prerequisites and ability bonuses |
| [`options_and_features.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/options_and_features.json) | ~195 | Invocations, Metamagic, Fighting Styles, Maneuvers, Infusions, Gifts |
| [`backgrounds.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/backgrounds.json) | ~101 | Backgrounds with skills, equipment, feature, and personality tables |
| [`items.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/items.json) | ~1,700+ | Weapons, armor, gear, magic items with stats and costs |
| [`spells.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/spells.json) | ~500+ | Unified spells with schools, casting time, range, components, and class lists |
| [`summary.json`](file:///home/krzysztof/Dokumenty/Projects/dnd5eToolsScrap/data/summary.json) | 1 | Metadata summary with counts, timestamp, and file sizes |

---

## 🛠️ Project Architecture

```text
dnd5eToolsScrap/
├── package.json               # Scripts & dependencies
├── tsconfig.json              # Strict TypeScript ESM configuration
├── README.md                  # Documentation
├── src/
│   ├── config.ts              # Scraper configuration & endpoints
│   ├── client.ts              # HTTP fetcher with rate limiting & caching
│   ├── index.ts               # Main CLI runner
│   ├── parser/
│   │   ├── tag-cleaner.ts     # Strips & renders {@spell ...} tags
│   │   ├── entry-renderer.ts  # Converts 5e.tools AST to Markdown tables/lists
│   │   └── copy-resolver.ts   # Resolves _copy inheritance and _mod patches
│   ├── scrapers/
│   │   ├── races.ts           # Race & Subrace extraction
│   │   ├── classes.ts         # Class, Subclass & Feature extraction
│   │   ├── feats.ts           # Feats & prerequisites extraction
│   │   ├── options.ts         # Options & Features (invocations, metamagic)
│   │   ├── backgrounds.ts     # Backgrounds & characteristics tables
│   │   ├── items.ts           # Equipment, weapons, armor & magic items
│   │   └── spells.ts          # Unified spells with class associations
│   └── types/
│       └── models.ts          # Strong TypeScript interfaces for output models
└── data/                      # Output directory containing clean JSON files
```

---

## 📄 License
MIT License. D&D 5e content is subject to Wizards of the Coast SRD / OGL rules.
