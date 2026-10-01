import type { Character } from "../types/character.ts";
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

export interface LanguageGrant {
  fixed: string[];
  choiceCount: number;
  label: string;
}

export interface ToolChoice {
  key: string;
  label: string;
  count: number;
  options: string[];
}

export interface ToolGrant {
  fixed: string[];
  choices: ToolChoice[];
}

export function getRaceLanguageGrant(
  raceName?: string,
  subraceName?: string,
  raceCatalog: any[] = [],
  raceSource?: string,
  subraceSource?: string
): LanguageGrant {
  if (!raceName) return { fixed: ["Common"], choiceCount: 0, label: "" };
  const rd =
    raceCatalog.find(
      (r) =>
        r.name &&
        r.name.toLowerCase() === raceName.toLowerCase() &&
        (!raceSource || r.source === raceSource)
    ) ||
    raceCatalog.find(
      (r) => r.name && r.name.toLowerCase() === raceName.toLowerCase()
    );
  const fixed: string[] = [];
  let choiceCount = 0;

  for (const l of rd?.languages || []) {
    const match = l.match(/(\d+)\s+of\s+your\s+choice/i);
    if (match) {
      choiceCount += parseInt(match[1], 10);
    } else if (/^choose$|^other$/i.test(l.trim())) {
      choiceCount += 1;
    } else {
      fixed.push(l);
    }
  }

  const isMpmm = rd?.source === "MPMM";

  // Trait check on base race
  for (const t of rd?.traits || []) {
    const desc = t.description || "";
    if (
      /extra\s+language/i.test(t.name) ||
      /one\s+extra\s+language/i.test(desc) ||
      /one\s+other\s+language/i.test(desc) ||
      /another\s+language\s+of\s+your\s+choice/i.test(desc) ||
      /one\s+language\s+of\s+your\s+choice/i.test(desc)
    ) {
      if (choiceCount === 0) choiceCount += 1;
    }
  }

  // Subrace
  if (subraceName && rd?.subraces) {
    const sd =
      rd.subraces.find(
        (s: any) =>
          s.name &&
          s.name.toLowerCase() === subraceName.toLowerCase() &&
          (!subraceSource || s.source === subraceSource)
      ) ||
      rd.subraces.find(
        (s: any) =>
          s.name &&
          s.name.toLowerCase() === subraceName.toLowerCase()
      );
    if (sd) {
      for (const l of sd.languages || []) {
        const match = l.match(/(\d+)\s+of\s+your\s+choice/i);
        if (match) {
          choiceCount += parseInt(match[1], 10);
        } else if (/^choose$|^other$/i.test(l.trim())) {
          choiceCount += 1;
        } else if (!fixed.includes(l)) {
          fixed.push(l);
        }
      }
      for (const t of sd.traits || []) {
        const desc = t.description || "";
        if (
          /extra\s+language/i.test(t.name) ||
          /one\s+extra\s+language/i.test(desc) ||
          /one\s+other\s+language/i.test(desc) ||
          /another\s+language\s+of\s+your\s+choice/i.test(desc) ||
          /one\s+language\s+of\s+your\s+choice/i.test(desc)
        ) {
          choiceCount += 1;
        }
      }
    }
  }

  if (isMpmm && choiceCount === 0) {
    choiceCount = 1;
  }

  if (fixed.length === 0) {
    fixed.push("Common");
  }

  return {
    fixed,
    choiceCount,
    label: `${raceName}${subraceName ? ` (${subraceName})` : ""}: Languages`,
  };
}

export function getBackgroundLanguageGrant(
  bgName?: string,
  bgCatalog: any[] = []
): LanguageGrant {
  if (!bgName) return { fixed: [], choiceCount: 0, label: "" };
  const bg = bgCatalog.find((b) => b.name && b.name.toLowerCase() === bgName.toLowerCase());
  const fixed: string[] = [];
  let choiceCount = 0;

  for (const l of bg?.languages || []) {
    const match = l.match(/(\d+)\s+.*of\s+your\s+choice/i);
    if (match) {
      choiceCount += parseInt(match[1], 10);
    } else if (/^choose$/i.test(l.trim())) {
      choiceCount += 1;
    } else {
      fixed.push(l);
    }
  }

  return {
    fixed,
    choiceCount,
    label: `Background (${bgName}): Languages`,
  };
}

export function getRaceToolGrant(
  raceName?: string,
  subraceName?: string,
  _raceCatalog: any[] = []
): ToolGrant {
  const fixed: string[] = [];
  const choices: ToolChoice[] = [];
  if (!raceName) return { fixed, choices };

  const normRace = raceName.toLowerCase();
  const normSub = (subraceName || "").toLowerCase();

  // Dwarf tool proficiency: choice of smith's tools, brewer's supplies, or mason's tools
  if (normRace === "dwarf" || normRace.includes("dwarf")) {
    if (normRace.includes("kaladesh")) {
      choices.push({
        key: "race_artisan_2",
        label: "Artisan's Expertise",
        count: 2,
        options: ARTISAN_TOOLS,
      });
    } else {
      choices.push({
        key: "race_dwarf_tool",
        label: "Tool Proficiency (Smith, Brewer, or Mason)",
        count: 1,
        options: ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"],
      });
    }
  }

  if (normSub === "rock gnome" || normRace === "rock gnome" || normSub === "rock") {
    fixed.push("Tinker's Tools");
  }

  if (normRace === "satyr") {
    choices.push({
      key: "race_satyr_instrument",
      label: "Reveler (Musical Instrument)",
      count: 1,
      options: MUSICAL_INSTRUMENTS,
    });
  }

  if (normRace.includes("goblin") && (normSub.includes("tuktuk") || normRace.includes("tuktuk"))) {
    fixed.push("Thieves' Tools");
  }

  if (normRace.includes("merfolk") && (normSub.includes("ula") || normRace.includes("ula"))) {
    fixed.push("Navigator's Tools");
  }

  if (normRace === "naga") {
    fixed.push("Poisoner's Kit");
  }

  return { fixed, choices };
}

export function getBackgroundToolGrant(
  bgName?: string,
  bgCatalog: any[] = []
): ToolGrant {
  const fixed: string[] = [];
  const choices: ToolChoice[] = [];
  if (!bgName) return { fixed, choices };

  const bg = bgCatalog.find((b) => b.name && b.name.toLowerCase() === bgName.toLowerCase());

  for (const raw of bg?.toolProficiencies || []) {
    const t = raw.trim();
    if (t === "anyArtisansTool") {
      choices.push({
        key: "bg_artisan",
        label: `${bgName}: Artisan's Tools`,
        count: 1,
        options: ARTISAN_TOOLS,
      });
    } else if (t === "anyMusicalInstrument") {
      choices.push({
        key: "bg_instrument",
        label: `${bgName}: Musical Instrument`,
        count: 1,
        options: MUSICAL_INSTRUMENTS,
      });
    } else if (t === "anyGamingSet") {
      choices.push({
        key: "bg_gaming",
        label: `${bgName}: Gaming Set`,
        count: 1,
        options: GAMING_SETS,
      });
    } else if (t === "choose") {
      choices.push({
        key: "bg_choose",
        label: `${bgName}: Tool Choice`,
        count: 1,
        options: ALL_TOOLS,
      });
    } else {
      const norm = normalizeToolName(t);
      if (!fixed.includes(norm)) {
        fixed.push(norm);
      }
    }
  }

  return { fixed, choices };
}

export function getClassToolGrant(
  className?: string,
  _classCatalog: any[] = []
): ToolGrant {
  const fixed: string[] = [];
  const choices: ToolChoice[] = [];
  if (!className) return { fixed, choices };

  const norm = className.toLowerCase();
  if (norm === "rogue") {
    fixed.push("Thieves' Tools");
  } else if (norm === "druid") {
    fixed.push("Herbalism Kit");
  } else if (norm === "artificer") {
    fixed.push("Thieves' Tools");
    fixed.push("Tinker's Tools");
    choices.push({
      key: "class_artificer_artisan",
      label: "Artificer: Artisan's Tools",
      count: 1,
      options: ARTISAN_TOOLS,
    });
  } else if (norm === "bard") {
    choices.push({
      key: "class_bard_instruments",
      label: "Bard: Three Musical Instruments",
      count: 3,
      options: MUSICAL_INSTRUMENTS,
    });
  } else if (norm === "monk") {
    choices.push({
      key: "class_monk_tool",
      label: "Monk: Artisan's Tool or Musical Instrument",
      count: 1,
      options: [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS],
    });
  }

  return { fixed, choices };
}

export function resolveCharacterLanguages(
  character: Character,
  catalogs?: { races?: any[]; backgrounds?: any[] }
): string[] {
  const langSet = new Set<string>();

  // Fixed from Race
  const raceGrant = getRaceLanguageGrant(
    character.race?.name,
    character.race?.subraceName,
    catalogs?.races || [],
    character.race?.source,
    character.race?.subraceSource
  );
  for (const l of raceGrant.fixed) langSet.add(l);

  // Chosen from Race
  for (const l of character.chosenLanguages?.race || []) {
    langSet.add(l);
  }

  // Fixed from Background
  const bgGrant = getBackgroundLanguageGrant(
    character.background?.name,
    catalogs?.backgrounds || []
  );
  for (const l of bgGrant.fixed) langSet.add(l);

  // Chosen from Background
  for (const l of character.chosenLanguages?.background || []) {
    langSet.add(l);
  }

  // Legacy fallback if no structured choices but legacy character.languages exists
  if (
    langSet.size === 0 &&
    character.languages &&
    character.languages.length > 0
  ) {
    for (const l of character.languages) {
      if (!/(\d+)\s+of\s+your\s+choice/i.test(l) && !/^choose$|^other$/i.test(l)) {
        langSet.add(l);
      }
    }
  }

  if (langSet.size === 0) {
    langSet.add("Common");
  }

  return Array.from(langSet);
}

export function resolveCharacterTools(
  character: Character,
  catalogs?: { races?: any[]; backgrounds?: any[]; classes?: any[] }
): string[] {
  const toolSet = new Set<string>();

  // Race
  const raceGrant = getRaceToolGrant(
    character.race?.name,
    character.race?.subraceName,
    catalogs?.races || []
  );
  for (const t of raceGrant.fixed) toolSet.add(normalizeToolName(t));
  for (const t of character.chosenTools?.race || []) toolSet.add(normalizeToolName(t));

  // Background
  const bgGrant = getBackgroundToolGrant(
    character.background?.name,
    catalogs?.backgrounds || []
  );
  for (const t of bgGrant.fixed) toolSet.add(normalizeToolName(t));
  for (const t of character.chosenTools?.background || []) toolSet.add(normalizeToolName(t));

  // Primary Class
  const primaryClass = character.classes?.[0]?.className;
  if (primaryClass) {
    const classGrant = getClassToolGrant(
      primaryClass,
      catalogs?.classes || []
    );
    for (const t of classGrant.fixed) toolSet.add(normalizeToolName(t));
    for (const t of character.chosenTools?.class || []) toolSet.add(normalizeToolName(t));
  }

  // Multiclass proficiencies
  if (Array.isArray(character.multiclassProficiencies)) {
    for (const mp of character.multiclassProficiencies) {
      for (const t of mp.tools || []) {
        toolSet.add(normalizeToolName(t));
      }
    }
  }

  return Array.from(toolSet);
}
