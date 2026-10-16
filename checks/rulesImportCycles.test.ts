import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The Character Reconciler, the builder transitions and the choice modules must not form an
// import cycle. Module loading order depends on the graph being acyclic. This is a static scan
// of relative imports under src/rules, the same approach as rulesSingletonGuard.test.ts.

const RULES_DIR = fileURLToPath(new URL("../src/rules/", import.meta.url));

function ruleFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return ruleFiles(path);
    return entry.endsWith(".ts") ? [path] : [];
  });
}

function relativeImportsOf(source: string): string[] {
  const specifiers: string[] = [];
  const staticImport = /(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g;
  const sideEffectImport = /import\s*["']([^"']+)["']/g;
  const dynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [staticImport, sideEffectImport, dynamicImport]) {
    for (const m of source.matchAll(re)) {
      if (m[1].startsWith(".")) specifiers.push(m[1]);
    }
  }
  return specifiers;
}

/** Every cycle found by a depth-first walk, each listed as the path from a node back to itself. */
function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const stack: string[] = [];
  const onStack = new Set<string>();
  const done = new Set<string>();

  const visit = (node: string): void => {
    if (onStack.has(node)) {
      cycles.push([...stack.slice(stack.indexOf(node)), node]);
      return;
    }
    if (done.has(node)) return;
    onStack.add(node);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) visit(dep);
    stack.pop();
    onStack.delete(node);
    done.add(node);
  };

  for (const node of graph.keys()) visit(node);
  return cycles;
}

function rulesImportGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of ruleFiles(RULES_DIR)) {
    const deps = relativeImportsOf(readFileSync(file, "utf8")).map((spec) => resolve(dirname(file), spec));
    graph.set(resolve(file), deps);
  }
  return graph;
}

test("detector: reports a planted cycle and reports nothing for an acyclic graph", () => {
  const planted = new Map([
    ["a.ts", ["b.ts"]],
    ["b.ts", ["c.ts"]],
    ["c.ts", ["a.ts"]],
    ["d.ts", ["a.ts"]],
  ]);
  assert.deepEqual(findCycles(planted), [["a.ts", "b.ts", "c.ts", "a.ts"]]);

  const acyclic = new Map([
    ["reconciler.ts", ["choices.ts"]],
    ["transitions.ts", ["reconciler.ts"]],
    ["choices.ts", []],
  ]);
  assert.deepEqual(findCycles(acyclic), []);
});

test("import graph: the Character Reconciler, transitions and choice modules form no cycle", () => {
  const graph = rulesImportGraph();
  assert.ok(graph.size > 0, "the guard must find rules modules to check");

  const cycles = findCycles(graph).map((cycle) => cycle.map((file) => relative(RULES_DIR, file)).join(" -> "));
  assert.deepEqual(cycles, [], "the rules import graph must be acyclic");
});
