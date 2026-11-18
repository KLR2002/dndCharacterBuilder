import type { AbilityScoreChoice } from "../types/models.ts";
import type { ProficiencyReport } from "../types/proficiency.ts";

/**
 * The choose keys the scraper states. `entry` is the record's own sentence for the choice; the choice itself comes from
 * `from`, `count` and `amount`. Any other key makes the block unparsed (ADR 0019).
 */
const KNOWN_CHOOSE_KEYS = new Set(["from", "count", "amount", "entry"]);

/**
 * The Increase Choices of an ability entry, as `abilityScoreChoices` (count and amount default to 1). A choose block with a
 * key the scraper does not state, or with no `from` list, is reported as unparsed and writes no choice. Returns an object
 * spreading the field, which is absent when the record states no choice.
 */
export function scrapeAbilityChoices(
  ability: any,
  subject: { owner: string; feature: string; level: number },
  report: ProficiencyReport
): { abilityScoreChoices?: AbilityScoreChoice[] } {
  const list = Array.isArray(ability) ? ability : [ability];
  const choices: AbilityScoreChoice[] = [];
  const unparsed: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || item.choose === undefined) continue;
    const choose = item.choose;
    const unknownKeys = typeof choose === "object" && choose !== null ? Object.keys(choose).filter((key) => !KNOWN_CHOOSE_KEYS.has(key)) : ["*"];
    if (unknownKeys.length > 0 || !Array.isArray(choose.from)) {
      unparsed.push(`choose: ${JSON.stringify(choose)}`);
      continue;
    }
    choices.push({ from: choose.from, count: choose.count ?? 1, amount: choose.amount ?? 1 });
  }
  if (unparsed.length > 0) report.unparsed.push({ ...subject, unparsed });
  return choices.length > 0 ? { abilityScoreChoices: choices } : {};
}
