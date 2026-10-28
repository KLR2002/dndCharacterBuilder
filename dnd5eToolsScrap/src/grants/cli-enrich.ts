/**
 * npm run enrich:grants
 *
 * Adds the `grants` field to the tracked class, subclass and feat features in
 * data/classes.json and data/feats.json, and to each tracked class's starting
 * tools; the `initiativeBonus` field to the tracked class, subclass and feat
 * features, and to the race and subrace traits in data/races.json; and the
 * `additionalSpells` field to each tracked feat, race and subrace that grants spells, and to each tracked background
 * with expanded spell lists, read from the raw feats, races and backgrounds files (the scraper's cache, or
 * the network when it is not cached); and the `spellAttack` field to each tracked spell in data/spells.json that needs an
 * attack roll, read from the raw spells files the same way.
 * Idempotent; writes a file only when its content changes. The only way grants,
 * Initiative Bonuses and feat spell grants reach the tracked data (see ADR 0015,
 * ADR 0016 and ADR 0017).
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ToolsClient } from "../client.ts";
import { PROFICIENCY_GRANT_OVERRIDES } from "../overrides/proficiency-grants.ts";
import { INITIATIVE_BONUS_OVERRIDES } from "../overrides/initiative-bonuses.ts";
import { additionalSpellsByFeat } from "../scrapers/feats.ts";
import { additionalSpellsByRace } from "../scrapers/races.ts";
import { additionalSpellsByBackground } from "../scrapers/backgrounds.ts";
import { fetchResolvedSpells, spellAttackMap } from "../scrapers/spells.ts";
import { enrichGrantFiles, enrichSpellAttacks, type TrackedFiles } from "./enrich.ts";
import { allRefs, classFeatureOnlyRefs, featRefs, traitRefs, type TrackedData } from "./subjects.ts";

const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));
const paths = {
  classes: `${dataDir}classes.json`,
  feats: `${dataDir}feats.json`,
  races: `${dataDir}races.json`,
  backgrounds: `${dataDir}backgrounds.json`,
  spells: `${dataDir}spells.json`,
};

const before: Required<TrackedFiles> = {
  classes: fs.readFileSync(paths.classes, "utf8"),
  feats: fs.readFileSync(paths.feats, "utf8"),
  races: fs.readFileSync(paths.races, "utf8"),
  backgrounds: fs.readFileSync(paths.backgrounds, "utf8"),
};
const client = new ToolsClient();
const rawFeats = await client.fetchJson<{ feat: unknown[] }>("data/feats.json");
const rawRaces = await client.fetchJson<{ race: unknown[]; subrace: unknown[] }>("data/races.json");
const rawBackgrounds = await client.fetchJson<{ background: unknown[] }>("data/backgrounds.json");
const after = enrichGrantFiles(
  before,
  { ...PROFICIENCY_GRANT_OVERRIDES, initiativeBonuses: INITIATIVE_BONUS_OVERRIDES },
  additionalSpellsByFeat(rawFeats),
  additionalSpellsByBackground(rawBackgrounds),
  additionalSpellsByRace(rawRaces),
) as Required<TrackedFiles>;

const names = ["classes", "feats", "races", "backgrounds"] as const;
for (const name of names) {
  if (after[name] !== before[name]) fs.writeFileSync(paths[name], after[name]);
}

const spellsBefore = fs.readFileSync(paths.spells, "utf8");
const spellsAfter = enrichSpellAttacks(spellsBefore, spellAttackMap(await fetchResolvedSpells(client)));
if (spellsAfter !== spellsBefore) fs.writeFileSync(paths.spells, spellsAfter);

const trackedData: TrackedData = {
  classes: JSON.parse(after.classes),
  feats: JSON.parse(after.feats),
  races: JSON.parse(after.races),
  backgrounds: JSON.parse(after.backgrounds),
};
const granted =
  allRefs(trackedData).filter((ref) => ref.holder.grants && ref.holder.grants.length > 0).length +
  trackedData.classes.filter((cls) => cls.grants && cls.grants.length > 0).length;
const initiative = [...classFeatureOnlyRefs(trackedData.classes), ...featRefs(trackedData.feats)].filter((ref) => ref.holder.initiativeBonus).length;
const raceTraits = traitRefs(trackedData.races ?? []).filter((ref) => ref.holder.initiativeBonus).length;
const spellFeats = trackedData.feats.filter((feat) => feat.additionalSpells && feat.additionalSpells.length > 0).length;
const spellRaces = (trackedData.races ?? []).reduce(
  (count, race) => count + [race, ...race.subraces].filter((holder) => holder.additionalSpells && holder.additionalSpells.length > 0).length,
  0
);
const spellBackgrounds = (trackedData.backgrounds ?? []).filter((background) => background.additionalSpells).length;
const spellAttacks = (JSON.parse(spellsAfter) as Array<{ spellAttack?: string[] }>).filter((spell) => spell.spellAttack).length;
const changed = [...names.filter((name) => after[name] !== before[name]), ...(spellsAfter !== spellsBefore ? ["spells"] : [])];
console.log(
  `enrich:grants: ${granted} class, subclass and feat features carry grants; ${initiative} class, subclass and feat features and ${raceTraits} race and subrace traits carry an Initiative Bonus; ${spellFeats} feats, ${spellRaces} races and subraces carry spell grants; ${spellBackgrounds} backgrounds carry expanded spell lists; ${spellAttacks} spells carry an attack roll; ${changed.length ? `wrote ${changed.join(", ")}` : "no file changed"}`
);
