import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeBackgrounds } from "../src/scrapers/backgrounds.ts";
import { scrapeRaces } from "../src/scrapers/races.ts";
import type { ToolsClient } from "../src/types/models.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";

// Every name and sentence in this file is invented. The scrapers read a 5e.tools-shaped payload through
// the client, so a fake client that serves fixed records exercises the real extraction.

/** The grants without their aliases: these tests compare what a rule grants, and the alias tests check the aliases. */
function shapes<T extends { aliases?: string[] }>(grants: T[] | undefined): Omit<T, "aliases">[] {
  return (grants ?? []).map(({ aliases: _aliases, ...grant }) => grant);
}

function fakeClient(payloads: Record<string, unknown>): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`no fixture for ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
}

const RACE = {
  name: "Sample Folk",
  source: "TST",
  entries: [],
  toolProficiencies: [{ anyArtisansTool: 1 }],
  languageProficiencies: [{ common: true, other: true }],
};

const SUBRACE = {
  name: "Hillward",
  source: "TST",
  raceName: "Sample Folk",
  raceSource: "TST",
  entries: [],
  toolProficiencies: [{ "navigator's tools": true }],
};

test("a race's structured tool and language entries become race grants, in field order", async () => {
  const report = newProficiencyReport();
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [RACE] } }), report);
  assert.deepEqual(
    race.grants?.map((grant) => [grant.id, grant.kind, grant.category]),
    [
      ["TST/Race/Sample Folk@0#tools:choice:from", "choice", "tools"],
      ["TST/Race/Sample Folk@0#languages:fixed:Common", "fixed", "languages"],
      ["TST/Race/Sample Folk@0#languages:choice:any", "choice", "languages"],
    ],
  );
  assert.deepEqual(report.unparsed, []);
});

test("a subrace's tool and language entries become subrace grants, owned by its race", async () => {
  const report = newProficiencyReport();
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [RACE], subrace: [SUBRACE] } }), report);
  const [subrace] = race.subraces;
  assert.deepEqual(shapes(subrace.grants), [
    { id: "TST/Subrace/Sample Folk (Hillward)@0#tools:fixed:navigator's tools", kind: "fixed", category: "tools", names: ["navigator's tools"] },
  ]);
});

test("a subrace with no proficiency entries carries no grants field", async () => {
  const plain = { name: "Plainfolk", source: "TST", raceName: "Sample Folk", raceSource: "TST", entries: [] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [RACE], subrace: [plain] } }), newProficiencyReport());
  assert.equal("grants" in race.subraces[0], false);
});

test("a race entry the mapping cannot state gives the race no grants, and the race is reported", async () => {
  const report = newProficiencyReport();
  const odd = { ...RACE, name: "Odd Folk", toolProficiencies: [{ "sample set of things": true }] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [odd] } }), report);
  assert.equal("grants" in race, false);
  assert.deepEqual(report.unparsed, [
    { owner: "Race", feature: "Odd Folk", level: 0, unparsed: ['tools: {"sample set of things":true}'] },
  ]);
});

test("a background's tool and language entries become background grants named after the background", async () => {
  const background = {
    name: "Sample Trade",
    source: "TST",
    entries: [],
    toolProficiencies: [{ "anyGamingSet": 1, "vehicles (land)": true }],
    languageProficiencies: [{ anyStandard: 1 }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeBackgrounds(fakeClient({ "data/backgrounds.json": { background: [background] } }), report);
  assert.deepEqual(
    result.grants?.map((grant) => [grant.id, grant.kind, grant.category]),
    [
      ["TST/Background/Sample Trade@0#tools:choice:from", "choice", "tools"],
      ["TST/Background/Sample Trade@0#tools:fixed:vehicles (land)", "fixed", "tools"],
      ["TST/Background/Sample Trade@0#languages:choice:any", "choice", "languages"],
    ],
  );
  assert.deepEqual(report.unparsed, []);
});

test("a background's fixed skills become a skills grant after its tool grants, and its skill choice becomes a choice grant", async () => {
  const background = {
    name: "Sample Trade",
    source: "TST",
    entries: [],
    skillProficiencies: [{ "sleight of hand": true, stealth: true }, { choose: { from: ["arcana", "nature"], count: 1 } }],
    toolProficiencies: [{ "vehicles (land)": true }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeBackgrounds(fakeClient({ "data/backgrounds.json": { background: [background] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Background/Sample Trade@0#tools:fixed:vehicles (land)", kind: "fixed", category: "tools", names: ["vehicles (land)"] },
    { id: "TST/Background/Sample Trade@0#skills:fixed:Sleight of Hand,Stealth", kind: "fixed", category: "skills", names: ["Sleight of Hand", "Stealth"] },
    { id: "TST/Background/Sample Trade@0#skills:choice:from", kind: "choice", category: "skills", count: 1, pool: { kind: "names", names: ["Arcana", "Nature"] } },
  ]);
  assert.deepEqual(result.skillProficiencies, ["Sleight of hand", "Stealth"]);
  assert.deepEqual(report.unparsed, []);
});

test("a race's fixed and choice skills become skills grants after its language grants, and a subrace's its own", async () => {
  const race = {
    name: "Sample Folk",
    source: "TST",
    entries: [],
    skillProficiencies: [{ perception: true }, { any: 2 }],
    languageProficiencies: [{ common: true }],
  };
  const subrace = {
    name: "Hillward",
    source: "TST",
    raceName: "Sample Folk",
    raceSource: "TST",
    entries: [],
    skillProficiencies: [{ "animal handling": true }, { choose: { from: ["nature"] } }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race], subrace: [subrace] } }), report);
  assert.deepEqual(
    result.grants?.map((grant) => [grant.id, grant.category]),
    [
      ["TST/Race/Sample Folk@0#languages:fixed:Common", "languages"],
      ["TST/Race/Sample Folk@0#skills:fixed:Perception", "skills"],
      ["TST/Race/Sample Folk@0#skills:choice:any", "skills"],
    ],
  );
  assert.deepEqual(shapes(result.subraces[0].grants), [
    { id: "TST/Subrace/Sample Folk (Hillward)@0#skills:fixed:Animal Handling", kind: "fixed", category: "skills", names: ["Animal Handling"] },
    { id: "TST/Subrace/Sample Folk (Hillward)@0#skills:choice:from", kind: "choice", category: "skills", count: 1, pool: { kind: "names", names: ["Nature"] } },
  ]);
  assert.deepEqual(report.unparsed, []);
});

test("a race whose record names no language speaks Common, and nothing else", async () => {
  const plain = { name: "Plain Folk", source: "TST", entries: [] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [plain] } }), newProficiencyReport());
  assert.deepEqual(shapes(race.grants), [{ id: "TST/Race/Plain Folk@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] }]);
});

test("a race from the lineage book that names no language speaks Common and one language of the player's choice", async () => {
  const lineage = { name: "Lineage Folk", source: "MPMM", entries: [], lineage: "VRGR" };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [lineage] } }), newProficiencyReport());
  assert.deepEqual(shapes(race.grants), [
    { id: "MPMM/Race/Lineage Folk@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "MPMM/Race/Lineage Folk@0#languages:choice:any", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
  ]);
});

test("a reviewed race override replaces the structured grants of that race", async () => {
  const githyanki = { name: "Githyanki", source: "MPMM", entries: [], toolProficiencies: [{ any: 1 }] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [githyanki] } }), newProficiencyReport());
  assert.deepEqual(shapes(race.grants), [
    { id: "MPMM/Race/Githyanki@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "MPMM/Race/Githyanki@0#languages:choice:any", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
  ]);
});

test("a race's weapon and armor entries become grants after its skill grants, in that order", async () => {
  const race = {
    name: "Sample Folk",
    source: "TST",
    entries: [],
    languageProficiencies: [{ common: true }],
    skillProficiencies: [{ perception: true }],
    weaponProficiencies: [{ "longsword|phb": true, "spear|phb": true }],
    armorProficiencies: [{ light: true, shield: true }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Race/Sample Folk@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "TST/Race/Sample Folk@0#skills:fixed:Perception", kind: "fixed", category: "skills", names: ["Perception"] },
    { id: "TST/Race/Sample Folk@0#weapons:fixed:longsword,spear", kind: "fixed", category: "weapons", names: ["longsword", "spear"] },
    { id: "TST/Race/Sample Folk@0#armor:fixed:light armor,shields", kind: "fixed", category: "armor", names: ["light armor", "shields"] },
  ]);
  assert.deepEqual(report.unparsed, []);
});

test("a subrace's weapon and armor entries become subrace grants, owned by its race", async () => {
  const race = { name: "Sample Folk", source: "TST", entries: [], languageProficiencies: [{ common: true }] };
  const subrace = {
    name: "Hillward",
    source: "TST",
    raceName: "Sample Folk",
    raceSource: "TST",
    entries: [],
    weaponProficiencies: [{ "rapier|phb": true }],
    armorProficiencies: [{ medium: true }],
  };
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race], subrace: [subrace] } }), newProficiencyReport());
  assert.deepEqual(shapes(result.subraces[0].grants), [
    { id: "TST/Subrace/Sample Folk (Hillward)@0#weapons:fixed:rapier", kind: "fixed", category: "weapons", names: ["rapier"] },
    { id: "TST/Subrace/Sample Folk (Hillward)@0#armor:fixed:medium armor", kind: "fixed", category: "armor", names: ["medium armor"] },
  ]);
});

test("a race weapon choice the mapping cannot state leaves out the race's weapon and armor grants, and keeps its languages", async () => {
  const race = {
    name: "Sample Folk",
    source: "TST",
    entries: [],
    languageProficiencies: [{ common: true, goblin: true }],
    weaponProficiencies: [{ choose: { fromFilter: "type=martial weapon|miscellaneous=mundane", count: 2 } }],
    armorProficiencies: [{ light: true }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Race/Sample Folk@0#languages:fixed:Common,Goblin", kind: "fixed", category: "languages", names: ["Common", "Goblin"] },
  ]);
  assert.deepEqual(report.unparsed, [
    { owner: "Race", feature: "Sample Folk", level: 0, unparsed: ['weapons: {"choose":{"fromFilter":"type=martial weapon|miscellaneous=mundane","count":2}}'] },
  ]);
});

test("a reviewed subrace override gives the one language of choice its trait names, when its own entries name none", async () => {
  const gith = { name: "Gith", source: "TST", entries: [], languageProficiencies: [{ common: true, other: true }] };
  const githyanki = { name: "Githyanki", source: "TST", raceName: "Gith", raceSource: "TST", entries: [] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [gith], subrace: [githyanki] } }), newProficiencyReport());
  assert.deepEqual(shapes(race.subraces[0].grants), [
    { id: "TST/Subrace/Gith (Githyanki)@0#languages:choice:any", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
    { id: "TST/Subrace/Gith (Githyanki)@0#weapons:fixed:greatsword,longsword,shortsword", kind: "fixed", category: "weapons", names: ["shortsword", "longsword", "greatsword"] },
    { id: "TST/Subrace/Gith (Githyanki)@0#armor:fixed:light armor,medium armor", kind: "fixed", category: "armor", names: ["light armor", "medium armor"] },
  ]);
});

test("a reviewed subrace override holds a race's count when the subrace's entries restate it, and keeps its fixed skill", async () => {
  const keldonRace = { name: "Human", source: "TST", entries: [], languageProficiencies: [{ common: true, anyStandard: 1 }] };
  const keldon = {
    name: "Keldon",
    source: "TST",
    raceName: "Human",
    raceSource: "TST",
    entries: [],
    languageProficiencies: [{ common: true, other: true }],
    skillProficiencies: [{ athletics: true }],
  };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [keldonRace], subrace: [keldon] } }), newProficiencyReport());
  assert.deepEqual(
    shapes(race.subraces[0].grants),
    [{ id: "TST/Subrace/Human (Keldon)@0#skills:fixed:Athletics", kind: "fixed", category: "skills", names: ["Athletics"] }],
    "the subrace grants no language beyond its race, and keeps its fixed skill",
  );
});

test("a background's choose list of skills is a choice of its count from that list, and carries no fixed skill of its own", async () => {
  const background = {
    name: "Sample Scholar",
    source: "TST",
    entries: [],
    skillProficiencies: [{ choose: { from: ["insight", "investigation", "perception"], count: 2 } }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeBackgrounds(fakeClient({ "data/backgrounds.json": { background: [background] } }), report);
  assert.deepEqual(shapes(result.grants), [
    {
      id: "TST/Background/Sample Scholar@0#skills:choice:from",
      kind: "choice",
      category: "skills",
      count: 2,
      pool: { kind: "names", names: ["Insight", "Investigation", "Perception"] },
    },
  ]);
  assert.deepEqual(result.skillProficiencies, [], "the displayed fixed skills stay the fixed ones");
  assert.deepEqual(report.unparsed, []);
});

test("a background's any-skill count is a choice of that many skills from any skill", async () => {
  const background = { name: "Sample Wanderer", source: "TST", entries: [], skillProficiencies: [{ any: 2 }] };
  const report = newProficiencyReport();
  const [result] = await scrapeBackgrounds(fakeClient({ "data/backgrounds.json": { background: [background] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Background/Sample Wanderer@0#skills:choice:any", kind: "choice", category: "skills", count: 2, pool: { kind: "any" } },
  ]);
});

test("a background's skill choice the mapping cannot state is reported, and the block gives no grants, as for any unstated entry", async () => {
  const background = {
    name: "Sample Oddity",
    source: "TST",
    entries: [],
    skillProficiencies: [{ choose: { from: ["insight", "not a skill"] } }],
    toolProficiencies: [{ "vehicles (land)": true }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeBackgrounds(fakeClient({ "data/backgrounds.json": { background: [background] } }), report);
  assert.equal(result.grants, undefined, "a block with an unstated entry gives no grants");
  assert.deepEqual(report.unparsed, [{ owner: "Background", feature: "Sample Oddity", level: 0, unparsed: ['skills: {"choose":{"from":["insight","not a skill"]}}'] }]);
});

test("a race's any-skill count and a subrace's choose list are choice grants, not text", async () => {
  const race = { name: "Sample Wanderer", source: "TST", entries: [], skillProficiencies: [{ any: 1 }] };
  const subrace = {
    name: "Hillward",
    source: "TST",
    raceName: "Sample Wanderer",
    raceSource: "TST",
    entries: [{ name: "Lore", entries: ["You gain proficiency in one skill of your choice."] }],
    skillProficiencies: [{ choose: { from: ["history", "medicine"], count: 2 } }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race], subrace: [subrace] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Race/Sample Wanderer@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "TST/Race/Sample Wanderer@0#skills:choice:any", kind: "choice", category: "skills", count: 1, pool: { kind: "any" } },
  ]);
  assert.deepEqual(shapes(result.subraces[0].grants), [
    { id: "TST/Subrace/Sample Wanderer (Hillward)@0#skills:choice:from", kind: "choice", category: "skills", count: 2, pool: { kind: "names", names: ["History", "Medicine"] } },
  ]);
  assert.deepEqual(report.unparsed, [], "the trait text is not a second source of the grant");
});

test("a reviewed subrace override gives the skill of choice its trait names, beside its language of choice", async () => {
  const human = { name: "Human", source: "TST", entries: [], languageProficiencies: [{ common: true, anyStandard: 1 }] };
  const amonkhet = { name: "Amonkhet", source: "TST", raceName: "Human", raceSource: "TST", entries: [{ name: "Skills", entries: ["You gain proficiency in one skill of your choice."] }] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [human], subrace: [amonkhet] } }), newProficiencyReport());
  assert.deepEqual(shapes(race.subraces[0].grants), [
    { id: "TST/Subrace/Human (Amonkhet)@0#languages:choice:any", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
    { id: "TST/Subrace/Human (Amonkhet)@0#skills:choice:any", kind: "choice", category: "skills", count: 1, pool: { kind: "any" } },
  ]);
});

// Structured entries the mapping does not state are reported with their owner, feature and raw entry, never
// dropped. Each record below is invented: the names and the entry shapes are made up for these tests.

test("a race's choose list of skills is a choice grant of its count from that list", async () => {
  const race = { name: "Sample Ridge", source: "TST", entries: [], languageProficiencies: [{ common: true }], skillProficiencies: [{ choose: { from: ["insight", "perception"], count: 2 } }] };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Race/Sample Ridge@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "TST/Race/Sample Ridge@0#skills:choice:from", kind: "choice", category: "skills", count: 2, pool: { kind: "names", names: ["Insight", "Perception"] } },
  ]);
  assert.deepEqual(report.unparsed, []);
});

test("a race's any-skill count is a choice grant of that many skills from any skill", async () => {
  const race = { name: "Sample Ridge", source: "TST", entries: [], languageProficiencies: [{ common: true }], skillProficiencies: [{ any: 3 }] };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Race/Sample Ridge@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "TST/Race/Sample Ridge@0#skills:choice:any", kind: "choice", category: "skills", count: 3, pool: { kind: "any" } },
  ]);
  assert.deepEqual(report.unparsed, []);
});

test("a race's fixed list of skills is a fixed skills grant", async () => {
  const race = { name: "Sample Ridge", source: "TST", entries: [], languageProficiencies: [{ common: true }], skillProficiencies: [{ insight: true, perception: true }] };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Race/Sample Ridge@0#languages:fixed:Common", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "TST/Race/Sample Ridge@0#skills:fixed:Insight,Perception", kind: "fixed", category: "skills", names: ["Insight", "Perception"] },
  ]);
  assert.deepEqual(report.unparsed, []);
});

test("a structured entry that is a bare number is reported with its owner, feature and raw value, and the block gives no grants", async () => {
  const race = { name: "Sample Ridge", source: "TST", entries: [], skillProficiencies: [{ perception: true }, 3] };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.equal("grants" in result, false);
  assert.deepEqual(report.unparsed, [{ owner: "Race", feature: "Sample Ridge", level: 0, unparsed: ["skills: 3"] }]);
});

test("an empty structured entry is reported, not skipped", async () => {
  const race = { name: "Sample Ridge", source: "TST", entries: [], skillProficiencies: [{}] };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.equal("grants" in result, false);
  assert.deepEqual(report.unparsed, [{ owner: "Race", feature: "Sample Ridge", level: 0, unparsed: ["skills: {}"] }]);
});

test("an object entry with a key the mapping does not know is reported with the whole raw entry", async () => {
  const race = { name: "Sample Ridge", source: "TST", entries: [], toolProficiencies: [{ "sample pick": { count: 2 } }] };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.equal("grants" in result, false);
  assert.deepEqual(report.unparsed, [
    { owner: "Race", feature: "Sample Ridge", level: 0, unparsed: ['tools: {"sample pick":{"count":2}}'] },
  ]);
});

test("a structured field that is an object rather than a list is reported, not thrown on", async () => {
  const race = { name: "Sample Ridge", source: "TST", entries: [], skillProficiencies: { choose: { from: ["insight"], count: 1 } } };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.equal("grants" in result, false);
  assert.deepEqual(report.unparsed, [
    { owner: "Race", feature: "Sample Ridge", level: 0, unparsed: ['skills: {"choose":{"from":["insight"],"count":1}}'] },
  ]);
});

test("a null structured field is no entry: it gives no grants and nothing is reported", async () => {
  const subrace = { name: "Hillward", source: "TST", raceName: "Sample Ridge", raceSource: "TST", entries: [], skillProficiencies: null };
  const report = newProficiencyReport();
  const [result] = await scrapeRaces(fakeClient({ "data/races.json": { race: [{ name: "Sample Ridge", source: "TST", entries: [] }], subrace: [subrace] } }), report);
  assert.equal("grants" in result.subraces[0], false);
  assert.deepEqual(report.unparsed, []);
});

test("a background's weapon and armor entries become grants, as a race's do", async () => {
  const background = {
    name: "Sample Trade",
    source: "TST",
    entries: [],
    weaponProficiencies: [{ simple: true }],
    armorProficiencies: [{ light: true }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeBackgrounds(fakeClient({ "data/backgrounds.json": { background: [background] } }), report);
  assert.deepEqual(shapes(result.grants), [
    { id: "TST/Background/Sample Trade@0#weapons:fixed:simple weapons", kind: "fixed", category: "weapons", names: ["simple weapons"] },
    { id: "TST/Background/Sample Trade@0#armor:fixed:light armor", kind: "fixed", category: "armor", names: ["light armor"] },
  ]);
  assert.deepEqual(report.unparsed, []);
});
