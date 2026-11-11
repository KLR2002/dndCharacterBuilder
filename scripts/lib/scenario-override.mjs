// The web runner's per-width scenario override (scripts/layout-check.mjs applies it to every scenario it
// visits): a scenario may carry a `wide` field — `{ minWidth, ...overrides }` — that applyWideOverride
// merges over the scenario when the page width is at or above `minWidth` (shallow merge: `open`, `modal`,
// `expect`, `ready` ... are replaced wholesale, and `modal: null` unsets the modal). This lets one scenario
// assert a different path at wide widths, e.g. the identity panel on screen instead of behind a tap. Below
// every `minWidth` the scenario is used as written, and the Android runner (phone-only) never applies
// overrides, so phone widths and native runs behave exactly as before. It lives in its own module so a test
// can import it without pulling in playwright or the Expo server driver that layout-check.mjs needs.
export function applyWideOverride(screen, width) {
  const wide = screen.wide;
  if (!wide || typeof wide.minWidth !== "number" || width < wide.minWidth) return screen;
  const { minWidth, ...overrides } = wide;
  return { ...screen, ...overrides };
}
