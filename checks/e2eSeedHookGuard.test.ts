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

/** A module path without its extension: `.ts`, `.tsx`, `.js` and `.mjs` all name the same module. */
function stripExtension(path: string): string {
  return path.replace(/\.(ts|tsx|js|mjs)$/, "");
}

/** A relative module specifier written in `file`, as a path relative to src/, extension stripped. */
function moduleOf(file: string, spec: string): string {
  return stripExtension(relative(SRC, resolve(SRC, dirname(file), spec)).split(sep).join("/"));
}

/** The relative specifiers imported in one file's code: static, side-effect, dynamic, require and re-exports. */
function relativeImportsOf(file: string, source: string): string[] {
  const code = codeOnly(source);
  const specifiers: string[] = [];
  const staticImport = /(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g;
  const sideEffectImport = /import\s*["']([^"']+)["']/g;
  const dynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;
  const requireCall = /require\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [staticImport, sideEffectImport, dynamicImport, requireCall]) {
    for (const m of code.matchAll(re)) {
      if (m[1].startsWith(".")) specifiers.push(m[1]);
    }
  }
  return specifiers;
}

/** Whether `file` imports the seed importer module, given its source. `file` is relative to src/. */
function importsImporter(file: string, source: string): boolean {
  return relativeImportsOf(file, source).some((spec) => moduleOf(join(SRC, file), spec) === stripExtension(IMPORTER_MODULE));
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

test("the flag check returns before the entry first references the importer", () => {
  const code = codeOnly(readFileSync(join(SRC, FLAGGED_ENTRY), "utf8"));
  const flagCheck = /process\.env\.EXPO_PUBLIC_E2E\s*!==\s*"1"\)\s*return/.exec(code);
  assert.ok(flagCheck, `${FLAGGED_ENTRY} must return early when EXPO_PUBLIC_E2E is not "1"`);
  const importerRef = code.indexOf("e2eSeedImport");
  assert.ok(importerRef === -1 || importerRef > flagCheck.index,
    "the flag check must come before the first reference to the importer, so an unconditional import fails");
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

test("guard, synthetic: extensionless, require and re-export forms are caught like the .ts form", () => {
  const sources = [
    'import { importE2eSeed } from "../services/e2eSeedImport";\n',
    'export async function go() { return import("../services/e2eSeedImport"); }\n',
    'const { importE2eSeed } = require("../services/e2eSeedImport");\n',
    'export * from "../services/e2eSeedImport";\n',
    'export { importE2eSeed } from "../services/e2eSeedImport";\n',
    'import {\n  importE2eSeed,\n} from "../services/e2eSeedImport";\n',
    'import { importE2eSeed } from "../services/e2eSeedImport.js";\n',
  ];
  for (const source of sources) {
    assert.equal(importsImporter("components/Synthetic.tsx", source), true, source);
  }
  assert.equal(
    importsImporter("services/Synthetic.ts", 'import { loadAll } from "./storage";\n// require("./e2eSeedImport") in a comment\n'),
    false,
  );
});
