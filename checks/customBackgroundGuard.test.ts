import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// A background is custom by one rule: isCustomBackground (src/rules/customBackground.ts) reads the flag
// `background.isCustom` and the source "Custom". This guard scans src/ for a direct read of a background's flag,
// or a comparison of a background's source with "Custom", outside that module. An item's flag (`item.isCustom`)
// is not a background and does not match. The scan is line by line, so a read split across lines is not seen,
// and comment lines are skipped. A failure names the file and line and says to use isCustomBackground.
// Allowlist entries must still match a use, so a removed use takes its entry out with it.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const RULE_FILE = "rules/customBackground.ts";

/** An identifier that names a background: `background`, `bg`, `customBackground`, `character.background`'s last segment. */
const BACKGROUND_NAME = String.raw`\b(?:bg\w*|[\w$]*[Bb]ackground[\w$]*)`;

/** `background.isCustom`, `background?.isCustom`, `background?.["isCustom"]`, `background["isCustom"]`. */
const FLAG_READ = new RegExp(String.raw`${BACKGROUND_NAME}\s*(?:\??\.\s*isCustom\b|\??\.?\s*\[\s*["']isCustom["']\s*\])`);

/** `const { isCustom } = character.background;` */
const FLAG_DESTRUCTURED = new RegExp(String.raw`\{[^{}]*\bisCustom\b[^{}]*\}\s*=\s*(?:[\w$]+\??\.)*${BACKGROUND_NAME}\b`);

/** `background.source === "Custom"` in either order, with `==`, `===`, `!=` or `!==`. */
const SOURCE_CUSTOM = new RegExp(
  String.raw`${BACKGROUND_NAME}\s*\??\.\s*source\s*[!=]==?\s*["']Custom["']|["']Custom["']\s*[!=]==?\s*${BACKGROUND_NAME}\s*\??\.\s*source\b`,
);

/** Whether a line reads a background's custom flag or compares its source with "Custom". */
function isBackgroundCustomRead(line: string): boolean {
  return FLAG_READ.test(line) || FLAG_DESTRUCTURED.test(line) || SOURCE_CUSTOM.test(line);
}

interface Allowance {
  file: string;
  /** Text the matched line must contain, so the entry stops matching when the use is removed. */
  line: string;
  reason: string;
}

const ALLOWANCES: Allowance[] = [
  {
    file: "components/builder/BackgroundSection.tsx",
    line: 'character.background.source === "Custom" ? "Custom Background"',
    reason:
      "the selected-background card labels a background by its saved source. A flagged record whose source is not Custom keeps the label it had before the rule; routing it through isCustomBackground would change that label for saved characters",
  },
  {
    file: "components/builder/BackgroundSection.tsx",
    line: 'character.background.source !== "Custom" &&',
    reason:
      "the Background Benefits card is shown for a catalog background only. A flagged record whose source is not Custom keeps showing it; routing it through isCustomBackground would hide it for saved characters",
  },
];

interface Finding {
  file: string;
  line: number;
  text: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function isCommentLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
}

function findings(): Finding[] {
  return sourceFiles(SRC).flatMap((path) => {
    const file = relative(SRC, path).split(sep).join("/");
    if (file === RULE_FILE || file.startsWith("data/")) return [];
    return readFileSync(path, "utf8")
      .split("\n")
      .flatMap((text, index): Finding[] =>
        !isCommentLine(text) && isBackgroundCustomRead(text) ? [{ file, line: index + 1, text: text.trim() }] : [],
      );
  });
}

function format(finding: Finding): string {
  return `src/${finding.file}:${finding.line} reads a background's custom flag or source directly; use isCustomBackground (src/rules/customBackground.ts)`;
}

test("guard: the custom-background patterns match background reads and not item flags or the rule's own calls", () => {
  const reads = [
    "const custom = background.isCustom;",
    "if (bg.isCustom) return;",
    "if (bg?.isCustom) return;",
    "const flagged = character.background.isCustom;",
    "const flagged = currentCharacter.background?.isCustom;",
    'const flagged = held.background?.["isCustom"];',
    "const { isCustom } = character.background;",
    'if (character.background.source === "Custom") {',
    'const label = character.background.source !== "Custom" && x;',
    'if ("Custom" === bg.source) return;',
    'if (bg || bg.source === "Custom") return;',
  ];
  for (const line of reads) assert.ok(isBackgroundCustomRead(line), line);

  const notReads = [
    "if (item.isCustom) return;",
    "const { isCustom } = item;",
    'const item = { source: "Custom", isCustom: true };',
    'source: "Custom",',
    "const flagged = isCustomBackground(character.background);",
    "const [isCustomBg, setIsCustomBg] = useState(false);",
    'if (item.source === "Custom") return;',
  ];
  for (const line of notReads) assert.equal(isBackgroundCustomRead(line), false, line);
});

test("guard: every background read of the custom flag or source in src/ is allowlisted with a reason", () => {
  const unallowed = findings().filter((f) => !ALLOWANCES.some((a) => a.file === f.file && f.text.includes(a.line)));
  assert.deepEqual(
    unallowed.map(format),
    [],
    "use isCustomBackground (src/rules/customBackground.ts) instead of reading the flag or source directly",
  );
});

test("guard: every allowlisted read still matches a use, so the list cannot go stale", () => {
  const found = findings();
  const stale = ALLOWANCES.filter((a) => !found.some((f) => f.file === a.file && f.text.includes(a.line)));
  assert.deepEqual(
    stale.map((a) => `${a.file}: ${a.line}`),
    [],
    "a removed or changed read must take its allowlist entry out",
  );
});
