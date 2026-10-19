import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// On Android a vertical ScrollView nested inside another vertical ScrollView (such as the shared
// Modal body) only scrolls when the inner one sets nestedScrollEnabled. A ScrollView with maxHeight
// is a bounded list that always sits inside a Modal or a page scroller, so it must set the prop.
// Horizontal rows are not nested vertically and are exempt. This is a static scan of src/**/*.tsx.

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC_DIR = join(REPO_ROOT, "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return entry.endsWith(".tsx") ? [path] : [];
  });
}

// Reads the props of an opening tag from `start` (just after "<ScrollView") up to its closing ">".
// `top` holds the props at brace depth 0 (quoted values and nested {...} removed), `full` holds the
// whole tag text.
function readOpeningTag(source: string, start: number): { top: string; full: string } {
  let depth = 0;
  let quote = "";
  let top = "";
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    } else if (ch === ">" && depth === 0) {
      return { top, full: source.slice(start, i) };
    } else if (depth === 0) {
      top += ch;
    }
  }
  throw new Error(`Unclosed <ScrollView> opening tag starting at offset ${start}`);
}

type ScrollViewTag = { line: number; top: string; full: string };

function scrollViewTags(source: string): ScrollViewTag[] {
  const opener = /<ScrollView(?=[\s/>])/g;
  const tags: ScrollViewTag[] = [];
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const start = match.index + "<ScrollView".length;
    const { top, full } = readOpeningTag(source, start);
    const line = source.slice(0, match.index).split("\n").length;
    tags.push({ line, top, full });
  }
  return tags;
}

test("bounded vertical ScrollViews set nestedScrollEnabled (Android nested scroll)", () => {
  const files = tsxFiles(SRC_DIR);
  let tagCount = 0;
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const tag of scrollViewTags(source)) {
      tagCount++;
      const isHorizontal = /\bhorizontal\b/.test(tag.top);
      const isBounded = /\bmaxHeight\b/.test(tag.full);
      const hasNestedScroll = /\bnestedScrollEnabled\b/.test(tag.top);
      if (!isHorizontal && isBounded && !hasNestedScroll) {
        offenders.push(`${relative(REPO_ROOT, file)}:${tag.line}`);
      }
    }
  }

  // Guard against the scan silently matching nothing.
  assert.ok(tagCount > 0, "expected to find at least one <ScrollView> under src/");
  assert.deepEqual(
    offenders,
    [],
    `Bounded vertical <ScrollView> (maxHeight) without nestedScrollEnabled. On Android it will not scroll inside a Modal:\n  ${offenders.join("\n  ")}`
  );
});
