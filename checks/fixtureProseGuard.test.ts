import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The UI-dump fixtures are captured from the real app, so a long text value in one can be real rules prose
// copied into the repository. The rules allow no real 5e prose in new files, tests or fixtures. This guard reads
// every checks/fixtures/uiautomator-*.xml and fails on any text or content-desc attribute value longer than 150
// characters, naming the file and the start of the value. Values are decoded from XML entities before they are
// measured. An allowlist entry names a value by file and first 40 characters, with a reason, and it must still
// match a long value, so a removed value takes its entry out with it. The synthetic tests cover the length limit,
// the boundary, the entities, the attribute names and the allowlist.

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const FIXTURE_FILE = /^uiautomator-.*\.xml$/;
const MAX_VALUE_LENGTH = 150;
const PREFIX_LENGTH = 40;

/** A long value that is not real rules prose, named by its file and first 40 characters. */
type Allowance = { file: string; prefix: string; reason: string };

const ALLOWLIST: Allowance[] = [
  {
    file: "uiautomator-background-languages-clipped.xml",
    prefix: "Feature: Lanternbound Credit, Fieldwarde",
    reason: "invented feature text (Lanternbound Credit, Fieldwardens of the Salt Road) written to replace captured prose",
  },
  {
    file: "uiautomator-background-languages-clipped.xml",
    prefix: "Fieldwardens of the Salt Road keep a led",
    reason: "invented feature text (Fieldwardens of the Salt Road) written to replace captured prose",
  },
];

type ProseResult = { violations: string[]; stale: Allowance[] };

/** The text and content-desc attribute values of an XML dump, decoded. */
function attributeValues(xml: string): string[] {
  return [...xml.matchAll(/\s(?:text|content-desc)="([^"]*)"/g)].map((m) => decodeXml(m[1]));
}

/** The XML entities a UI dump uses, decoded. `&amp;` comes last so that `&amp;lt;` decodes to `&lt;`, not `<`. */
function decodeXml(value: string): string {
  return value
    .replace(/&#10;/g, "\n")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The long values in the given dumps that the allowlist does not name, and the allowlist entries that match none. */
function proseCheck(files: Record<string, string>, allowlist: Allowance[]): ProseResult {
  const violations: string[] = [];
  const used = new Set<Allowance>();
  for (const [file, xml] of Object.entries(files)) {
    for (const value of attributeValues(xml)) {
      if (value.length <= MAX_VALUE_LENGTH) continue;
      const allowance = allowlist.find((entry) => entry.file === file && value.slice(0, PREFIX_LENGTH) === entry.prefix);
      if (allowance) {
        used.add(allowance);
        continue;
      }
      violations.push(
        `${file}: "${value.slice(0, PREFIX_LENGTH)}" is ${value.length} characters, over ${MAX_VALUE_LENGTH}`,
      );
    }
  }
  return { violations, stale: allowlist.filter((entry) => !used.has(entry)) };
}

test("every long text value in a UI-dump fixture is allowlisted, and every allowlist entry still matches", () => {
  const files = Object.fromEntries(
    readdirSync(FIXTURES)
      .filter((entry) => FIXTURE_FILE.test(entry))
      .map((entry) => [entry, readFileSync(join(FIXTURES, entry), "utf8")]),
  );
  const { violations, stale } = proseCheck(files, ALLOWLIST);
  assert.deepEqual(violations, [], "a text value over 150 characters is real rules prose or needs an allowlist reason");
  assert.deepEqual(
    stale.map((entry) => `${entry.file}: "${entry.prefix}"`),
    [],
    "an allowlist entry must match a long value; remove entries whose value is gone",
  );
});

test("guard, synthetic: a text value over 150 characters fails and names its file and start", () => {
  const xml = `<hierarchy><node text="${"invented ".repeat(20).trim()}" /></hierarchy>`;
  const { violations } = proseCheck({ "uiautomator-synthetic.xml": xml }, []);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /^uiautomator-synthetic\.xml: "invented invented/);
});

test("guard, synthetic: a short text value passes", () => {
  const xml = '<hierarchy><node text="Short label" content-desc="Also short" /></hierarchy>';
  assert.deepEqual(proseCheck({ "uiautomator-synthetic.xml": xml }, []).violations, []);
});

test("guard, synthetic: the limit is exclusive, so 150 characters pass and 151 fail", () => {
  const at = `<node text="${"a".repeat(150)}" />`;
  const over = `<node text="${"a".repeat(151)}" />`;
  assert.deepEqual(proseCheck({ "uiautomator-synthetic.xml": at }, []).violations, []);
  assert.equal(proseCheck({ "uiautomator-synthetic.xml": over }, []).violations.length, 1);
});

test("guard, synthetic: a content-desc value over 150 characters fails too", () => {
  const xml = `<node content-desc="${"b".repeat(151)}" />`;
  assert.equal(proseCheck({ "uiautomator-synthetic.xml": xml }, []).violations.length, 1);
});

test("guard, synthetic: entities are decoded before the length is measured", () => {
  const decodesToLimit = `<node text="${"a".repeat(149)}&amp;" />`;
  const decodesOver = `<node text="${"a".repeat(150)}&amp;" />`;
  assert.deepEqual(proseCheck({ "uiautomator-synthetic.xml": decodesToLimit }, []).violations, []);
  assert.equal(proseCheck({ "uiautomator-synthetic.xml": decodesOver }, []).violations.length, 1);
});

test("guard, synthetic: other attributes are not measured", () => {
  const xml = `<node resource-id="${"c".repeat(200)}" hint="${"d".repeat(200)}" />`;
  assert.deepEqual(proseCheck({ "uiautomator-synthetic.xml": xml }, []).violations, []);
});

test("guard, synthetic: an allowlisted value passes, and an entry that matches no long value is stale", () => {
  const long = "Invented text. ".repeat(12);
  const xml = `<node text="${long}" />`;
  const allowed: Allowance = { file: "uiautomator-synthetic.xml", prefix: long.slice(0, 40), reason: "invented" };
  const wrongFile: Allowance = { ...allowed, file: "uiautomator-other.xml" };
  const gone: Allowance = { file: "uiautomator-synthetic.xml", prefix: "Removed text no longer in the dump", reason: "invented" };

  const matched = proseCheck({ "uiautomator-synthetic.xml": xml }, [allowed]);
  assert.deepEqual(matched.violations, []);
  assert.deepEqual(matched.stale, []);

  const mismatched = proseCheck({ "uiautomator-synthetic.xml": xml }, [wrongFile, gone]);
  assert.equal(mismatched.violations.length, 1, "an entry for another file does not allow this value");
  assert.deepEqual(mismatched.stale, [wrongFile, gone]);
});
