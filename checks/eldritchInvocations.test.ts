import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import {
  warlockInvocationChoices,
  warlockPactBoonChoices,
  getChosenInvocations,
  hasInvocation,
  getChosenPactBoon,
  getAtWillInvocationSpells,
  INVOCATION_AT_WILL_SPELLS,
  isInvocationEligible,
  pruneInvalidInvocations,
  subclassRuleChoices,
  pickSubclassRuleChoice,
} from "../src/rules/ruleChoices.ts";
import { getEldritchBlastDamage } from "../src/rules/attacks.ts";
import { removeAsiSelection } from "../src/rules/leveling.ts";
import { teardownSubclass } from "../src/rules/builderTransitions.ts";

test("Warlock level milestones offer correct number of invocations (2 at lvl 2, up to 8 at lvl 18)", () => {
  // Level 1: 0 invocations
  const w1 = makeChar({
    classes: [{ className: "Warlock", level: 1, hitDiceType: "d8" }],
  });
  assert.equal(warlockInvocationChoices(w1).length, 0);

  // Level 2: 1 slot (choose 2) -> total 2
  const w2 = makeChar({
    classes: [{ className: "Warlock", level: 2, hitDiceType: "d8" }],
  });
  const c2 = warlockInvocationChoices(w2);
  assert.equal(c2.length, 1);
  assert.equal(c2[0].id, "PHB__Warlock__Invocations 2");
  assert.equal(c2[0].choose, 2);
  assert.equal(c2[0].level, 2);

  // Level 3: still 1 slot (choose 2) -> total 2
  const w3 = makeChar({
    classes: [{ className: "Warlock", level: 3, hitDiceType: "d8" }],
  });
  assert.equal(warlockInvocationChoices(w3).length, 1);

  // Level 5: 2 slots (choose 2 + choose 1) -> total 3
  const w5 = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
  });
  const c5 = warlockInvocationChoices(w5);
  assert.equal(c5.length, 2);
  const total5 = c5.reduce((sum, c) => sum + c.choose, 0);
  assert.equal(total5, 3);

  // Level 7: 3 slots -> total 4
  const w7 = makeChar({
    classes: [{ className: "Warlock", level: 7, hitDiceType: "d8" }],
  });
  const c7 = warlockInvocationChoices(w7);
  assert.equal(c7.length, 3);
  assert.equal(c7.reduce((sum, c) => sum + c.choose, 0), 4);

  // Level 9: 4 slots -> total 5
  const w9 = makeChar({
    classes: [{ className: "Warlock", level: 9, hitDiceType: "d8" }],
  });
  const c9 = warlockInvocationChoices(w9);
  assert.equal(c9.length, 4);
  assert.equal(c9.reduce((sum, c) => sum + c.choose, 0), 5);

  // Level 12: 5 slots -> total 6
  const w12 = makeChar({
    classes: [{ className: "Warlock", level: 12, hitDiceType: "d8" }],
  });
  const c12 = warlockInvocationChoices(w12);
  assert.equal(c12.length, 5);
  assert.equal(c12.reduce((sum, c) => sum + c.choose, 0), 6);

  // Level 15: 6 slots -> total 7
  const w15 = makeChar({
    classes: [{ className: "Warlock", level: 15, hitDiceType: "d8" }],
  });
  const c15 = warlockInvocationChoices(w15);
  assert.equal(c15.length, 6);
  assert.equal(c15.reduce((sum, c) => sum + c.choose, 0), 7);

  // Level 18: 7 slots -> total 8
  const w18 = makeChar({
    classes: [{ className: "Warlock", level: 18, hitDiceType: "d8" }],
  });
  const c18 = warlockInvocationChoices(w18);
  assert.equal(c18.length, 7);
  assert.equal(c18.reduce((sum, c) => sum + c.choose, 0), 8);

  // Level 20: capped at 8 invocations
  const w20 = makeChar({
    classes: [{ className: "Warlock", level: 20, hitDiceType: "d8" }],
  });
  assert.equal(warlockInvocationChoices(w20).reduce((sum, c) => sum + c.choose, 0), 8);
});

test("Pact Boon offered at Warlock level >= 3 and integrates into subclassRuleChoices", () => {
  const w2 = makeChar({
    classes: [{ className: "Warlock", level: 2, hitDiceType: "d8" }],
  });
  assert.equal(warlockPactBoonChoices(w2).length, 0);

  const w3 = makeChar({
    classes: [{ className: "Warlock", level: 3, hitDiceType: "d8" }],
  });
  const boonChoices = warlockPactBoonChoices(w3);
  assert.equal(boonChoices.length, 1);
  assert.equal(boonChoices[0].id, "PHB__Warlock__Pact Boon");
  assert.equal(boonChoices[0].choose, 1);
  const boonNames = boonChoices[0].options.map((o) => o.name);
  assert.ok(boonNames.includes("Pact of the Blade"));
  assert.ok(boonNames.includes("Pact of the Tome"));
  assert.ok(boonNames.includes("Pact of the Chain"));
  assert.ok(boonNames.includes("Pact of the Talisman"));

  // Subclass rule choices includes Pact Boon and Invocations
  const subChoices = subclassRuleChoices(w3);
  assert.ok(subChoices.some((c) => c.id === "PHB__Warlock__Pact Boon"));
  assert.ok(subChoices.some((c) => c.id === "PHB__Warlock__Invocations 2"));

  // Selecting a Pact Boon
  const chosen = pickSubclassRuleChoice(w3, boonChoices[0], "Pact of the Blade");
  assert.equal(getChosenPactBoon(chosen), "Pact of the Blade");
});

test("Level prerequisite gating: Level 5 invocations (Thirsting Blade) not offered to level 2 Warlock", () => {
  const w2 = makeChar({
    classes: [{ className: "Warlock", level: 2, hitDiceType: "d8" }],
    knownSpells: [{ name: "Eldritch Blast", source: "PHB", className: "Warlock" }],
  });

  const choices2 = warlockInvocationChoices(w2);
  const optNames2 = choices2[0].options.map((o) => o.name);

  // Level 5 invocations must NOT be present
  assert.ok(!optNames2.includes("Thirsting Blade"));
  assert.ok(!optNames2.includes("One with Shadows"));
  assert.ok(!optNames2.includes("Sign of Ill Omen"));
  assert.ok(!optNames2.includes("Mire the Mind"));
  assert.ok(!optNames2.includes("Lifedrinker"));

  // Low level invocations ARE present
  assert.ok(optNames2.includes("Armor of Shadows"));
  assert.ok(optNames2.includes("Devil's Sight"));
  assert.ok(optNames2.includes("Fiendish Vigor"));
  assert.ok(optNames2.includes("Agonizing Blast")); // EB known
});

test("Pact Boon prerequisite gating: Blade/Tome/Chain requirements enforced", () => {
  // Warlock 5 without Pact Boon: Thirsting Blade not available
  const w5NoBoon = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
  });
  const c5NoBoon = warlockInvocationChoices(w5NoBoon);
  const allOptsNoBoon = c5NoBoon.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(!allOptsNoBoon.includes("Thirsting Blade"));
  assert.ok(!allOptsNoBoon.includes("Book of Ancient Secrets"));
  assert.ok(!allOptsNoBoon.includes("Voice of the Chain Master"));

  // Warlock 5 with Pact of the Blade: Thirsting Blade available, Tome/Chain not
  const w5Blade = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: ["Pact of the Blade"],
        choose: 1,
        options: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome", "Pact of the Talisman"],
        origin: "class",
      },
    ],
  });
  const c5Blade = warlockInvocationChoices(w5Blade);
  const allOptsBlade = c5Blade.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(allOptsBlade.includes("Thirsting Blade"));
  assert.ok(!allOptsBlade.includes("Book of Ancient Secrets"));
  assert.ok(!allOptsBlade.includes("Voice of the Chain Master"));
  // Lifedrinker requires 12th level Warlock, so not available at level 5
  assert.ok(!allOptsBlade.includes("Lifedrinker"));

  // Warlock 12 with Pact of the Blade: Lifedrinker IS available
  const w12Blade = makeChar({
    classes: [{ className: "Warlock", level: 12, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: ["Pact of the Blade"],
        choose: 1,
        options: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome", "Pact of the Talisman"],
        origin: "class",
      },
    ],
  });
  const c12Blade = warlockInvocationChoices(w12Blade);
  const allOpts12Blade = c12Blade.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(allOpts12Blade.includes("Lifedrinker"));
  assert.ok(allOpts12Blade.includes("Thirsting Blade"));

  // Warlock 5 with Pact of the Tome: Book of Ancient Secrets available
  const w5Tome = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: ["Pact of the Tome"],
        choose: 1,
        options: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome", "Pact of the Talisman"],
        origin: "class",
      },
    ],
  });
  const c5Tome = warlockInvocationChoices(w5Tome);
  const allOptsTome = c5Tome.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(allOptsTome.includes("Book of Ancient Secrets"));
  assert.ok(!allOptsTome.includes("Thirsting Blade"));

  // Warlock 5 with Pact of the Chain: Voice of the Chain Master available
  const w5Chain = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: ["Pact of the Chain"],
        choose: 1,
        options: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome", "Pact of the Talisman"],
        origin: "class",
      },
    ],
  });
  const c5Chain = warlockInvocationChoices(w5Chain);
  const allOptsChain = c5Chain.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(allOptsChain.includes("Voice of the Chain Master"));
  assert.ok(!allOptsChain.includes("Thirsting Blade"));
});

test("Spell / Cantrip prerequisite gating: Eldritch Blast required for Agonizing Blast & Repelling Blast", () => {
  // Warlock 2 without Eldritch Blast cantrip
  const w2NoEb = makeChar({
    classes: [{ className: "Warlock", level: 2, hitDiceType: "d8" }],
    knownSpells: [{ name: "Chill Touch", source: "PHB", className: "Warlock" }],
  });
  const c2NoEb = warlockInvocationChoices(w2NoEb);
  const optsNoEb = c2NoEb[0].options.map((o) => o.name);
  assert.ok(!optsNoEb.includes("Agonizing Blast"));
  assert.ok(!optsNoEb.includes("Repelling Blast"));
  assert.ok(!optsNoEb.includes("Eldritch Spear"));
  assert.ok(!optsNoEb.includes("Grasp of Hadar"));

  // Warlock 2 with Eldritch Blast cantrip
  const w2Eb = makeChar({
    classes: [{ className: "Warlock", level: 2, hitDiceType: "d8" }],
    knownSpells: [{ name: "Eldritch Blast", source: "PHB", className: "Warlock" }],
  });
  const c2Eb = warlockInvocationChoices(w2Eb);
  const optsEb = c2Eb[0].options.map((o) => o.name);
  assert.ok(optsEb.includes("Agonizing Blast"));
  assert.ok(optsEb.includes("Repelling Blast"));
  assert.ok(optsEb.includes("Eldritch Spear"));
  assert.ok(optsEb.includes("Grasp of Hadar"));

  // Maddening Hex requires Hex spell
  const w5NoHex = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
  });
  const c5NoHex = warlockInvocationChoices(w5NoHex);
  const opts5NoHex = c5NoHex.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(!opts5NoHex.includes("Maddening Hex"));

  const w5Hex = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    knownSpells: [{ name: "Hex", source: "PHB", className: "Warlock" }],
  });
  const c5Hex = warlockInvocationChoices(w5Hex);
  const opts5Hex = c5Hex.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(opts5Hex.includes("Maddening Hex"));
});

test("Non-Warlock taking Eldritch Adept can only choose invocations without prerequisites", () => {
  // Fighter 4 taking Eldritch Adept feat (has Eldritch Blast via Magic Initiate)
  const fighterEa = makeChar({
    classes: [{ className: "Fighter", level: 4, hitDiceType: "d10" }],
    knownSpells: [{ name: "Eldritch Blast", source: "PHB", className: "Warlock" }],
    asiSelections: [{ type: "feat", featName: "Eldritch Adept", level: 4, classLevel: 4, className: "Fighter" }],
  });

  const eaChoices = warlockInvocationChoices(fighterEa);
  assert.equal(eaChoices.length, 1);
  assert.equal(eaChoices[0].id, "TCE__Feat__Eldritch Adept__Invocation");
  assert.equal(eaChoices[0].choose, 1);

  const opts = eaChoices[0].options.map((o) => o.name);
  // Non-warlock can only choose invocations with NO prerequisites
  const expectedNoPrereq = [
    "Armor of Shadows",
    "Beast Speech",
    "Beguiling Influence",
    "Devil's Sight",
    "Eldritch Mind",
    "Eldritch Sight",
    "Eyes of the Rune Keeper",
    "Fiendish Vigor",
    "Gaze of Two Minds",
    "Mask of Many Faces",
    "Misty Visions",
    "Thief of Five Fates",
  ];

  for (const exp of expectedNoPrereq) {
    assert.ok(opts.includes(exp), `Expected ${exp} to be offered to non-warlock Eldritch Adept`);
  }

  // Agonizing Blast, Thirsting Blade, etc. have prerequisites and MUST NOT be offered
  assert.ok(!opts.includes("Agonizing Blast"));
  assert.ok(!opts.includes("Repelling Blast"));
  assert.ok(!opts.includes("Thirsting Blade"));
  assert.ok(!opts.includes("Lifedrinker"));
  assert.ok(!opts.includes("Book of Ancient Secrets"));
  assert.equal(opts.length, expectedNoPrereq.length);
});

test("Warlock taking Eldritch Adept can choose invocations with prerequisites if they qualify", () => {
  // Warlock 5 with Pact of the Blade and Eldritch Blast taking Eldritch Adept feat
  const warlockEa = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    knownSpells: [{ name: "Eldritch Blast", source: "PHB", className: "Warlock" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: ["Pact of the Blade"],
        choose: 1,
        options: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome", "Pact of the Talisman"],
        origin: "class",
      },
    ],
    asiSelections: [{ type: "feat", featName: "Eldritch Adept", level: 4, classLevel: 4, className: "Warlock" }],
  });

  const eaChoices = warlockInvocationChoices(warlockEa);
  const featChoice = eaChoices.find((c) => c.id === "TCE__Feat__Eldritch Adept__Invocation");
  assert.ok(featChoice);

  const featOpts = featChoice.options.map((o) => o.name);
  // Qualifies for EB invocations and Pact of the Blade level 5 invocations
  assert.ok(featOpts.includes("Agonizing Blast"));
  assert.ok(featOpts.includes("Thirsting Blade"));
  assert.ok(featOpts.includes("Devil's Sight"));
  // Does NOT qualify for level 12 invocation Lifedrinker
  assert.ok(!featOpts.includes("Lifedrinker"));
});

test("Dynamic cross-choice deduplication: invocations chosen in one slot cannot be picked in another", () => {
  const w5 = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    knownSpells: [{ name: "Eldritch Blast", source: "PHB", className: "Warlock" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Invocations 2",
        trait: "Eldritch Invocations (2nd Level)",
        picked: ["Devil's Sight", "Armor of Shadows"],
        choose: 2,
        options: [],
        origin: "class",
      },
    ],
  });

  const choices = warlockInvocationChoices(w5);
  const lvl2Slot = choices.find((c) => c.id === "PHB__Warlock__Invocations 2");
  const lvl5Slot = choices.find((c) => c.id === "PHB__Warlock__Invocations 5");

  assert.ok(lvl2Slot);
  assert.ok(lvl5Slot);

  // In level 2 slot, existing picks remain in options so they can be unselected/changed
  const lvl2OptNames = lvl2Slot.options.map((o) => o.name);
  assert.ok(lvl2OptNames.includes("Devil's Sight"));
  assert.ok(lvl2OptNames.includes("Armor of Shadows"));

  // In level 5 slot, Devil's Sight and Armor of Shadows are filtered out
  const lvl5OptNames = lvl5Slot.options.map((o) => o.name);
  assert.ok(!lvl5OptNames.includes("Devil's Sight"));
  assert.ok(!lvl5OptNames.includes("Armor of Shadows"));
  assert.ok(lvl5OptNames.includes("Agonizing Blast"));
});

test("Teardown and prerequisite pruning: de-leveling, changing Pact Boon, or removing spells removes invalid invocations", () => {
  // Warlock 5 with Pact of the Blade and Eldritch Blast, having picked Thirsting Blade and Agonizing Blast
  let hero = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    knownSpells: [{ name: "Eldritch Blast", source: "PHB", className: "Warlock" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: ["Pact of the Blade"],
        choose: 1,
        options: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome", "Pact of the Talisman"],
        origin: "class",
      },
      {
        id: "PHB__Warlock__Invocations 2",
        trait: "Eldritch Invocations (2nd Level)",
        picked: ["Agonizing Blast", "Armor of Shadows"],
        choose: 2,
        options: [],
        origin: "class",
      },
      {
        id: "PHB__Warlock__Invocations 5",
        trait: "Eldritch Invocations (5th Level)",
        picked: ["Thirsting Blade"],
        choose: 1,
        options: [],
        origin: "class",
      },
    ],
  });

  assert.equal(hasInvocation(hero, "Thirsting Blade"), true);
  assert.equal(hasInvocation(hero, "Agonizing Blast"), true);
  assert.equal(hasInvocation(hero, "Armor of Shadows"), true);

  // 1. Changing Pact Boon to Pact of the Tome prunes Thirsting Blade
  const pactChoice = warlockPactBoonChoices(hero)[0];
  hero = pickSubclassRuleChoice(hero, pactChoice, "Pact of the Tome");

  assert.equal(hasInvocation(hero, "Thirsting Blade"), false);
  assert.equal(hasInvocation(hero, "Agonizing Blast"), true);
  assert.equal(hasInvocation(hero, "Armor of Shadows"), true);
  assert.ok(
    hero.needsReview?.some((n) => n.includes("Thirsting Blade removed: prerequisite no longer satisfied"))
  );

  // 2. Removing Eldritch Blast cantrip and pruning removes Agonizing Blast
  hero = {
    ...hero,
    knownSpells: [],
  };
  hero = pruneInvalidInvocations(hero);

  assert.equal(hasInvocation(hero, "Agonizing Blast"), false);
  assert.equal(hasInvocation(hero, "Armor of Shadows"), true);
  assert.ok(
    hero.needsReview?.some((n) => n.includes("Agonizing Blast removed: prerequisite no longer satisfied"))
  );

  // 3. De-leveling Warlock to level 1 drops all Warlock invocations
  hero = {
    ...hero,
    classes: [{ className: "Warlock", level: 1, hitDiceType: "d8" }],
  };
  hero = pruneInvalidInvocations(hero);
  assert.equal(getChosenInvocations(hero).length, 0);
  assert.ok(
    hero.needsReview?.some((n) => n.includes("Armor of Shadows removed: prerequisite no longer satisfied"))
  );
});

test("Agonizing Blast adds Charisma modifier to Eldritch Blast damage string", () => {
  // CHA 16 (+3 mod)
  const charCha16 = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    classes: [{ className: "Warlock", level: 2, hitDiceType: "d8" }],
  });
  // Without Agonizing Blast
  assert.equal(getEldritchBlastDamage(charCha16), "1d10 force");

  // With Agonizing Blast
  const charWithAgonizing = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    classes: [{ className: "Warlock", level: 2, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Invocations 2",
        trait: "Eldritch Invocations (2nd Level)",
        picked: ["Agonizing Blast"],
        choose: 2,
        options: [],
        origin: "class",
      },
    ],
  });
  assert.equal(getEldritchBlastDamage(charWithAgonizing), "1d10 + 3 force");

  // CHA 20 (+5 mod)
  const charCha20 = makeChar({
    ...charWithAgonizing,
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 20 },
  });
  assert.equal(getEldritchBlastDamage(charCha20), "1d10 + 5 force");

  // CHA 8 (-1 mod)
  const charCha8 = makeChar({
    ...charWithAgonizing,
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 8 },
  });
  assert.equal(getEldritchBlastDamage(charCha8), "1d10 - 1 force");
});

test("At-will spells from invocations identified via getAtWillInvocationSpells", () => {
  const charNone = makeChar();
  assert.deepEqual(getAtWillInvocationSpells(charNone), []);

  const charWithAtWill = makeChar({
    ruleChoices: [
      {
        id: "PHB__Warlock__Invocations 2",
        trait: "Eldritch Invocations (2nd Level)",
        picked: ["Armor of Shadows", "Fiendish Vigor", "Mask of Many Faces", "Misty Visions"],
        choose: 4,
        options: [],
        origin: "class",
      },
    ],
  });

  const atWill = getAtWillInvocationSpells(charWithAtWill);
  assert.equal(atWill.length, 4);
  assert.ok(atWill.some((s) => s.spellName === "Mage Armor" && s.invocationName === "Armor of Shadows"));
  assert.ok(atWill.some((s) => s.spellName === "False Life" && s.invocationName === "Fiendish Vigor"));
  assert.ok(atWill.some((s) => s.spellName === "Disguise Self" && s.invocationName === "Mask of Many Faces"));
  assert.ok(atWill.some((s) => s.spellName === "Silent Image" && s.invocationName === "Misty Visions"));
});

test("Eldritch Adept feat removal via removeAsiSelection removes choice and prunes invocations", () => {
  const charWithFeat = makeChar({
    classes: [{ className: "Fighter", level: 4, hitDiceType: "d10" }],
    asiSelections: [
      {
        className: "Fighter",
        classLevel: 4,
        level: 4,
        type: "feat",
        featName: "Eldritch Adept",
      },
    ],
    ruleChoices: [
      {
        id: "TCE__Feat__Eldritch Adept__Invocation",
        trait: "Eldritch Adept: Invocation",
        picked: ["Devil's Sight"],
        choose: 1,
        options: [],
        origin: "class",
      },
    ],
  });

  assert.equal(hasInvocation(charWithFeat, "Devil's Sight"), true);

  const updated = removeAsiSelection(charWithFeat, "Fighter", 4);
  assert.equal(hasInvocation(updated, "Devil's Sight"), false);
  assert.ok(!updated.ruleChoices?.some((rc) => rc.id.includes("Eldritch Adept")));
});

test("Teardown subclass invokes pruneInvalidInvocations", () => {
  const char = makeChar({
    classes: [{ className: "Warlock", level: 2, subclassName: "The Fiend", hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Invocations 2",
        trait: "Eldritch Invocations (2nd Level)",
        picked: ["Devil's Sight"],
        choose: 2,
        options: [],
        origin: "class",
      },
    ],
  });

  const torn = teardownSubclass(char, "Warlock", "The Fiend");
  assert.ok(torn);
  // Devil's Sight is still valid for level 2 Warlock
  assert.equal(hasInvocation(torn, "Devil's Sight"), true);
});

test("Invocation descriptions include their prerequisites clearly stated", () => {
  const w5Blade = makeChar({
    classes: [{ className: "Warlock", level: 5, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: ["Pact of the Blade"],
        choose: 1,
        options: [],
        origin: "class",
      },
    ],
    knownSpells: [{ name: "Eldritch Blast", source: "PHB", ability: "cha" }],
  });

  const choices = warlockInvocationChoices(w5Blade);
  const choice5 = choices.find((c) => c.id === "PHB__Warlock__Invocations 5");
  assert.ok(choice5);

  // Thirsting Blade has prerequisite: 5th-level Warlock; Pact of the Blade
  const thirsting = choice5.options.find((o) => o.name === "Thirsting Blade");
  assert.ok(thirsting);
  assert.ok(
    thirsting.description.startsWith("Prerequisite: 5th level, Pact of the Blade."),
    `Expected prefix "Prerequisite: 5th level, Pact of the Blade." but got: ${thirsting.description}`
  );

  // Agonizing Blast has prerequisite: eldritch blast cantrip/spell
  const agonizing = choice5.options.find((o) => o.name === "Agonizing Blast");
  assert.ok(agonizing);
  assert.ok(
    agonizing.description.startsWith("Prerequisite: eldritch blast cantrip."),
    `Expected prefix "Prerequisite: eldritch blast cantrip." but got: ${agonizing.description}`
  );

  // Armor of Shadows has no prerequisite
  const armorOfShadows = choice5.options.find((o) => o.name === "Armor of Shadows");
  assert.ok(armorOfShadows);
  assert.ok(!armorOfShadows.description.startsWith("Prerequisite:"));
});

test("Hexblade check is conjunctive: non-Warlock with subclass hexblade does not satisfy prerequisite", () => {
  // Fighter 5 with homebrew subclass "Hexblade" should NOT satisfy hex/curse requirement for Maddening Hex
  const fakeHexblade = makeChar({
    classes: [{ className: "Fighter", level: 5, subclassName: "Hexblade", hitDiceType: "d10" }],
    asiSelections: [
      {
        className: "Fighter",
        classLevel: 4,
        level: 4,
        type: "feat",
        featName: "Eldritch Adept",
      },
    ],
  });

  const eaChoices = warlockInvocationChoices(fakeHexblade);
  const eaOptionNames = eaChoices[0]?.options.map((o) => o.name) || [];
  assert.ok(!eaOptionNames.includes("Maddening Hex"));
});

