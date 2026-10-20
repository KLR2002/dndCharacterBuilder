import { STANDARD_LANGUAGES, EXOTIC_LANGUAGES } from "../constants/languages.ts";

export const ARTISAN_TOOLS: string[] = [
  "Alchemist's Supplies",
  "Brewer's Supplies",
  "Calligrapher's Supplies",
  "Carpenter's Tools",
  "Cartographer's Tools",
  "Cobbler's Tools",
  "Cook's Utensils",
  "Glassblower's Tools",
  "Jeweler's Tools",
  "Leatherworker's Tools",
  "Mason's Tools",
  "Painter's Supplies",
  "Potter's Tools",
  "Smith's Tools",
  "Tinker's Tools",
  "Weaver's Tools",
  "Woodcarver's Tools",
];

export const MUSICAL_INSTRUMENTS: string[] = [
  "Bagpipes",
  "Drum",
  "Dulcimer",
  "Flute",
  "Horn",
  "Lute",
  "Lyre",
  "Pan Flute",
  "Shawm",
  "Viol",
];

export const GAMING_SETS: string[] = [
  "Dice Set",
  "Dragonchess Set",
  "Playing Card Set",
  "Three-Dragon Ante Set",
];

export const OTHER_KITS_AND_TOOLS: string[] = [
  "Disguise Kit",
  "Forgery Kit",
  "Herbalism Kit",
  "Navigator's Tools",
  "Poisoner's Kit",
  "Thieves' Tools",
  "Vehicles (Land)",
  "Vehicles (Water)",
];

export const ALL_TOOLS: string[] = [
  ...ARTISAN_TOOLS,
  ...MUSICAL_INSTRUMENTS,
  ...GAMING_SETS,
  ...OTHER_KITS_AND_TOOLS,
];

export const STANDARD_LANGUAGE_NAMES: string[] = STANDARD_LANGUAGES.map((l) => l.name);
export const EXOTIC_LANGUAGE_NAMES: string[] = EXOTIC_LANGUAGES.map((l) => l.name);
export const ALL_LANGUAGE_NAMES: string[] = [
  ...STANDARD_LANGUAGE_NAMES,
  ...EXOTIC_LANGUAGE_NAMES,
];

export function normalizeToolName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const known = ALL_TOOLS.find((t) => t.toLowerCase() === lower);
  if (known) return known;
  if (lower.startsWith("vehicles (") || lower.startsWith("vehicle (")) {
    const inside = lower.includes("land") ? "Land" : lower.includes("water") ? "Water" : lower.includes("air") ? "Air" : "Space";
    return `Vehicles (${inside})`;
  }
  return raw
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

