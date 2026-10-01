import type { Character, KnownSpell, SkillChoiceEntry } from "../types/character.ts";
import { CLASS_DATA } from "./classData.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Character-level migration only. Never mutate or discard the original record. */
export function migrateCharacter(raw: unknown): Character {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" ||
      typeof raw.createdAt !== "number" || !Number.isFinite(raw.createdAt)) {
    throw new Error("Invalid character: expected an identified character record");
  }
  for (const key of ["classes", "knownSpells", "preparedSpells", "chosenSkills", "skillChoices", "racialChoiceBonus", "classChoices", "needsReview"]) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) throw new Error(`Invalid character: ${key} must be an array`);
  }
  const c = raw as unknown as Character;
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
  const owner = classes.find(entry => CLASS_DATA[entry.className]?.spellAbility ||
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
  return {
    ...c,
    ...(needsReview.size ? { needsReview: [...needsReview] } : {}),
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
}
