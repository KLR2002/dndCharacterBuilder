import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractRuleChoices,
  RULE_CHOICE_LEVELS,
  ruleChoiceKey,
} from "../src/scrapers/rule-choices.ts";
import { renderEntries } from "../src/parser/entry-renderer.ts";

// The three real shapes, verbatim from the shipped catalog.
const VARIANT_FEATURE_INSET = {
  type: "inset",
  name: "Variant Feature (Choose 1)",
  entries: [
    { name: "Skill Versatility", entries: ["You gain proficiency in two skills of your choice."], type: "entries" },
    {
      name: "Drow Magic",
      entries: ["You know the {@spell dancing lights} cantrip."],
      type: "entries",
    },
  ],
  data: { overwrite: "Skill Versatility" },
};

const REVELATION_LIST = {
  type: "entries",
  name: "Celestial Revelation",
  entries: [
    "When you reach 3rd level, choose one of the revelation options below.",
    {
      type: "list",
      style: "list-hang-notitle",
      items: [
        { type: "item", name: "Necrotic Shroud", entry: "Your eyes briefly become pools of darkness." },
        { type: "item", name: "Radiant Consumption", entry: "Searing light radiates from your eyes." },
        { type: "item", name: "Radiant Soul", entry: "Two luminous, spectral wings sprout." },
      ],
    },
  ],
};

const SEASON_LIST = {
  type: "entries",
  name: "Fey Step",
  entries: [
    "{@i Choose your eladrin's season: autumn, winter, spring, or summer. When finishing a long rest, you can change your season. See the \"Info\" tab for more information.}",
    {
      type: "entries",
      name: "Fey Step",
      entries: [
        "As a bonus action, you can magically teleport up to 30 feet.",
        {
          type: "list",
          style: "list-hang-notitle",
          items: [
            { type: "item", name: "Autumn", entry: "Immediately after you use your Fey Step, up to two creatures must succeed on a Wisdom saving throw or be charmed." },
            { type: "item", name: "Winter", entry: "One creature within 5 feet of you must succeed on a Wisdom saving throw or be frightened." },
            { type: "item", name: "Spring", entry: "You can touch one willing creature; that creature teleports instead of you." },
            { type: "item", name: "Summer", entry: "Each creature within 5 feet of you takes fire damage equal to your Charisma modifier." },
          ],
        },
      ],
    },
  ],
};

// A named list with no choose instruction anywhere is not a choice (Deep Gnome spell lists).
const SPELL_LIST = {
  type: "entries",
  name: "Spellcasting",
  entries: [
    { type: "list", style: "list-hang-notitle", items: [{ type: "item", name: "At will:", entry: "minor illusion" }, { type: "item", name: "1/day each:", entry: "dispel magic" }] },
  ],
};

test("a variant feature inset extracts one pick per named option, replacing the named feature", () => {
  const found = extractRuleChoices([VARIANT_FEATURE_INSET], ["You gain proficiency in two skills of your choice."]);
  assert.equal(found.length, 1);
  const [choice] = found;
  assert.equal(choice.traitName, "Variant Feature (Choose 1)");
  assert.equal(choice.pick, 1);
  assert.equal(choice.replaces, "Skill Versatility");
  assert.equal(choice.index, 0);
  assert.deepEqual(choice.options.map((o) => o.name), ["Skill Versatility", "Drow Magic"]);
  assert.match(choice.options[1].description, /dancing lights/);
  assert.doesNotMatch(choice.options[0].description, /\{@spell/);
});

test("a revelation list extracts three options with prose outside the list preserved per option", () => {
  const found = extractRuleChoices([REVELATION_LIST], ["When you reach 3rd level, choose one of the revelation options below."]);
  assert.equal(found.length, 1);
  const [choice] = found;
  assert.equal(choice.traitName, "Celestial Revelation");
  assert.equal(choice.pick, 1);
  assert.equal(choice.replaces, undefined);
  assert.deepEqual(choice.options.map((o) => o.name), ["Necrotic Shroud", "Radiant Consumption", "Radiant Soul"]);
  for (const option of choice.options) {
    assert.ok(option.description.length > 10, `${option.name} should carry its own text`);
  }
});

test("eladrin seasons extract four options, and the choice instruction may be a sibling entry", () => {
  const found = extractRuleChoices(SEASON_LIST.entries as any[], [SEASON_LIST.entries[0] as string]);
  assert.equal(found.length, 1);
  const [choice] = found;
  assert.equal(choice.traitName, "Fey Step");
  assert.deepEqual(choice.options.map((o) => o.name), ["Autumn", "Winter", "Spring", "Summer"]);
});

test("a named list with no choose instruction is not a rule choice", () => {
  assert.deepEqual(extractRuleChoices([SPELL_LIST], []), []);
});

test("every choice in the shipped catalog has a curated level, and the in-scope rules are numeric", () => {
  const races = JSON.parse(readFileSync(new URL("../data/races.json", import.meta.url), "utf8"));
  const unmapped: string[] = [];
  let total = 0;

  const inspect = (entries: any[] | undefined, texts: string[], key: (trait: string) => string) => {
    if (!entries) return;
    for (const choice of extractRuleChoices(entries, texts)) {
      total++;
      const id = key(choice.traitName, choice.index);
      if (!(id in RULE_CHOICE_LEVELS)) unmapped.push(id);
    }
  };

  for (const race of races) {
    const texts = [renderEntries(race.rawEntries, "plain")];
    inspect(race.rawEntries, texts, (trait, index) =>
      ruleChoiceKey({ source: race.source, race: race.name, subrace: null, trait, index })
    );
    for (const sub of race.subraces || []) {
      const subTexts = [renderEntries(sub.rawEntries, "plain")];
      inspect(
        sub.rawEntries,
        subTexts,
        (trait, index) => ruleChoiceKey({ source: sub.source, race: race.name, subrace: sub.name, trait, index })
      );
    }
  }

  assert.deepEqual(unmapped, [], "scraped choices missing a curated level");
  assert.ok(total > 0, "the shipped catalog should expose at least one rule choice");

  // The three rules this work was scoped to must be fully curated, not deferred.
  for (const fragment of [
    "MPMM__Aasimar____Celestial Revelation",
    "MPMM__Eladrin____Fey Step",
    "SCAG__Half-Elf__",
  ]) {
    const curated = Object.entries(RULE_CHOICE_LEVELS).filter(([id]) => id.includes(fragment));
    assert.ok(curated.length > 0, `expected a curated entry for ${fragment}`);
    for (const [id, spec] of curated) {
      assert.equal(typeof spec.level, "number", `${id} should have a numeric level`);
      assert.equal(spec.momentary, undefined, `${id} is in scope and must not be deferred`);
    }
  }
});