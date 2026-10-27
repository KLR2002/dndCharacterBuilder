import type { FeatData, RaceData, SubraceData } from "../src/types/dnd5e.ts";
import { backgroundSpellBackgrounds } from "./backgroundSpellsFixture.ts";

/**
 * Invented feats and races whose expanded spell lists join the spell list of every spellcasting class the character has
 * (ADR 0017). Their spells and classes are checks/backgroundSpellsFixture.ts's. Every name and sentence is made up on purpose.
 * The lists use the scraper's shape: keyed by spell level, with normalised spell names.
 */

const feat = (name: string, extra: Partial<FeatData>): FeatData => ({
  name,
  source: "TST",
  prerequisite: null,
  abilityScoreIncrease: null,
  description: "Placeholder description for the feat.",
  ...extra,
});

/**
 * Sample Rune Mark lists a cantrip the mage's own list gives (Sample Ember), and two first-level spells: one the background
 * also lists (Sample Ward) and one no class lists (Sample Warding).
 */
export const expandedSpellFeats = (): FeatData[] => [
  feat("Sample Rune Mark", {
    additionalSpells: [
      {
        ability: { choose: ["int", "wis", "cha"] },
        expanded: { s0: ["sample ember"], s1: ["sample ward", "sample warding"] },
      },
    ],
  }),
  // A feat with no spell grant, to swap a Sample Rune Mark for.
  feat("Sample Rune Sign", {}),
];

const race = (name: string, extra: Partial<RaceData>): RaceData => ({
  name,
  source: "TST",
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  ...extra,
});

const subrace = (name: string, raceName: string, extra: Partial<SubraceData>): SubraceData => ({
  name,
  source: "TST",
  raceName,
  raceSource: "TST",
  isVariant: false,
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
  ...extra,
});

/**
 * Two invented lineages. Sample Lineage A lists Sample Warding and Sample Ward; Sample Lineage B lists only Sample Ward, so a
 * swap from A to B releases Sample Warding alone.
 */
export const expandedSpellLineages = (): RaceData[] => [
  race("Sample Lineage A", { additionalSpells: [{ expanded: { s1: ["sample warding", "sample ward"] } }] }),
  race("Sample Lineage B", { additionalSpells: [{ expanded: { s1: ["sample ward"] } }] }),
];

/** Sample Runekin has no spell grant of its own. Its subrace Sample Rune Line lists a third-level spell no class lists. */
export const expandedSpellRaces = (): RaceData[] => [
  race("Sample Runekin", {
    subraces: [
      subrace("Sample Rune Line", "Sample Runekin", {
        additionalSpells: [{ ability: "int", expanded: { s3: ["sample spirit"] } }],
      }),
    ],
  }),
];

/**
 * The invented sources of the fixtures above, each held on the book `source`: the feat, the race with its subrace, the two
 * lineages and the background. A test switches that book off by leaving it out of the active books.
 */
export const expandedSourcesOfBook = (source: string) => {
  const runekin = expandedSpellRaces()[0];
  return {
    feats: expandedSpellFeats().map((entry) => ({ ...entry, source })),
    races: [
      { ...runekin, source, subraces: (runekin.subraces ?? []).map((sub) => ({ ...sub, source, raceSource: source })) },
      ...expandedSpellLineages().map((lineage) => ({ ...lineage, source })),
    ],
    backgrounds: backgroundSpellBackgrounds().map((background) => ({ ...background, source })),
  };
};
