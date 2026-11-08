import test from "node:test";
import assert from "node:assert/strict";
import { ACCENT_PALETTES, BASE_DARK_THEME, getFullTheme } from "../src/constants/theme.ts";

const MIN_RATIO = 4.5;
const SURFACES = ["background", "surface", "surfaceRaised", "surfaceHighlight"] as const;
const TEXT_AND_STATUS = [
  "text",
  "textSecondary",
  "textMuted",
  "success",
  "warning",
  "danger",
  "info",
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  assert.equal(value.length, 6, `expected a 6-digit hex colour, got ${hex}`);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

// WCAG 2.x relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test("every accent palette is checked", () => {
  assert.ok(Object.keys(ACCENT_PALETTES).length >= 7);
});

for (const accentId of Object.keys(ACCENT_PALETTES)) {
  test(`accent "${accentId}" meets WCAG AA on every surface`, () => {
    const theme = getFullTheme(accentId);
    const failures: string[] = [];
    for (const surfaceKey of SURFACES) {
      const surface = BASE_DARK_THEME[surfaceKey];
      const pairs: [string, string, string][] = [
        ...TEXT_AND_STATUS.map((key) => [key, theme[key], surface] as [string, string, string]),
        // The accent's ink (secondary tone) used for text, icons and selection borders.
        ["accent ink", theme.accentHover, surface],
      ];
      for (const [label, fg, bg] of pairs) {
        const ratio = contrastRatio(fg, bg);
        if (ratio < MIN_RATIO) {
          failures.push(
            `${label} ${fg} on ${surfaceKey} ${bg}: ${ratio.toFixed(2)}:1 < ${MIN_RATIO}:1`,
          );
        }
      }
    }
    const labelRatio = contrastRatio(theme.accentText, theme.accent);
    if (labelRatio < MIN_RATIO) {
      failures.push(
        `label on fill accentText ${theme.accentText} on accent ${theme.accent}: ${labelRatio.toFixed(2)}:1 < ${MIN_RATIO}:1`,
      );
    }
    assert.deepEqual(failures, [], `accent "${accentId}" fails WCAG AA:\n${failures.join("\n")}`);
  });
}
