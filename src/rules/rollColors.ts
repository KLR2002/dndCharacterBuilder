import { ACCENT_PALETTES } from "../constants/theme.ts";

const SILVER = "silver";

/**
 * The accent of the Roll at `index` in a batch. Index 0 takes the selected accent; the later Rolls
 * take the accents after it in palette order, wrapping, with silver used only by index 0 unless it is
 * the selected accent. The sequence repeats from the start when it runs out.
 */
export function rollAccentId(selectedAccentId: string, index: number, accentIds: readonly string[] = Object.keys(ACCENT_PALETTES)): string {
  const start = Math.max(0, accentIds.indexOf(selectedAccentId));
  const rotated = [...accentIds.slice(start), ...accentIds.slice(0, start)];
  const cycle = [selectedAccentId, ...rotated.slice(1).filter((id) => id !== SILVER && id !== selectedAccentId)];
  return cycle[index % cycle.length];
}
