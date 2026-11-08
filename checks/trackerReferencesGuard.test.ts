import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Source comments and test names carry no tracker references: ticket numbers, slice numbers, spec ids and
// local tracker folder paths belong in the ticket, not in the code. This guard scans the comments of the source
// folders (src/, scripts/, plugins/) and the comments and test names of checks/*.test.ts. String literals in code
// are not comments, so a string that happens to name a reference is not flagged. The synthetic tests prove that
// each pattern is caught in a comment and in a test name, and that a comment after a nested template literal is found.

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const COMMENT_ROOTS = ["src", "scripts", "plugins"];
const CHECKS_DIR = "checks";
const CODE_FILE = /\.(ts|tsx|js|mjs)$/;

/** A tracker reference, by what it names. */
const TRACKER_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "spec id", pattern: /\bAC-\d+\b/ },
  { name: "question id", pattern: /\bQ\d+\b/ },
  { name: ".scratch reference", pattern: /\.scratch\b/ },
  { name: "ticket number", pattern: /\bticket\s+\d+\b/i },
  { name: "slice number", pattern: /\bslice\s+\d+\b/i },
];

type Span = { line: number; text: string };
type TrackerHit = { line: number; where: string; match: string };

/** The number of line breaks in `text`. */
function lineBreaks(text: string): number {
  return text.split("\n").length - 1;
}

/** Lexical context: top-level code, a template literal, or a `${` expression with its unclosed braces. */
type Context = { kind: "code" } | { kind: "template" } | { kind: "expr"; braces: number };

/**
 * The comments of a source file, each with the line it starts on. String and template literals are skipped, so
 * a comment marker inside a string is not a comment. A quoted string ends at its line's end, since JavaScript
 * strings cannot span lines, so an unterminated quote in a regular expression cannot hide the rest of the file.
 */
function commentsOf(source: string): Span[] {
  const comments: Span[] = [];
  const stack: Context[] = [{ kind: "code" }];
  let i = 0;
  let line = 1;
  const skipTo = (to: number): void => {
    line += lineBreaks(source.slice(i, to));
    i = to;
  };
  while (i < source.length) {
    const top = stack[stack.length - 1];
    const ch = source[i];
    const next = source[i + 1];
    if (top.kind === "template") {
      if (ch === "\\") skipTo(i + 2);
      else if (ch === "`") {
        stack.pop();
        skipTo(i + 1);
      } else if (ch === "$" && next === "{") {
        stack.push({ kind: "expr", braces: 0 });
        skipTo(i + 2);
      } else skipTo(i + 1);
      continue;
    }
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      comments.push({ line, text: source.slice(i + 2, stop) });
      skipTo(stop);
      continue;
    }
    if (ch === "/" && next === "*") {
      const close = source.indexOf("*/", i + 2);
      const stop = close === -1 ? source.length : close;
      comments.push({ line, text: source.slice(i + 2, stop) });
      skipTo(Math.min(stop + 2, source.length));
      continue;
    }
    if (ch === '"' || ch === "'") {
      let end = i + 1;
      while (end < source.length && source[end] !== ch && source[end] !== "\n") end += source[end] === "\\" ? 2 : 1;
      skipTo(Math.min(end + 1, source.length));
      continue;
    }
    if (ch === "`") {
      stack.push({ kind: "template" });
      skipTo(i + 1);
      continue;
    }
    if (top.kind === "expr" && ch === "{") top.braces++;
    if (top.kind === "expr" && ch === "}") {
      if (top.braces === 0) stack.pop();
      else top.braces--;
    }
    skipTo(i + 1);
  }
  return comments;
}

/** The first string argument of each test( and describe( call, each with the line it starts on. */
function testNamesOf(source: string): Span[] {
  const call = /\b(?:test|describe)\(\s*(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  return [...source.matchAll(call)].map((m) => ({ line: 1 + lineBreaks(source.slice(0, m.index)), text: m[2] }));
}

/** The tracker references in one span of text, each with the line it sits on. */
function findTrackerRefs(text: string, line: number, where: string): TrackerHit[] {
  return TRACKER_PATTERNS.flatMap(({ name, pattern }) => {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    return [...text.matchAll(global)].map((m) => ({
      line: line + lineBreaks(text.slice(0, m.index)),
      where,
      match: `${name}: ${m[0]}`,
    }));
  });
}

/** Every tracker reference in a source file: its comments, and its test names when `withTestNames` is set. */
function trackerHits(source: string, withTestNames: boolean): TrackerHit[] {
  const hits = commentsOf(source).flatMap(({ line, text }) => findTrackerRefs(text, line, "comment"));
  if (withTestNames) {
    hits.push(...testNamesOf(source).flatMap(({ line, text }) => findTrackerRefs(text, line, "test name")));
  }
  return hits;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "node_modules" ? [] : filesUnder(path);
    return CODE_FILE.test(entry) ? [path] : [];
  });
}

function describeHits(file: string, hits: TrackerHit[]): string[] {
  return hits.map((hit) => `${relative(ROOT, file).split(sep).join("/")}:${hit.line} (${hit.where}) ${hit.match}`);
}

test("source comments under src, scripts and plugins carry no tracker reference", () => {
  const found = COMMENT_ROOTS.flatMap((root) =>
    filesUnder(join(ROOT, root)).flatMap((file) => describeHits(file, trackerHits(readFileSync(file, "utf8"), false))),
  );
  assert.deepEqual(found, [], "source comments must not name tickets, slices, spec ids or .scratch paths");
});

test("checks test files carry no tracker reference in their comments or test names", () => {
  const files = readdirSync(join(ROOT, CHECKS_DIR))
    .filter((entry) => entry.endsWith(".test.ts"))
    .map((entry) => join(ROOT, CHECKS_DIR, entry));
  const found = files.flatMap((file) => describeHits(file, trackerHits(readFileSync(file, "utf8"), true)));
  assert.deepEqual(found, [], "checks test files must not name tickets, slices, spec ids or .scratch paths in comments or test names");
});

test("guard, synthetic: each pattern is caught in a comment, on the line it sits on", () => {
  const examples = ["AC-8", "Q6", ".scratch/feature/notes.md", "ticket 12", "Ticket 12", "slice 3"];
  for (const example of examples) {
    const hits = trackerHits(`const a = 1;\n// the rule from ${example} holds\n`, false);
    assert.equal(hits.length, 1, `${example} in a line comment`);
    assert.equal(hits[0].line, 2, `${example} reports the comment's line`);
    assert.equal(hits[0].where, "comment");
    const block = trackerHits(`const b = 2;\n/*\n * ${example}\n */\n`, false);
    assert.equal(block.length, 1, `${example} in a block comment`);
    assert.equal(block[0].line, 3, `${example} in a block comment reports the line the match sits on`);
  }
});

test("guard, synthetic: each pattern is caught in a test name", () => {
  const examples = ["AC-8", "Q6", ".scratch/feature/notes.md", "ticket 12", "slice 3"];
  for (const example of examples) {
    const hits = trackerHits(`test("${example} holds", () => {});\ndescribe("${example}", () => {});\n`, true);
    assert.equal(hits.length, 2, `${example} in a test or describe name`);
    assert.ok(hits.every((hit) => hit.where === "test name"), `${example} is reported as a test name`);
  }
});

test("guard, synthetic: the same text in a plain string literal in code is not flagged", () => {
  const source = [
    'const label = "AC-8 Q6 .scratch/x ticket 12 slice 3";',
    "const other = `ticket 4 and slice 5`;",
    "const single = 'AC-9';",
    'test("plain name", () => { const s = "AC-8"; assert.ok(s); });',
    "",
  ].join("\n");
  assert.deepEqual(trackerHits(source, true), []);
});

test("guard, synthetic: a clean comment and a clean test name pass", () => {
  const source = '// Returns the sum of the rolls.\ntest("sums the rolls", () => {});\n';
  assert.deepEqual(trackerHits(source, true), []);
});

test("guard, synthetic: a comment after a nested template literal is still found", () => {
  const source = "const a = `x ${`y`} z`;\n// slice 2 follows the template\n";
  const hits = trackerHits(source, false);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2);
});
