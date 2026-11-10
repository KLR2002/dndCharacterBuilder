import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// FlowShell's wide breakpoint is BREAKPOINTS.tablet by reference, so the flows and the sheet (which switch
// on useResponsiveLayout's isTablet) always change layout at the same width. A second literal 768 in
// FlowShell would drift from BREAKPOINTS.tablet, which checks/responsiveLayout.test.ts pins to 768.

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
