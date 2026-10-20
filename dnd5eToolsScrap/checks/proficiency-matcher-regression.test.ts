import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchedSentences } from "../src/parser/proficiency-grants.ts";
import type { TrackedData } from "../src/grants/subjects.ts";

// The features in review-decisions.md under "Grants to add", by owner and feature name.
// Each must still be matched by the vocabulary over the tracked data, so that the
// matcher's noise reduction can never drop a feature out of review before its override exists.
const GRANTS_TO_ADD: Array<[owner: string, feature: string]> = [
  ["Artificer", "Optional Rule: Firearm Proficiency"],
  ["Artificer/Alchemist", "Tool Proficiency"],
  ["Artificer/Armorer", "Tools of the Trade"],
  ["Artificer/Artillerist", "Tool Proficiency"],
  ["Artificer/Battle Smith", "Tool Proficiency"],
  ["Barbarian/Path of the Giant", "Giant Power"],
  ["Bard/College of Swords", "Bonus Proficiencies"],
  ["Cleric/Knowledge Domain", "Blessings of Knowledge"],
  ["Cleric/Death Domain", "Bonus Proficiency"],
  ["Cleric/Arcana Domain", "Arcane Initiate"],
  ["Druid", "Druidic"],
  ["Fighter/Purple Dragon Knight (Banneret)", "Royal Envoy"],
  ["Fighter/Arcane Archer", "Arcane Archer Lore"],
  ["Fighter/Cavalier", "Bonus Proficiency"],
  ["Fighter/Samurai", "Bonus Proficiency"],
  ["Fighter/Samurai", "Elegant Courtier"],
  ["Fighter/Rune Knight", "Bonus Proficiencies"],
  ["Monk/Way of the Kensei", "Path of the Kensei"],
  ["Monk/Way of Mercy", "Implements of Mercy"],
  ["Monk/Way of the Ascendant Dragon", "Draconic Disciple"],
  ["Ranger", "Deft Explorer"],
  ["Ranger", "Favored Enemy"],
  ["Ranger", "Favored Enemy and Natural Explorer improvements"],
  ["Ranger", "Favored Enemy improvement"],
  ["Ranger/Gloom Stalker", "Iron Mind"],
  ["Ranger/Drakewarden", "Draconic Gift"],
  ["Rogue/Mastermind", "Master of Intrigue"],
  ["Rogue/Scout", "Survivalist"],
  ["Sorcerer/Draconic Bloodline", "Dragon Ancestor"],
  ["Sorcerer/Storm Sorcery", "Wind Speaker"],
  ["Warlock/The Hexblade", "Hex Warrior"],
  ["Wizard/Bladesinging", "Training in War and Song (Bladesinging)"],
  ["Expert Sidekick", "Bonus Proficiencies"],
  ["Spellcaster Sidekick", "Bonus Proficiencies"],
  ["Warrior Sidekick", "Bonus Proficiencies"],
  ["Feat", "Artificer Initiate"],
  ["Feat", "Chef"],
  ["Feat", "Gunner"],
  ["Feat", "Linguist"],
  ["Feat", "Poisoner"],
  ["Feat", "Prodigy"],
  ["Feat", "Quicksmithing"],
  ["Feat", "Resilient"],
  ["Feat", "Skill Expert"],
  ["Feat", "Skilled"],
  ["Feat", "Tavern Brawler"],
  ["Feat", "Weapon Master"],
];

const tracked: TrackedData = {
  classes: JSON.parse(fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8")),
  feats: JSON.parse(fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8")),
};

function trackedFeatures(): Array<{ owner: string; feature: string; description: string }> {
  const out: Array<{ owner: string; feature: string; description: string }> = [];
  for (const cls of tracked.classes) {
    for (const f of cls.features) out.push({ owner: cls.name, feature: f.name, description: f.description });
    for (const sub of cls.subclasses) {
      for (const f of sub.features) out.push({ owner: `${cls.name}/${sub.name}`, feature: f.name, description: f.description });
    }
  }
  for (const feat of tracked.feats) out.push({ owner: "Feat", feature: feat.name, description: feat.description });
  return out;
}

test("every feature in the grants-to-add table is found in the tracked data", () => {
  const features = trackedFeatures();
  for (const [owner, feature] of GRANTS_TO_ADD) {
    assert.ok(
      features.some((f) => f.owner === owner && f.feature === feature),
      `no tracked feature named ${owner} / ${feature}`
    );
  }
});

test("every feature in the grants-to-add table is still matched by the vocabulary, before its override exists", () => {
  const features = trackedFeatures();
  const unmatched: string[] = [];
  for (const [owner, feature] of GRANTS_TO_ADD) {
    const hits = features.filter((f) => f.owner === owner && f.feature === feature);
    if (hits.every((f) => matchedSentences(f.description).length === 0)) unmatched.push(`${owner} / ${feature}`);
  }
  assert.deepEqual(unmatched, []);
});
