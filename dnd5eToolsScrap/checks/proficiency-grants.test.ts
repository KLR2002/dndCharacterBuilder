import { test } from "node:test";
import assert from "node:assert/strict";
import { matchedSentences, resolveFeatureGrants, structuredGrants, type GrantSubject } from "../src/parser/proficiency-grants.ts";
import type { GrantOverride } from "../src/parser/proficiency-grants.ts";
import type { ProficiencyReport } from "../src/types/proficiency.ts";

// Every sentence in this file is invented. Names are invented unless they are rule vocabulary.

const CIRCLE = "Wizard2/Sample Circle";

function subject(description: string, overrides: Partial<GrantSubject> = {}): GrantSubject {
  return {
    source: "TST",
    owner: CIRCLE,
    feature: "Field Training",
    level: 3,
    description,
    ...overrides,
  };
}

function run(subjects: GrantSubject[], overrides: GrantOverride[] = []) {
  const report: ProficiencyReport = { covered: 0, unparsed: [] };
  const results = resolveFeatureGrants(subjects, overrides, report);
  return { results, report };
}

test("a fixed tool sentence becomes a fixed grant with a stable id", () => {
  const [result] = run([subject("You gain proficiency with lantern-maker's kit.")]).results;
  assert.deepEqual(result.grants, [
    {
      id: "TST/Wizard2/Sample Circle/Field Training@3#0",
      kind: "fixed",
      category: "tools",
      names: ["lantern-maker's kit"],
    },
  ]);
  assert.deepEqual(result.unparsed, []);
});

test("a fixed list splits into one grant per category, and a lead-in clause is ignored", () => {
  const [result] = run([
    subject("Once the Sample Circle is chosen at 3rd level, you gain proficiency with light armor, shields, and martial weapons."),
  ]).results;
  assert.deepEqual(
    result.grants.map((g) => [g.category, g.kind === "fixed" ? g.names : null]),
    [
      ["armor", ["light armor", "shields"]],
      ["weapons", ["martial weapons"]],
    ]
  );
});

test("a choice from a named list gives a count and a names pool", () => {
  const [result] = run([
    subject("Once the Sample Circle is chosen at 3rd level, you gain proficiency in two skills from the following list: Arcana, Insight, and Survival."),
  ]).results;
  assert.deepEqual(result.grants, [
    {
      id: "TST/Wizard2/Sample Circle/Field Training@3#0",
      kind: "choice",
      category: "skills",
      count: 2,
      pool: { kind: "names", names: ["Arcana", "Insight", "Survival"] },
    },
  ]);
});

test("a choice of any entry gives a count and an any pool", () => {
  const [result] = run([subject("You gain proficiency in three skills of your choice.")]).results;
  assert.deepEqual(result.grants, [
    {
      id: "TST/Wizard2/Sample Circle/Field Training@3#0",
      kind: "choice",
      category: "skills",
      count: 3,
      pool: { kind: "any" },
    },
  ]);
});

test("a single named tool with an apostrophe is a fixed grant, not a count", () => {
  const [result] = run([subject("You gain proficiency with smith's tools.")]).results;
  assert.deepEqual(result.grants, [
    { id: "TST/Wizard2/Sample Circle/Field Training@3#0", kind: "fixed", category: "tools", names: ["smith's tools"] },
  ]);
});

test("string starting-proficiency entries of one category merge into one fixed grant", () => {
  const result = structuredGrants(
    { source: "TST", owner: "Wizard2", feature: "Starting Proficiencies", level: 1 },
    { tools: ["thieves' tools", "tinker's tools"] }
  );
  assert.deepEqual(result.unparsed, []);
  assert.deepEqual(result.grants, [
    { id: "TST/Wizard2/Starting Proficiencies@1#0", kind: "fixed", category: "tools", names: ["thieves' tools", "tinker's tools"] },
  ]);
});

test("your choice of A or B becomes a single pick from a names pool", () => {
  const [result] = run([
    subject("You gain proficiency with your choice of calligrapher's supplies or painter's supplies."),
  ]).results;
  assert.deepEqual(result.grants, [
    {
      id: "TST/Wizard2/Sample Circle/Field Training@3#0",
      kind: "choice",
      category: "tools",
      count: 1,
      pool: { kind: "names", names: ["calligrapher's supplies", "painter's supplies"] },
    },
  ]);
});

test("learning languages of your choice is an any-language choice; learning named ones is fixed", () => {
  const [choice] = run([subject("You learn two languages of your choice.")]).results;
  assert.deepEqual(choice.grants, [
    {
      id: "TST/Wizard2/Sample Circle/Field Training@3#0",
      kind: "choice",
      category: "languages",
      count: 2,
      pool: { kind: "any" },
    },
  ]);
  const [fixed] = run([subject("You learn to speak, read, and write Giant.")]).results;
  assert.deepEqual(fixed.grants, [
    { id: "TST/Wizard2/Sample Circle/Field Training@3#0", kind: "fixed", category: "languages", names: ["Giant"] },
  ]);
});

test("a sample sentence granting proficiency in all saving throws is a fixed saving-throw grant", () => {
  const [result] = run([
    subject("Once the Sample Circle is chosen at 14th level, you gain proficiency in all saving throws."),
  ]).results;
  assert.deepEqual(result.grants, [
    {
      id: "TST/Wizard2/Sample Circle/Field Training@3#0",
      kind: "fixed",
      category: "savingThrows",
      names: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
    },
  ]);
});

test("a sentence that matches but cannot be parsed is reported, and the whole feature gets no grants", () => {
  const [result] = run([
    subject("You gain proficiency with lantern-maker's kit. You gain proficiency with these weapons if you don't already have it."),
  ]).results;
  assert.deepEqual(result.grants, []);
  assert.deepEqual(result.unparsed, ["You gain proficiency with these weapons if you don't already have it"]);
});

test("a feature whose prose has no proficiency or language vocabulary is neither covered nor reported", () => {
  const { results, report } = run([subject("Your strength grows when you train.")]);
  assert.deepEqual(results[0].grants, []);
  assert.deepEqual(results[0].unparsed, []);
  assert.equal(report.covered, 0);
  assert.deepEqual(report.unparsed, []);
});

test("the report counts covered features and lists unparsed ones with their owner", () => {
  const { report } = run([
    subject("You gain proficiency with lantern-maker's kit."),
    subject("You gain proficiency with these weapons.", { feature: "Other Training" }),
  ]);
  assert.equal(report.covered, 1);
  assert.deepEqual(report.unparsed, [
    { owner: CIRCLE, feature: "Other Training", level: 3, unparsed: ["You gain proficiency with these weapons"] },
  ]);
});

test("grant ids are identical across repeated resolutions of the same data", () => {
  const first = run([subject("You gain proficiency with lantern-maker's kit.")]).results;
  const second = run([subject("You gain proficiency with lantern-maker's kit.")]).results;
  assert.deepEqual(first, second);
});

test("an override supplies grants for a feature the extractor could not parse, names only", () => {
  const override: GrantOverride = {
    owner: CIRCLE,
    feature: "Field Training",
    level: 3,
    grants: [
      {
        kind: "choice",
        category: "tools",
        count: 1,
        pool: { kind: "names", names: ["calligrapher's supplies", "painter's supplies"] },
      },
    ],
  };
  const { results, report } = run([subject("You gain proficiency with these weapons.")], [override]);
  assert.deepEqual(results[0].grants, [
    {
      id: "TST/Wizard2/Sample Circle/Field Training@3#0",
      kind: "choice",
      category: "tools",
      count: 1,
      pool: { kind: "names", names: ["calligrapher's supplies", "painter's supplies"] },
    },
  ]);
  assert.deepEqual(results[0].unparsed, []);
  assert.deepEqual(report.unparsed, []);
});

test("an override for a feature the scrape does not include is ignored, so a partial scrape still runs", () => {
  const overrides: GrantOverride[] = [
    {
      owner: "Sample Artificer",
      feature: "Optional Rule: Firearm Proficiency",
      level: 1,
      grants: [{ kind: "fixed", category: "weapons", names: ["firearms"] }],
    },
    {
      owner: CIRCLE,
      feature: "No Such Feature",
      level: 3,
      grants: [{ kind: "fixed", category: "armor", names: ["light armor"] }],
    },
  ];
  const { results, report } = run([subject("You gain proficiency with lantern-maker's kit.")], overrides);
  assert.deepEqual(results[0].grants.map((g) => (g.kind === "fixed" ? g.names : null)), [["lantern-maker's kit"]]);
  assert.deepEqual(report.unparsed, []);
});

test("race and background structured fields become grants with the same shape", () => {
  const result = structuredGrants(
    { source: "TST", owner: "Race", feature: "Sample Folk", level: 0 },
    {
      skills: [{ "sleight of hand": true }, { any: 1 }],
      languages: [{ common: true, anyStandard: 1 }],
    }
  );
  assert.deepEqual(result.unparsed, []);
  assert.deepEqual(result.grants, [
    { id: "TST/Race/Sample Folk@0#0", kind: "fixed", category: "skills", names: ["Sleight of Hand"] },
    { id: "TST/Race/Sample Folk@0#1", kind: "choice", category: "skills", count: 1, pool: { kind: "any" } },
    { id: "TST/Race/Sample Folk@0#2", kind: "fixed", category: "languages", names: ["Common"] },
    {
      id: "TST/Race/Sample Folk@0#3",
      kind: "choice",
      category: "languages",
      count: 1,
      pool: { kind: "names", names: ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"] },
    },
  ]);
});

test("a structured entry the mapping cannot state precisely makes the whole block unparsed, not partly granted", () => {
  const result = structuredGrants(
    { source: "TST", owner: "Background", feature: "Sample Trade", level: 0 },
    {
      skills: [{ insight: true }],
      tools: [{ "gaming set": true }, { "anyGamingSet": 1 }],
    }
  );
  assert.deepEqual(result.grants, []);
  assert.deepEqual(result.unparsed, ["tools: gaming set", "tools: anyGamingSet"]);
});

test("the vocabulary matches 'proficient' wording, not only 'proficiency'", () => {
  assert.deepEqual(matchedSentences("You are proficient with improvised weapons."), [
    "You are proficient with improvised weapons",
  ]);
});

test("the vocabulary matches saving-throw proficiency sentences, fixed and of-your-choice", () => {
  assert.deepEqual(matchedSentences("You gain proficiency in all saving throws. Your mind grows sharp."), [
    "You gain proficiency in all saving throws",
  ]);
  assert.deepEqual(matchedSentences("You gain proficiency in a saving throw of your choice."), [
    "You gain proficiency in a saving throw of your choice",
  ]);
});

test("the vocabulary ignores prose with no proficiency or language mention", () => {
  assert.deepEqual(matchedSentences("You make a Dexterity saving throw. Nothing else changes."), []);
});

test("a sentence that only mentions the proficiency bonus is not a match", () => {
  assert.deepEqual(matchedSentences("Your proficiency bonus is doubled for any check you make."), []);
  assert.deepEqual(matchedSentences("Your attack bonus equals your proficiency bonus plus your Strength modifier."), []);
  assert.deepEqual(
    matchedSentences("Whenever the sample makes a check that includes its whole proficiency bonus, it treats a low roll as a ten."),
    []
  );
});

test("a saving throw DC or attack formula is not a match, even when it names the proficiency bonus", () => {
  assert.deepEqual(matchedSentences("Save DC = 8 + your Wisdom modifier + your proficiency bonus."), []);
  assert.deepEqual(matchedSentences("Sample attack modifier = your proficiency bonus + your Charisma modifier."), []);
});

test("a conditional reference to a proficiency the character already has is not a match", () => {
  assert.deepEqual(matchedSentences("If you're proficient with lantern-maker's kit, you move quietly."), []);
  assert.deepEqual(matchedSentences("If you are proficient with smith's tools, you may add them to checks."), []);
  assert.deepEqual(matchedSentences("You can use any tool with which you have proficiency."), []);
  assert.deepEqual(matchedSentences("You can use a weapon you are proficient with as a focus."), []);
  assert.deepEqual(matchedSentences("You must be proficient with the kit to use it this way."), []);
});

test("a real grant beside a conditional reference is still a match", () => {
  assert.deepEqual(matchedSentences("You gain proficiency with a weapon you are proficient with."), [
    "You gain proficiency with a weapon you are proficient with",
  ]);
});

test("a language the character knows, or sharing one, is not a match", () => {
  assert.deepEqual(matchedSentences("You can share a language with your companion."), []);
  assert.deepEqual(matchedSentences("You can write in the language you speak."), []);
  assert.deepEqual(matchedSentences("You can translate a language you know."), []);
});

test("a real language grant is still a match", () => {
  assert.deepEqual(matchedSentences("You learn two languages of your choice."), ["You learn two languages of your choice"]);
});
