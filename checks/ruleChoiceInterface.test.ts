import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { makeChar, loadTestCatalog, integratedTestCompendium, srdBaselineCompendium } from "./testUtils.ts";
import { infusionCatalog } from "./infusionFixture.ts";
import {
  offeredRuleChoices,
  pickRuleChoice,
  subclassRuleChoices,
} from "../src/rules/ruleChoices.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { GIANT_POWER_CHOICE_ID } from "../src/rules/choices/types.ts";
import {
  fightingStyleRuleChoices,
  pickFightingStyleChoice,
} from "../src/rules/choices/fightingStyles.ts";
import {
  artificerInfusionChoices,
  pickInfusionChoice,
} from "../src/rules/choices/artificerInfusions.ts";
import { currentCompendium } from "../src/services/compendium.ts";

const races = loadTestCatalog("races");
const ACTIVE = ["PHB", "MPMM", "TCE"];

// Import-cycle guard. The Rule Choice module, the transitions and the Reconciler must form an
// acyclic graph, so module loading order never depends on which file is loaded first.

const RULES_DIR = new URL("../src/rules/", import.meta.url).pathname;

function ruleFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return ruleFiles(path);
    return entry.endsWith(".ts") ? [path] : [];
  });
}

function importGraph(files: string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const specifiers = [...source.matchAll(/(?:import|export)\s[^;]*?\sfrom\s*["'](\.[^"']+)["']/g)].map((m) => m[1]);
    graph.set(
      file,
      specifiers.map((spec) => resolve(dirname(file), spec)).filter((target) => files.includes(target)),
    );
  }
  return graph;
}

function findCycle(graph: Map<string, string[]>): string[] | null {
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    state.set(node, "visiting");
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === "visiting") {
        return [...stack.slice(stack.indexOf(next)), next];
      }
      if (!state.has(next)) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(node, "done");
    return null;
  };

  for (const node of graph.keys()) {
    if (!state.has(node)) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

test("import graph: no cycle among the rules modules (Rule Choice, transitions, Reconciler, choice modules)", () => {
  const files = ruleFiles(RULES_DIR);
  assert.ok(files.length > 0, "the guard must find rules modules to check");

  const cycle = findCycle(importGraph(files));
  assert.equal(
    cycle,
    null,
    cycle && `import cycle: ${cycle.map((f) => relative(RULES_DIR, f)).join(" -> ")}`,
  );
});

// Interface behaviour.

const aasimarDruid = () =>
  makeChar({
    race: { name: "Aasimar", source: "MPMM" },
    classes: [{ className: "Druid", source: "PHB", level: 3, subclassName: "Circle of the Land" }],
  });

test("offeredRuleChoices offers ancestry and class choices, each tagged with its origin", () => {
  const offered = offeredRuleChoices(aasimarDruid(), { raceCatalog: races, level: 3, activeBooks: ACTIVE });

  const revelation = offered.find((c) => c.traitName === "Celestial Revelation");
  const biome = offered.find((c) => c.traitName === "Circle of the Land: Biome");
  assert.ok(revelation, "the ancestry revelation is offered at third level");
  assert.ok(biome, "the Circle of the Land biome is offered at druid level 3");
  assert.equal(revelation.origin, "race");
  assert.equal(biome.origin, "subclass");
});

test("offeredRuleChoices filters by origin", () => {
  const base = { raceCatalog: races, level: 3, activeBooks: ACTIVE };

  const classOnly = offeredRuleChoices(aasimarDruid(), { ...base, origins: ["class", "subclass"] });
  assert.ok(classOnly.length > 0);
  assert.ok(classOnly.every((c) => c.origin !== "race"));

  const raceOnly = offeredRuleChoices(aasimarDruid(), { ...base, origins: ["race"] });
  assert.deepEqual(
    raceOnly.map((c) => c.traitName),
    ["Celestial Revelation"],
  );
});

test("picking an offered choice records it under its origin, and the result is already reconciled", () => {
  const char = aasimarDruid();
  const [biome] = subclassRuleChoices(char, ACTIVE);
  const afterBiome = pickRuleChoice(char, biome, "Coast");
  const biomeEntry = afterBiome.ruleChoices?.find((rc) => rc.id === biome.id);
  assert.equal(biomeEntry?.origin, "subclass");
  assert.deepEqual(biomeEntry?.picked, ["Coast"]);
  assert.deepEqual(reconcile(afterBiome, currentCompendium()), afterBiome);

  const [revelation] = offeredRuleChoices(char, { raceCatalog: races, level: 3, activeBooks: ACTIVE, origins: ["race"] });
  const afterRevelation = pickRuleChoice(char, revelation, "Radiant Soul");
  const revelationEntry = afterRevelation.ruleChoices?.find((rc) => rc.id === revelation.id);
  assert.equal(revelationEntry?.origin, "race");
  assert.deepEqual(revelationEntry?.picked, ["Radiant Soul"]);
});

test("Giant Power: the Reconciler keeps the granted cantrip in step with the recorded pick", () => {
  const giant = makeChar({
    classes: [{ className: "Barbarian", level: 3, subclassName: "Path of the Giant", source: "BGG" }],
    ruleChoices: [
      {
        id: GIANT_POWER_CHOICE_ID,
        trait: "Giant Power Cantrip",
        origin: "subclass",
        choose: 1,
        from: ["Druidcraft", "Thaumaturgy"],
        picked: ["Thaumaturgy"],
      },
    ],
    knownSpells: [
      { name: "Druidcraft", source: "PHB", ownerKey: "Barbarian__BGG", ability: "wis", className: "Barbarian" },
    ],
  });

  const once = reconcile(giant, currentCompendium());
  assert.deepEqual(
    once.knownSpells?.map((k) => [k.name, k.ownerKey]),
    [["Thaumaturgy", "Barbarian__BGG"]],
  );
  assert.deepEqual(reconcile(once, currentCompendium()), once, "reconciling again changes nothing");
});

test("Giant Power: picking Druidcraft lands the cantrip in knownSpells and survives a re-pick", () => {
  const char = makeChar({
    classes: [{ className: "Barbarian", level: 3, subclassName: "Path of the Giant", source: "BGG" }],
  });
  const giantChoice = subclassRuleChoices(char).find((c) => c.id === GIANT_POWER_CHOICE_ID);
  assert.ok(giantChoice);

  const picked = pickRuleChoice(char, giantChoice, "Druidcraft");
  assert.deepEqual(picked.knownSpells?.map((k) => k.name), ["Druidcraft"]);

  const repicked = pickRuleChoice(picked, giantChoice, "Thaumaturgy");
  assert.deepEqual(repicked.knownSpells?.map((k) => k.name), ["Thaumaturgy"]);
});

test("fighting style picks keep their specialised recording", () => {
  const fighter = makeChar({ classes: [{ className: "Fighter", level: 1 }] });
  const fightingStyle = fightingStyleRuleChoices(fighter).find((c) => c.id === "PHB__Fighter__Fighting Style");
  assert.ok(fightingStyle);

  const viaInterface = pickRuleChoice(fighter, fightingStyle, "Defense");
  const viaModule = reconcile(pickFightingStyleChoice(fighter, fightingStyle, "Defense"), currentCompendium());
  assert.deepEqual(viaInterface, viaModule);
});

test("artificer infusion picks keep their specialised recording", () => {
  const artificer = makeChar({ classes: [{ className: "Artificer", level: 2 }] });
  const catalog = infusionCatalog();
  const [infusion] = artificerInfusionChoices(artificer, ["PHB", "TCE"], catalog);
  assert.ok(infusion);
  assert.equal(infusion.pick, "artificerInfusion");

  const viaInterface = pickRuleChoice(artificer, infusion, "Placeholder Alpha", catalog);
  const viaModule = reconcile(pickInfusionChoice(artificer, infusion, "Placeholder Alpha"), catalog);
  assert.deepEqual(viaInterface, viaModule);
});

test("a rule choice id that no table recognises is left alone by a pick", () => {
  const char = makeChar({
    ...aasimarDruid(),
    ruleChoices: [
      { id: "FUTURE__Unknown__Choice", trait: "Future Choice", origin: "subclass", choose: 1, from: ["A"], picked: ["A"] },
    ],
  });
  const [biome] = subclassRuleChoices(char, ACTIVE);
  const updated = pickRuleChoice(char, biome, "Coast");
  assert.ok(updated.ruleChoices?.some((rc) => rc.id === "FUTURE__Unknown__Choice" && rc.picked[0] === "A"));
});

const ACOLYTE_OF_NATURE_ID = "PHB__Cleric__Nature Domain__Acolyte of Nature";
const TOTEM_SPIRIT_3_ID = "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3";

test("a catalog-derived pick is offered and recorded in both SRD and integrated modes", () => {
  const cleric = makeChar({
    classes: [{ className: "Cleric", source: "PHB", level: 1, subclassName: "Nature Domain" }],
  });
  const choiceIn = (compendium: Compendium) => {
    const choice = subclassRuleChoices(cleric, undefined, compendium).find((c) => c.id === ACOLYTE_OF_NATURE_ID);
    assert.ok(choice, "the domain cantrip choice is offered at first level");
    return choice;
  };
  const srd = srdBaselineCompendium();
  const integrated = integratedTestCompendium();
  const srdChoice = choiceIn(srd);
  const integratedChoice = choiceIn(integrated);

  const srdNames = srdChoice.options.map((o) => o.name);
  const integratedNames = integratedChoice.options.map((o) => o.name);
  assert.ok(srdNames.includes("Druidcraft"), "the SRD baseline offers its druid cantrips");
  assert.ok(integratedNames.length > srdNames.length, "the integrated catalog offers more druid cantrips");
  assert.ok(integratedNames.includes("Control Flames"), "an expansion cantrip is offered in integrated mode");
  assert.equal(srdNames.includes("Control Flames"), false, "an expansion cantrip is not offered in SRD mode");

  const srdPicked = pickRuleChoice(cleric, srdChoice, "Guidance", srd);
  assert.deepEqual(srdPicked.ruleChoices?.find((rc) => rc.id === ACOLYTE_OF_NATURE_ID)?.picked, ["Guidance"]);
  assert.deepEqual(reconcile(srdPicked, srd), srdPicked, "the SRD pick is already reconciled");

  const integratedPicked = pickRuleChoice(cleric, integratedChoice, "Control Flames", integrated);
  assert.deepEqual(
    integratedPicked.ruleChoices?.find((rc) => rc.id === ACOLYTE_OF_NATURE_ID)?.picked,
    ["Control Flames"],
  );
  assert.deepEqual(reconcile(integratedPicked, integrated), integratedPicked, "the integrated pick is already reconciled");
});

test("a book-gated option is offered only while its book is active, and an existing pick survives a disabled book", () => {
  const totem = makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 3, subclassName: "Path of the Totem Warrior" }],
  });
  const spiritChoice = (books: string[]) => {
    const choice = subclassRuleChoices(totem, books).find((c) => c.id === TOTEM_SPIRIT_3_ID);
    assert.ok(choice, "the totem spirit choice is offered at third level");
    return choice;
  };

  const phbOnly = spiritChoice(["PHB"]);
  assert.deepEqual(
    phbOnly.options.map((o) => o.name),
    ["Bear", "Eagle", "Wolf"],
    "Elk and Tiger are hidden while SCAG is inactive",
  );

  const withScag = spiritChoice(["PHB", "SCAG"]);
  assert.ok(withScag.options.some((o) => o.name === "Elk"), "Elk is offered while SCAG is active");
  assert.ok(withScag.options.some((o) => o.name === "Tiger"), "Tiger is offered while SCAG is active");

  const picked = pickRuleChoice(totem, withScag, "Elk");
  assert.deepEqual(picked.ruleChoices?.find((rc) => rc.id === TOTEM_SPIRIT_3_ID)?.picked, ["Elk"]);

  // Disabling the book later gates new offers only; a pick already on the sheet still displays.
  const afterDisable = reconcile(picked, currentCompendium());
  assert.deepEqual(afterDisable.ruleChoices?.find((rc) => rc.id === TOTEM_SPIRIT_3_ID)?.picked, ["Elk"]);
});
