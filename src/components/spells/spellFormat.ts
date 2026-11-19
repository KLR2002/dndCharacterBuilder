/** Ordinal text for a spell level or a class level: 1st, 2nd, 3rd, 4th. */
export function formatOrdinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

/** The text a spell detail modal shows. */
export interface SpellDetailPayload {
  title: string;
  subtitle?: string;
  content: string;
}
