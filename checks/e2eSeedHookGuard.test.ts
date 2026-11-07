import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The seed importer must stay reachable from one flagged entry only, so a bundle built without the E2E
// flag carries no seed-reading code. This guard scans src/ for imports (static, side-effect, dynamic and
// re-exports) of the importer module: exactly one file may import it, the entry guarded by the
// EXPO_PUBLIC_E2E flag check, and any other importer is named. The same scan shape as
// rulesSingletonGuard.test.ts.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const IMPORTER_MODULE = "services/e2eSeedImport.ts";
const FLAGGED_ENTRY = "services/e2eSeedHook.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** The source without comments, so a comment naming the module is not an import. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
}

/** A relative module specifier written in `file`, as a path relative to src/. */
function moduleOf(file: string, spec: string): string {
  return relative(SRC, resolve(SRC, dirname(file), spec)).split(sep).join("/");
}

/** The relative specifiers imported in one file's code: static, side-effect, dynamic and re-exports. */
function relativeImportsOf(file: string, source: string): string[] {
  const code = codeOnly(source);
  const specifiers: string[] = [];
  const staticImport = /(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g;
  const sideEffectImport = /import\s*["']([^"']+)["']/g;
  const dynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [staticImport, sideEffectImport, dynamicImport]) {
    for (const m of code.matchAll(re)) {
      if (m[1].startsWith(".")) specifiers.push(m[1]);
    }
  }
  return specifiers;
}

/** Whether `file` imports the seed importer module, given its source. `file` is relative to src/. */
function importsImporter(file: string, source: string): boolean {
  return relativeImportsOf(file, source).some((spec) => moduleOf(join(SRC, file), spec) === IMPORTER_MODULE);
}

/** Every file under src/ that imports the seed importer, as paths relative to src/. */
function treeImporters(): string[] {
  return sourceFiles(SRC)
    .map((path) => ({ file: relative(SRC, path).split(sep).join("/"), source: readFileSync(path, "utf8") }))
    .filter(({ file, source }) => importsImporter(file, source))
    .map(({ file }) => file);
}

test("only the flagged entry imports the seed importer module", () => {
  const importers = treeImporters();
  assert.deepEqual(
    importers,
    [FLAGGED_ENTRY],
    `the seed importer must be imported by ${FLAGGED_ENTRY} only; found: ${importers.join(", ") || "(none)"}`,
  );
});

test("the one allowed entry is guarded by the EXPO_PUBLIC_E2E flag check", () => {
  const source = readFileSync(join(SRC, FLAGGED_ENTRY), "utf8");
  assert.match(
    codeOnly(source),
    /process\.env\.EXPO_PUBLIC_E2E/,
    `${FLAGGED_ENTRY} must read the EXPO_PUBLIC_E2E flag, so the import is statically dead without it`,
  );
});

test("guard, synthetic: any other module importing the importer is named, statically or dynamically", () => {
  const staticImport = 'import { importE2eSeed } from "../services/e2eSeedImport.ts";\nexport const go = importE2eSeed;\n';
  const dynamicImport = 'export async function go() { return import("../services/e2eSeedImport.ts"); }\n';
  const reexport = 'export { importE2eSeed } from "../services/e2eSeedImport.ts";\n';
  const sideEffect = 'import "../services/e2eSeedImport.ts";\n';
  for (const source of [staticImport, dynamicImport, reexport, sideEffect]) {
    assert.equal(importsImporter("components/Synthetic.tsx", source), true, source);
  }
  assert.equal(
    importsImporter("services/Synthetic.ts", 'import { loadAll } from "./storage.ts";\n// import("./e2eSeedImport.ts") in a comment\n'),
    false,
  );
  assert.equal(importsImporter("services/Synthetic.ts", 'const s = "../services/e2eSeedImport.ts";\n'), false);
});
