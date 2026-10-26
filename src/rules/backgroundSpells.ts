import type { BackgroundData } from "../types/dnd5e.ts";

/**
 * The spell names a background's expanded lists add to the list of each spellcasting class the character has (ADR 0017).
 * The lists are keyed by spell level (the cantrip list is `s0`); a background's lists carry no level gate, so every name
 * counts. A background without lists gives none.
 */
export function backgroundExpandedSpellNames(background: BackgroundData | undefined): string[] {
  const names: string[] = [];
  for (const grant of background?.additionalSpells ?? []) {
    for (const list of Object.values(grant.expanded ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const name of list) {
        if (typeof name === "string") names.push(name);
      }
    }
  }
  return names;
}
