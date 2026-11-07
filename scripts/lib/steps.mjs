// The shared description of a scenario step, as plain data. scripts/lib/scenarios.mjs holds the steps as
// data only; each runner maps them its own way: the web player (scripts/lib/web-steps.mjs) turns them into
// Playwright locator calls, the native player (scripts/lib/native-steps.mjs) matches them against a
// uiautomator dump. This module holds the mapping both sides read, and imports nothing.

// The locator call one step maps to, as plain data: the page method ("getByText" or "getByLabel"), its
// argument (the text, the pattern as a RegExp, or the label), the options the call passes (from `exact`),
// and the match to tap (`index`, the first by default). A step with `name` instead of a locator carries
// `name` and no method: it is a web-only named step.
export function describeStep(step) {
  const tap = step.tap;
  if (tap.name !== undefined) return { name: tap.name };
  const options = tap.exact ? { exact: true } : undefined;
  const index = tap.index ?? 0;
  if (tap.pattern !== undefined) return { method: "getByText", arg: new RegExp(tap.pattern), options, index };
  if (tap.text !== undefined) return { method: "getByText", arg: tap.text, options, index };
  return { method: "getByLabel", arg: tap.label, options, index };
}
