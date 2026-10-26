// Responsive layout check at phone widths. Visits every screen in SCREENS (the character tabs and the
// Builder subtabs, including the race picker for a character with no race, the background picker and the
// Custom Background creator for one with no background, home, settings, and the Rest, Conditions and New
// Character modals), the hit point modal (from the Stats HP number and the header HP badge), and the Active
// Wild Shape box (Stats tab, header badge, Features tab). The helpers that start the app and seed it are in
// scripts/lib/app-driver.mjs (see docs/agents/driving-the-app.md).
//
// Usage: `npm run layout:check` (not part of check:all). The script starts the Expo web server itself
// on the port in BASE, unless a server already answers there. `npm run layout:check -- --integrated`
// (or LAYOUT_INTEGRATED=1) seeds the integrated catalog instead of the SRD Baseline. The first run
// needs `npx playwright install chromium` once.
//
// Fails (one line per violation) on squeezed text and on elements that stick out of a non-scrolling
// parent. Env: BASE (default http://localhost:8099), WIDTHS (default "393,360,320,412"), ONLY (a comma-separated
// list of substrings: only the scenarios whose name contains one of them, ignoring case, are visited in every
// width; unset visits all), SHOTS (screenshot dir, default a layout-check folder under the OS temp dir). Exit:
// 0 green, 1 violations, 2 no browser or no server (the server log path is printed then), or an ONLY term that
// matches no scenario (the scenario names are printed then).
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { chromium } from "playwright";
import { makeChar, defaultSettings } from "../checks/testUtils.ts";
import {
  httpStatus,
  integratedCollections,
  makeCatalogReader,
  seedBrowser,
  signalExpoGroup,
  spawnExpoWeb,
  stopExpoWeb,
  waitForExpoWeb,
} from "./lib/app-driver.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE ?? "http://localhost:8099";
const PORT = new URL(BASE).port || "8099";
const SHOTS = process.env.SHOTS ?? join(tmpdir(), "layout-check");
const WIDTHS = (process.env.WIDTHS ?? "393,360,320,412").split(",").map(Number);
// Lowercase substrings from ONLY. Empty when ONLY is unset or blank, which visits every scenario.
const ONLY = (process.env.ONLY ?? "").split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
const INTEGRATED = process.argv.includes("--integrated") || process.env.LAYOUT_INTEGRATED === "1";
const SERVER_WAIT_MS = 180_000;

// The Expo web server this script started. It runs in its own process group, so one signal stops it and its children.
let server = null;

function signalServerGroup(signal) {
  if (server) signalExpoGroup(server, signal);
}

async function stopServer() {
  if (!server) return;
  await stopExpoWeb(server);
  server = null;
}

// Starts the Expo web server on PORT (see spawnExpoWeb). Resolves "up", "exited" or "timeout" (see waitForExpoWeb).
async function startServer(logPath) {
  server = spawnExpoWeb({ root: ROOT, port: PORT, logPath });
  return waitForExpoWeb(server, BASE, SERVER_WAIT_MS);
}

// Record sources the active catalog uses, so seeded characters refer to records the app can find.
const catalogDir = INTEGRATED ? join(ROOT, "dnd5eToolsScrap", "data") : join(ROOT, "src", "data");
const { catalogSource } = makeCatalogReader(catalogDir);

// The character the builder shows: Half-Orc, Acolyte background, level 1 Paladin, equipment claimed.
const CHARACTER_ID = "char_rendar";
// A level 4 Druid in a Black Bear (SRD: AC 11, 19 HP), with the bear at 12 of 19 HP and 4 temp HP.
const DRUID_ID = "char_druid";
// A level 3 Wizard with known and prepared spells and inventory items, so the Spells and Inventory tabs have content.
const WIZARD_ID = "char_wizard";
const WIZARD_SPELLS = ["Fire Bolt", "Light", "Mage Hand", "Magic Missile", "Shield", "Mage Armor", "Detect Magic", "Misty Step"];
const WIZARD_PREPARED = ["Magic Missile", "Shield", "Mage Armor", "Detect Magic", "Misty Step"];
// `equipped` items are worn or held. The custom item has a long name, so it exercises wrapping.
const WIZARD_ITEMS = [
  { name: "Quarterstaff", section: "equipped" },
  { name: "Cloak of Protection", section: "equipped" },
  { name: "Spellbook", section: "carried" },
  { name: "Component Pouch", section: "carried" },
  { name: "Dagger", section: "carried" },
  { name: "Potion of Healing", section: "carried", quantity: 2 },
];

function wizardCharacter() {
  const classSource = catalogSource("classes", "Wizard");
  const ownerKey = `Wizard__${classSource}`;
  const spellSource = (name) => catalogSource("spells", name);
  const items = WIZARD_ITEMS.map((item, i) => ({
    id: `item_${i}`,
    name: item.name,
    source: catalogSource("items", item.name),
    quantity: item.quantity ?? 1,
    isEquipped: item.section === "equipped",
    section: item.section,
  }));
  items.push({
    id: "item_custom",
    name: "Dusty tome of forgotten diagrams copied from the Hollow Library of Vennmoor",
    source: "Custom",
    quantity: 1,
    isEquipped: false,
    section: "carried",
    isCustom: true,
  });
  return makeChar({
    id: WIZARD_ID,
    name: "Elowen",
    createdAt: 3,
    updatedAt: 3,
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    startingOption: "equipment",
    baseAbilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: classSource, level: 3 }],
    currentHp: 15,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
    knownSpells: WIZARD_SPELLS.map((name) => ({ name, source: spellSource(name), ownerKey })),
    preparedSpells: WIZARD_PREPARED.map((name) => `${name}__${spellSource(name)}__${ownerKey}`),
    usedSpellSlots: { 1: 1 },
    items,
  });
}

// A level 6 Half-Elf Fighter with an ability score improvement at level 4 and a feat (Grappler, with its
// Info button) at level 6. The Race tab shows her granted languages and her language choice. In integrated mode
// the race has a subrace, which the same card lists.
const HALF_ELF_ID = "char_halfelf";
function halfElfCharacter() {
  const subrace = INTEGRATED ? { subraceName: "Moon Elf or Sun Elf Descent", subraceSource: "SCAG" } : {};
  return makeChar({
    id: HALF_ELF_ID,
    name: "Dianain",
    createdAt: 4,
    updatedAt: 4,
    startingOption: "equipment",
    baseAbilityScores: { str: 13, dex: 14, con: 12, int: 10, wis: 12, cha: 14 },
    race: { name: "Half-Elf", source: catalogSource("races", "Half-Elf"), ...subrace },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [{ className: "Fighter", source: catalogSource("classes", "Fighter"), level: 6 }],
    currentHp: 30,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
    asiSelections: [
      { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { cha: 1, con: 1 } },
      { level: 6, className: "Fighter", classLevel: 6, type: "feat", featName: "Grappler", featSource: catalogSource("feats", "Grappler") },
    ],
  });
}

// A level 3 Ranger with no picks yet. Its Deft Explorer and Favored Enemy language choices are Proficiency
// Choices in the Class & Subclass Choices card, shown as "Picked 0 / N" in both SRD and integrated modes.
const RANGER_ID = "char_ranger";
function rangerCharacter() {
  return makeChar({
    id: RANGER_ID,
    name: "Tamsin",
    createdAt: 5,
    updatedAt: 5,
    startingOption: "equipment",
    baseAbilityScores: { str: 12, dex: 16, con: 13, int: 10, wis: 14, cha: 8 },
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [{ className: "Ranger", source: catalogSource("classes", "Ranger"), level: 3 }],
    currentHp: 26,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
  });
}

// A level 2 Fighter with an invented name long enough that the header has to shorten it with an ellipsis.
const LONG_NAME_ID = "char_longname";
const LONG_NAME = "Ysolde Marrowbrook-Vantesk the Unbroken Wanderer";
function longNameCharacter() {
  return makeChar({
    id: LONG_NAME_ID,
    name: LONG_NAME,
    createdAt: 7,
    updatedAt: 7,
    startingOption: "equipment",
    baseAbilityScores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 11 },
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [{ className: "Fighter", source: catalogSource("classes", "Fighter"), level: 2 }],
    currentHp: 18,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
  });
}

// A level 3 Way of the Kensei monk, integrated mode only (the Kensei is not in the SRD). Its Path of the Kensei
// choices are Proficiency Choices: the brush and the ranged kensei weapon are unmade ("Picked 0 / 1"), and the
// melee kensei weapon is picked (Rapier), which the Stats tab shows under Weapon Proficiencies.
const KENSEI_ID = "char_kensei";
const KENSEI_PATH = "XGE/Monk/Way of the Kensei/Path of the Kensei@3";
function kenseiCharacter() {
  return makeChar({
    id: KENSEI_ID,
    name: "Hikaru",
    createdAt: 6,
    updatedAt: 6,
    startingOption: "equipment",
    baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [
      {
        className: "Monk",
        source: catalogSource("classes", "Monk"),
        level: 3,
        subclassName: "Way of the Kensei",
        subclassSource: "XGE",
      },
    ],
    currentHp: 22,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
    proficiencyPicks: { [`${KENSEI_PATH}#weapons:choice:rule`]: ["Rapier"] },
  });
}

// A level 3 Rogue Swashbuckler who is also a level 2 War Magic Wizard, integrated mode only (neither subclass is in the
// SRD). Their Initiative Bonuses are Rakish Audacity (Charisma) and Tactical Wit (Intelligence), so the Initiative
// breakdown has three parts: Dexterity +2, Rakish Audacity +3, Tactical Wit +3, total +8. Both books are default-active.
const INITIATIVE_ID = "char_initiative";
function initiativeCharacter() {
  return makeChar({
    id: INITIATIVE_ID,
    name: "Sylvane",
    createdAt: 8,
    updatedAt: 8,
    startingOption: "equipment",
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 16 },
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [
      { className: "Rogue", source: catalogSource("classes", "Rogue"), level: 3, subclassName: "Swashbuckler", subclassSource: "XGE" },
      { className: "Wizard", source: catalogSource("classes", "Wizard"), level: 2, subclassName: "War Magic", subclassSource: "XGE" },
    ],
    currentHp: 22,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
  });
}

// A level 3 College of Lore Bard with no picks yet. Its Bonus Proficiencies are a skill Proficiency Choice
// in the Class & Subclass Choices card ("Picked 0 / 3"), offering the skills the Bard does not hold yet.
const BARD_ID = "char_bard";
function bardCharacter() {
  return makeChar({
    id: BARD_ID,
    name: "Lirael",
    createdAt: 6,
    updatedAt: 6,
    startingOption: "equipment",
    baseAbilityScores: { str: 8, dex: 14, con: 12, int: 12, wis: 13, cha: 16 },
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [{ className: "Bard", source: catalogSource("classes", "Bard"), level: 3, subclassName: "College of Lore", subclassSource: "PHB" }],
    currentHp: 20,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
  });
}

// A new character with no race and no background: the race picker starts here.
const NO_RACE_ID = "char_norace";
function noRaceCharacter() {
  return makeChar({
    id: NO_RACE_ID,
    name: "Sable",
    createdAt: 8,
    updatedAt: 8,
    startingOption: "equipment",
    baseAbilityScores: { str: 10, dex: 12, con: 10, int: 14, wis: 10, cha: 12 },
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
  });
}

// A level 1 Human Fighter with no background: the background picker and the Custom Background creator start here.
const NO_BG_ID = "char_nobg";
function noBackgroundCharacter() {
  return makeChar({
    id: NO_BG_ID,
    name: "Pim",
    createdAt: 9,
    updatedAt: 9,
    startingOption: "equipment",
    baseAbilityScores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 },
    race: { name: "Human", source: catalogSource("races", "Human") },
    classes: [{ className: "Fighter", source: catalogSource("classes", "Fighter"), level: 1 }],
    currentHp: 12,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
  });
}

// A level 4 Battle Master with Superior Technique and the Martial Adept feat, so the Stats badge, the Features counters
// and the Actions maneuver cards show both superiority pools: the Battle Master's d8 dice and the bonus d6 dice.
const BATTLE_MASTER_ID = "char_battlemaster";
function battleMasterCharacter() {
  return makeChar({
    id: BATTLE_MASTER_ID,
    name: "Orrin",
    createdAt: 9,
    updatedAt: 9,
    startingOption: "equipment",
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [
      {
        className: "Fighter",
        source: catalogSource("classes", "Fighter"),
        level: 4,
        subclassName: "Battle Master",
        subclassSource: "PHB",
      },
    ],
    currentHp: 28,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
      {
        id: "PHB__Fighter__Battle Master__Maneuvers 3",
        trait: "Combat Superiority (3rd Level)",
        origin: "subclass",
        choose: 3,
        from: ["Riposte", "Rally", "Trip Attack"],
        picked: ["Riposte", "Rally", "Trip Attack"],
      },
    ],
    asiSelections: [{ className: "Fighter", classLevel: 4, level: 4, type: "feat", featName: "Martial Adept" }],
  });
}

// A level 4 Wizard who took Magic Initiate and chose its Wizard list, so the feat's own pick controls show the list's
// cantrip and spell choices. Integrated mode only (Magic Initiate is not in the SRD Baseline).
const MAGIC_INITIATE_ID = "char_magicinitiate";
const MAGIC_INITIATE_ROUTE = `/character/${MAGIC_INITIATE_ID}`;
function magicInitiateCharacter() {
  const featSource = catalogSource("feats", "Magic Initiate");
  return makeChar({
    id: MAGIC_INITIATE_ID,
    name: "Ilse",
    createdAt: 10,
    updatedAt: 10,
    startingOption: "equipment",
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    classes: [{ className: "Wizard", source: catalogSource("classes", "Wizard"), level: 4 }],
    currentHp: 20,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
    asiSelections: [{ level: 4, className: "Wizard", classLevel: 4, type: "feat", featName: "Magic Initiate", featSource }],
    ruleChoices: [
      {
        id: `${featSource}__Feat Spells__Magic Initiate__Spell List`,
        trait: "Magic Initiate Spell List",
        origin: "feat",
        choose: 1,
        from: ["Bard Spells", "Cleric Spells", "Druid Spells", "Sorcerer Spells", "Warlock Spells", "Wizard Spells"],
        picked: ["Wizard Spells"],
      },
    ],
  });
}

// A level 4 Wizard whose background grants Magic Initiate: the feat is claimed in the background section and its list is
// picked there. Integrated mode only (the background and the feat are not in the SRD Baseline).
const BACKGROUND_FEAT_ID = "char_backgroundfeat";
const BACKGROUND_FEAT_ROUTE = `/character/${BACKGROUND_FEAT_ID}`;
function backgroundFeatCharacter() {
  const featSource = catalogSource("feats", "Magic Initiate");
  return makeChar({
    id: BACKGROUND_FEAT_ID,
    name: "Tamsin",
    createdAt: 11,
    updatedAt: 11,
    startingOption: "equipment",
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Astral Drifter", source: catalogSource("backgrounds", "Astral Drifter") },
    classes: [{ className: "Wizard", source: catalogSource("classes", "Wizard"), level: 4 }],
    currentHp: 20,
    startingGrantsApplied: true,
    backgroundGrantsApplied: true,
    originFeats: [{ level: 1, type: "feat", featName: "Magic Initiate", featSource: "Background" }],
    ruleChoices: [
      {
        id: `${featSource}__Feat Spells__Magic Initiate__Spell List`,
        trait: "Magic Initiate Spell List",
        origin: "feat",
        choose: 1,
        from: ["Bard Spells", "Cleric Spells", "Druid Spells", "Sorcerer Spells", "Warlock Spells", "Wizard Spells"],
        picked: ["Wizard Spells"],
      },
    ],
  });
}

// Level 1 Fighters for the equipment card. The unpicked one has no picks, so Claim Starting Equipment is disabled. The
// picked one has a pick in every slot (chain mail, a martial weapon and a shield, a light crossbow, a dungeoneer's pack),
// so Claim is enabled, and its martial weapon picker is the one a screen opens.
const FIGHTER_ID = "char_fighter";
const FIGHTER_PICKED_ID = "char_fighterpicked";
function fighterCharacter({ id, name, picked }) {
  const classSource = catalogSource("classes", "Fighter");
  return makeChar({
    id,
    name,
    createdAt: 4,
    updatedAt: 4,
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    startingOption: "equipment",
    classes: [{ className: "Fighter", source: classSource, level: 1 }],
    currentHp: 12,
    backgroundGrantsApplied: true,
    ...(picked
      ? {
          startingEquipmentPicks: {
            className: "Fighter",
            source: classSource,
            options: { 0: "a", 1: "a", 2: "a", 3: "a" },
            items: { "1.a.0": ["Longsword"] },
          },
        }
      : {}),
  });
}

// Level 1 Clerics. Without a domain the warhammer and chain mail need proficiencies this Cleric does not have, so
// neither is offered. A Life Domain gives heavy armor, so chain mail is offered (the warhammer still is not).
const CLERIC_ID = "char_cleric";
const CLERIC_DOMAIN_ID = "char_clericdomain";
function clericCharacter({ id, name, domain }) {
  const domainSource = INTEGRATED ? "PHB" : "SRD";
  return makeChar({
    id,
    name,
    createdAt: 5,
    updatedAt: 5,
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    startingOption: "equipment",
    classes: [
      {
        className: "Cleric",
        source: catalogSource("classes", "Cleric"),
        level: 1,
        ...(domain ? { subclassName: "Life Domain", subclassSource: domainSource } : {}),
      },
    ],
    currentHp: 9,
    backgroundGrantsApplied: true,
  });
}

// The Skills card. Integrated: a Variant Human Acolyte Cleric 1 with the Knowledge Domain, who picked Arcana and History
// for Blessings of Knowledge, and a Rogue 1, so the card holds the starting picker, the Rogue's multiclass pick and the
// Blessings picks, with Expertise on the two Blessings picks. The Variant Human's skill pick is a Race pick, so it is
// on the Race tab and not on this card. SRD Baseline (no Knowledge Domain): a Fighter 1 and a Rogue 1, so the card
// holds the Fighter's starting picker and the Rogue's multiclass pick.
const KNOWLEDGE_ID = "char_knowledge";
const MULTICLASS_SKILLS_ID = "char_multiclass_skills";
function knowledgeClericCharacter() {
  return makeChar({
    id: KNOWLEDGE_ID,
    name: "Corwin",
    createdAt: 7,
    updatedAt: 7,
    race: { name: "Human", source: catalogSource("races", "Human"), subraceName: "Variant", subraceSource: "PHB" },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    startingOption: "equipment",
    classes: [
      {
        className: "Cleric",
        source: catalogSource("classes", "Cleric"),
        level: 1,
        subclassName: "Knowledge Domain",
        subclassSource: "PHB",
      },
      { className: "Rogue", source: catalogSource("classes", "Rogue"), level: 1 },
    ],
    proficiencyPicks: { "PHB/Cleric/Knowledge Domain/Blessings of Knowledge@1#skills:choice:from": ["Arcana", "History"] },
    currentHp: 9,
    backgroundGrantsApplied: true,
  });
}
function multiclassSkillCharacter() {
  return makeChar({
    id: MULTICLASS_SKILLS_ID,
    name: "Tamsin",
    createdAt: 8,
    updatedAt: 8,
    race: { name: "Human", source: catalogSource("races", "Human") },
    background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
    startingOption: "equipment",
    classes: [
      { className: "Fighter", source: catalogSource("classes", "Fighter"), level: 1 },
      { className: "Rogue", source: catalogSource("classes", "Rogue"), level: 1 },
    ],
    currentHp: 12,
    backgroundGrantsApplied: true,
  });
}

// The seed the browser starts from: the characters, folders, settings, and (integrated mode) the catalog.
function buildSeed() {
  const defaults = defaultSettings();
  return {
    characters: [
      makeChar({
        id: CHARACTER_ID,
        name: "Rendar",
        createdAt: 1,
        updatedAt: 1,
        race: { name: "Half-Orc", source: "PHB" },
        background: { name: "Acolyte", source: "PHB" },
        startingOption: "equipment",
        classes: [{ className: "Paladin", source: "PHB", level: 1 }],
        currentHp: 10,
        startingGrantsApplied: true,
        backgroundGrantsApplied: true,
        // Added Proficiencies: a known tool and a known and a long custom language, so the Stats tab shows the "added" rows.
        addedTools: ["Smith's Tools"],
        addedLanguages: ["Elvish", "Dusty Hollow Cant of Vennmoor"],
      }),
      makeChar({
        id: DRUID_ID,
        name: "Mossa",
        createdAt: 2,
        updatedAt: 2,
        startingOption: "equipment",
        classes: [{ className: "Druid", source: "PHB", level: 4 }],
        currentHp: 14,
        startingGrantsApplied: true,
        backgroundGrantsApplied: true,
        activeWildShape: { name: "Black Bear", source: "SRD", ac: 11, currentHp: 12, maxHp: 19, tempHp: 4 },
      }),
      wizardCharacter(),
      halfElfCharacter(),
      rangerCharacter(),
      longNameCharacter(),
      ...(INTEGRATED ? [kenseiCharacter()] : []),
      ...(INTEGRATED ? [initiativeCharacter()] : []),
      bardCharacter(),
      noRaceCharacter(),
      noBackgroundCharacter(),
      fighterCharacter({ id: FIGHTER_ID, name: "Tavish", picked: false }),
      fighterCharacter({ id: FIGHTER_PICKED_ID, name: "Brannoc", picked: true }),
      battleMasterCharacter(),
      ...(INTEGRATED ? [magicInitiateCharacter()] : []),
      ...(INTEGRATED ? [backgroundFeatCharacter()] : []),
      ...(INTEGRATED ? [clericCharacter({ id: CLERIC_ID, name: "Corwin", domain: false })] : []),
      clericCharacter({ id: CLERIC_DOMAIN_ID, name: "Ysolde", domain: true }),
      INTEGRATED ? knowledgeClericCharacter() : multiclassSkillCharacter(),
    ],
    folders: [],
    settings: {
      ...defaults,
      hasCompletedFirstRun: true,
      // AAG is switched on for the Astral Drifter background, which grants Magic Initiate (the background section lists its feat only when the book is on).
      activeResourceBooks: INTEGRATED ? [...new Set([...defaults.activeResourceBooks, "MM", "AAG"])] : defaults.activeResourceBooks,
    },
    integrated: INTEGRATED ? integratedCollections(ROOT) : null,
  };
}

// The screens each width visits, in order. `route` is opened first (a modal always reopens its route).
// `tabs` are tapped in order. `open` taps the control that opens a modal, and `modal` is that modal's
// title. `ready` (a string or regex) is text the screen shows once it is ready. `scrollTo` scrolls a needle into view.
const RENDAR_ROUTE = `/character/${CHARACTER_ID}`;
const WIZARD_ROUTE = `/character/${WIZARD_ID}`;
const HALF_ELF_ROUTE = `/character/${HALF_ELF_ID}`;
const RANGER_ROUTE = `/character/${RANGER_ID}`;
const LONG_NAME_ROUTE = `/character/${LONG_NAME_ID}`;
const KENSEI_ROUTE = `/character/${KENSEI_ID}`;
const INITIATIVE_ROUTE = `/character/${INITIATIVE_ID}`;
const BARD_ROUTE = `/character/${BARD_ID}`;
const NO_RACE_ROUTE = `/character/${NO_RACE_ID}`;
const NO_BG_ROUTE = `/character/${NO_BG_ID}`;
const FIGHTER_ROUTE = `/character/${FIGHTER_ID}`;
const FIGHTER_PICKED_ROUTE = `/character/${FIGHTER_PICKED_ID}`;
const BATTLE_MASTER_ROUTE = `/character/${BATTLE_MASTER_ID}`;
const CLERIC_ROUTE = `/character/${CLERIC_ID}`;
const CLERIC_DOMAIN_ROUTE = `/character/${CLERIC_DOMAIN_ID}`;
const KNOWLEDGE_ROUTE = `/character/${KNOWLEDGE_ID}`;
const MULTICLASS_SKILLS_ROUTE = `/character/${MULTICLASS_SKILLS_ID}`;
const SCREENS = [
  { name: "Builder Abilities", route: RENDAR_ROUTE, tabs: ["Builder", "Abilities"], ready: /points remaining/i },
  { name: "Builder Race", route: RENDAR_ROUTE, tabs: ["Builder", "Race"], ready: /traits:/i },
  { name: "Builder Race language choice", route: HALF_ELF_ROUTE, tabs: ["Builder", "Race"], ready: /Granted Languages:/, scrollTo: "Granted Languages:" },
  { name: "Builder Class feats", route: HALF_ELF_ROUTE, tabs: ["Builder", "Class"], ready: /Selected Ability Improvements/i, scrollTo: "Selected Ability Improvements" },
  { name: "Builder Background", route: RENDAR_ROUTE, tabs: ["Builder", "Background"], ready: /background benefits/i, scrollTo: "Claim again" },
  // Pickers for characters with no race (the race list) or no background (the background list, then the Custom Background creator).
  // In integrated mode Half-Elf's card has the plain row, the race's own form with no subrace name, under "Subraces / Variants:".
  { name: "Builder Race picker", route: NO_RACE_ROUTE, tabs: ["Builder", "Race"], ready: "Half-Elf", scrollTo: "Half-Elf", expect: { placeholders: ["Search races…"], plainRaceRow: INTEGRATED ? "Half-Elf" : undefined } },
  { name: "Builder Background picker", route: NO_BG_ROUTE, tabs: ["Builder", "Background"], ready: "Create Custom", expect: { texts: ["Acolyte"], placeholders: ["Search backgrounds…"] } },
  {
    name: "Builder Background custom form",
    route: NO_BG_ROUTE,
    tabs: ["Builder", "Background"],
    open: (page) => page.getByText("Create Custom", { exact: true }).first().click(),
    ready: "Apply Custom Background",
    scrollTo: "Feature from Another Background (optional):",
    expect: {
      texts: [
        "Background Name:",
        "Select 2 Skill Proficiencies:",
        "Acrobatics",
        "Select 2 Tool or Language Proficiencies:",
        "Elvish",
        "Feature from Another Background (optional):",
      ],
      placeholders: ["e.g. Bounty Hunter, Village Hero...", "Search features…"],
    },
  },
  { name: "Builder Class", route: RENDAR_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Starting Equipment" },
  { name: "Builder Class proficiency choices", route: RANGER_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Class & Subclass Choices" },
  // Kensei weapons (integrated mode only): the Path of the Kensei choices, and the weapon rows they add to the sheet.
  ...(INTEGRATED
    ? [
        { name: "Builder Class kensei weapon choices", route: KENSEI_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Path of the Kensei" },
        { name: "Stats kensei weapon proficiencies", route: KENSEI_ROUTE, tabs: ["Stats"], ready: /hit points/i, scrollTo: "Weapon Proficiencies" },
      ]
    : []),
  // Magic Initiate's own picks (integrated mode only): its spell list, then the cantrips and spell of the list chosen.
  ...(INTEGRATED
    ? [
        {
          name: "Builder Class feat spell picks",
          route: MAGIC_INITIATE_ROUTE,
          tabs: ["Builder", "Class"],
          ready: /Selected Ability Improvements/i,
          scrollTo: "Magic Initiate Spell List (choose 1)",
          expect: { texts: ["Magic Initiate Spell List (choose 1)", "Magic Initiate Cantrip (choose 2)", "Magic Initiate Spell (choose 1)"], fitsWidth: true },
        },
        // A background that grants Magic Initiate: its pick controls sit under the feat the background section shows.
        {
          name: "Builder Background feat spell picks",
          route: BACKGROUND_FEAT_ROUTE,
          tabs: ["Builder", "Background"],
          ready: /background feat/i,
          scrollTo: "Magic Initiate Spell List (choose 1)",
          expect: { texts: ["Feat Added to Character", "Magic Initiate Spell List (choose 1)", "Magic Initiate Cantrip (choose 2)", "Magic Initiate Spell (choose 1)"], fitsWidth: true },
        },
      ]
    : []),
  // The equipment card: one option per slot, the picker of a generic entry, Claim disabled until every slot is picked.
  { name: "Builder Class equipment choices", route: FIGHTER_ROUTE, tabs: ["Builder", "Class"], ready: "Starting Equipment & Gold:", scrollTo: "Starting Equipment & Gold:", expect: { texts: ["Chain Mail", "Choice 1 of 4"], disabled: ["Claim Starting Equipment"], fitsWidth: true } },
  { name: "Builder Class equipment picked", route: FIGHTER_PICKED_ROUTE, tabs: ["Builder", "Class"], ready: "Starting Equipment & Gold:", scrollTo: "Starting Equipment & Gold:", expect: { enabled: ["Claim Starting Equipment"], fitsWidth: true } },
  { name: "Builder Class equipment picker open", route: FIGHTER_PICKED_ROUTE, tabs: ["Builder", "Class"], open: (page) => page.getByText("Martial weapon", { exact: true }).first().click(), ready: "Greatsword", scrollTo: "Martial weapon", expect: { placeholders: ["Search…"] } },
  { name: "Builder Class equipment cleric domain", route: CLERIC_DOMAIN_ROUTE, tabs: ["Builder", "Class"], ready: "Starting Equipment & Gold:", scrollTo: "Starting Equipment & Gold:", expect: { texts: ["Chain Mail", "Included"], absent: ["Warhammer"], fitsWidth: true } },
  // The SRD Baseline has one Cleric domain, which the app applies at once, so a Cleric without a domain exists in integrated mode only.
  ...(INTEGRATED
    ? [{ name: "Builder Class equipment cleric", route: CLERIC_ROUTE, tabs: ["Builder", "Class"], ready: "Starting Equipment & Gold:", scrollTo: "Starting Equipment & Gold:", expect: { texts: ["Scale Mail"], absent: ["Warhammer", "Chain Mail"], fitsWidth: true } }]
    : []),
  { name: "Builder Class skill proficiency choices", route: BARD_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Class & Subclass Choices" },
  // The Skills card above Class & Subclass Choices: each skill pick named by its source, with Expertise on the Blessings picks.
  ...(INTEGRATED
    ? [{ name: "Builder Class skills card cleric", route: KNOWLEDGE_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "starting skills", expect: { texts: ["Cleric starting skills", "Blessings of Knowledge", "Rogue multiclass skill", "Expertise"], absent: ["Variant"], fitsWidth: true } }]
    : [{ name: "Builder Class skills card multiclass", route: MULTICLASS_SKILLS_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "starting skills", expect: { texts: ["Fighter starting skills", "Rogue multiclass skill"], fitsWidth: true } }]),
  // The Knowledge Cleric's Class & Subclass Choices and Expertise cards, open: the picker of each card is listed.
  ...(INTEGRATED
    ? [{ name: "Builder Class skills card cleric choices", route: KNOWLEDGE_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Class & Subclass Choices", expect: { texts: ["Class & Subclass Choices", "Blessings of Knowledge: Language", "Expertise", "Rogue Expertise (Level 1)"], fitsWidth: true } }]
    : []),
  // The picks cards collapse and expand: the Skills, Class & Subclass Choices and Expertise cards here, the Race and Background
  // picks cards below, and the Optional & Replacement Class Features card (Ranger, both modes). Collapsed, a card shows its
  // title row and subtitle only, and a reopened card lists its picks again. Each collapsed-state scenario loads its route
  // again (`fresh`), so the cards start open whatever the scenario before it left collapsed.
  ...(INTEGRATED
    ? [
        { name: "Builder Class skills card collapsed", route: KNOWLEDGE_ROUTE, fresh: true, tabs: ["Builder", "Class"], ready: /total level/i, open: async (page) => { for (const title of ["Skills", "Class & Subclass Choices", "Expertise"]) await page.getByText(title, { exact: true }).first().click(); }, scrollTo: "Class & Subclass Choices", expect: { texts: ["Skills", "Class & Subclass Choices", "Expertise"], absent: ["Blessings of Knowledge", "Cleric starting skills", "Blessings of Knowledge: Language", "Rogue Expertise (Level 1)"], fitsWidth: true } },
        { name: "Builder Class skills card reopened", route: KNOWLEDGE_ROUTE, fresh: true, tabs: ["Builder", "Class"], ready: /total level/i, open: async (page) => { const title = page.getByText("Class & Subclass Choices", { exact: true }).first(); await title.click(); await title.click(); }, scrollTo: "Class & Subclass Choices", expect: { texts: ["Class & Subclass Choices", "Blessings of Knowledge: Language"], fitsWidth: true } },
      ]
    : [{ name: "Builder Class skills card collapsed", route: MULTICLASS_SKILLS_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, open: (page) => page.getByText("Skills", { exact: true }).first().click(), scrollTo: "Class & Subclass Choices", expect: { texts: ["Skills"], absent: ["Fighter starting skills"], fitsWidth: true } }]),
  { name: "Builder Class optional features card", route: RANGER_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Optional & Replacement Class Features:", expect: { texts: ["Optional & Replacement Class Features:", "Deft Explorer", "Favored Foe"], fitsWidth: true } },
  { name: "Builder Class optional features card collapsed", route: RANGER_ROUTE, fresh: true, tabs: ["Builder", "Class"], ready: /total level/i, open: (page) => page.getByText("Optional & Replacement Class Features:", { exact: true }).first().click(), scrollTo: "Optional & Replacement Class Features:", expect: { texts: ["Optional & Replacement Class Features:", "Tasha's Cauldron optional features and replacements for your classes."], absent: ["Deft Explorer", "Favored Foe"], fitsWidth: true } },
  // A choice card with a badge: the Fighting Style badge sits in the title row beside the chevron, in both states.
  { name: "Builder Class fighting styles card", route: FIGHTER_ROUTE, fresh: true, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Fighting Styles", expect: { texts: ["Fighting Styles", "Fighting Style", "Martial specialization granting passive combat bonuses or additional cantrips."], fitsWidth: true } },
  { name: "Builder Class fighting styles card collapsed", route: FIGHTER_ROUTE, fresh: true, tabs: ["Builder", "Class"], ready: /total level/i, open: (page) => page.getByText("Fighting Styles", { exact: true }).first().click(), scrollTo: "Fighting Styles", expect: { texts: ["Fighting Styles", "Fighting Style", "Martial specialization granting passive combat bonuses or additional cantrips."], absent: ["Archery", "Blind Fighting", "Defense"], fitsWidth: true } },
  // The Race card: the Variant Human's language and skill picks, named by what they pick, then collapsed to its title.
  ...(INTEGRATED
    ? [
        { name: "Builder Race skill picks", route: KNOWLEDGE_ROUTE, tabs: ["Builder", "Race"], ready: /traits:/i, scrollTo: "Languages & Proficiencies", expect: { texts: ["Languages & Proficiencies", "Language", "Skill"], fitsWidth: true } },
        { name: "Builder Race skill picks collapsed", route: KNOWLEDGE_ROUTE, tabs: ["Builder", "Race"], ready: "Languages & Proficiencies", open: (page) => page.getByText("Languages & Proficiencies", { exact: true }).first().click(), scrollTo: "Languages & Proficiencies", expect: { absent: ["Granted Languages:", "Language", "Skill"], fitsWidth: true } },
      ]
    : [{ name: "Builder Race skill picks collapsed", route: HALF_ELF_ROUTE, tabs: ["Builder", "Race"], ready: "Languages & Proficiencies", open: (page) => page.getByText("Languages & Proficiencies", { exact: true }).first().click(), scrollTo: "Languages & Proficiencies", expect: { absent: ["Granted Languages:"], fitsWidth: true } }]),
  // The picks card's options are listed under its title when open, and the title row alone when collapsed.
  { name: "Builder Background picks card", route: RENDAR_ROUTE, tabs: ["Builder", "Background"], ready: /background benefits/i, scrollTo: "Languages", expect: { texts: ["Languages", "Dwarvish"], fitsWidth: true } },
  { name: "Builder Background picks card collapsed", route: RENDAR_ROUTE, tabs: ["Builder", "Background"], ready: "Languages", open: (page) => page.getByText("Languages", { exact: true }).first().click(), scrollTo: "Languages", expect: { texts: ["Languages"], absent: ["Dwarvish"], fitsWidth: true } },
  { name: "Stats", route: RENDAR_ROUTE, tabs: ["Stats"], ready: /hit points/i },
  { name: "Stats long header name", route: LONG_NAME_ROUTE, tabs: ["Stats"], ready: /hit points/i, headerName: LONG_NAME },
  { name: "Stats add tool modal", route: RENDAR_ROUTE, tabs: ["Stats"], open: (page) => page.getByLabel("Add tool proficiency").first().click(), modal: "Add Tool Proficiency" },
  { name: "Stats add language modal", route: RENDAR_ROUTE, tabs: ["Stats"], open: (page) => page.getByLabel("Add language").first().click(), modal: "Add Language" },
  // The Initiative box opens its breakdown (integrated mode only, where the Rogue's and the Wizard's Initiative Bonuses exist).
  ...(INTEGRATED
    ? [
        {
          name: "Stats initiative breakdown modal",
          route: INITIATIVE_ROUTE,
          tabs: ["Stats"],
          open: (page) => page.getByLabel("Initiative breakdown", { exact: true }).first().click(),
          modal: "Initiative",
          expect: { texts: ["Dexterity", "+2", "Rakish Audacity", "+3", "Tactical Wit", "+3", "Total", "+8"], fitsWidth: true },
        },
      ]
    : []),
  { name: "Spells", route: WIZARD_ROUTE, tabs: ["Spells"], ready: /add spells/i },
  { name: "Inventory", route: WIZARD_ROUTE, tabs: ["Inventory"], ready: /total wealth/i },
  { name: "Features", route: RENDAR_ROUTE, tabs: ["Features"], ready: /resource trackers/i },
  { name: "Journal", route: RENDAR_ROUTE, tabs: ["Journal"], ready: /character name/i },
  { name: "Actions", route: RENDAR_ROUTE, tabs: ["Actions"], ready: /attack action/i },
  { name: "Stats battle master superiority dice", route: BATTLE_MASTER_ROUTE, tabs: ["Stats"], ready: /hit points/i, scrollTo: "Superiority Dice: 4d8 + 2d6", expect: { texts: ["Superiority Dice: 4d8 + 2d6"], fitsWidth: true } },
  { name: "Features battle master superiority counters", route: BATTLE_MASTER_ROUTE, tabs: ["Features"], ready: /resource trackers/i, scrollTo: "Superiority Dice [d6]", expect: { texts: ["Superiority Dice [d8]", "Superiority Dice [d6]"], fitsWidth: true } },
  { name: "Actions battle master maneuver dice", route: BATTLE_MASTER_ROUTE, tabs: ["Actions"], ready: /battle master maneuvers/i, scrollTo: "BATTLE MASTER MANEUVERS", expect: { texts: ["Die: d8 / d6", "+d8 / d6"], fitsWidth: true } },
  { name: "Rest modal", route: RENDAR_ROUTE, tabs: ["Stats"], open: (page) => page.getByText(/^Take Rest/).first().click(), modal: "Rest & Recovery" },
  { name: "Conditions modal", route: RENDAR_ROUTE, tabs: ["Stats"], open: (page) => page.getByText(/^Conditions \(/).first().click(), modal: "Toggle Conditions" },
  { name: "Home", route: "/", ready: /5e Character Builder/ },
  { name: "New Character modal", route: "/", open: tapHeaderAdd, modal: "Create New Character" },
  { name: "Settings", route: "/options", ready: /settings & compendium/i },
];

// Taps the round add button at the right end of the home header. It has no text or label, so it is found by place.
async function tapHeaderAdd(page) {
  const point = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('div[tabindex="0"]')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width === 36 && r.height === 36 && r.top < 80)
      .sort((a, b) => b.left - a.left);
    return buttons[0] ? { x: buttons[0].left + 18, y: buttons[0].top + 18 } : null;
  });
  if (!point) throw new Error("home header add button not found");
  await page.mouse.click(point.x, point.y);
}

// Runs in the browser. Returns one message per layout violation inside `root` (an element handle,
// or the whole document when null).
function findLayoutViolations(root) {
  const nodes = (root ?? document).querySelectorAll("*");
  const out = [];
  const scrollerX = (el) => /(auto|scroll)/.test(getComputedStyle(el).overflowX);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    const text = (el.textContent || "").trim();
    // Inputs have no text content, so they are named by their placeholder.
    const label = text || el.getAttribute("placeholder") || el.tagName.toLowerCase();
    const fontSize = parseFloat(getComputedStyle(el).fontSize) || 14;
    const lines = r.height / (fontSize * 1.25);
    // Squeezed means many lines of short text (a narrow column), not a long paragraph at a normal width.
    if (el.children.length === 0 && text.length >= 20 && lines >= 5 && text.length / lines < 25)
      out.push(`squeezed text (${Math.round(r.width)}px wide, ${Math.round(r.height)}px tall, ~${Math.round(lines)} lines of ~${Math.round(text.length / lines)} characters): "${text.slice(0, 40)}"`);
    if (r.width === 0) continue;
    const p = el.parentElement;
    if (!p || scrollerX(p)) continue;
    let inScroller = false;
    for (let a = p; a; a = a.parentElement) if (scrollerX(a) && a !== document.documentElement && a !== document.body) { inScroller = true; break; }
    if (inScroller) continue;
    const pr = p.getBoundingClientRect();
    if (pr.width > 0 && r.right > pr.right + 1) out.push(`sticks out of its parent by ${Math.round(r.right - pr.right)}px: "${label.slice(0, 40)}"`);
  }
  return [...new Set(out)];
}

// Runs in the browser. Checks the header of a character sheet for a long name. The name must be clipped and end
// with an ellipsis, and it must end before the level badge and the HP badge start. Returns one message per violation.
function findHeaderNameViolations(name) {
  const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0);
  const nameEl = leaves.find((e) => e.textContent.trim() === name);
  if (!nameEl) return [`header name "${name.slice(0, 40)}" is not on the screen`];
  const badgeText = leaves.filter((e) => /^(Lvl \d+|\d+\/\d+.*)$/.test(e.textContent.trim()) && e.getBoundingClientRect().top < 80);
  const out = [];
  const nr = nameEl.getBoundingClientRect();
  const cs = getComputedStyle(nameEl);
  if (cs.textOverflow !== "ellipsis" || cs.overflow !== "hidden") out.push(`header name has no ellipsis (text-overflow: ${cs.textOverflow}, overflow: ${cs.overflow})`);
  if (nameEl.scrollWidth <= nameEl.clientWidth) out.push(`header name is not clipped (${nameEl.scrollWidth}px of text in ${nameEl.clientWidth}px)`);
  if (nr.right > window.innerWidth + 1) out.push(`header name sticks out of the screen by ${Math.round(nr.right - window.innerWidth)}px`);
  for (const badge of badgeText) {
    const br = (badge.parentElement ?? badge).getBoundingClientRect();
    if (nr.right > br.left + 1 && nr.left < br.right - 1) out.push(`header name overlaps the badge "${badge.textContent.trim().slice(0, 20)}" by ${Math.round(nr.right - br.left)}px`);
  }
  return out;
}

// Runs in the browser. Native Text defaults to flexShrink 0 and the web's does not, so a title that wraps in
// this web check runs into its badge, counter or button on a phone. Forces flexShrink 0 on the children of every
// row (flex, space-between, two or more children) and tags those rows. Returns how many rows it tagged.
function forceNoShrinkRows() {
  let tagged = 0;
  for (const row of document.querySelectorAll("*")) {
    if (row.hasAttribute("data-noshrink") || row.children.length < 2) continue;
    const cs = getComputedStyle(row);
    if (cs.display !== "flex" || cs.flexDirection !== "row" || cs.justifyContent !== "space-between") continue;
    row.setAttribute("data-noshrink", "");
    for (const kid of row.children) {
      kid.dataset.prevShrink = kid.style.flexShrink;
      kid.style.flexShrink = "0";
    }
    tagged++;
  }
  return tagged;
}

// Runs in the browser. Undoes forceNoShrinkRows.
function restoreNoShrinkRows() {
  for (const row of document.querySelectorAll("[data-noshrink]")) {
    row.removeAttribute("data-noshrink");
    for (const kid of row.children) {
      kid.style.flexShrink = kid.dataset.prevShrink ?? "";
      delete kid.dataset.prevShrink;
    }
  }
}

// Checks the rows of the open page as native Text lays them out. Only Builder screens: the rows there are
// the ones the sibling rule (CODING_STANDARDS section 7) covers.
async function checkNoShrinkRows(page, screen) {
  if (!screen.name.startsWith("Builder")) return [];
  await page.evaluate(forceNoShrinkRows);
  const out = [];
  try {
    for (const row of await page.$$("[data-noshrink]")) out.push(...(await page.evaluate(findLayoutViolations, row)));
  } finally {
    await page.evaluate(restoreNoShrinkRows);
  }
  return out.map((v) => `row, native text (flexShrink 0): ${v}`);
}

// Runs in the browser. Whether the button labelled `text` is disabled, read from the aria-disabled that the Button
// sets on its touch target (the element with a tabindex). Null when no such label is on the page; `state` says what was read.
function buttonDisabled(text) {
  const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.includes(text));
  const target = el?.closest("[tabindex]");
  if (!target) {
    const near = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /Claim|Choose|Starting|Equipment/.test(e.textContent)).map((e) => e.textContent).slice(0, 10);
    return { disabled: null, state: `no button with that label; near: ${near.join(" | ")}` };
  }
  const aria = target.getAttribute("aria-disabled");
  return { disabled: aria === "true", state: `aria-disabled=${aria}` };
}

// Runs in the browser. True when the race card titled `name` has a plain row under its "Subraces / Variants:" label:
// the row for the race's own form, which is the card's title text inside that box.
function findPlainRaceRow(name) {
  const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0);
  const title = leaves.find((e) => e.textContent.trim() === name);
  for (let card = title?.parentElement; card; card = card.parentElement) {
    const label = [...card.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Subraces / Variants:");
    if (label) return [...label.parentElement.querySelectorAll("*")].some((e) => e.children.length === 0 && e.textContent.trim() === name);
  }
  return false;
}

// Runs in the browser. The open modal dialog whose title is `title`, or null.
function findDialog(title) {
  const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === title);
  return el?.closest('[role="dialog"]') ?? null;
}

// Runs in the browser. The open hit point modal (normal or wild shape): the smallest ancestor of its Amount field that holds the title and the buttons.
function findHpModal() {
  for (let a = document.querySelector('[aria-label="Amount"]'); a; a = a.parentElement) {
    const text = a.textContent || "";
    if ((text.includes("Hit Points") || text.includes("Wild Shape HP")) && text.includes("Set to")) return a;
  }
  return null;
}

// Runs in the browser. Indexes of the "Change hit points" controls: `stats` is the one under the
// HIT POINTS label on the Stats tab, `header` is the first one that is not `stats` (the header badge).
function findHpControls() {
  const all = [...document.querySelectorAll('[aria-label="Change hit points"]')];
  const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "HIT POINTS");
  let stats = -1;
  for (let a = label?.parentElement; a && stats < 0; a = a.parentElement) {
    const hit = all.find((el) => a.contains(el));
    if (hit) stats = all.indexOf(hit);
  }
  const header = all.findIndex((_, i) => i !== stats);
  return { stats, header };
}

// Runs in the browser. Same as findHpControls, for the wild shape controls ("Change wild shape hit points").
function findWildShapeControls() {
  const all = [...document.querySelectorAll('[aria-label="Change wild shape hit points"]')];
  const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "WILD SHAPE HP");
  let stats = -1;
  for (let a = label?.parentElement; a && stats < 0; a = a.parentElement) {
    const hit = all.find((el) => a.contains(el));
    if (hit) stats = all.indexOf(hit);
  }
  const header = all.findIndex((_, i) => i !== stats);
  return { stats, header };
}

// Opens the wild shape HP box from one control, checks it (no violations, shows the form's "+4 Temp" line), closes it.
async function checkWildShapeBox(page, index, prefix, shot) {
  if (index < 0) {
    console.log(`${prefix} no "Change wild shape hit points" control found`);
    return 1;
  }
  let failures = 0;
  await page.locator('[aria-label="Change wild shape hit points"]').nth(index).click();
  await page.getByText("Set to", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, shot) });
  const modal = await page.evaluateHandle(findHpModal);
  if (!modal.asElement()) {
    failures++;
    console.log(`${prefix} modal not found`);
  } else {
    const text = await page.evaluate((el) => el.textContent || "", modal);
    if (!text.includes("Wild Shape HP")) {
      failures++;
      console.log(`${prefix} modal is not the wild shape box`);
    }
    if (!text.includes("+4 Temp")) {
      failures++;
      console.log(`${prefix} modal does not show the form's "+4 Temp" line`);
    }
    for (const v of await page.evaluate(findLayoutViolations, modal)) {
      failures++;
      console.log(`${prefix} ${v}`);
    }
  }
  await page.getByText("✕", { exact: true }).first().click();
  await page.getByText("Set to", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
  await page.waitForTimeout(400);
  return failures;
}

// Opens the Druid's Stats tab and checks the Active Wild Shape box and the header badge that opens the same box.
async function checkWildShapeScreen(ctx, width) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/character/${DRUID_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText("WILD SHAPE HP", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes("WILD SHAPE HP"));
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `WildShape-Stats-${width}.png`) });
  let failures = 0;
  for (const v of await page.evaluate(findLayoutViolations, null)) {
    failures++;
    console.log(`[${width}px wild shape Stats] ${v}`);
  }
  failures += await checkWildShapeTempLine(page, `[${width}px wild shape Stats]`);
  const controls = await page.evaluate(findWildShapeControls);
  failures += await checkWildShapeBox(page, controls.stats, `[${width}px wild shape box from Stats number]`, `WildShapeModal-${width}.png`);
  failures += await checkWildShapeBox(page, controls.header, `[${width}px wild shape box from header badge]`, `WildShapeModal-header-${width}.png`);
  await page.close();
  return failures;
}

// Checks the Active Wild Shape card shows the form's temp HP next to its HP, as "(+4 Temp)".
async function checkWildShapeTempLine(page, prefix) {
  const visible = await page.getByText("(+4 Temp)", { exact: true }).first().isVisible();
  if (visible) return 0;
  console.log(`${prefix} Active Wild Shape card does not show "(+4 Temp)"`);
  return 1;
}

// Runs in the browser. The Active Wild Shape card: the smallest ancestor of the "WILD SHAPE HP" label that also holds the "ACTIVE WILD SHAPE" badge.
function findWildShapeCard() {
  const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "WILD SHAPE HP");
  for (let a = label?.parentElement; a; a = a.parentElement) {
    if ((a.textContent || "").includes("ACTIVE WILD SHAPE")) return a;
  }
  return null;
}

// Opens the Druid's Features tab (same shared Active Wild Shape card as Stats) and checks the card for layout violations.
async function checkWildShapeFeatures(ctx, width) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/character/${DRUID_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Features", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText("WILD SHAPE HP", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes("WILD SHAPE HP"));
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `WildShape-Features-${width}.png`) });
  let failures = await checkWildShapeTempLine(page, `[${width}px wild shape Features]`);
  const card = await page.evaluateHandle(findWildShapeCard);
  if (!card.asElement()) {
    failures++;
    console.log(`[${width}px wild shape Features] no Active Wild Shape card found`);
  } else {
    for (const v of await page.evaluate(findLayoutViolations, card)) {
      failures++;
      console.log(`[${width}px wild shape Features card] ${v}`);
    }
  }
  await page.close();
  return failures;
}

// Checks what a picker screen must show that the layout rules cannot see: texts and input placeholders on the page,
// and (`plainRaceRow`) the plain race row. Returns one message per missing control.
async function checkExpected(page, expect) {
  const out = [];
  for (const text of expect.texts ?? []) {
    if (!(await page.getByText(text, { exact: true }).first().isVisible())) out.push(`missing "${text}"`);
  }
  for (const placeholder of expect.placeholders ?? []) {
    if (!(await page.getByPlaceholder(placeholder).first().isVisible())) out.push(`missing the input with placeholder "${placeholder}"`);
  }
  for (const text of expect.absent ?? []) {
    if (await page.getByText(text, { exact: true }).first().isVisible()) out.push(`"${text}" is shown but should not be`);
  }
  for (const text of expect.disabled ?? []) {
    const { disabled, state } = await page.evaluate(buttonDisabled, text);
    if (disabled !== true) out.push(`"${text}" is not disabled (${state})`);
  }
  for (const text of expect.enabled ?? []) {
    const { disabled, state } = await page.evaluate(buttonDisabled, text);
    if (disabled !== false) out.push(`"${text}" is not enabled (${state})`);
  }
  if (expect.fitsWidth) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) out.push(`the page scrolls sideways by ${overflow}px`);
  }
  if (expect.plainRaceRow && !(await page.evaluate(findPlainRaceRow, expect.plainRaceRow))) {
    out.push(`no plain "${expect.plainRaceRow}" row under "Subraces / Variants:"`);
  }
  return out;
}

// Visits one screen of SCREENS and checks it. Returns the number of violations (or 1 if it never became ready).
async function visitScreen(page, width, screen, state) {
  const prefix = `[${width}px ${screen.name}]`;
  const ready = screen.modal ?? screen.ready;
  const readyLocator = typeof ready === "string" ? page.getByText(ready, { exact: true }) : page.getByText(ready);
  try {
    if (screen.modal || screen.fresh || state.route !== screen.route) {
      await page.goto(`${BASE}${screen.route}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1500);
    }
    for (const tab of screen.tabs ?? []) {
      await page.getByText(tab, { exact: true }).first().click();
      await page.waitForTimeout(500);
    }
    if (screen.open) await screen.open(page);
    await readyLocator.first().waitFor({ state: "visible", timeout: 10000 });
  } catch {
    console.log(`${prefix} did not show ${typeof ready === "string" ? `"${ready}"` : ready} in time`);
    state.route = null;
    return 1;
  }
  if (screen.scrollTo) {
    await page.evaluate((needle) => {
      const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes(needle));
      el?.scrollIntoView({ block: "center" });
    }, screen.scrollTo);
  }
  await page.waitForTimeout(screen.modal ? 500 : 300);
  await page.screenshot({ path: join(SHOTS, `${screen.name.replace(/\W+/g, "-")}-${width}.png`) });
  state.route = screen.modal ? null : screen.route;
  let violations;
  if (screen.modal) {
    const root = await page.evaluateHandle(findDialog, screen.modal);
    if (!root.asElement()) {
      console.log(`${prefix} modal "${screen.modal}" not found`);
      return 1;
    }
    violations = await page.evaluate(findLayoutViolations, root);
  } else {
    violations = await page.evaluate(findLayoutViolations, null);
  }
  violations = [...violations, ...(await checkNoShrinkRows(page, screen))];
  if (screen.headerName) violations = [...violations, ...(await page.evaluate(findHeaderNameViolations, screen.headerName))];
  if (screen.expect) violations = [...violations, ...(await checkExpected(page, screen.expect))];
  for (const v of violations) console.log(`${prefix} ${v}`);
  return violations.length;
}

// Visits the screens in SCREENS that ONLY selects, on one width's context.
async function checkScreens(ctx, width) {
  const page = await ctx.newPage();
  const state = { route: null };
  let failures = 0;
  for (const screen of SCREENS) if (selected(screen.name)) failures += await visitScreen(page, width, screen, state);
  await page.close();
  return failures;
}

// Opens the Stats tab of the Rendar and checks the hit point modal from the Stats HP number and from the header badge.
async function checkHitPointModals(ctx, width) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  let failures = 0;
  const controls = await page.evaluate(findHpControls);
  const entries = [
    ["Stats number", controls.stats, `HpModal-${width}.png`],
    ["header badge", controls.header, `HpModal-header-${width}.png`],
  ];
  for (const [entry, index, shot] of entries) {
    const prefix = `[${width}px HP modal from ${entry}]`;
    if (index < 0) {
      failures++;
      console.log(`${prefix} no "Change hit points" control found`);
      continue;
    }
    await page.locator('[aria-label="Change hit points"]').nth(index).click();
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(SHOTS, shot) });
    const modal = await page.evaluateHandle(findHpModal);
    if (!modal.asElement()) {
      failures++;
      console.log(`${prefix} modal not found`);
    } else {
      for (const v of await page.evaluate(findLayoutViolations, modal)) {
        failures++;
        console.log(`${prefix} ${v}`);
      }
    }
    await page.getByText("✕", { exact: true }).first().click();
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(400);
  }
  await page.close();
  return failures;
}

// The checks that open their own page rather than a SCREENS entry. Each is a scenario, so ONLY selects it by name.
const EXTRA_CHECKS = [
  { name: "HP modals", run: checkHitPointModals },
  { name: "Wild Shape Stats", run: checkWildShapeScreen },
  { name: "Wild Shape Features", run: checkWildShapeFeatures },
];

// Every scenario name of this run: the SCREENS entries of the active catalog, then the extra checks.
function scenarioNames() {
  return [...SCREENS.map((screen) => screen.name), ...EXTRA_CHECKS.map((check) => check.name)];
}

// Whether ONLY visits the scenario `name` (every scenario when ONLY is empty).
function selected(name) {
  return ONLY.length === 0 || ONLY.some((term) => name.toLowerCase().includes(term));
}

// The ONLY terms that no scenario name contains. Such a term is a typo, so it fails the run instead of visiting nothing.
function unmatchedOnlyTerms() {
  const names = scenarioNames().map((name) => name.toLowerCase());
  return ONLY.filter((term) => !names.some((name) => name.includes(term)));
}

// Runs every check at one width, on that width's own browser context. Returns the number of violations.
async function checkWidth(browser, seed, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 851 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  try {
    await ctx.addInitScript(seedBrowser, seed);
    let failures = await checkScreens(ctx, width);
    for (const check of EXTRA_CHECKS) if (selected(check.name)) failures += await check.run(ctx, width);
    return failures;
  } finally {
    await ctx.close();
  }
}

// Runs every check at every width, the widths at the same time. Returns the number of violations.
async function runChecks(browser) {
  const seed = buildSeed();
  const counts = await Promise.all(WIDTHS.map((width) => checkWidth(browser, seed, width)));
  return counts.reduce((total, count) => total + count, 0);
}

let browser = null;

// Stops the browser and the server this script started, then exits with `code`.
async function shutdown(code) {
  await browser?.close().catch(() => {});
  await stopServer();
  process.exit(code);
}

async function main() {
  const unmatched = unmatchedOnlyTerms();
  if (unmatched.length > 0) {
    console.error(`ONLY matches no scenario: ${unmatched.map((term) => `"${term}"`).join(", ")}. Scenarios in this run: ${scenarioNames().join(", ")}`);
    return 2;
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    browser = await chromium.launch();
  } catch (error) {
    console.error(`Could not launch Chromium (${error.message.split("\n")[0]}).\nInstall it once with: npx playwright install chromium`);
    return 2;
  }
  const logPath = join(SHOTS, "expo-server.log");
  if ((await httpStatus(BASE)) > 0) {
    console.log(`Using the server already running at ${BASE}. If it started before your latest code change it may be stale; stop it and rerun to test fresh code.`);
  } else {
    console.log(`Starting Expo web on port ${PORT} (log: ${logPath}).`);
    const state = await startServer(logPath);
    if (state !== "up") {
      console.error(
        state === "exited"
          ? `Expo web stopped before it answered 200 at ${BASE}. Server log: ${logPath}`
          : `No Expo web server answered 200 at ${BASE} within ${SERVER_WAIT_MS / 1000} s. Server log: ${logPath}`,
      );
      return 2;
    }
  }
  console.log(`Catalog: ${INTEGRATED ? "integrated (seeded)" : "SRD Baseline"}`);
  const failures = await runChecks(browser);
  console.log(failures === 0 ? "GREEN: no layout violations" : `RED: ${failures} violations`);
  return failures === 0 ? 0 : 1;
}

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) process.on(signal, () => shutdown(code));
// Last resort on any exit path: the server's process group must not outlive this script.
process.on("exit", () => signalServerGroup("SIGKILL"));

main().then(
  (code) => {
    // Stop the server and browser in one place: the `finally` equivalent for every return path above.
    return shutdown(code);
  },
  (error) => {
    console.error(error);
    return shutdown(1);
  },
);
