export interface ResourceBook {
  code: string;
  name: string;
  category: "core" | "supplement" | "setting" | "adventure" | "other";
  isDefaultActive: boolean;
}

export const ALL_RESOURCE_BOOKS: ResourceBook[] = [
  { code: "PHB", name: "Player's Handbook 2014", category: "core", isDefaultActive: true },
  { code: "EEPC", name: "Elemental Evil Player's Companion", category: "supplement", isDefaultActive: true },
  { code: "SCAG", name: "Sword Coast Adventurer's Guide", category: "setting", isDefaultActive: true },
  { code: "VGM", name: "Volo's Guide to Monsters", category: "supplement", isDefaultActive: true },
  { code: "XGE", name: "Xanathar's Guide to Everything", category: "supplement", isDefaultActive: true },
  { code: "MTF", name: "Mordenkainen's Tome of Foes", category: "supplement", isDefaultActive: true },
  { code: "TCE", name: "Tasha's Cauldron of Everything", category: "supplement", isDefaultActive: true },
  { code: "VRGR", name: "Van Richten's Guide to Ravenloft", category: "setting", isDefaultActive: true },
  { code: "WBtW", name: "The Wild Beyond the Witchlight", category: "adventure", isDefaultActive: true },
  { code: "FTD", name: "Fizban's Treasury of Dragons", category: "supplement", isDefaultActive: true },
  { code: "MPMM", name: "Mordenkainen Presents: Monsters of the Multiverse", category: "supplement", isDefaultActive: true },
  { code: "LR", name: "Locathah Rising", category: "other", isDefaultActive: true },
  { code: "TP", name: "The Tortle Package", category: "other", isDefaultActive: true },
  { code: "OGA", name: "One Grung Above", category: "other", isDefaultActive: true },

  // Additional official resources (optional)
  { code: "DMG", name: "Dungeon Master's Guide", category: "core", isDefaultActive: false },
  { code: "ERLW", name: "Eberron: Rising from the Last War", category: "setting", isDefaultActive: false },
  { code: "EGW", name: "Explorer's Guide to Wildemount", category: "setting", isDefaultActive: false },
  { code: "GGR", name: "Guildmasters' Guide to Ravnica", category: "setting", isDefaultActive: false },
  { code: "MOT", name: "Mythic Odysseys of Theros", category: "setting", isDefaultActive: false },
  { code: "BGG", name: "Bigby Presents: Glory of the Giants", category: "supplement", isDefaultActive: false },
  { code: "BMT", name: "The Book of Many Things", category: "supplement", isDefaultActive: false },
  { code: "AAG", name: "Astral Adventurer's Guide (Spelljammer)", category: "setting", isDefaultActive: false },
  { code: "SCC", name: "Strixhaven: A Curriculum of Chaos", category: "setting", isDefaultActive: false },
  { code: "AI", name: "Acquisitions Incorporated", category: "setting", isDefaultActive: false },
  { code: "IDRotF", name: "Icewind Dale: Rime of the Frostmaiden", category: "adventure", isDefaultActive: false },
  { code: "CoS", name: "Curse of Strahd", category: "adventure", isDefaultActive: false },
  { code: "ToA", name: "Tomb of Annihilation", category: "adventure", isDefaultActive: false },
  { code: "GoS", name: "Ghosts of Saltmarsh", category: "adventure", isDefaultActive: false },
  { code: "BGDIA", name: "Baldur's Gate: Descent into Avernus", category: "adventure", isDefaultActive: false },
  { code: "SatO", name: "Sigil and the Outlands (Planescape)", category: "setting", isDefaultActive: false },
  { code: "DSotDQ", name: "Dragonlance: Shadow of the Dragon Queen", category: "adventure", isDefaultActive: false },
];

export const DEFAULT_ACTIVE_BOOK_CODES = ALL_RESOURCE_BOOKS
  .filter((b) => b.isDefaultActive)
  .map((b) => b.code);
