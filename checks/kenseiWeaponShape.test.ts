import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { ClassData, SubclassData } from "../src/types/dnd5e.ts";
import { createCompendium } from "../src/services/compendium.ts";
import { kenseiWeaponNames } from "../src/rules/kenseiWeapons.ts";
import { choiceCatalogBundle } from "./choiceCatalogFixture.ts";
import { makeChar } from "./testUtils.ts";

/**
 * The Monk weapon rule is recognised by the shape of the grant: a weapon choice on a subclass feature of a
 * Monk. Every subclass whose data declares that shape gets the same behavior. The names here are invented.
 */

const SUBCLASS = "Way of the Invented Stance";
const FEATURE = "Invented Stance Training";
const WEAPON = "Placeholder Blade";
const GRANT = `TST/Monk/${SUBCLASS}/${FEATURE}@3#0`;

const stanceSubclass: SubclassData = {
  name: SUBCLASS,
  shortName: "Invented Stance",
  source: "TST",
  className: "Monk",
  classSource: "PHB",
  features: [
    {
      name: FEATURE,
      level: 3,
      description: "Placeholder prose for the invented stance.",
      grants: [
        {
          id: GRANT,
          kind: "choice",
          category: "weapons",
          count: 1,
          pool: { kind: "names", names: [WEAPON] },
        },
      ],
    },
  ],
  description: "Placeholder description for the invented subclass.",
};

const monkClass: ClassData = {
  name: "Monk",
  source: "PHB",
  hitDie: "1d8",
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 2, from: [] },
  features: [],
  subclasses: [stanceSubclass],
  description: "Placeholder description for the invented class.",
};

const compendium = () => createCompendium({ ...choiceCatalogBundle(), classes: [monkClass] });

const stanceChar = (picks: Record<string, string[]>): Character =>
  makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 3, subclassName: SUBCLASS, subclassSource: "TST" }],
    proficiencyPicks: picks,
  });

test("a weapon pick on a Monk subclass's feature is a kensei weapon, whatever the subclass is called", () => {
  assert.deepEqual(kenseiWeaponNames(stanceChar({ [GRANT]: [WEAPON] }), { compendium: compendium(), activeBooks: ALL_BOOKS }), [WEAPON]);
});

test("a weapon pick on a feature of another class is not a Monk Weapon", () => {
  const wizardStance = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 3, subclassName: SUBCLASS, subclassSource: "TST" }],
    proficiencyPicks: { [GRANT]: [WEAPON] },
  });
  assert.deepEqual(kenseiWeaponNames(wizardStance, { compendium: compendium(), activeBooks: ALL_BOOKS }), []);
});
