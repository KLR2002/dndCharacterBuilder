import type { Character, KnownSpell, SkillChoiceEntry } from "../types/character.ts";
import type { ClassData, RaceData } from "../types/dnd5e.ts";
import { spellAbilityOf } from "./classData.ts";
import { totalLevel } from "./proficiencies.ts";
import { availableRuleChoices } from "./ruleChoices.ts";
import { migrateLegacyRacialCantrip, moveLegacyRacePickIds } from "./choices/featSpells.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Character-level migration only. Never mutate or discard the original record.
 *
 * `raceCatalog` is optional so this stays a pure function of the record; when
 * supplied it lets the migration notice an ancestry choice that was never
 * recorded, which only the catalog can say is missing. `classCatalog` works the
 * same way for the class that owns a legacy spell list; without it the SRD
 * Baseline's classes stand in.
 */
export function migrateCharacter(raw: unknown, raceCatalog?: RaceData[], classCatalog: readonly ClassData[] = []): Character {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" ||
      typeof raw.createdAt !== "number" || !Number.isFinite(raw.createdAt)) {
    throw new Error("Invalid character: expected an identified character record");
  }
  const c = raw as unknown as Character;
  for (const key of ["classes", "knownSpells", "preparedSpells", "chosenSkills", "skillChoices", "racialChoiceBonus", "classChoices", "needsReview"]) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) throw new Error(`Invalid character: ${key} must be an array`);
  }
  if (c.ruleChoices !== undefined) {
    if (!Array.isArray(c.ruleChoices)) throw new Error("Invalid character: ruleChoices must be an array");
    if (!c.ruleChoices.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && typeof entry.choose === "number" &&
      Array.isArray(entry.from) && entry.from.every((v) => typeof v === "string") &&
      Array.isArray(entry.picked) && entry.picked.every((v) => typeof v === "string")
    )) throw new Error("Invalid character: malformed ruleChoices");
  }
  const classes = c.classes ?? [];
  if (!classes.every(entry => isRecord(entry) && typeof entry.className === "string" && typeof entry.source === "string")) {
    throw new Error("Invalid character: malformed classes");
  }
  const known = c.knownSpells ?? [];
  if (!known.every(entry => isRecord(entry) && typeof entry.name === "string" && typeof entry.source === "string" &&
      (entry.ownerKey === undefined || typeof entry.ownerKey === "string"))) throw new Error("Invalid character: malformed knownSpells");
  const prepared = c.preparedSpells ?? [];
  if (!prepared.every(key => typeof key === "string")) throw new Error("Invalid character: malformed preparedSpells");
  for (const key of ["pactSlotsUsed", "usedPactSlots"] as const) {
    if (c[key] !== undefined && (typeof c[key] !== "number" || !Number.isFinite(c[key]) || c[key]! < 0)) {
      throw new Error(`Invalid character: ${key} must be nonnegative`);
    }
  }
  // Match the legacy SpellsTab mapping, including its non-PHB class-name entries.
  const owner = classes.find(entry => spellAbilityOf(entry, classCatalog) ||
    ["Artificer", "Arcane Trickster", "Eldritch Knight"].includes(entry.className));
  const ownerKey = owner ? `${owner.className}__${owner.source}` : "unknown__unknown";
  const knownSpells: KnownSpell[] = known.map(spell => ({ ...spell, ownerKey: spell.ownerKey ?? ownerKey }));
  const chosenSkills = c.chosenSkills ?? [];
  if (!chosenSkills.every(skill => typeof skill === "string") || !(c.needsReview ?? []).every(message => typeof message === "string")) {
    throw new Error("Invalid character: malformed skill choices or review flags");
  }
  let skillChoices = c.skillChoices ?? [];
  const needsReview = new Set(c.needsReview ?? []);
  if (c.skillChoices === undefined && chosenSkills.length) {
    const sources = [
      ...classes.map(entry => ({ origin: "class" as const, name: entry.className, source: entry.source })),
      ...(c.background ? [{ origin: "background" as const, ...c.background }] : []),
      ...(c.race ? [{ origin: "race" as const, ...c.race }] : []),
    ];
    if (sources.length === 1 && sources[0].origin !== "race") {
      const source = sources[0];
      // ponytail: retain only evidenced picks; catalog reconciliation can expand the available pool later.
      const entry: SkillChoiceEntry = { id: `${source.origin}__${source.name}__${source.source}__skills`, origin: source.origin,
        choose: chosenSkills.length, from: [...chosenSkills], picked: [...chosenSkills] };
      skillChoices = [entry];
    } else needsReview.add("skillChoices: legacy chosenSkills ownership is ambiguous");
  }
  const ruleChoices = c.ruleChoices ?? [];
  // A character saved before Rule Choices existed has no recorded pick for an
  // ancestry choice it should have made - a variant half-elf never had the
  // option available. Flag it rather than leaving the sheet looking complete.
  // Only flag a choice the character could actually make: a first-level aasimar
  // has not reached the third level its Revelation needs, so flagging it would
  // leave a permanent, meaningless review notice.
  if (c.race && raceCatalog && ruleChoices.length === 0) {
    const recorded = new Set(ruleChoices.map((entry) => entry.id));
    const missing = availableRuleChoices(c, raceCatalog, totalLevel(c)).filter(
      (choice) => !recorded.has(choice.id)
    );
    if (missing.length > 0) {
      needsReview.add("ruleChoices: this ancestry offers a choice that was never recorded");
    }
  }

  const migrated: Character = {
    ...c,
    ...(needsReview.size ? { needsReview: [...needsReview] } : {}),
    ruleChoices,
    classes,
    chosenSkills: c.chosenSkills ?? [],
    standardArrayPicks: c.standardArrayPicks ?? {},
    skillChoices,
    racialChoiceBonus: c.racialChoiceBonus ?? [],
    classChoices: c.classChoices ?? [],
    knownSpells,
    preparedSpells: prepared.map(key => key.split("__").length < 4 ? `${key}__${ownerKey}` : key),
    pactSlotsUsed: c.pactSlotsUsed ?? c.usedPactSlots ?? 0,
  };
  // A saved legacy racial cantrip moves to the race's own pick once the catalog says what the race grants. A race the catalog
  // does not hold is not loaded, so the cantrip is kept as saved, with no notice.
  const rekeyed = moveLegacyRacePickIds(migrated);
  return raceCatalog && isRaceListed(c.race, raceCatalog) ? migrateLegacyRacialCantrip(rekeyed, raceCatalog) : rekeyed;
}

/**
 * Whether the catalog holds a saved race. The record of its own book is the one held; when the catalog holds no record of that
 * book, the race is found by its name, as the reader finds it (see raceGrantsOf).
 */
function isRaceListed(race: { name: string; source: string } | null | undefined, races: readonly RaceData[]): boolean {
  if (!race) return false;
  if (races.some((record) => record.name === race.name && record.source === race.source)) return true;
  return !races.some((record) => record.source === race.source) && races.some((record) => record.name === race.name);
}
