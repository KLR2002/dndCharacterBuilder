export const BOOK_CATEGORIES = ["core", "supplement", "setting", "adventure", "other"] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export const BOOK_CATEGORY_LABELS: Record<BookCategory, string> = {
  core: "Core Rules",
  supplement: "Rule Supplements",
  setting: "Campaign Settings",
  adventure: "Adventures & Modules",
  other: "Plane Shift & Extras",
};

export interface ResourceBook {
  code: string;
  name: string;
  category: BookCategory;
  isDefaultActive: boolean;
}

export const ALL_RESOURCE_BOOKS: ResourceBook[] = [
  // Core Rules
  { code: "PHB", name: "Player's Handbook 2014", category: "core", isDefaultActive: true },
  { code: "MM", name: "Monster Manual", category: "core", isDefaultActive: false },
  { code: "DMG", name: "Dungeon Master's Guide", category: "core", isDefaultActive: false },

  // Rule Supplements
  { code: "EEPC", name: "Elemental Evil Player's Companion", category: "supplement", isDefaultActive: true },
  { code: "VGM", name: "Volo's Guide to Monsters", category: "supplement", isDefaultActive: true },
  { code: "XGE", name: "Xanathar's Guide to Everything", category: "supplement", isDefaultActive: true },
  { code: "MTF", name: "Mordenkainen's Tome of Foes", category: "supplement", isDefaultActive: true },
  { code: "TCE", name: "Tasha's Cauldron of Everything", category: "supplement", isDefaultActive: true },
  { code: "FTD", name: "Fizban's Treasury of Dragons", category: "supplement", isDefaultActive: true },
  { code: "MPMM", name: "Mordenkainen Presents: Monsters of the Multiverse", category: "supplement", isDefaultActive: true },
  { code: "BGG", name: "Bigby Presents: Glory of the Giants", category: "supplement", isDefaultActive: false },
  { code: "BMT", name: "The Book of Many Things", category: "supplement", isDefaultActive: false },

  // Campaign Settings
  { code: "SCAG", name: "Sword Coast Adventurer's Guide", category: "setting", isDefaultActive: true },
  { code: "VRGR", name: "Van Richten's Guide to Ravenloft", category: "setting", isDefaultActive: true },
  { code: "ERLW", name: "Eberron: Rising from the Last War", category: "setting", isDefaultActive: false },
  { code: "EGW", name: "Explorer's Guide to Wildemount", category: "setting", isDefaultActive: false },
  { code: "GGR", name: "Guildmasters' Guide to Ravnica", category: "setting", isDefaultActive: false },
  { code: "MOT", name: "Mythic Odysseys of Theros", category: "setting", isDefaultActive: false },
  { code: "AAG", name: "Astral Adventurer's Guide (Spelljammer)", category: "setting", isDefaultActive: false },
  { code: "SCC", name: "Strixhaven: A Curriculum of Chaos", category: "setting", isDefaultActive: false },
  { code: "SatO", name: "Sigil and the Outlands (Planescape)", category: "setting", isDefaultActive: false },
  { code: "AI", name: "Acquisitions Incorporated", category: "setting", isDefaultActive: false },

  // Adventures & Modules
  { code: "WBtW", name: "The Wild Beyond the Witchlight", category: "adventure", isDefaultActive: true },
  { code: "CoS", name: "Curse of Strahd", category: "adventure", isDefaultActive: false },
  { code: "ToA", name: "Tomb of Annihilation", category: "adventure", isDefaultActive: false },
  { code: "WDH", name: "Waterdeep: Dragon Heist", category: "adventure", isDefaultActive: false },
  { code: "WDMM", name: "Waterdeep: Dungeon of the Mad Mage", category: "adventure", isDefaultActive: false },
  { code: "IDRotF", name: "Icewind Dale: Rime of the Frostmaiden", category: "adventure", isDefaultActive: false },
  { code: "BGDIA", name: "Baldur's Gate: Descent into Avernus", category: "adventure", isDefaultActive: false },
  { code: "SKT", name: "Storm King's Thunder", category: "adventure", isDefaultActive: false },
  { code: "PotA", name: "Princes of the Apocalypse", category: "adventure", isDefaultActive: false },
  { code: "OotA", name: "Out of the Abyss", category: "adventure", isDefaultActive: false },
  { code: "TftYP", name: "Tales from the Yawning Portal", category: "adventure", isDefaultActive: false },
  { code: "GoS", name: "Ghosts of Saltmarsh", category: "adventure", isDefaultActive: false },
  { code: "PaBTSO", name: "Phandelver and Below: The Shattered Obelisk", category: "adventure", isDefaultActive: false },
  { code: "DSotDQ", name: "Dragonlance: Shadow of the Dragon Queen", category: "adventure", isDefaultActive: false },
  { code: "KftGV", name: "Keys from the Golden Vault", category: "adventure", isDefaultActive: false },
  { code: "JttRC", name: "Journeys through the Radiant Citadel", category: "adventure", isDefaultActive: false },
  { code: "CRCotN", name: "Critical Role: Call of the Netherdeep", category: "adventure", isDefaultActive: false },
  { code: "CM", name: "Candlekeep Mysteries", category: "adventure", isDefaultActive: false },
  { code: "LMoP", name: "Lost Mine of Phandelver", category: "adventure", isDefaultActive: false },
  { code: "HoTDQ", name: "Hoard of the Dragon Queen", category: "adventure", isDefaultActive: false },
  { code: "RoT", name: "The Rise of Tiamat", category: "adventure", isDefaultActive: false },
  { code: "DoIP", name: "Dragon of Icespire Peak", category: "adventure", isDefaultActive: false },
  { code: "VEoR", name: "Vecna: Eve of Ruin", category: "adventure", isDefaultActive: false },
  { code: "QftIS", name: "Quests from the Infinite Staircase", category: "adventure", isDefaultActive: false },

  // Plane Shift & Extras
  { code: "LR", name: "Locathah Rising", category: "other", isDefaultActive: true },
  { code: "TP", name: "The Tortle Package", category: "other", isDefaultActive: true },
  { code: "OGA", name: "One Grung Above", category: "other", isDefaultActive: true },
  { code: "PSA", name: "Plane Shift: Amonkhet", category: "other", isDefaultActive: false },
  { code: "PSI", name: "Plane Shift: Innistrad", category: "other", isDefaultActive: false },
  { code: "PSK", name: "Plane Shift: Kaladesh", category: "other", isDefaultActive: false },
  { code: "PSZ", name: "Plane Shift: Zendikar", category: "other", isDefaultActive: false },
  { code: "PSD", name: "Plane Shift: Dominaria", category: "other", isDefaultActive: false },
  { code: "PSX", name: "Plane Shift: Ixalan", category: "other", isDefaultActive: false },
];

/** The source of the SRD Baseline's records. They count as active whatever books are switched on. */
export const SRD_SOURCE = "SRD";

export const DEFAULT_ACTIVE_BOOK_CODES = ALL_RESOURCE_BOOKS
  .filter((b) => b.isDefaultActive)
  .map((b) => b.code);
