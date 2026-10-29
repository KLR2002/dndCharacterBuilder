/** The mark between a swap's grant id and the name it replaces. Saved picks are stored under ids that carry it, so it never changes. */
export const SWAP_MARK = "#swap:";

/** The id of the swap that replaces one original of a grant. Its pick is stored under this id. */
export function swapId(grantId: string, original: string): string {
  return `${grantId}${SWAP_MARK}${original}`;
}

/** Whether an id is a swap's: a language, skill, tool, weapon or armor swap alike. */
export function isSwapId(id: string): boolean {
  return id.includes(SWAP_MARK);
}

/** The original a swap id replaces. */
export function originalOfSwapId(id: string): string {
  return id.slice(id.lastIndexOf(SWAP_MARK) + SWAP_MARK.length);
}

const SWAP_LABELS: Record<string, string> = { languages: "Language", skills: "Skill", tools: "Tool", weapons: "Weapon", armor: "Armor" };

/** The word a notice gives a swap, read from the category its grant id carries. */
export function swapLabelOf(id: string): string {
  const category = /#(\w+):/.exec(id)?.[1];
  return (category && SWAP_LABELS[category]) || "Proficiency";
}
