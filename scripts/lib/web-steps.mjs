// The web player for the scenario `open` steps. The shared module (scripts/lib/scenarios.mjs) holds the
// steps as data only; the locator call one step maps to is described as plain data in the shared
// scripts/lib/steps.mjs (describeStep, re-exported here), so the mapping can be checked without a browser.
// This module is the web runner's side of the seam (scripts/layout-check.mjs imports it) and owns every page
// call: playStep runs the described locator call. The native runner plays the same step data its own way; a
// named step (one with no locator) is web-only, and only this module knows what it does there.
import { describeStep } from "./steps.mjs";

export { describeStep };

// Taps the round add button at the right end of the home header. It has no text or label, so it is found by place.
async function tapHeaderAdd(page) {
  const point = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('div[tabindex="0"]')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width === 36 && r.height === 36 && r.top < 80)
      .sort((a, b) => b.left - a.left);
    return buttons[0] ? { x: buttons[0].left + 18, y: buttons[0].top + 18 } : null;
  });
  if (!point) throw new Error("home header add button not found");
  await page.mouse.click(point.x, point.y);
}

// The web-only named steps, by name: the actions a scenario step names because no text, pattern or label taps them.
const NAMED_STEPS = {
  "home-header-add": tapHeaderAdd,
};

// Plays one step on the page: the locator call describeStep names, tapped at its match (the first by
// default), or the web-only action of a named step.
export async function playStep(page, step) {
  const call = describeStep(step);
  if (call.name !== undefined) {
    const named = NAMED_STEPS[call.name];
    if (!named) throw new Error(`no web-only action named "${call.name}"`);
    await named(page);
    return;
  }
  const locator = page[call.method](call.arg, call.options);
  await (call.index === 0 ? locator.first() : locator.nth(call.index)).click();
}

// Plays a scenario's `open` steps in order.
export async function playSteps(page, steps) {
  for (const step of steps ?? []) await playStep(page, step);
}
