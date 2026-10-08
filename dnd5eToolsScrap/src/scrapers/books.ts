import { ToolsClient } from "../client.js";
import { BookModel } from "../types/models.js";

export const OFFLINE_2014_BOOKS: BookModel[] = [
  // Core Rules
  { id: "PHB", name: "Player's Handbook", source: "PHB", group: "core", published: "2014-08-19", author: "Wizards of the Coast" },
  { id: "MM", name: "Monster Manual", source: "MM", group: "core", published: "2014-09-30", author: "Wizards of the Coast" },
  { id: "DMG", name: "Dungeon Master's Guide", source: "DMG", group: "core", published: "2014-12-09", author: "Wizards of the Coast" },

  // Rule Supplements
  { id: "EEPC", name: "Elemental Evil Player's Companion", source: "EEPC", group: "supplement", published: "2015-03-10", author: "Wizards of the Coast" },
  { id: "VGM", name: "Volo's Guide to Monsters", source: "VGM", group: "supplement", published: "2016-11-15", author: "Wizards of the Coast" },
  { id: "XGE", name: "Xanathar's Guide to Everything", source: "XGE", group: "supplement", published: "2017-11-21", author: "Wizards of the Coast" },
  { id: "MTF", name: "Mordenkainen's Tome of Foes", source: "MTF", group: "supplement", published: "2018-05-29", author: "Wizards of the Coast" },
  { id: "TCE", name: "Tasha's Cauldron of Everything", source: "TCE", group: "supplement", published: "2020-11-17", author: "Wizards of the Coast" },
  { id: "FTD", name: "Fizban's Treasury of Dragons", source: "FTD", group: "supplement", published: "2021-10-26", author: "Wizards of the Coast" },
  { id: "MPMM", name: "Mordenkainen Presents: Monsters of the Multiverse", source: "MPMM", group: "supplement", published: "2022-05-17", author: "Wizards of the Coast" },
  { id: "BGG", name: "Bigby Presents: Glory of the Giants", source: "BGG", group: "supplement", published: "2023-08-15", author: "Wizards of the Coast" },
  { id: "BMT", name: "The Book of Many Things", source: "BMT", group: "supplement", published: "2023-11-14", author: "Wizards of the Coast" },

  // Campaign Settings
  { id: "SCAG", name: "Sword Coast Adventurer's Guide", source: "SCAG", group: "setting", published: "2015-11-03", author: "Wizards of the Coast" },
  { id: "GGR", name: "Guildmasters' Guide to Ravnica", source: "GGR", group: "setting", published: "2018-11-20", author: "Wizards of the Coast" },
  { id: "AI", name: "Acquisitions Incorporated", source: "AI", group: "setting", published: "2019-06-18", author: "Penny Arcade, Inc." },
  { id: "ERLW", name: "Eberron: Rising from the Last War", source: "ERLW", group: "setting", published: "2019-11-19", author: "Wizards of the Coast" },
  { id: "EGW", name: "Explorer's Guide to Wildemount", source: "EGW", group: "setting", published: "2020-03-17", author: "Critical Role & Wizards of the Coast" },
  { id: "MOT", name: "Mythic Odysseys of Theros", source: "MOT", group: "setting", published: "2020-06-02", author: "Wizards of the Coast" },
  { id: "VRGR", name: "Van Richten's Guide to Ravenloft", source: "VRGR", group: "setting", published: "2021-05-18", author: "Wizards of the Coast" },
  { id: "SCC", name: "Strixhaven: A Curriculum of Chaos", source: "SCC", group: "setting", published: "2021-12-07", author: "Wizards of the Coast" },
  { id: "AAG", name: "Astral Adventurer's Guide (Spelljammer)", source: "AAG", group: "setting", published: "2022-08-16", author: "Wizards of the Coast" },
  { id: "SatO", name: "Sigil and the Outlands (Planescape)", source: "SatO", group: "setting", published: "2023-10-31", author: "Wizards of the Coast" },

  // Adventures & Modules
  { id: "LMoP", name: "Lost Mine of Phandelver", source: "LMoP", group: "adventure", published: "2014-07-15", author: "Wizards of the Coast" },
  { id: "HoTDQ", name: "Hoard of the Dragon Queen", source: "HoTDQ", group: "adventure", published: "2014-08-19", author: "Wizards of the Coast" },
  { id: "RoT", name: "The Rise of Tiamat", source: "RoT", group: "adventure", published: "2014-11-04", author: "Wizards of the Coast" },
  { id: "PotA", name: "Princes of the Apocalypse", source: "PotA", group: "adventure", published: "2015-04-07", author: "Wizards of the Coast" },
  { id: "OotA", name: "Out of the Abyss", source: "OotA", group: "adventure", published: "2015-09-15", author: "Wizards of the Coast" },
  { id: "CoS", name: "Curse of Strahd", source: "CoS", group: "adventure", published: "2016-03-15", author: "Wizards of the Coast" },
  { id: "SKT", name: "Storm King's Thunder", source: "SKT", group: "adventure", published: "2016-09-06", author: "Wizards of the Coast" },
  { id: "TftYP", name: "Tales from the Yawning Portal", source: "TftYP", group: "adventure", published: "2017-04-04", author: "Wizards of the Coast" },
  { id: "ToA", name: "Tomb of Annihilation", source: "ToA", group: "adventure", published: "2017-09-19", author: "Wizards of the Coast" },
  { id: "WDH", name: "Waterdeep: Dragon Heist", source: "WDH", group: "adventure", published: "2018-09-18", author: "Wizards of the Coast" },
  { id: "WDMM", name: "Waterdeep: Dungeon of the Mad Mage", source: "WDMM", group: "adventure", published: "2018-11-20", author: "Wizards of the Coast" },
  { id: "GoS", name: "Ghosts of Saltmarsh", source: "GoS", group: "adventure", published: "2019-05-21", author: "Wizards of the Coast" },
  { id: "DoIP", name: "Dragon of Icespire Peak", source: "DoIP", group: "adventure", published: "2019-06-24", author: "Wizards of the Coast" },
  { id: "BGDIA", name: "Baldur's Gate: Descent into Avernus", source: "BGDIA", group: "adventure", published: "2019-09-17", author: "Wizards of the Coast" },
  { id: "IDRotF", name: "Icewind Dale: Rime of the Frostmaiden", source: "IDRotF", group: "adventure", published: "2020-09-15", author: "Wizards of the Coast" },
  { id: "CM", name: "Candlekeep Mysteries", source: "CM", group: "adventure", published: "2021-03-16", author: "Wizards of the Coast" },
  { id: "WBtW", name: "The Wild Beyond the Witchlight", source: "WBtW", group: "adventure", published: "2021-09-21", author: "Wizards of the Coast" },
  { id: "CRCotN", name: "Critical Role: Call of the Netherdeep", source: "CRCotN", group: "adventure", published: "2022-03-15", author: "Critical Role & Wizards of the Coast" },
  { id: "JttRC", name: "Journeys through the Radiant Citadel", source: "JttRC", group: "adventure", published: "2022-07-19", author: "Wizards of the Coast" },
  { id: "DSotDQ", name: "Dragonlance: Shadow of the Dragon Queen", source: "DSotDQ", group: "adventure", published: "2022-12-06", author: "Wizards of the Coast" },
  { id: "KftGV", name: "Keys from the Golden Vault", source: "KftGV", group: "adventure", published: "2023-02-21", author: "Wizards of the Coast" },
  { id: "PaBTSO", name: "Phandelver and Below: The Shattered Obelisk", source: "PaBTSO", group: "adventure", published: "2023-09-19", author: "Wizards of the Coast" },
  { id: "VEoR", name: "Vecna: Eve of Ruin", source: "VEoR", group: "adventure", published: "2024-05-21", author: "Wizards of the Coast" },
  { id: "QftIS", name: "Quests from the Infinite Staircase", source: "QftIS", group: "adventure", published: "2024-07-16", author: "Wizards of the Coast" },

  // Plane Shift & Extras
  { id: "PSA", name: "Plane Shift: Amonkhet", source: "PSA", group: "other", published: "2017-07-05", author: "Wizards of the Coast" },
  { id: "PSI", name: "Plane Shift: Innistrad", source: "PSI", group: "other", published: "2016-07-13", author: "Wizards of the Coast" },
  { id: "PSK", name: "Plane Shift: Kaladesh", source: "PSK", group: "other", published: "2017-02-16", author: "Wizards of the Coast" },
  { id: "PSZ", name: "Plane Shift: Zendikar", source: "PSZ", group: "other", published: "2016-04-27", author: "Wizards of the Coast" },
  { id: "PSD", name: "Plane Shift: Dominaria", source: "PSD", group: "other", published: "2018-07-31", author: "Wizards of the Coast" },
  { id: "PSX", name: "Plane Shift: Ixalan", source: "PSX", group: "other", published: "2018-01-09", author: "Wizards of the Coast" },
  { id: "TP", name: "The Tortle Package", source: "TP", group: "other", published: "2017-09-19", author: "Wizards of the Coast" },
  { id: "LR", name: "Locathah Rising", source: "LR", group: "other", published: "2019-09-19", author: "Wizards of the Coast" },
  { id: "OGA", name: "One Grung Above", source: "OGA", group: "other", published: "2017-10-13", author: "Wizards of the Coast" },
];

export async function scrapeBooks(client: ToolsClient): Promise<BookModel[]> {
  console.log("  → Fetching books from data/books.json...");
  let rawBooks: any[] = [];
  try {
    const rawData = await client.fetchJson<{ book?: any[] }>("data/books.json");
    if (Array.isArray(rawData?.book)) {
      rawBooks = rawData.book;
    }
  } catch (err: any) {
    console.warn(`  [WARN] Could not fetch data/books.json (${err.message}). Using offline catalog fallback.`);
  }

  if (rawBooks.length > 0) {
    return rawBooks.map((b) => ({
      name: b.name,
      id: b.id || b.source || b.name,
      source: b.source || b.id,
      group: b.group,
      published: b.published,
      author: b.author,
    }));
  }

  return OFFLINE_2014_BOOKS;
}
