// Times the pure work one Creation Flow pick triggers, against the live Integrated Catalog.
import { readFileSync } from "node:fs";
const R = "/home/krzysztof/Dokumenty/Projects/dndCharacterBuilder";
const { integrate, currentCompendium } = await import(`${R}/src/services/compendium.ts`);
const { makeChar } = await import(`${R}/checks/testUtils.ts`);
const { evaluateCharacter } = await import(`${R}/src/rules/characterEvaluation.ts`);
const { creationSteps, currentCreationStep, applyBuildStepUpdate } = await import(`${R}/src/rules/creationFlow.ts`);
const { reconcile } = await import(`${R}/src/rules/characterReconciler.ts`);
const { proficiencySheet, sourceGrants } = await import(`${R}/src/rules/proficiencySheet.ts`);
const { proficiencyChoiceOffers } = await import(`${R}/src/rules/proficiencyChoiceOffers.ts`);
const { migrateIfNeeded } = await import(`${R}/src/services/storage.ts`);
const { DEFAULT_ACTIVE_BOOK_CODES } = await import(`${R}/src/constants/books.ts`);

integrate(JSON.parse(readFileSync(`${R}/.cache/live-catalog/catalog.json`, "utf8")));
const activeBooks = DEFAULT_ACTIVE_BOOK_CODES;
const catalogs = () => ({ compendium: currentCompendium(), activeBooks });

const draft = makeChar({
  race: { name: "Half-Elf", source: "PHB" }, background: { name: "Sage", source: "PHB" },
  classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  creationProgress: { currentStep: "class" } as any,
});
const veteran = makeChar({
  race: { name: "Human", source: "PHB" }, background: { name: "Acolyte", source: "PHB" },
  classes: [{ className: "Wizard", source: "PHB", level: 6 }, { className: "Cleric", source: "PHB", level: 4 }],
});

function time(label: string, fn: () => unknown, n = 30) {
  for (let i = 0; i < 3; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  const ms = (performance.now() - t0) / n;
  console.log(`${label.padEnd(44)} ${ms.toFixed(2).padStart(8)} ms`);
  return ms;
}

for (const [name, c] of [["draft Wizard 1", draft], ["Wizard 6 / Cleric 4", veteran]] as const) {
  console.log(`\n== ${name}`);
  const steps = time("creationSteps", () => creationSteps(c, { activeBooks }));
  const cur = time("currentCreationStep", () => currentCreationStep(c, { activeBooks }));
  const ev = time("evaluateCharacter", () => evaluateCharacter(c, catalogs()));
  const sg = time("sourceGrants", () => sourceGrants(c, catalogs()));
  const pco = time("proficiencyChoiceOffers", () => proficiencyChoiceOffers(c, { activeBooks }));
  const ps = time("proficiencySheet", () => proficiencySheet(c, catalogs()));
  const rec = time("reconcile", () => reconcile(c, currentCompendium(), { activeBooks }));
  const next = { ...c, chosenSkills: [...(c.chosenSkills ?? []), "Arcana"] };
  const apply = time("applyBuildStepUpdate (skills on class step)", () => applyBuildStepUpdate(c, next, "class", { activeBooks }));
  const chars = Array.from({ length: 10 }, (_, i) => ({ ...c, id: `c${i}` }));
  const save = time("save path: parse+migrate+stringify, 10 chars", () => {
    const parsed = JSON.parse(JSON.stringify(chars));
    JSON.stringify(migrateIfNeeded({ characters: parsed, folders: [], settings: {} }).characters);
  });
  // One render of the build screen: steps + current step + BuilderTab + IdentityPanel.
  const render = steps + cur + ev * 2 + sg + pco + ps;
  console.log(`-- one render ≈ ${render.toFixed(1)} ms; one pick ≈ apply + 2 renders + save ≈ ${(apply + 2 * render + save).toFixed(1)} ms`);
}
