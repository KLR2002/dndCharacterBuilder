import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The dice result card must announce each Roll exactly once per platform. Android and web have the
// card's polite live region (accessibilityLiveRegion), so the explicit AccessibilityInfo announcement
// must run only on iOS, which has no live region — on Android the two together would make TalkBack
// speak every result twice.

const SOURCE = readFileSync(fileURLToPath(new URL("../src/components/dice/DiceOverlay.tsx", import.meta.url)), "utf8");

test("the result card keeps a polite live region on Android and web, but not on iOS", () => {
  const prop = /accessibilityLiveRegion=\{([^}]*)\}/.exec(SOURCE)?.[1] ?? "";
  assert.ok(prop.length > 0, "the result card's accessibilityLiveRegion is no longer a plain prop expression");
  assert.match(prop, /Platform\.OS === "ios"/, "the live region is switched off on iOS only");
  assert.match(prop, /"polite"/, "Android and web keep the polite live region");
});

test("the explicit announcement runs only on iOS, where no live region applies", () => {
  const announceAt = SOURCE.indexOf("AccessibilityInfo.announceForAccessibility");
  assert.ok(announceAt > 0, "the overlay still announces explicitly somewhere");
  const before = SOURCE.slice(Math.max(0, announceAt - 400), announceAt);
  assert.match(before, /Platform\.OS !== "ios"/, "the announce effect returns early on every platform but iOS");
  assert.ok(!/accessibilityLiveRegion="polite"/.test(SOURCE), "no unconditional live region remains on the card");
});
