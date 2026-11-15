import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The local Expo modules ship as source. F-Droid builds from source and refuses prebuilt binaries, so a
// compiled library or an image under modules/ would break a release. Build output is gitignored and skipped.

const MODULES = fileURLToPath(new URL("../modules/", import.meta.url));
const TEXT_EXTENSIONS = new Set([".kt", ".kts", ".gradle", ".json", ".md", ".ts", ".tsx", ".properties", ".xml", ".txt"]);
const SKIPPED_DIRECTORIES = new Set(["build", ".cxx"]);

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : filesUnder(path);
    return [path];
  });
}

test("every file under modules/ is a text file of a source type", () => {
  assert.ok(existsSync(MODULES), "modules/ exists");
  const files = filesUnder(MODULES);
  assert.ok(files.length > 0, "modules/ holds files");
  const offenders = files.flatMap((path) => {
    const name = relative(MODULES, path);
    if (!TEXT_EXTENSIONS.has(extname(path))) return [`${name}: extension is not a text type`];
    if (readFileSync(path).includes(0)) return [`${name}: contains a NUL byte`];
    return [];
  });
  assert.deepEqual(offenders, [], "modules/ holds only source and text files");
});
