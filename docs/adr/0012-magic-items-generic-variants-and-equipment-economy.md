# 0012: Magic Items Compendium, Generic Variants & Equipment Economy

## Context

Managing equipment and magic items in the 2014 Fifth Edition character sheet revealed several structural gaps across the ingestion pipeline, inventory compendium, and combat mechanics:

1. **Missing Generic Magic Variants (+1/+2/+3, Weapon of Warning, etc.)**:
   In 5eTools data architecture, generic magic items (such as `Weapon, +1`, `Weapon, +2`, `Weapon, +3`, `Weapon of Warning`, `Armor, +1`, `Adamantine Armor`) are maintained in a dedicated file, `data/magicvariants.json`, as inheritance templates rather than flat items in `items.json`. The scraper previously ingested only `items-base.json` and `items.json`, completely omitting generic magic variants. As a result, players activating the *Dungeon Master's Guide (DMG)* could not find `+1 weapons` or `Weapon of Warning` in the compendium.

2. **Broken Category Filtering for Rods, Wands, Scrolls, and Rings**:
   5eTools item type codes include source suffixes for many magic items (e.g., `WD|DMG` for Wand, `RD|DMG` for Rod, `SC|DMG` for Scroll, `RG|DMG` for Ring). The scraper performed exact matches against bare codes like `"WD"` or `"RD"`, causing items with suffixes to fall through to `type: "WD|DMG"` and `itemCategory: "Item"`. In `InventoryTab.tsx`, filter pills checked substrings on `type` (e.g., `"Wand"`), resulting in 0 matches and completely empty category screens.

3. **Missing Combat Economy Integration for Equipped Magic Items**:
   When a player equipped a `+1 Longsword` or `+2 Shield`, the attack ledger (`attacks.ts` / `tacticalActions.ts`) and Armor Class calculation (`ac.ts`) did not parse or apply the item's magical enhancement bonuses to attack rolls, damage formulas, or AC.

4. **Absence of Attunement Tracking & 3-Slot Limit Enforcement**:
   Per 2014 RAW (PHB p. 138), a character can be attuned to at most three magic items simultaneously, and an item requiring attunement confers its magical benefits only while attuned. The data model lacked attunement tracking, attunement cap enforcement, and attunement-gated magical property checks.

5. **Artificer Infusion Mundane Targeting Invariant**:
   Per 2014 RAW, Artificer infusions (*Enhanced Weapon*, *Enhanced Defense*, etc.) can target only nonmagical mundane objects. The inventory lacked validation to prevent infusing already-magical items.

---

## Decision

1. **Ingest `magicvariants.json` and Pre-expand Standard PHB Equipment Combinations**:
   - Update `dnd5eToolsScrap/src/scrapers/items.ts` to ingest `data/magicvariants.json`.
   - Cross-product standard 2014 PHB weapons (37 weapons) and armors/shield (12 armors + Shield) with core DMG variants (`+1`, `+2`, `+3`, `Weapon of Warning`, `Vicious Weapon`, `Adamantine Armor`, `Mithral Armor`).
   - Generate concrete, search-friendly catalog entries (e.g., `Longsword, +1`, `Dagger of Warning`, `Vicious Shortsword`, `Shield, +1`, `Plate Armor, +1`) with base damage, properties, and weight fully pre-populated, while preserving the generic templates (`Weapon, +1`, `Weapon of Warning`, etc.) for custom weapons.
   - Maintain a bundled offline fallback / cache in `dnd5eToolsScrap` to guarantee fully reproducible offline builds.

2. **Ingestion Normalization & Aligned Compendium Filter Pills**:
   - In `dnd5eToolsScrap/src/scrapers/items.ts`, strip source suffixes from type codes (e.g., `WD|DMG` $\to$ `WD`, `SC|DMG` $\to$ `SC`).
   - Map normalized codes to canonical `itemCategory` and human-readable `type` (`Weapon`, `Armor`, `Shield`, `Potion`, `Ring`, `Rod`, `Wand`, `Scroll`, `Wondrous Item`, `Adventuring Gear`, `Tool`).
   - In `InventoryTab.tsx`, update the horizontal category filter pills to match canonical `itemCategory` directly, fixing all empty category views.

3. **Automatic Combat Economy Propagation & Calculation Badges**:
   - Store `bonusWeapon?: number` and `bonusAc?: number` on `ItemModel` and `InventoryItem`.
   - In `attacks.ts` and `tacticalActions.ts`, equipped weapons add `bonusWeapon` to attack bonus and damage formula, tagged with an `[Item +X]` badge.
   - In `ac.ts`, equipped armor and shields add `bonusAc` to AC, tagged with `+ X (Magic Item)` in the calculation breakdown.

4. **First-Class Attunement Ledger & 3-Slot RAW Limit**:
   - Add `attunement?: boolean | string` (requirement description) and `isAttuned?: boolean` to `InventoryItem`.
   - In `InventoryTab.tsx`, display an `Attuned: X / 3` indicator in the inventory header with a 1-tap attune/unattune toggle on eligible items.
   - Strict RAW Gating: Magic bonuses from items requiring attunement apply only when `isEquipped === true` and `isAttuned === true`. Unattuned items display an `[Unattuned]` badge.
   - If a player attempts to attune a 4th item while at 3/3, render a modal/alert prompting them to choose an existing attuned item to replace or cancel.

5. **Artificer Infusion Mundane Object Exclusivity**:
   - Restrict Artificer active infusion targeting to mundane items (`rarity: "None"` and no inherent magic bonus), enforcing RAW non-stacking.

---

## Consequences

- Compendium searches for `Longsword +1`, `Dagger of Warning`, `Shield +2`, etc., immediately yield complete, ready-to-use items with exact 2014 statistics.
- Rods, Wands, Scrolls, and Rings filter reliably in the compendium without empty screens.
- Combat attacks and Armor Class automatically and accurately reflect equipped, attuned magic items with transparent calculation badges.
- Attunement slots are tracked and constrained to the 2014 RAW 3-item limit.
- Artificer infusions cannot be illegally stacked onto magic items.
- Offline and CI builds remain robust and reproducible.
