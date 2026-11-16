/** The name of one die as its accessible label: its sides, the face it shows, and whether it was dropped. */
export function dieLabel(sides: number, face: number, dropped: boolean): string {
  const suffix = dropped ? ", dropped" : "";
  return sides === 100 ? `d100 showing ${face}${suffix}` : `d${sides} showing ${face}${suffix}`;
}
