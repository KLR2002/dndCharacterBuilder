import test from "node:test";
import assert from "node:assert/strict";
import { applyWideOverride } from "../scripts/layout-check.mjs";
import { buildScreens } from "../scripts/lib/scenarios.mjs";

// The web runner's per-width override mechanism (scripts/layout-check.mjs): a scenario may carry a `wide`
// field — `{ minWidth, ...overrides }` — that applyWideOverride merges over the scenario when the run's page
// width is at or above `minWidth`. Phone widths below every minWidth get the scenario as written, and the
// Android runner (phone-only) never calls applyWideOverride, so both behave exactly as before.

type Screen = { name: string; route?: string; open?: unknown; modal?: string | null; ready?: unknown; expect?: unknown; wide?: { minWidth: number } & Record<string, unknown> };

test("below minWidth the scenario is returned unchanged (same object)", () => {
  const screen: Screen = { name: "S", route: "/x", open: [{ tap: { text: "A" } }], modal: "M", wide: { minWidth: 1024, modal: null } };
  assert.equal(applyWideOverride(screen, 320), screen);
  assert.equal(applyWideOverride(screen, 768), screen);
  assert.equal(applyWideOverride(screen, 1023), screen);
});

test("at or above minWidth the overrides merge over the scenario, wholesale per key", () => {
  const screen: Screen = {
    name: "S",
    route: "/x",
    open: [{ tap: { text: "A" } }],
    modal: "M",
    ready: "R",
    wide: { minWidth: 1024, open: [], modal: null, ready: "8 (-1)", expect: { texts: ["8 (-1)"] } },
  };
  const at1024 = applyWideOverride(screen, 1024) as Screen;
  const at1280 = applyWideOverride(screen, 1280) as Screen;
  for (const merged of [at1024, at1280]) {
    assert.equal(merged.name, "S");
    assert.equal(merged.route, "/x");
    assert.deepEqual(merged.open, []);
    assert.equal(merged.modal, null, "modal: null unsets the modal in the override");
    assert.equal(merged.ready, "8 (-1)");
    assert.deepEqual(merged.expect, { texts: ["8 (-1)"] });
  }
});

test("a scenario without a wide field is never overridden", () => {
  const screen: Screen = { name: "S", modal: "M" };
  assert.equal(applyWideOverride(screen, 1280), screen);
});

test("every wide field in the shared scenario list has a numeric minWidth and stays inert at phone widths", () => {
  for (const integrated of [false, true]) {
    const withWide = buildScreens({ integrated }).filter((screen) => (screen as Screen).wide);
    assert.ok(withWide.length > 0, "expected at least one scenario with a wide override");
    for (const screen of withWide) {
      const wide = (screen as Screen).wide!;
      assert.equal(typeof wide.minWidth, "number", `${screen.name}: wide.minWidth must be a number`);
      for (const width of [320, 360, 393, 412]) assert.equal(applyWideOverride(screen, width), screen, `${screen.name} must be unchanged at ${width}px`);
      assert.notEqual(applyWideOverride(screen, wide.minWidth), screen, `${screen.name} must merge at its minWidth`);
    }
  }
});
