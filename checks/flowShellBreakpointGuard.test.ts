import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// FlowShell's wide breakpoint is BREAKPOINTS.tablet by reference, so the flows and the sheet (which switch
// on useResponsiveLayout's isTablet) always change layout at the same width. A second literal 768 in
// FlowShell would drift from BREAKPOINTS.tablet, which checks/responsiveLayout.test.ts pins to 768.
// The identity side column's threshold is likewise BREAKPOINTS.desktop by reference (pinned to 1024 in
// checks/responsiveLayout.test.ts), so a second literal 1024 in FlowShell would drift from it.

const SOURCE = readFileSync(fileURLToPath(new URL("../src/components/creationFlow/FlowShell.tsx", import.meta.url)), "utf8");

test("FLOW_WIDE_MIN_WIDTH is BREAKPOINTS.tablet by reference, not a second literal", () => {
  assert.match(SOURCE, /export const FLOW_WIDE_MIN_WIDTH = BREAKPOINTS\.tablet;/, "FLOW_WIDE_MIN_WIDTH must be assigned BREAKPOINTS.tablet");
  assert.ok(!/FLOW_WIDE_MIN_WIDTH\s*=\s*\d+/.test(SOURCE), "FLOW_WIDE_MIN_WIDTH is a literal number, not BREAKPOINTS.tablet");
  assert.match(
    SOURCE,
    /import\s*\{[^}]*\bBREAKPOINTS\b[^}]*\}\s*from\s*["']\.\.\/\.\.\/hooks\/useResponsiveLayout["']/,
    "BREAKPOINTS must be imported from the shared responsive layout module",
  );
});

test("FLOW_IDENTITY_SIDE_MIN_WIDTH is BREAKPOINTS.desktop by reference, and the side column carries its testID", () => {
  assert.match(
    SOURCE,
    /export const FLOW_IDENTITY_SIDE_MIN_WIDTH = BREAKPOINTS\.desktop;/,
    "FLOW_IDENTITY_SIDE_MIN_WIDTH must be assigned BREAKPOINTS.desktop",
  );
  assert.ok(!/FLOW_IDENTITY_SIDE_MIN_WIDTH\s*=\s*\d+/.test(SOURCE), "FLOW_IDENTITY_SIDE_MIN_WIDTH is a literal number, not BREAKPOINTS.desktop");
  assert.match(SOURCE, /const identitySide = width >= FLOW_IDENTITY_SIDE_MIN_WIDTH;/, "the side column must switch on FLOW_IDENTITY_SIDE_MIN_WIDTH");
  assert.match(SOURCE, /testID="flow-identity-side"/, "the identity side column must carry the flow-identity-side testID");
});
