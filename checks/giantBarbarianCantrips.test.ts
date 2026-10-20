import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { getClassSpellProfiles, type ClassSpellProfile } from "../src/rules/spellcasting.ts";
import { GIANT_POWER_CHOICE_ID } from "../src/rules/choices/types.ts";
import type { Character, KnownSpell, RuleChoiceEntry } from "../src/types/character.ts";

// A Path of the Giant Barbarian's Giant Power cantrip is one pick from two unnamed catalog entries
// (Druidcraft, Thaumaturgy). Only the picked cantrip may appear among the spells the profile shows
// as known or granted. The profile is built from the real integrated catalog, as the app does.

const ACTIVE_BOOKS = ["PHB", "BGG"];
const GIANT_CANTRIPS = ["Druidcraft", "Thaumaturgy"];

function giantPick(picked: string[]): RuleChoiceEntry {
  return {
    id: GIANT_POWER_CHOICE_ID,
    trait: "Giant Power Cantrip",
    origin: "subclass",
    choose: 1,
    from: GIANT_CANTRIPS,
    picked,
  };
}

function giantBarbarian(picked: string[], knownSpells: KnownSpell[] = []): Character {
  return makeChar({
    baseAbilityScores: { str: 16, dex: 14, con: 16, int: 10, wis: 14, cha: 8 },
    classes: [{ className: "Barbarian", source: "BGG", level: 3, subclassName: "Path of the Giant" }],
    ruleChoices: [giantPick(picked)],
    knownSpells,
  });
}

function barbarianProfile(char: Character): ClassSpellProfile {
  const profile = getClassSpellProfiles(char, { activeBooks: ACTIVE_BOOKS }).find((p) => p.className === "Barbarian");
  assert.ok(profile, "expected a Barbarian profile");
  return profile;
}

/** The Giant Power cantrip names among the spells the profile shows as known or granted. */
function shownGiantCantrips(profile: ClassSpellProfile): { known: string[]; granted: string[] } {
  const isGiant = (name: string) => GIANT_CANTRIPS.some((c) => c.toLowerCase() === name.toLowerCase());
  return {
    known: profile.knownSpells.map((k) => k.name).filter(isGiant),
    granted: (profile.subclassKnownSpells ?? []).map((s) => s.name).filter(isGiant),
  };
}

const stored = (name: string): KnownSpell => ({ name, source: "PHB", ownerKey: "Barbarian__BGG", className: "Barbarian", ability: "wis" });

test("with Druidcraft picked, only Druidcraft is shown as a known or granted cantrip", () => {
  const profile = barbarianProfile(giantBarbarian(["Druidcraft"]));

  assert.deepEqual(shownGiantCantrips(profile), { known: ["Druidcraft"], granted: ["Druidcraft"] });
});

test("with Thaumaturgy picked, only Thaumaturgy is shown as a known or granted cantrip", () => {
  const profile = barbarianProfile(giantBarbarian(["Thaumaturgy"]));

  assert.deepEqual(shownGiantCantrips(profile), { known: ["Thaumaturgy"], granted: ["Thaumaturgy"] });
});

test("with no Giant Power pick, no Giant cantrip is shown", () => {
  const profile = barbarianProfile(giantBarbarian([]));

  assert.deepEqual(shownGiantCantrips(profile), { known: [], granted: [] });
});

test("with the pick cleared, a stored Giant cantrip is not shown", () => {
  const profile = barbarianProfile(giantBarbarian([], [stored("Druidcraft")]));

  assert.deepEqual(shownGiantCantrips(profile), { known: [], granted: [] });
});

test("changing the pick swaps the shown Giant cantrip, even while the old one is still stored", () => {
  const before = barbarianProfile(giantBarbarian(["Druidcraft"], [stored("Druidcraft")]));
  assert.deepEqual(shownGiantCantrips(before), { known: ["Druidcraft"], granted: ["Druidcraft"] });

  const after = barbarianProfile(giantBarbarian(["Thaumaturgy"], [stored("Druidcraft")]));
  assert.deepEqual(shownGiantCantrips(after), { known: ["Thaumaturgy"], granted: ["Thaumaturgy"] });
});

test("a saved pick stays known when the Giant book is inactive and the catalog grants nothing", () => {
  const profile = getClassSpellProfiles(giantBarbarian(["Druidcraft"], [stored("Druidcraft")]), { activeBooks: ["PHB"] })
    .find((p) => p.className === "Barbarian");

  assert.deepEqual(profile?.knownSpells.map((k) => k.name), ["Druidcraft"]);
});

test("a stored Giant cantrip that is not the pick is not shown next to the pick", () => {
  const profile = barbarianProfile(giantBarbarian(["Druidcraft"], [stored("Druidcraft"), stored("Thaumaturgy")]));

  assert.deepEqual(shownGiantCantrips(profile), { known: ["Druidcraft"], granted: ["Druidcraft"] });
});

test("a Druid's own Thaumaturgy is not affected by the Giant pick rule", () => {
  const druid = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 3 }],
    knownSpells: [{ name: "Thaumaturgy", source: "PHB", ownerKey: "Druid__PHB", className: "Druid" }],
  });
  const profile = getClassSpellProfiles(druid, { activeBooks: ACTIVE_BOOKS }).find((p) => p.className === "Druid");

  assert.ok(profile?.knownSpells.some((k) => k.name === "Thaumaturgy"));
});
