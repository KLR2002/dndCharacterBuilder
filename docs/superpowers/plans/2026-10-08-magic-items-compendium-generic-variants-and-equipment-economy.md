# Specification: Magic Items Compendium, Generic Variants & Equipment Economy

## Problem Statement

When players build and play characters in the 2014 ruleset, managing equipment and magic items exhibits four major flaws:
1. Standard generic magic items such as `+1, +2, +3 weapons`, `+1, +2, +3 armor`, and core items like `Weapon of Warning` cannot be found in the Compendium, even when official sourcebooks like the *Dungeon Master's Guide (DMG)* are enabled.
2. In the item library browser, category filters for *Rod*, *Wand*, *Scroll*, and *Ring* display empty screens despite matching items existing in the catalog under manual text search.
3. Equipping magical weapons, armor, or shields does not automatically modify attack rolls, damage formulas, or Armor Class on the character sheet, forcing players to manually compute math or leave their combat values inaccurate.
4. The character sheet lacks attunement tracking, permitting unlimited magical items or failing to communicate which items are actively attuned according to the 2014 RAW 3-item limit.
5. Players can accidentally select magic items as targets for Artificer infusions, violating the 2014 rule requiring infusions to target nonmagical mundane objects.

---

## Solution

Build a robust, end-to-end Magic Items Compendium and Equipment Economy:
1. Expand the ingestion pipeline in `dnd5eToolsScrap` to ingest `magicvariants.json` and generate pre-expanded concrete items (e.g. `Longsword, +1`, `Dagger of Warning`, `Shield, +1`, `Plate Armor, +1`) for all standard 2014 weapons and armors alongside canonical generic templates (`Weapon, +1`, etc.).
2. Cleanly normalize 5eTools type codes at ingestion by stripping source suffixes (`WD|DMG` $\to$ `WD`, `SC|DMG` $\to$ `SC`, `RD|DMG` $\to$ `RD`) and mapping to canonical `itemCategory` and human-readable `type`. Align compendium filter pills to `itemCategory`, fixing empty category views.
3. Automatically propagate item enhancement bonuses (`bonusWeapon` and `bonusAc`) into the combat attack ledger and Armor Class calculation engine with transparent calculation badges (`[Item +1]`, `+ 1 (Magic Item)`).
4. Introduce a first-class Attunement Ledger tracking `attunement` and `isAttuned` on inventory items with a prominent `Attuned: X / 3` indicator, 1-tap toggling, an interactive replacement prompt when exceeding 3 items, and strict mechanical gating so magical benefits require active attunement.
5. Enforce Artificer infusion exclusivity by restricting infusion targeting to nonmagical mundane items (`rarity: "None"` and no inherent magic bonuses).

---

## User Stories

1. As a player browsing the item compendium, I want to search for "+1" or "Longsword +1", so that I can immediately add a +1 Longsword with correct 1d8 slashing damage, versatile property, and 3 lb weight to my inventory.
2. As a player searching for "Warning" in the compendium, I want to find "Weapon of Warning" and specific variants (like "Dagger of Warning"), so that I can equip them and track their magical properties.
3. As a player with the Dungeon Master's Guide enabled, I want all DMG magic weapons and armors (+1, +2, +3, Vicious, Adamantine, Mithral) to appear in compendium searches, so that my character can carry official magic gear.
4. As a player tapping the "Wand" category filter pill in the compendium, I want to see all wands (such as Wand of Magic Detection, Wand of the War Mage), so that the category screen is never falsely empty.
5. As a player tapping the "Rod" category filter pill, I want to see all rods (such as Rod of the Pact Keeper), so that I can browse rod options without relying on text search.
6. As a player tapping the "Scroll" category filter pill, I want to see all spell scrolls and protection scrolls, so that I can quickly stock my consumable inventory.
7. As a player tapping the "Ring" category filter pill, I want to see all magical rings (such as Ring of Protection, Ring of Free Action), so that I can browse ring choices effortlessly.
8. As a player equipping a +1 Longsword in my inventory, I want my Actions tab attack rolls and damage formulas to automatically increase by +1, so that my attack math is always accurate.
9. As a player inspecting an attack card for a +2 weapon, I want to see an `[Item +2]` calculation badge, so that I can see the exact breakdown of my to-hit and damage bonuses.
10. As a player equipping a +1 Shield or +1 Armor, I want my total Armor Class on the Stats and Features tabs to automatically include the +1 enhancement bonus, so that my defense reflects my magical protection.
11. As a player viewing my inventory, I want to see an `Attuned: X / 3` counter at the top of the screen, so that I always know how many attunement slots my character has remaining.
12. As a player inspecting an item requiring attunement (like Ring of Protection), I want an "Attune" button on the item card, so that I can attune to it during a Short Rest.
13. As a player whose character is already attuned to 3 items, I want a replacement prompt when I try to attune a 4th item, so that I am prevented from exceeding the RAW limit while easily choosing which item to unattune.
14. As a player equipping an unattuned magic item that requires attunement, I want its magical bonuses to remain inactive and show an `[Unattuned]` badge, so that I do not receive benefits my character has not bonded with.
15. As an Artificer selecting an item to infuse with Enhanced Weapon or Enhanced Defense, I want the selection list to display only nonmagical mundane items, so that I cannot illegally stack infusions onto existing magic items.
16. As a player toggling off sourcebooks in Settings, I want items from disabled books to be filtered out of the compendium, so that our campaign's allowed content is respected.
17. As a player creating a custom homebrew item, I want to specify an attack/damage bonus or AC bonus, so that custom magic items enjoy the same automatic combat math as compendium items.
18. As a developer running verification offline, I want the item scraper to fall back to a high-fidelity local dataset when network is unavailable, so that tests and builds never fail due to network restrictions.

---

## Implementation Decisions

### Ingestion Pipeline & Scraper Engine
- Ingest `data/magicvariants.json` from 5eTools alongside `items-base.json` and `items.json`.
- Provide an offline fallback fixture for magic variants so the scraper executes deterministically offline.
- Cross-product standard 2014 PHB base weapons (37) and armors/shields (13) with primary DMG generic templates (`+1`, `+2`, `+3`, `Weapon of Warning`, `Vicious Weapon`, `Adamantine Armor`, `Mithral Armor`).
- Inherit base item stats (damage dice, damage type, range, weight, properties, base AC, strength requirement, stealth disadvantage) and apply variant modifiers (rarity, enhancement bonus, attunement text, description entries).
- Retain canonical generic templates (`Weapon, +1`, `Weapon of Warning`, `Armor, +1`) in the catalog for exotic and custom base weapons.

### Canonical Type and Category Normalization
- Strip pipe source suffixes from raw type codes (e.g. `WD|DMG` $\to$ `WD`, `SC|DMG` $\to$ `SC`, `RD|DMG` $\to$ `RD`, `RG|DMG` $\to$ `RG`).
- Map codes to canonical category and type values:
  - `WD` $\to$ `type: "Wand"`, `itemCategory: "Wand"`
  - `RD` $\to$ `type: "Rod"`, `itemCategory: "Rod"`
  - `SC` $\to$ `type: "Scroll"`, `itemCategory: "Scroll"`
  - `RG` $\to$ `type: "Ring"`, `itemCategory: "Ring"`
  - `P` $\to$ `type: "Potion"`, `itemCategory: "Potion"`
  - `W` $\to$ `type: "Wondrous Item"`, `itemCategory: "Wondrous Item"`
  - `M` / `R` $\to$ `type: "Melee Weapon" / "Ranged Weapon"`, `itemCategory: "Weapon"`
  - `LA` / `MA` / `HA` $\to$ `type: "Light/Medium/Heavy Armor"`, `itemCategory: "Armor"`
  - `S` $\to$ `type: "Shield"`, `itemCategory: "Shield"`
  - `G` / `SCF` / `A` $\to$ `type: "Adventuring Gear"`, `itemCategory: "Adventuring Gear"`
  - `T` / `AT` / `GS` / `INS` $\to$ `type: "Tool"`, `itemCategory: "Tool"`
- Update horizontal filter pills in the compendium picker to match canonical `itemCategory` directly.

### Data Model Enhancements
- On item data models and character inventory items:
  - `attunement?: boolean | string` (attunement requirement text, e.g. `"requires attunement by a spellcaster"`)
  - `isAttuned?: boolean` (active player attunement state)
  - `rarity?: string` (`"Common"`, `"Uncommon"`, `"Rare"`, `"Very Rare"`, `"Legendary"`, `"Artifact"`, `"None"`)
  - `bonusWeapon?: number` (enhancement bonus to attack and damage rolls)
  - `bonusAc?: number` (enhancement bonus to Armor Class)
  - `itemCategory?: string` (canonical category)

### Combat Economy Engine
- In weapon attack resolution (`attacks.ts` and `tacticalActions.ts`):
  - Check if equipped weapon has `bonusWeapon`.
  - If the weapon requires attunement, verify `isAttuned === true`.
  - Add `bonusWeapon` to to-hit attack bonus and damage formula, rendering with an `[Item +X]` badge.
- In Armor Class calculation (`ac.ts`):
  - Check equipped armor and shield for `bonusAc`.
  - If the armor/shield requires attunement, verify `isAttuned === true`.
  - Add `bonusAc` to the final AC and include `+ X (Magic Item)` in the breakdown string.
- If an item requires attunement and is equipped without being attuned, magical bonuses are withheld and the attack/armor card displays an `[Unattuned]` badge.

### Attunement Ledger & UI
- Render an `Attuned: X / 3` indicator in the inventory header.
- Provide an attune/unattune button on item rows that have `attunement`.
- Enforce the 3-item limit: if attempting to attune when `attunedCount >= 3`, present a modal allowing the player to select which existing item to unattune or cancel.
- Preserve attunement across rests, and include attunement management reminders in the Short Rest modal.

### Artificer Infusion Validation
- In the Active Infusions modal and assignment helper, filter available base target items to those with `rarity === "None"` (or undefined) and no inherent magic bonus (`!bonusWeapon && !bonusAc`).

---

## Testing Decisions

- **Good Tests Principle**: Test external behavior and mathematical invariants rather than internal scraper loops or private UI states.
- **Scraper Ingestion Tests** (`checks/itemsScraper.test.ts`):
  - Verify pipe-separated types like `WD|DMG`, `RD|DMG`, `SC|DMG` normalize to canonical types and `itemCategory`.
  - Verify `magicvariants.json` ingestion generates concrete variants (e.g. `Longsword, +1`, `Dagger of Warning`, `Plate Armor, +1`, `Shield, +1`) with proper stats, weight, and properties.
  - Verify generic templates (`Weapon, +1`, `Weapon of Warning`) remain present.
- **Combat Math & Attunement Tests** (`checks/magicItemsCombat.test.ts`):
  - Equipping `Longsword, +1` adds +1 to attack roll and damage with `[Item +1]` badge.
  - Equipping `+2 Shield` or `Plate Armor, +1` adds correct bonus to AC and breakdown.
  - Equipping an item requiring attunement without attuning it withholds bonuses.
  - Attuning the item activates the bonus.
  - Attempting to attune 4 items enforces the 3-item cap.
  - Artificer infusions reject magic items.
- **Prior Art**: Follows patterns established in `checks/fightingStyles.test.ts`, `checks/artificerInfusions.test.ts`, and `checks/tacticalActions.test.ts`.

---

## Out of Scope

- Automatic spell slot charges for wands/staves (charges can be tracked using custom counters for now).
- Automatic activation of complex conditional curses or legendary artifact sentient properties.
- Full automation of weapon-specific spells (e.g. casting Sun Blade sunlight or Holy Avenger spell resistance aura).

---

## Further Notes

- The scraper offline fallback ensures complete testability in sandboxed environments without requiring network access.
- All naming conventions match the official 2014 DMG tables and 5eTools catalog standards.
