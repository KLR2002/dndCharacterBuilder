import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The dice result card must announce each Roll exactly once per platform. The card mounts fresh on
// every Roll (`latest ? <ResultCard/> : null`), so a live region on the card itself appears already
// populated — after a dismissal or the timeout the next Roll mounts a new view whose region already
// has its text, which TalkBack does not reliably announce. So Android and iOS announce explicitly
// through AccessibilityInfo.announceForAccessibility, and web alone keeps a live region: one that is
// always mounted, so each Roll changes its text inside an existing region. One mechanism per platform.

const SOURCE = readFileSync(fileURLToPath(new URL("../src/components/dice/DiceOverlay.tsx", import.meta.url)), "utf8");

test("the overlay holds exactly one live region, and it is not the result card", () => {
  const occurrences = SOURCE.match(/accessibilityLiveRegion/g) ?? [];
  assert.equal(occurrences.length, 1, "exactly one live region in the overlay: the always-mounted web container");
  const card = /function ResultCard[\s\S]*?\n\}/.exec(SOURCE)?.[0] ?? "";
  assert.ok(card.length > 0, "the ResultCard function was found");
  assert.ok(!card.includes("accessibilityLiveRegion"), "the result card itself is not a live region");
});

test("the explicit announcement runs on Android and iOS, never on web", () => {
  const announceAt = SOURCE.indexOf("AccessibilityInfo.announceForAccessibility");
  assert.ok(announceAt > 0, "the overlay still announces explicitly somewhere");
  const before = SOURCE.slice(Math.max(0, announceAt - 400), announceAt);
  assert.match(before, /Platform\.OS === "web"/, "the announce effect returns early on web only, so Android and iOS both announce explicitly");
});

test("web's live region is always mounted on web, so a Roll changes its text instead of mounting a populated region", () => {
  const at = SOURCE.indexOf('accessibilityLiveRegion="polite"');
  assert.ok(at > 0, "web keeps a polite live region as a plain literal prop");
  const before = SOURCE.slice(Math.max(0, at - 160), at);
  assert.match(before, /Platform\.OS === "web"/, "the live region container renders on web only");
  // It sits after the card's `latest ? ... : null`, so it stays mounted across dismissals.
  assert.ok(at > SOURCE.indexOf("latest ?"), "the live region is not mounted per result card (`latest ? ... : null`)");
  assert.ok(SOURCE.slice(at).includes("latest === null"), "the region's text follows the latest Roll and clears on dismissal");
});
