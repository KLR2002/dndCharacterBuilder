export interface LanguageData {
  name: string;
  type: "standard" | "exotic";
  typicalSpeakers: string;
  script: string;
}

export const STANDARD_LANGUAGES: LanguageData[] = [
  { name: "Common", type: "standard", typicalSpeakers: "Humans", script: "Common" },
  { name: "Dwarvish", type: "standard", typicalSpeakers: "Dwarves", script: "Dwarvish" },
  { name: "Elvish", type: "standard", typicalSpeakers: "Elves", script: "Elvish" },
  { name: "Giant", type: "standard", typicalSpeakers: "Ogres, giants", script: "Dwarvish" },
  { name: "Gnomish", type: "standard", typicalSpeakers: "Gnomes", script: "Dwarvish" },
  { name: "Goblin", type: "standard", typicalSpeakers: "Goblinoids", script: "Dwarvish" },
  { name: "Halfling", type: "standard", typicalSpeakers: "Halflings", script: "Common" },
  { name: "Orc", type: "standard", typicalSpeakers: "Orcs", script: "Dwarvish" },
];

export const EXOTIC_LANGUAGES: LanguageData[] = [
  { name: "Abyssal", type: "exotic", typicalSpeakers: "Demons", script: "Infernal" },
  { name: "Celestial", type: "exotic", typicalSpeakers: "Celestials", script: "Celestial" },
  { name: "Draconic", type: "exotic", typicalSpeakers: "Dragons, dragonborn", script: "Draconic" },
  { name: "Deep Speech", type: "exotic", typicalSpeakers: "Mind Flayers, beholders", script: "—" },
  { name: "Infernal", type: "exotic", typicalSpeakers: "Devils", script: "Infernal" },
  { name: "Primordial", type: "exotic", typicalSpeakers: "Elementals", script: "Dwarvish" },
  { name: "Sylvan", type: "exotic", typicalSpeakers: "Fey creatures", script: "Elvish" },
  { name: "Undercommon", type: "exotic", typicalSpeakers: "Underdark traders", script: "Elvish" },
];

export const ALL_LANGUAGES: LanguageData[] = [...STANDARD_LANGUAGES, ...EXOTIC_LANGUAGES];
export const ALL_LANGUAGE_NAMES: string[] = ALL_LANGUAGES.map(l => l.name);
