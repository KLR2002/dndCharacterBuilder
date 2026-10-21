// Responsive layout check at phone widths. Visits every screen in SCREENS (the character tabs and the
// Builder subtabs, home, settings, and the Rest, Conditions and New Character modals), the hit point
// modal (from the Stats HP number and the header HP badge), and the Active Wild Shape box (Stats tab,
// header badge, Features tab).
//
// Usage: `npm run layout:check` (not part of check:all). The script starts the Expo web server itself
// on the port in BASE, unless a server already answers there. `npm run layout:check -- --integrated`
// (or LAYOUT_INTEGRATED=1) seeds the integrated catalog instead of the SRD Baseline. The first run
// needs `npx playwright install chromium` once.
//
// Fails (one line per violation) on squeezed text and on elements that stick out of a non-scrolling
// parent. Env: BASE (default http://localhost:8099), WIDTHS (default "393,360,320,412"), SHOTS
// (screenshot dir, default a layout-check folder under the OS temp dir). Exit: 0 green, 1 violations,
// 2 no browser or no server (the server log path is printed then).
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";
import { makeChar, defaultSettings } from "../checks/testUtils.ts";
import { REQUIRED_CATALOG_FORMAT } from "../src/services/compendiumStorage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE ?? "http://localhost:8099";
const PORT = new URL(BASE).port || "8099";
const SHOTS = process.env.SHOTS ?? join(tmpdir(), "layout-check");
const WIDTHS = (process.env.WIDTHS ?? "393,360,320,412").split(",").map(Number);
const INTEGRATED = process.argv.includes("--integrated") || process.env.LAYOUT_INTEGRATED === "1";
const SERVER_WAIT_MS = 180_000;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// HTTP status of `url`, or 0 when nothing answers.
async function httpStatus(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    await res.body?.cancel();
    return res.status;
  } catch {
    return 0;
  }
}

// The Expo web server this script started. It runs in its own process group, so one signal stops it and its children.
let server = null;

function signalServerGroup(signal) {
  if (server) {
    try {
      process.kill(-server.pid, signal);
    } catch {
      // The group is already gone.
    }
  }
}

function serverGroupAlive() {
  if (!server) return false;
  try {
    process.kill(-server.pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopServer() {
  if (!server) return;
  signalServerGroup("SIGTERM");
  for (let i = 0; i < 25 && serverGroupAlive(); i++) await sleep(200);
  if (serverGroupAlive()) signalServerGroup("SIGKILL");
  server = null;
}

// Starts `npx expo start --web --clear` with CI set (no reload prompts, no telemetry), logging to `logPath`.
// `--clear` drops Metro's cache, so a stale bundle cannot pass the check.
// Resolves "up" once BASE answers 200, "exited" if the process ends first, "timeout" if the wait runs out.
async function startServer(logPath) {
  const fd = fs.openSync(logPath, "w");
  let exited = false;
  const child = spawn("npx", ["expo", "start", "--web", "--port", PORT, "--clear"], {
    cwd: ROOT,
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  child.on("exit", () => {
    exited = true;
  });
  child.on("error", () => {
    exited = true;
  });
  server = child;
  const deadline = Date.now() + SERVER_WAIT_MS;
  while (!exited && Date.now() < deadline) {
    if ((await httpStatus(BASE)) === 200) return "up";
    await sleep(1000);
  }
  return exited ? "exited" : "timeout";
}

// The integrated catalog's collections, read from dnd5eToolsScrap/data. Conditions are optional.
function readScrapJson(name) {
  return JSON.parse(fs.readFileSync(join(ROOT, "dnd5eToolsScrap", "data", `${name}.json`), "utf8"));
}

function integratedCollections() {
  const hasConditions = fs.existsSync(join(ROOT, "dnd5eToolsScrap", "data", "conditions.json"));
  return {
    hasIntegratedCatalog: true,
    catalogFormat: REQUIRED_CATALOG_FORMAT,
    integratedAt: new Date().toISOString(),
    races: readScrapJson("races"),
    classes: readScrapJson("classes"),
    feats: readScrapJson("feats"),
    backgrounds: readScrapJson("backgrounds"),
    items: readScrapJson("items"),
    spells: readScrapJson("spells"),
    beasts: readScrapJson("beasts"),
    conditions: hasConditions ? readScrapJson("conditions") : [],
    optionsAndFeatures: readScrapJson("options_and_features"),
    books: readScrapJson("books"),
  };
}

// Record sources the active catalog uses, so seeded characters refer to records the app can find.
const catalogDir = INTEGRATED ? join(ROOT, "dnd5eToolsScrap", "data") : join(ROOT, "src", "data");
const catalogCache = new Map();
function catalogRecords(collection) {
  if (!catalogCache.has(collection)) {
    catalogCache.set(collection, JSON.parse(fs.readFileSync(join(catalogDir, `${collection}.json`), "utf8")));
  }
  return catalogCache.get(collection);
}
function catalogSource(collection, name) {
  const record = catalogRecords(collection).find((r) => r.name === name);
  if (!record) throw new Error(`${name} is not in ${collection}.json (${catalogDir})`);
  return record.source;
}

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
// Info button) at level 6. The Race tab shows her language choice. In integrated mode the race has a subrace,
// so its language heading is the long one ("Half-Elf (Moon Elf or Sun Elf Descent): Languages").
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
    proficiencyPicks: { [`${KENSEI_PATH}#1`]: ["Rapier"] },
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
      bardCharacter(),
    ],
    folders: [],
    settings: {
      ...defaults,
      hasCompletedFirstRun: true,
      activeResourceBooks: INTEGRATED ? [...new Set([...defaults.activeResourceBooks, "MM"])] : defaults.activeResourceBooks,
    },
    integrated: INTEGRATED ? integratedCollections() : null,
  };
}

// Runs in the browser before the app loads. Seeds localStorage once per context and, in integrated
// mode, the IndexedDB catalog the app reads on launch.
function seedBrowser(s) {
  if (localStorage.getItem("__seeded")) return;
  localStorage.setItem("@dnd5e_characters", JSON.stringify(s.characters));
  localStorage.setItem("@dnd5e_folders", JSON.stringify(s.folders));
  localStorage.setItem("@dnd5e_app_settings", JSON.stringify(s.settings));
  if (s.integrated) {
    const open = indexedDB.open("dnd5e_compendium_db", 2);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("collections")) open.result.createObjectStore("collections");
    };
    open.onsuccess = () => {
      const tx = open.result.transaction("collections", "readwrite");
      tx.objectStore("collections").put(s.integrated, "@dnd5e_integrated_compendium");
    };
  }
  localStorage.setItem("__seeded", "1");
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
const BARD_ROUTE = `/character/${BARD_ID}`;
const SCREENS = [
  { name: "Builder Abilities", route: RENDAR_ROUTE, tabs: ["Builder", "Abilities"], ready: /points remaining/i },
  { name: "Builder Race", route: RENDAR_ROUTE, tabs: ["Builder", "Race"], ready: /traits:/i },
  { name: "Builder Race language choice", route: HALF_ELF_ROUTE, tabs: ["Builder", "Race"], ready: /: Languages/, scrollTo: ": Languages" },
  { name: "Builder Class feats", route: HALF_ELF_ROUTE, tabs: ["Builder", "Class"], ready: /Selected Ability Improvements/i, scrollTo: "Selected Ability Improvements" },
  { name: "Builder Background", route: RENDAR_ROUTE, tabs: ["Builder", "Background"], ready: /background benefits/i, scrollTo: "Claim again" },
  { name: "Builder Class", route: RENDAR_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Starting Equipment" },
  { name: "Builder Class proficiency choices", route: RANGER_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Class & Subclass Choices" },
  // Kensei weapons (integrated mode only): the Path of the Kensei choices, and the weapon rows they add to the sheet.
  ...(INTEGRATED
    ? [
        { name: "Builder Class kensei weapon choices", route: KENSEI_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Path of the Kensei" },
        { name: "Stats kensei weapon proficiencies", route: KENSEI_ROUTE, tabs: ["Stats"], ready: /hit points/i, scrollTo: "Weapon Proficiencies" },
      ]
    : []),
  { name: "Builder Class skill proficiency choices", route: BARD_ROUTE, tabs: ["Builder", "Class"], ready: /total level/i, scrollTo: "Class & Subclass Choices" },
  { name: "Stats", route: RENDAR_ROUTE, tabs: ["Stats"], ready: /hit points/i },
  { name: "Stats long header name", route: LONG_NAME_ROUTE, tabs: ["Stats"], ready: /hit points/i, headerName: LONG_NAME },
  { name: "Stats add tool modal", route: RENDAR_ROUTE, tabs: ["Stats"], open: (page) => page.getByLabel("Add tool proficiency").first().click(), modal: "Add Tool Proficiency" },
  { name: "Stats add language modal", route: RENDAR_ROUTE, tabs: ["Stats"], open: (page) => page.getByLabel("Add language").first().click(), modal: "Add Language" },
  { name: "Spells", route: WIZARD_ROUTE, tabs: ["Spells"], ready: /add spells/i },
  { name: "Inventory", route: WIZARD_ROUTE, tabs: ["Inventory"], ready: /total wealth/i },
  { name: "Features", route: RENDAR_ROUTE, tabs: ["Features"], ready: /resource trackers/i },
  { name: "Journal", route: RENDAR_ROUTE, tabs: ["Journal"], ready: /character name/i },
  { name: "Actions", route: RENDAR_ROUTE, tabs: ["Actions"], ready: /attack action/i },
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

// Visits one screen of SCREENS and checks it. Returns the number of violations (or 1 if it never became ready).
async function visitScreen(page, width, screen, state) {
  const prefix = `[${width}px ${screen.name}]`;
  const ready = screen.modal ?? screen.ready;
  const readyLocator = typeof ready === "string" ? page.getByText(ready, { exact: true }) : page.getByText(ready);
  try {
    if (screen.modal || state.route !== screen.route) {
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
  for (const v of violations) console.log(`${prefix} ${v}`);
  return violations.length;
}

// Visits every screen in SCREENS on one width's context.
async function checkScreens(ctx, width) {
  const page = await ctx.newPage();
  const state = { route: null };
  let failures = 0;
  for (const screen of SCREENS) failures += await visitScreen(page, width, screen, state);
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

// Runs every check at every width. Returns the number of violations.
async function runChecks(browser) {
  const seed = buildSeed();
  let failures = 0;
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 851 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(seedBrowser, seed);
    failures += await checkScreens(ctx, width);
    failures += await checkHitPointModals(ctx, width);
    failures += await checkWildShapeScreen(ctx, width);
    failures += await checkWildShapeFeatures(ctx, width);
    await ctx.close();
  }
  return failures;
}

let browser = null;

// Stops the browser and the server this script started, then exits with `code`.
async function shutdown(code) {
  await browser?.close().catch(() => {});
  await stopServer();
  process.exit(code);
}

async function main() {
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
