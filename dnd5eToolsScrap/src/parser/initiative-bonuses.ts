import type { InitiativeBonus, ProficiencyReport } from "../types/proficiency.ts";
import { featureKey, proseSentences, type GrantSubject } from "./proficiency-grants.ts";

/**
 * Turns Initiative Bonuses out of feature prose, beside the Proficiency Grant extractor (ADR 0016). A sentence that
 * names initiative and adds or grants a bonus is a candidate. A candidate this extractor cannot read is reported
 * rather than dropped, so a feature never loses its bonus silently. A reviewed override replaces the extracted bonus
 * for its feature.
 */

/** A reviewed Initiative Bonus for one feature, written as the bonus itself. */
export interface InitiativeBonusOverride {
  owner: string;
  feature: string;
  level: number;
  bonus: InitiativeBonus;
}

export interface InitiativeBonusExtraction {
  /** The feature's one Initiative Bonus. Absent when it has none, or when its sentences cannot be read. */
  bonus?: InitiativeBonus;
  /** Candidate sentences that could not be read, without their final punctuation. */
  unparsed: string[];
}

type AbilityKey = Extract<InitiativeBonus, { kind: "ability" }>["ability"];

const ABILITY_KEYS = new Map<string, AbilityKey>([
  ["strength", "str"],
  ["dexterity", "dex"],
  ["constitution", "con"],
  ["intelligence", "int"],
  ["wisdom", "wis"],
  ["charisma", "cha"],
]);

const ABILITY = "(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)";

/** "... a bonus to your initiative rolls equal to your Charisma modifier", as the rule text gives it. */
const GIVEN_ABILITY = new RegExp(`\\ba bonus to (?:your )?initiative(?: rolls)? equal to your ${ABILITY} modifier$`, "i");
/** "... add your Intelligence modifier to your initiative rolls", as the rule text adds it. */
const ADDED_ABILITY = new RegExp(`\\badd your ${ABILITY} modifier to (?:your )?initiative(?: rolls)?$`, "i");
/** "When you roll initiative, you can add your Wisdom modifier to the roll", as the rule text states it under its heading. */
const ROLL_ABILITY = new RegExp(`\\bwhen you roll initiative, you can add your ${ABILITY} modifier to the roll$`, "i");

/** "... you all gain a bonus to initiative equal to your proficiency bonus", and "... add your proficiency bonus to your initiative rolls". */
const GIVEN_PROFICIENCY = /\ba bonus to (?:your )?initiative(?: rolls)? equal to your proficiency bonus$/i;
const ADDED_PROFICIENCY = /\badd your proficiency bonus to (?:your )?initiative(?: rolls)?$/i;
/** "When you roll initiative, you can add your proficiency bonus to the roll", as the rule text states it under its heading. */
const ROLL_PROFICIENCY = /\bwhen you roll initiative, you can add your proficiency bonus to the roll$/i;
/** "... you gain a +5 bonus to initiative", and "+5 bonus to initiative" with no article. */
const FLAT = /\+(\d+) bonus to (?:your )?initiative(?: rolls)?$/i;

/**
 * The holder is the one who gains the bonus: "you gain", "you all gain", "you can gain", or "you can give yourself".
 * A bonus that another creature gains is not the holder's, even when the sentence also says "you" in a condition
 * ("each ally who can see you gains a +2 bonus"). The given forms need this; the "add your ... to your initiative
 * rolls" forms name the holder as the one who adds, so they need no check.
 */
const HOLDER_GAINS = /\byou(?: all)?(?: can)? (?:gain|have|get)\b|\bgive yourself\b/i;

/**
 * A sentence that names initiative and gives a bonus to it: "bonus to initiative", "bonus to your initiative rolls",
 * or an "add" to a roll. A bare "bonus" does not count, so "your Proficiency Bonus" in a roll trigger does not match.
 * Advantage and shared initiative counts do not match.
 */
function isInitiativeBonusSentence(sentence: string): boolean {
  return /\binitiative\b/i.test(sentence) && /\b(?:bonus (?:to )?(?:your )?initiative|add)\b/i.test(sentence);
}

/**
 * The sentences of a feature's prose that name initiative and give it a bonus, without their final punctuation.
 * The extractor and the coverage gate both read candidates through this function, so they agree on what a
 * candidate is. Headings are not candidates.
 */
export function candidateSentences(description: string): string[] {
  return proseSentences(description)
    .filter((sentence) => !sentence.startsWith("#"))
    .map((sentence) => sentence.replace(/[.!?]+$/, "").trim())
    .filter(isInitiativeBonusSentence);
}

function parseSentence(sentence: string): InitiativeBonus | null {
  const holderGains = HOLDER_GAINS.test(sentence);
  const abilityMatch = (holderGains ? GIVEN_ABILITY.exec(sentence) : null) ?? ADDED_ABILITY.exec(sentence) ?? ROLL_ABILITY.exec(sentence);
  if (abilityMatch) {
    const ability = ABILITY_KEYS.get((abilityMatch[1] ?? "").toLowerCase());
    return ability ? { kind: "ability", ability } : null;
  }
  const proficiencyAdded = ADDED_PROFICIENCY.test(sentence) || ROLL_PROFICIENCY.test(sentence);
  if (proficiencyAdded || (holderGains && GIVEN_PROFICIENCY.test(sentence))) return { kind: "proficiency" };
  const flat = holderGains ? FLAT.exec(sentence) : null;
  return flat ? { kind: "flat", value: Number(flat[1]) } : null;
}

/**
 * Reads the feature's Initiative Bonus. Sentences that cannot be read leave the feature without a bonus and are
 * returned as `unparsed`. A feature whose sentences give two different bonuses is ambiguous: the bonus is left out
 * and every candidate sentence is reported.
 */
export function extractInitiativeBonus(description: string): InitiativeBonusExtraction {
  const sentences = candidateSentences(description);
  const parsed: InitiativeBonus[] = [];
  const unparsed: string[] = [];
  for (const sentence of sentences) {
    const bonus = parseSentence(sentence);
    if (bonus) parsed.push(bonus);
    else unparsed.push(sentence);
  }
  const distinct = [...new Map(parsed.map((bonus) => [JSON.stringify(bonus), bonus])).values()];
  if (unparsed.length > 0 || distinct.length > 1) return { bonus: undefined, unparsed: unparsed.length > 0 ? unparsed : sentences };
  return { bonus: distinct[0], unparsed: [] };
}

/**
 * The Initiative Bonus of each subject, in subject order. An override for a feature replaces its extracted bonus.
 * Unreadable candidate sentences are added to `report`, once per feature.
 */
export function resolveInitiativeBonuses(
  subjects: GrantSubject[],
  overrides: InitiativeBonusOverride[],
  report: ProficiencyReport
): Array<InitiativeBonus | undefined> {
  const overrideByKey = new Map(overrides.map((override) => [featureKey(override), override]));
  const reported = new Set<string>();
  return subjects.map((subject) => {
    const key = featureKey(subject);
    const override = overrideByKey.get(key);
    if (override) return override.bonus;
    const { bonus, unparsed } = extractInitiativeBonus(subject.description);
    if (unparsed.length > 0 && !reported.has(key)) {
      reported.add(key);
      report.unparsed.push({ owner: subject.owner, feature: subject.feature, level: subject.level, unparsed });
    }
    return bonus;
  });
}
