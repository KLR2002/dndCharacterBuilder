import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { traitTextSkills } from "../src/rules/proficiencySources/skillGrants.ts";
import { makeChar } from "./testUtils.ts";

/** Skills named in race and subrace trait text. Invented trait names and sentences. */

const opts = (traits: { name: string; description?: string }[]) => ({
  race: { name: "Glimmerkin", traits },
  activeBooks: ALL_BOOKS,
});

test("a trait naming a skill in prose form grants that skill", () => {
  const got = traitTextSkills(makeChar(), opts([{ name: "Lantern Sense", description: "You are proficient in the Perception skill." }]));
  assert.deepEqual(got, ["Perception"]);
});

test("a trait naming a skill with the {@skill} tag grants that skill", () => {
  const got = traitTextSkills(makeChar(), opts([{ name: "Moss Lore", description: "Gain {@skill Nature} as a starting skill." }]));
  assert.deepEqual(got, ["Nature"]);
});

test("the Stonecunning trait does not grant the History skill its text names", () => {
  const got = traitTextSkills(
    makeChar(),
    opts([{ name: "Stonecunning", description: "You are proficient in the History skill when checking stone walls." }]),
  );
  assert.deepEqual(got, []);
});

test("a trait naming no skill grants nothing", () => {
  const got = traitTextSkills(makeChar(), opts([{ name: "Quiet Feet", description: "Invented sentence without a skill name." }]));
  assert.deepEqual(got, []);
});

test("granted skills come back in the DND_SKILLS order, once each, across traits", () => {
  const got = traitTextSkills(
    makeChar(),
    opts([
      { name: "Burrow Sense", description: "{@skill Stealth} and proficient in the Acrobatics skill." },
      { name: "Mirror Sense", description: "Proficiency in Stealth skill. Also {@skill Stealth}." },
      { name: "Empty Sense" },
    ]),
  );
  assert.deepEqual(got, ["Acrobatics", "Stealth"]);
});

test("repeated calls with the same trait text return the same skills", () => {
  const traits = [{ name: "Ember Eyes", description: "You are proficient in the Intimidation skill." }];
  assert.deepEqual(traitTextSkills(makeChar(), opts(traits)), ["Intimidation"]);
  assert.deepEqual(traitTextSkills(makeChar(), opts(traits)), ["Intimidation"]);
});
