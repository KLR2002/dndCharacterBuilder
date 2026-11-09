import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Every modal in the app renders through the shared shell src/components/ui/Modal.tsx, which owns the close
// paths (backdrop tap and Escape, asking first when closing would discard unsaved work) and the phone
// bottom-sheet shape with swipe-down close. That shell is therefore the only place that may import React
// Native's Modal. This guard scans src/ and fails on any other file that imports `Modal` from
// "react-native", named or aliased (`Modal as RNModal`), in an import or a re-export, comments excluded.
// Importing the shell's own Modal from "../ui/Modal" (or a deeper relative path) is the sanctioned way and passes.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const SHELL_FILE = "components/ui/Modal.tsx";

interface Finding {
  file: string;
  local: string;
  line: number;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = dir + sep + entry;
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** The source without comments, so that a doc comment naming a react-native Modal import is not an import. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
}

/** The line number (1-based) of a match index in the source. */
function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/**
 * Every import or re-export of React Native's `Modal` in one file's code, as the local name it is bound to.
 * `file` is relative to src/. Matches named imports, including multi-line ones and `Modal as RNModal`, from
 * "react-native" or 'react-native'; a default or namespace import of react-native binds no `Modal` name.
 */
function findingsIn(file: string, source: string): Finding[] {
  const code = codeOnly(source);
  const findings: Finding[] = [];
  for (const m of code.matchAll(/\b(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']react-native["']/g)) {
    for (const part of m[1].split(",")) {
      const trimmed = part.trim().replace(/^type\s+/, "");
      const imported = trimmed.split(/\s+as\s+/)[0].trim();
      if (imported !== "Modal") continue;
      const local = trimmed.split(/\s+as\s+/).pop()?.trim() ?? "Modal";
      findings.push({ file, local, line: lineOf(code, m.index ?? 0) });
    }
  }
  return findings;
}

function format(finding: Finding): string {
  return `${finding.file}:${finding.line} imports React Native's Modal as ${finding.local}; only ${SHELL_FILE} may import it, every other modal goes through the shared shell`;
}

/** The findings in every source file under src/, the shell excepted. */
function treeFindings(): Finding[] {
  return sourceFiles(SRC).flatMap((path) => {
    const file = relative(SRC, path).split(sep).join("/");
    if (file === SHELL_FILE) return [];
    return findingsIn(file, readFileSync(path, "utf8"));
  });
}

test("guard, synthetic: importing react-native's Modal, aliased or not, fails and is named by file and local name", () => {
  const direct = 'import { Modal } from "react-native";\n';
  const aliased = 'import {\n  Pressable,\n  Modal as RNModal,\n} from "react-native";\n';
  for (const [source, local] of [[direct, "Modal"], [aliased, "RNModal"]] as const) {
    const violations = findingsIn("components/Synthetic.tsx", source);
    assert.deepEqual(violations.map((v) => [v.file, v.local]), [["components/Synthetic.tsx", local]], source);
  }
  assert.equal(
    format(findingsIn("components/Synthetic.tsx", aliased)[0]),
    "components/Synthetic.tsx:1 imports React Native's Modal as RNModal; only components/ui/Modal.tsx may import it, every other modal goes through the shared shell",
  );
});

test("guard, synthetic: a re-export of react-native's Modal fails, and other react-native imports pass", () => {
  const reexported = 'export { Modal } from "react-native";\n';
  assert.deepEqual(findingsIn("components/Synthetic.tsx", reexported).map((v) => v.local), ["Modal"]);
  const harmless = 'import { View, Text, Pressable } from "react-native";\nimport { Modal } from "../ui/Modal";\n';
  assert.deepEqual(findingsIn("components/Synthetic.tsx", harmless), []);
});

test("guard, synthetic: a react-native Modal import in a comment is not an import, and the shell itself is exempt", () => {
  const commented = '// import { Modal } from "react-native";\n/* import { Modal as RNModal } from "react-native"; */\n';
  assert.deepEqual(findingsIn("components/Synthetic.tsx", commented), []);
  const shellSource = 'import {\n  Modal as RNModal,\n  View,\n} from "react-native";\n';
  assert.equal(findingsIn(SHELL_FILE, shellSource).length, 1, "the shell's own import is found, and treeFindings excludes the file");
  assert.deepEqual(treeFindings().filter((f) => f.file === SHELL_FILE), []);
});

test("only the shared modal shell imports React Native's Modal under src/", () => {
  const violations = treeFindings();
  assert.equal(
    violations.length,
    0,
    `React Native's Modal is imported outside the shared shell:\n${violations.map(format).join("\n")}`,
  );
});
