import type { ActiveBooks } from "../constants/books.ts";
import type { AsiSelection, Character, KnownSpell, SkillChoiceEntry } from "../types/character.ts";
import type { ClassData, RaceData } from "../types/dnd5e.ts";
import { spellAbilityOf } from "./classData.ts";
import { totalLevel } from "./proficiencies.ts";
import { availableRuleChoices } from "./ruleChoices.ts";
import { migrateLegacyRacialCantrip, moveLegacyRacePickIds } from "./choices/featSpells.ts";
import { heldRaceListed } from "./raceLookup.ts";
import { BACKGROUND_FEAT_SOURCE, UNKNOWN_OWNER_KEY } from "../constants/rules.ts";

const ANCESTRY_CHOICE_NOTICE = "Your ancestry has a choice to make in the Builder.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * One entry per feat name. A save made before a feat was held once can carry the race's copy and the background's; the
 * background's is kept because the builder cannot remove it. A feat's picks and counters are keyed by the feat, so they
 * stay with the kept entry. The ability increase is taken from the dropped entry when the kept one has none, so the
 * scores lose only the double count.
 */
function oneEntryPerFeat(entries: AsiSelection[]): AsiSelection[] {
  const kept: AsiSelection[] = [];
  const indexByName = new Map<string, number>();
  for (const entry of entries) {
    const name = entry.featName?.toLowerCase();
    if (!name) {
      kept.push(entry);
      continue;
    }
    const index = indexByName.get(name);
    if (index === undefined) {
      indexByName.set(name, kept.length);
      kept.push(entry);
      continue;
    }
    const current = kept[index];
    const preferred = current.featSource !== BACKGROUND_FEAT_SOURCE && entry.featSource === BACKGROUND_FEAT_SOURCE ? entry : current;
    const dropped = preferred === entry ? current : entry;
    kept[index] = !preferred.featAbility && dropped.featAbility ? { ...preferred, featAbility: dropped.featAbility } : preferred;
  }
  return kept.length === entries.length ? entries : kept;
}

/**
 * Character-level migration only. Never mutate or discard the original record.
 *
 * `raceCatalog` is optional so this stays a pure function of the record; when
 * supplied it lets the migration notice an ancestry choice that was never
 * recorded, which only the catalog can say is missing. `classCatalog` works the
 * same way for the class that owns a legacy spell list; without it the SRD
 * Baseline's classes stand in. `activeBooks` picks, among the records of the
 * character's race, the one a legacy racial cantrip is checked against.
 */
export function migrateCharacter(
  raw: unknown,
  raceCatalog: RaceData[] | undefined,
  classCatalog: readonly ClassData[] = [],
  activeBooks: ActiveBooks,
): Character {
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
  const ownerKey = owner ? `${owner.className}__${owner.source}` : UNKNOWN_OWNER_KEY;
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
    } else needsReview.add("Some skill picks could not be matched to a class or background. Check them in the Builder.");
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
    const missing = availableRuleChoices(c, raceCatalog, totalLevel(c), activeBooks).filter(
      (choice) => !recorded.has(choice.id)
    );
    if (missing.length > 0) needsReview.add(ANCESTRY_CHOICE_NOTICE);
    else needsReview.delete(ANCESTRY_CHOICE_NOTICE);
  } else if (raceCatalog || !c.race) {
    // A recorded choice, or no ancestry at all, leaves the notice nothing to ask for.
    needsReview.delete(ANCESTRY_CHOICE_NOTICE);
  }

  const migrated: Character = {
    ...c,
    ...(needsReview.size ? { needsReview: [...needsReview] } : {}),
    // A save that holds the Custom Lineage race is a Custom Lineage, whether or not its flag was written.
    customLineage: c.customLineage === true || c.race?.name === "Custom Lineage",
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
    ...(Array.isArray(c.originFeats) ? { originFeats: oneEntryPerFeat(c.originFeats) } : {}),
  };
  // The stored list is spread above; when every notice in it was removed, the character holds no list.
  if (needsReview.size === 0 && c.needsReview?.length) delete migrated.needsReview;
  // A saved legacy racial cantrip moves to the race's own pick once the catalog says what the race grants. A race the catalog
  // does not hold is not loaded, so the cantrip is kept as saved, with no notice.
  const rekeyed = moveLegacyRacePickIds(migrated);
  return raceCatalog && heldRaceListed(c.race, raceCatalog) ? migrateLegacyRacialCantrip(rekeyed, raceCatalog, activeBooks) : rekeyed;
}

