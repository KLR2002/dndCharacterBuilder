import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeBackgrounds } from "../src/scrapers/backgrounds.ts";
import { scrapeRaces } from "../src/scrapers/races.ts";
import type { ToolsClient } from "../src/types/models.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";

// Every name and sentence in this file is invented. The scrapers read a 5e.tools-shaped payload through
// the client, so a fake client that serves fixed records exercises the real extraction.

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
      ["TST/Race/Sample Folk@0#0", "choice", "tools"],
      ["TST/Race/Sample Folk@0#1", "fixed", "languages"],
      ["TST/Race/Sample Folk@0#2", "choice", "languages"],
    ],
  );
  assert.deepEqual(report.unparsed, []);
});

test("a subrace's tool and language entries become subrace grants, owned by its race", async () => {
  const report = newProficiencyReport();
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [RACE], subrace: [SUBRACE] } }), report);
  const [subrace] = race.subraces;
  assert.deepEqual(subrace.grants, [
    { id: "TST/Subrace/Sample Folk (Hillward)@0#0", kind: "fixed", category: "tools", names: ["navigator's tools"] },
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
    { owner: "Race", feature: "Odd Folk", level: 0, unparsed: ["tools: sample set of things"] },
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
      ["TST/Background/Sample Trade@0#0", "choice", "tools"],
      ["TST/Background/Sample Trade@0#1", "fixed", "tools"],
      ["TST/Background/Sample Trade@0#2", "choice", "languages"],
    ],
  );
  assert.deepEqual(report.unparsed, []);
});

test("a background's fixed skills become a skills grant after its tool and language grants, and its choice names no skill", async () => {
  const background = {
    name: "Sample Trade",
    source: "TST",
    entries: [],
    skillProficiencies: [{ "sleight of hand": true, stealth: true }, { choose: { from: ["arcana", "nature"], count: 1 } }],
    toolProficiencies: [{ "vehicles (land)": true }],
  };
  const report = newProficiencyReport();
  const [result] = await scrapeBackgrounds(fakeClient({ "data/backgrounds.json": { background: [background] } }), report);
  assert.deepEqual(result.grants, [
    { id: "TST/Background/Sample Trade@0#0", kind: "fixed", category: "tools", names: ["vehicles (land)"] },
    { id: "TST/Background/Sample Trade@0#1", kind: "fixed", category: "skills", names: ["Sleight of Hand", "Stealth"] },
  ]);
  assert.deepEqual(result.skillProficiencies, ["Sleight of hand", "Stealth"]);
  assert.deepEqual(report.unparsed, []);
});

test("a race's fixed skills become a skills grant after its language grants, and a subrace's its own", async () => {
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
      ["TST/Race/Sample Folk@0#0", "languages"],
      ["TST/Race/Sample Folk@0#1", "skills"],
    ],
  );
  assert.deepEqual(result.subraces[0].grants, [
    { id: "TST/Subrace/Sample Folk (Hillward)@0#0", kind: "fixed", category: "skills", names: ["Animal Handling"] },
  ]);
  assert.deepEqual(report.unparsed, []);
});

test("a race whose record names no language speaks Common, and nothing else", async () => {
  const plain = { name: "Plain Folk", source: "TST", entries: [] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [plain] } }), newProficiencyReport());
  assert.deepEqual(race.grants, [{ id: "TST/Race/Plain Folk@0#0", kind: "fixed", category: "languages", names: ["Common"] }]);
});

test("a race from the lineage book that names no language speaks Common and one language of the player's choice", async () => {
  const lineage = { name: "Lineage Folk", source: "MPMM", entries: [], lineage: "VRGR" };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [lineage] } }), newProficiencyReport());
  assert.deepEqual(race.grants, [
    { id: "MPMM/Race/Lineage Folk@0#0", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "MPMM/Race/Lineage Folk@0#1", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
  ]);
});

test("a reviewed race override replaces the structured grants of that race", async () => {
  const githyanki = { name: "Githyanki", source: "MPMM", entries: [], toolProficiencies: [{ any: 1 }] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [githyanki] } }), newProficiencyReport());
  assert.deepEqual(race.grants, [
    { id: "MPMM/Race/Githyanki@0#0", kind: "fixed", category: "languages", names: ["Common"] },
    { id: "MPMM/Race/Githyanki@0#1", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
  ]);
});

test("a reviewed subrace override gives the one language of choice its trait names, when its own entries name none", async () => {
  const gith = { name: "Gith", source: "TST", entries: [], languageProficiencies: [{ common: true, other: true }] };
  const githyanki = { name: "Githyanki", source: "TST", raceName: "Gith", raceSource: "TST", entries: [] };
  const [race] = await scrapeRaces(fakeClient({ "data/races.json": { race: [gith], subrace: [githyanki] } }), newProficiencyReport());
  assert.deepEqual(race.subraces[0].grants, [
    { id: "TST/Subrace/Gith (Githyanki)@0#0", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
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
    race.subraces[0].grants,
    [{ id: "TST/Subrace/Human (Keldon)@0#0", kind: "fixed", category: "skills", names: ["Athletics"] }],
    "the subrace grants no language beyond its race, and keeps its fixed skill",
  );
});
