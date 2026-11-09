import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScreens, buildSeed } from "../scripts/lib/scenarios.mjs";

// The shared scenario module (scripts/lib/scenarios.mjs) holds the scenario list and the seed builder that
// scripts/layout-check.mjs and the native runner both import. These tests pin the list against the fixtures
// captured from layout-check before the move: the same names in the same order, in both catalog modes, and
// a seed of the shape { characters, folders, settings, integrated }.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fixtureNames(file: string): string[] {
  return JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"));
}

test("SRD scenario names and order equal the pre-move list", () => {
  assert.deepEqual(
    buildScreens({ integrated: false }).map((screen: { name: string }) => screen.name),
    fixtureNames("scenarioNamesSrd.json"),
  );
});

test("integrated scenario names and order equal the pre-move list", () => {
  assert.deepEqual(
    buildScreens({ integrated: true }).map((screen: { name: string }) => screen.name),
    fixtureNames("scenarioNamesIntegrated.json"),
  );
});

test("buildSeed returns { characters, folders, settings, integrated }", () => {
  const srd = buildSeed({ root: ROOT, integrated: false });
  assert.deepEqual(Object.keys(srd).sort(), ["characters", "folders", "integrated", "settings"]);
  assert.ok(Array.isArray(srd.characters));
  // The one folder the home list shows, so the "New character" draft-folder check lands its draft in it.
  assert.deepEqual(srd.folders, [{ id: "folder_camp", name: "Camp", createdAt: 1 }]);
  assert.equal(srd.settings.hasCompletedFirstRun, true);
  assert.equal(srd.integrated, null);

  const integrated = buildSeed({ root: ROOT, integrated: true });
  assert.deepEqual(Object.keys(integrated).sort(), ["characters", "folders", "integrated", "settings"]);
  assert.equal(integrated.integrated.hasIntegratedCatalog, true);
});
