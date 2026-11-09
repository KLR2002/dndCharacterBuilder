import test from "node:test";
import assert from "node:assert/strict";
import { buildScreens } from "../scripts/lib/scenarios.mjs";
import { describeStep, playStep, playSteps } from "../scripts/lib/web-steps.mjs";

// The shared scenario module (scripts/lib/scenarios.mjs) holds its `open` steps as data that both runners
// play; the web player lives with the web runner (scripts/lib/web-steps.mjs, used by layout-check.mjs).
// These tests pin that: no scenario carries a function to play, every step is well-formed tap data, a step
// with no native form is a named step that marks its scenario web-only, and the web player maps each step
// shape to the same locator call the old closure made (checked on a recording fake page, no browser).

type Tap = { text?: string; pattern?: string; label?: string; name?: string; exact?: boolean; index?: number };
type Step = { tap: Tap };
type Screen = { name: string; open?: Step[]; modal?: unknown; webOnly?: boolean };

function screensOf(integrated: boolean): Screen[] {
  return buildScreens({ integrated }) as unknown as Screen[];
}

test("no scenario of either catalog mode holds a function-valued open or modal", () => {
  for (const integrated of [false, true]) {
    const offenders = screensOf(integrated)
      .filter((screen) => typeof screen.open === "function" || typeof screen.modal === "function")
      .map((screen) => screen.name);
    assert.deepEqual(offenders, [], `integrated=${integrated} still holds function-valued steps`);
  }
});

test("every open step is well-formed tap data", () => {
  for (const integrated of [false, true]) {
    for (const screen of screensOf(integrated)) {
      if (screen.open === undefined) continue;
      assert.ok(Array.isArray(screen.open), `${screen.name}: open is not a step list`);
      for (const step of screen.open) {
        const locators = ["text", "pattern", "label", "name"].filter((key) => step.tap[key as keyof Tap] !== undefined);
        assert.equal(locators.length, 1, `${screen.name}: step tap holds ${JSON.stringify(step.tap)}`);
        if (step.tap.index !== undefined) assert.ok(Number.isInteger(step.tap.index) && step.tap.index >= 0, `${screen.name}: bad index`);
        if (step.tap.exact !== undefined) assert.equal(typeof step.tap.exact, "boolean", `${screen.name}: bad exact`);
      }
    }
  }
});

test("a scenario with a named step is web-only, and only those are", () => {
  for (const integrated of [false, true]) {
    for (const screen of screensOf(integrated)) {
      const named = (screen.open ?? []).some((step) => step.tap.name !== undefined);
      assert.equal(screen.webOnly === true, named, `${screen.name} (integrated=${integrated}): webOnly does not follow its named steps`);
    }
  }
});

// The locator call each step shape maps to, as describeStep reports it. The text, pattern and label rows are
// the calls the module's former closures made: getByText with { exact: true } or with a RegExp, getByLabel
// with or without { exact: true }, always the first match unless the step says otherwise.
test("describeStep maps each step shape to its locator call", () => {
  const cases: [Step, unknown][] = [
    [{ tap: { text: "CHA", exact: true } }, { method: "getByText", arg: "CHA", options: { exact: true }, index: 0 }],
    [{ tap: { text: "Create Custom", exact: true } }, { method: "getByText", arg: "Create Custom", options: { exact: true }, index: 0 }],
    [{ tap: { pattern: "^Take Rest" } }, { method: "getByText", arg: /^Take Rest/, options: undefined, index: 0 }],
    [{ tap: { pattern: "^Conditions \\(" } }, { method: "getByText", arg: /^Conditions \(/, options: undefined, index: 0 }],
    [{ tap: { label: "Add tool proficiency" } }, { method: "getByLabel", arg: "Add tool proficiency", options: undefined, index: 0 }],
    [{ tap: { label: "Initiative breakdown", exact: true } }, { method: "getByLabel", arg: "Initiative breakdown", options: { exact: true }, index: 0 }],
    [{ tap: { text: "X" } }, { method: "getByText", arg: "X", options: undefined, index: 0 }],
    [{ tap: { text: "X", index: 2 } }, { method: "getByText", arg: "X", options: undefined, index: 2 }],
    [{ tap: { name: "home-header-add" } }, { name: "home-header-add" }],
  ];
  for (const [step, expected] of cases) assert.deepEqual(describeStep(step), expected, JSON.stringify(step));
});

// One recorded call per click on a fake page: the locator method, its argument and options, which match was
// picked, and the action.
type Recorded = { method: string; arg: unknown; options: unknown; pick: string | number; action: string };

function fakePage() {
  const calls: Recorded[] = [];
  const locator = (method: string, arg: unknown, options: unknown) => ({
    first: () => ({ click: async () => void calls.push({ method, arg, options, pick: "first", action: "click" }) }),
    nth: (index: number) => ({ click: async () => void calls.push({ method, arg, options, pick: index, action: "click" }) }),
  });
  const page = {
    getByText: (arg: unknown, options?: unknown) => locator("getByText", arg, options),
    getByLabel: (arg: unknown, options?: unknown) => locator("getByLabel", arg, options),
    evaluate: async () => ({ x: 10, y: 20 }),
    mouse: { click: async (x: number, y: number) => void calls.push({ method: "mouse.click", arg: { x, y }, options: undefined, pick: "coordinate", action: "click" }) },
  };
  return { page, calls };
}

test("playStep clicks the same locator call the former closure made", async () => {
  const cases: [Step, Recorded][] = [
    [{ tap: { text: "CHA", exact: true } }, { method: "getByText", arg: "CHA", options: { exact: true }, pick: "first", action: "click" }],
    [{ tap: { pattern: "^Take Rest" } }, { method: "getByText", arg: /^Take Rest/, options: undefined, pick: "first", action: "click" }],
    [{ tap: { pattern: "^Conditions \\(" } }, { method: "getByText", arg: /^Conditions \(/, options: undefined, pick: "first", action: "click" }],
    [{ tap: { label: "Add language" } }, { method: "getByLabel", arg: "Add language", options: undefined, pick: "first", action: "click" }],
    [{ tap: { label: "Initiative breakdown", exact: true } }, { method: "getByLabel", arg: "Initiative breakdown", options: { exact: true }, pick: "first", action: "click" }],
    [{ tap: { text: "X", index: 2 } }, { method: "getByText", arg: "X", options: undefined, pick: 2, action: "click" }],
    [{ tap: { name: "home-header-add" } }, { method: "mouse.click", arg: { x: 10, y: 20 }, options: undefined, pick: "coordinate", action: "click" }],
  ];
  for (const [step, expected] of cases) {
    const { page, calls } = fakePage();
    await playStep(page as never, step);
    assert.deepEqual(calls, [expected], JSON.stringify(step));
  }
});

test("playSteps plays every scenario's open steps of both modes, one click per step in order", async () => {
  for (const integrated of [false, true]) {
    for (const screen of screensOf(integrated)) {
      const { page, calls } = fakePage();
      await playSteps(page as never, screen.open);
      assert.equal(calls.length, screen.open?.length ?? 0, `${screen.name} (integrated=${integrated})`);
    }
  }
  // The multi-tap steps play as several clicks in order, and the web-only named step as a coordinate click.
  const integrated = screensOf(true);
  const collapsed = integrated.find((screen) => screen.name === "Builder Class skills card collapsed");
  const reopened = integrated.find((screen) => screen.name === "Builder Class skills card reopened");
  const newCharacter = integrated.find((screen) => screen.name === "New character draft");
  for (const [screen, args] of [
    [collapsed, ["Skills", "Class & Subclass Choices", "Expertise"]],
    [reopened, ["Class & Subclass Choices", "Class & Subclass Choices"]],
  ] as [Screen | undefined, string[]][]) {
    const { page, calls } = fakePage();
    await playSteps(page as never, screen?.open);
    assert.deepEqual(
      calls.map((call) => call.arg),
      args,
      screen?.name ?? "unnamed",
    );
    assert.ok(calls.every((call) => call.method === "getByText" && call.pick === "first" && call.action === "click"));
  }
  const { page, calls } = fakePage();
  await playSteps(page as never, newCharacter?.open);
  assert.deepEqual(calls.map((call) => call.method), ["mouse.click"]);
});
