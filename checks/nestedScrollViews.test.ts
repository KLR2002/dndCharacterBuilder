import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// On Android a vertical ScrollView nested inside another vertical ScrollView (such as the shared
// Modal body) only scrolls when the inner one sets nestedScrollEnabled. A ScrollView with maxHeight
// is a bounded list that always sits inside a Modal or a page scroller, so it must set the prop.
// Horizontal rows are not nested vertically and are exempt. The maxHeight can be written inline or come from
// a style object in the same file (a StyleSheet.create entry, a const object, or an array of them).
// This is a static scan of src/**/*.tsx.

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

// The text inside the bracket that opens at `open` in `text` ("{", "[" or "("), without the brackets.
function balancedInner(text: string, open: number): string {
  let depth = 0;
  let quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error(`Unclosed bracket at offset ${open}`);
}

// The parts of `text` split on `separator` where the separator is at bracket depth 0 (outside quotes).
function topLevelParts(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

// The expression of the tag's own style prop (`style={...}`), or null when the tag has none. Only depth-0
// props count, so a style prop on a child element inside a render prop is not read.
function styleExpression(tagText: string): string | null {
  let depth = 0;
  let quote = "";
  for (let i = 0; i < tagText.length; i++) {
    const ch = tagText[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0 && /\s/.test(ch) && tagText.startsWith("style={", i + 1)) {
      return balancedInner(tagText, i + 1 + "style=".length);
    }
  }
  return null;
}

// The source text of the initializer of `const|let|var name = ...` in `source`, up to the end of its
// statement (a `;` or a line break outside brackets), or null when the file does not declare it.
function declaredValue(source: string, name: string): string | null {
  const declaration = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(source);
  if (!declaration) return null;
  const start = declaration.index + declaration[0].length;
  let depth = 0;
  let quote = "";
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (depth === 0 && (ch === ";" || ch === "\n")) return source.slice(start, i).trim();
  }
  return source.slice(start).trim();
}

// The value of each `key: value` entry of an object literal's inner text. A shorthand entry maps to itself.
function objectEntries(inner: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const part of topLevelParts(inner, ",")) {
    const text = part.trim();
    if (!text || text.startsWith("...")) continue;
    const colon = text.indexOf(":");
    if (colon === -1) entries.set(text, text);
    else entries.set(text.slice(0, colon).trim(), text.slice(colon + 1).trim());
  }
  return entries;
}

// Whether a style expression sets maxHeight. Resolves object literals, arrays, `obj.key` (a StyleSheet.create
// entry or a const object's key) and a same-file const, recursively. Anything else (a prop, a call, a ternary,
// an import) resolves to "not bounded": only the cases the scan can read are reported.
function isBoundedStyle(expression: string, source: string, seen = new Set<string>()): boolean {
  const text = expression.trim();
  if (!text || seen.has(text)) return false;
  seen.add(text);
  if (text.startsWith("{")) return /\bmaxHeight\s*:/.test(text);
  if (text.startsWith("[")) {
    return topLevelParts(balancedInner(text, 0), ",").some((part) => isBoundedStyle(part, source, seen));
  }
  const member = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(text);
  if (member) {
    const value = declaredValue(source, member[1]);
    if (!value) return false;
    const object = /^StyleSheet\.create\(/.test(value) ? balancedInner(value, value.indexOf("(")) : value;
    if (!object.startsWith("{")) return false;
    const entry = objectEntries(balancedInner(object, 0)).get(member[2]);
    return entry !== undefined && isBoundedStyle(entry, source, seen);
  }
  if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    const value = declaredValue(source, text);
    return value !== null && isBoundedStyle(value, source, seen);
  }
  return false;
}

// Returns the line of every bounded, vertical <ScrollView> in `source` that lacks nestedScrollEnabled. A
// bound is a maxHeight in the tag's style prop, written inline or resolved from a style object in the file.
function offendingLines(source: string): number[] {
  const lines: number[] = [];
  for (const tag of scrollViewTags(source)) {
    const isHorizontal = /\bhorizontal\b/.test(tag.top);
    const style = styleExpression(tag.full);
    const isBounded = style !== null && isBoundedStyle(style, source);
    const hasNestedScroll = /\bnestedScrollEnabled\b/.test(tag.top);
    if (!isHorizontal && isBounded && !hasNestedScroll) lines.push(tag.line);
  }
  return lines;
}

test("bounded vertical ScrollViews set nestedScrollEnabled (Android nested scroll)", () => {
  const files = tsxFiles(SRC_DIR);
  let tagCount = 0;
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    tagCount += scrollViewTags(source).length;
    for (const line of offendingLines(source)) {
      offenders.push(`${relative(REPO_ROOT, file)}:${line}`);
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

// Synthetic component source: an invented drawer that nests a bounded list inside a page scroller. Each
// case puts the bound in a different place so the scan is tested on every shape it must resolve.
function drawerSource(opening: string, styleDefinitions = ""): string {
  return [
    'import { ScrollView, StyleSheet, View } from "react-native";',
    "",
    styleDefinitions,
    "export function LanternDrawer() {",
    "  return (",
    "    <View>",
    `      ${opening}`,
    "        <View />",
    "      </ScrollView>",
    "    </View>",
    "  );",
    "}",
  ].join("\n");
}

const LIST_STYLES = `const styles = StyleSheet.create({
  list: { maxHeight: 240 },
  fill: { flex: 1 },
});`;

// The line of the drawer's <ScrollView> tag, which is where the scan reports it.
function drawerLine(source: string): number {
  return source.split("\n").findIndex((text) => text.includes("<ScrollView")) + 1;
}

test("a bounded ScrollView with its height in a style object is an offender (synthetic component)", () => {
  const cases = [
    // Control: the inline form is already caught.
    drawerSource("<ScrollView style={{ maxHeight: 240 }}>"),
    // A StyleSheet.create entry, the common case.
    drawerSource("<ScrollView style={styles.list}>", LIST_STYLES),
    // A const object declared in the same file and passed by name.
    drawerSource("<ScrollView style={panel}>", "const panel = { maxHeight: 240, padding: 4 };"),
    // A bounded entry inside an array, beside an unbounded entry.
    drawerSource("<ScrollView style={[styles.fill, styles.list]}>", LIST_STYLES),
    // A const object inside an array, beside an inline literal.
    drawerSource("<ScrollView style={[{ flex: 1 }, panel]}>", "const panel = { maxHeight: 240 };"),
  ];
  for (const source of cases) {
    assert.deepEqual(offendingLines(source), [drawerLine(source)], source);
  }
});

test("style-object bounds that are nested or unbounded are not reported (synthetic component)", () => {
  const cases = [
    // Bounded, and nestedScrollEnabled is set on the tag.
    drawerSource("<ScrollView nestedScrollEnabled style={styles.list}>", LIST_STYLES),
    // No bound in the resolved style: a fill height is not a scroll bound.
    drawerSource("<ScrollView style={styles.fill}>", LIST_STYLES),
    // Horizontal rows are not nested vertically.
    drawerSource("<ScrollView horizontal style={styles.list}>", LIST_STYLES),
    // A reference the scan cannot resolve (not declared in the file) is not reported.
    drawerSource("<ScrollView style={theme.panel}>"),
  ];
  for (const source of cases) {
    assert.deepEqual(offendingLines(source), [], source);
  }
});
