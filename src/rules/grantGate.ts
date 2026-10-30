import type { Character } from "../types/character.ts";

/**
 * Whether a race or subrace grant's gate is open (ADR 0015, ADR 0017). A grant with no gate always is. A gated grant is read
 * only while the character's pick on the Rule Choice the gate names includes the gate's option. The scraper writes the gate
 * into the Catalog, so the app encodes no rule here. A leaf module: the spell reader and the Proficiency Sheet's record
 * grants both use it, so it imports nothing that imports them back.
 */
export function grantGateOpen(character: Pick<Character, "ruleChoices">, grant: object & { gatedBy?: { choiceId: string; option: string } }): boolean {
  const gate = grant.gatedBy;
  if (!gate) return true;
  const picked = character.ruleChoices?.find((entry) => entry.id === gate.choiceId)?.picked ?? [];
  return picked.includes(gate.option);
}
