import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Character, RuleChoiceEntry } from "../src/types/character.ts";
import type { ClassData, SubclassData } from "../src/types/dnd5e.ts";
import type { CompendiumCollections } from "../src/services/compendiumStorage.ts";
import { createCompendium } from "../src/services/compendium.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { proficiencySheet } from "../src/rules/proficiencySheet.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { choiceCatalogBundle, TIGER_SKILL_GRANT } from "./choiceCatalogFixture.ts";
import { integratedTestCompendium, makeChar } from "./testUtils.ts";

/**
 * A grant on a subclass feature that is one option of an earlier feature's choice applies only while the
 * character's pick on that choice names the option. The pick's row id is read from the feature's own
 * Catalog coordinates, so a subclass that declares the same shape gets the same behavior.
 */

const TIGER = TIGER_SKILL_GRANT.id;
const AOB_6 = "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6";

const aspectPick = (picked: string[], id = AOB_6, trait = "Aspect of the Beast (6th Level)"): RuleChoiceEntry => ({
  id,
  trait,
  origin: "subclass",
  choose: 1,
  from: [],
  picked,
});

const totemChar = (ruleChoices: RuleChoiceEntry[] = [], extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 6, subclassName: "Path of the Totem Warrior", subclassSource: "PHB" }],
    ruleChoices,
    ...extra,
  });

const tigerOffers = (character: Character, compendium = createCompendium(choiceCatalogBundle())) =>
  proficiencyChoiceOffers(character, { compendium }).filter((offer) => offer.id === TIGER);

test("the Tiger skill choice is offered as Tiger only while the Aspect of the Beast pick is Tiger", () => {
  assert.deepEqual(tigerOffers(totemChar()), [], "no Aspect pick yet, so no Tiger choice");
  assert.deepEqual(tigerOffers(totemChar([aspectPick(["Bear"])])), [], "another animal, so no Tiger choice");

  const offers = tigerOffers(totemChar([aspectPick(["Tiger"])]));
  assert.deepEqual(offers.map((offer) => offer.traitName), ["Tiger"]);
  assert.equal(offers[0].choose, 2);
  assert.deepEqual(offers[0].options.map((option) => option.name), ["Athletics", "Acrobatics", "Stealth", "Survival"]);
});

test("the Integrated Catalog's Tiger skill choice is offered only with the Aspect of the Beast pick", () => {
  const compendium = integratedTestCompendium();
  assert.deepEqual(tigerOffers(totemChar(), compendium), [], "no Aspect pick yet, so no Tiger choice");
  assert.deepEqual(tigerOffers(totemChar([aspectPick(["Bear"])]), compendium), [], "another animal, so no Tiger choice");
  assert.deepEqual(tigerOffers(totemChar([aspectPick(["Tiger"])]), compendium).map((offer) => offer.traitName), ["Tiger"]);
});

// The tracked scraper data as the layout check's integrated mode reads it: the Totem options are still their own
// features there, so the Tiger grant on its own feature must carry the requirement that gates it.
test("the tracked class data gates the Tiger skill choice on the Aspect of the Beast pick", () => {
  const tracked = JSON.parse(readFileSync(new URL("../dnd5eToolsScrap/data/classes.json", import.meta.url), "utf8"));
  const compendium = createCompendium({ ...choiceCatalogBundle(), classes: tracked as ClassData[] });
  assert.deepEqual(tigerOffers(totemChar(), compendium), [], "no Aspect pick yet, so no Tiger choice");
  assert.deepEqual(tigerOffers(totemChar([aspectPick(["Bear"])]), compendium), [], "another animal, so no Tiger choice");
  assert.deepEqual(tigerOffers(totemChar([aspectPick(["Tiger"])]), compendium).map((offer) => offer.traitName), ["Tiger"]);
});

test("the Tiger skill pick is listed on the sheet only with the Aspect of the Beast pick", () => {
  const compendium = createCompendium(choiceCatalogBundle());
  const picked = totemChar([aspectPick(["Tiger"])], {
    proficiencyPicks: { [TIGER]: ["Athletics", "Stealth"] },
  });
  assert.deepEqual(
    proficiencySheet(picked, { compendium }).skills.map((skill) => skill.name).filter((name) => name === "Stealth"),
    ["Stealth"],
  );
  const switched = totemChar([aspectPick(["Bear"])], {
    proficiencyPicks: { [TIGER]: ["Athletics", "Stealth"] },
  });
  assert.deepEqual(
    proficiencySheet(switched, { compendium }).skills.map((skill) => skill.name).filter((name) => name === "Stealth"),
    [],
    "the Tiger pick does not reach the sheet while another animal is the pick",
  );
});

test("the Tiger skill pick is released with a notice when the Aspect of the Beast pick moves to another animal", () => {
  const compendium = createCompendium(choiceCatalogBundle());
  const tigerChar = totemChar([aspectPick(["Tiger"])], {
    proficiencyPicks: { [TIGER]: ["Athletics", "Stealth"] },
  });
  const moved = reconcile(
    { ...tigerChar, ruleChoices: [aspectPick(["Bear"])] },
    compendium,
  );
  assert.equal(moved.proficiencyPicks, undefined, "the pick is gone");
  assert.deepEqual(moved.needsReview, ["Athletics, Stealth removed from Tiger: no longer granted"]);
  assert.deepEqual(reconcile(moved, compendium), moved, "reconciling again changes nothing");
});

// An invented subclass whose feature is one option of an invented choice, the option's grant a standalone
// feature grant. The same shape as the Totem's, under other names.
const INVENTED_SUB = "Path of the Invented Beast";
const INVENTED_ASPECT = "Invented Aspect";
const INVENTED_OPTION = "Invented Option";
const INVENTED_GRANT = `TST/Barbarian/${INVENTED_SUB}/${INVENTED_OPTION}@6#0`;
const INVENTED_ROW = `TST__Barbarian__${INVENTED_SUB}__${INVENTED_ASPECT} 6`;

const inventedSubclass: SubclassData = {
  name: INVENTED_SUB,
  shortName: "Invented Beast",
  source: "TST",
  className: "Barbarian",
  classSource: "PHB",
  features: [
    {
      name: INVENTED_ASPECT,
      level: 6,
      description: "Placeholder prose for the invented aspect.",
      choices: {
        pick: 1,
        options: [{ name: INVENTED_OPTION, description: "Placeholder text.", source: "TST", level: 6 }],
      },
    },
    {
      name: INVENTED_OPTION,
      level: 6,
      description: "Placeholder text.",
      grants: [
        {
          id: INVENTED_GRANT,
          kind: "choice",
          category: "skills",
          count: 1,
          pool: { kind: "names", names: ["Arcana", "Nature"] },
          requires: { feature: INVENTED_ASPECT, level: 6 },
        },
      ],
    },
  ],
  description: "Placeholder description for the invented subclass.",
};

const inventedClass: ClassData = {
  name: "Barbarian",
  source: "PHB",
  hitDie: "1d12",
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 2, from: [] },
  features: [],
  subclasses: [inventedSubclass],
  description: "Placeholder description for the invented class.",
};

const inventedCompendium = () =>
  createCompendium({ ...choiceCatalogBundle(), classes: [inventedClass] } as CompendiumCollections);

const inventedChar = (ruleChoices: RuleChoiceEntry[], extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 6, subclassName: INVENTED_SUB, subclassSource: "TST" }],
    ruleChoices,
    ...extra,
  });

const inventedPick = (picked: string[]) => aspectPick(picked, INVENTED_ROW, `${INVENTED_ASPECT} (6th Level)`);

test("an invented subclass's grant that requires another feature's pick is offered only with that pick", () => {
  const compendium = inventedCompendium();
  const offersOf = (character: Character) =>
    proficiencyChoiceOffers(character, { compendium }).filter((offer) => offer.id === INVENTED_GRANT);

  assert.deepEqual(offersOf(inventedChar([])), [], "no pick, no offer");
  assert.deepEqual(offersOf(inventedChar([inventedPick(["Some Other Option"])])), [], "another option, no offer");
  assert.deepEqual(
    offersOf(inventedChar([inventedPick([INVENTED_OPTION])])).map((offer) => offer.traitName),
    [INVENTED_OPTION],
  );
});

test("an invented subclass's required pick is released with a notice when the parent pick moves away", () => {
  const compendium = inventedCompendium();
  const held = inventedChar([inventedPick([INVENTED_OPTION])], {
    proficiencyPicks: { [INVENTED_GRANT]: ["Arcana"] },
  });
  const moved = reconcile({ ...held, ruleChoices: [inventedPick(["Some Other Option"])] }, compendium);
  assert.equal(moved.proficiencyPicks, undefined);
  assert.deepEqual(moved.needsReview, [`Arcana removed from ${INVENTED_OPTION}: no longer granted`]);
});
