import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// The scraper writes only its own data dir. Copying output into the app's src/data would replace the SRD Baseline
// with non-SRD content, so the one way into src/data is scripts/prune-to-srd.mjs.
const here = path.dirname(fileURLToPath(import.meta.url));
const indexSource = fs.readFileSync(path.resolve(here, "../src/index.ts"), "utf8");

test("scraper entry point never names src/data", () => {
  const lines = indexSource
    .split("\n")
    .map((line, i) => ({ line, number: i + 1 }))
    .filter(({ line }) => /src\/data/.test(line));
  assert.deepEqual(
    lines.map(({ number, line }) => `${number}: ${line.trim()}`),
    [],
    "src/index.ts must not write into src/data; the SRD Baseline is written only by node scripts/prune-to-srd.mjs"
  );
});
