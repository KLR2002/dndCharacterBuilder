#!/usr/bin/env node
// Type-check ratchet for checks/ (tsconfig.checks.json).
//
// Runs tsc on the checks configuration and compares its errors with the recorded baseline in
// checks/fixtures/typecheckBaseline.json. An error is identified by file, code and message, not by line,
// so editing other lines of a file does not invalidate its baseline. The check fails on any error beyond
// the baseline and prints each new one with its file and line.
//
// Fixing a baselined error only lowers the count; the baseline is then re-recorded on purpose:
//   UPDATE_TYPECHECK_BASELINE=1 node scripts/typecheck-ratchet.mjs
// The recorder rewrites the whole baseline from the current errors, so it also records new errors when run.
// Never edit the baseline by hand.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = "tsconfig.checks.json";
const BASELINE_PATH = join(ROOT, "checks", "fixtures", "typecheckBaseline.json");
const BASELINE_VERSION = 1;

/**
 * @typedef {{ file: string, line: number, column: number, code: string, message: string, detail: string }} TypeError
 * @typedef {{ file: string, code: string, message: string, count: number }} BaselineEntry
 * @typedef {{ version: number, note: string, errors: BaselineEntry[] }} Baseline
 */

const HEADER = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const FILELESS_HEADER = /^error (TS\d+): (.*)$/;

/**
 * Parses tsc output produced with --pretty false. Indented lines after an error header are its detail.
 * @param {string} text
 * @returns {TypeError[]}
 */
export function parseTscOutput(text) {
  /** @type {TypeError[]} */
  const errors = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const header = HEADER.exec(line);
    if (header) {
      errors.push({
        file: header[1].replace(/\\/g, "/"),
        line: Number(header[2]),
        column: Number(header[3]),
        code: header[4],
        message: header[5],
        detail: "",
      });
      continue;
    }
    const fileless = FILELESS_HEADER.exec(line);
    if (fileless) {
      errors.push({ file: "(no file)", line: 0, column: 0, code: fileless[1], message: fileless[2], detail: "" });
      continue;
    }
    if (/^\s+\S/.test(line) && errors.length > 0) {
      const last = errors[errors.length - 1];
      last.detail = last.detail ? `${last.detail}\n${line}` : line;
    }
  }
  return errors;
}

/** Identity of an error for the baseline: file, code and message. Line and column are not part of it. */
function keyOf({ file, code, message }) {
  return JSON.stringify([file, code, message]);
}

/** @param {{ file: string, line: number, column: number }} a @param {{ file: string, line: number, column: number }} b */
function byLocation(a, b) {
  return a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column;
}

/**
 * Builds the baseline document: one entry per file, code and message, with the number of occurrences.
 * @param {TypeError[]} errors
 * @returns {Baseline}
 */
export function toBaseline(errors) {
  /** @type {Map<string, BaselineEntry>} */
  const counted = new Map();
  for (const { file, code, message } of errors) {
    const key = keyOf({ file, code, message });
    const entry = counted.get(key);
    if (entry) entry.count += 1;
    else counted.set(key, { file, code, message, count: 1 });
  }
  const sorted = [...counted.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message),
  );
  return {
    version: BASELINE_VERSION,
    note: "Recorded by scripts/typecheck-ratchet.mjs with UPDATE_TYPECHECK_BASELINE=1. Do not edit by hand.",
    errors: sorted,
  };
}

/**
 * Compares current errors with the baseline. Within one key, the first `count` occurrences (in line order)
 * are baselined; any later ones are new.
 * @param {TypeError[]} errors
 * @param {Baseline} baseline
 * @returns {{ newErrors: TypeError[], resolved: number }}
 */
export function compareToBaseline(errors, baseline) {
  /** @type {Map<string, number>} */
  const allowed = new Map();
  for (const entry of baseline.errors) {
    const key = keyOf(entry);
    allowed.set(key, (allowed.get(key) ?? 0) + entry.count);
  }

  /** @type {Map<string, TypeError[]>} */
  const groups = new Map();
  for (const error of [...errors].sort(byLocation)) {
    const key = keyOf(error);
    const list = groups.get(key) ?? [];
    list.push(error);
    groups.set(key, list);
  }

  const newErrors = [];
  for (const [key, list] of groups) {
    const quota = allowed.get(key) ?? 0;
    if (list.length > quota) newErrors.push(...list.slice(quota));
  }

  let resolved = 0;
  for (const [key, quota] of allowed) {
    resolved += Math.max(0, quota - (groups.get(key)?.length ?? 0));
  }

  return { newErrors: newErrors.sort(byLocation), resolved };
}

function runTsc() {
  const tscBin = join(ROOT, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(process.execPath, [tscBin, "-p", CONFIG, "--pretty", "false"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}`, error: result.error };
}

function formatError(error) {
  const head = `${error.file}:${error.line}:${error.column} ${error.code}: ${error.message}`;
  return error.detail ? `${head}\n${error.detail}` : head;
}

function main() {
  const recording = Boolean(process.env.UPDATE_TYPECHECK_BASELINE);
  const { status, output, error } = runTsc();
  const errors = parseTscOutput(output);

  if (error || (status !== 0 && errors.length === 0)) {
    console.error(`typecheck-ratchet: tsc did not produce a parsable result (exit ${status}).`);
    console.error(output || error?.message || "");
    process.exit(1);
  }

  if (recording) {
    const baseline = toBaseline(errors);
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(
      `typecheck-ratchet: recorded ${errors.length} error(s) in ${baseline.errors.length} baseline entries to ${relative(ROOT, BASELINE_PATH)}`,
    );
    return 0;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`typecheck-ratchet: no baseline at ${relative(ROOT, BASELINE_PATH)}.`);
    console.error("Record it on purpose with: UPDATE_TYPECHECK_BASELINE=1 node scripts/typecheck-ratchet.mjs");
    return 1;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const { newErrors, resolved } = compareToBaseline(errors, baseline);

  if (newErrors.length > 0) {
    console.error(`typecheck-ratchet: ${newErrors.length} new type error(s) in checks/, not in the baseline:`);
    for (const error of newErrors) console.error(`  ${formatError(error)}`);
    console.error("Fix them. If a new error is intended, record it on purpose with:");
    console.error("  UPDATE_TYPECHECK_BASELINE=1 node scripts/typecheck-ratchet.mjs");
    return 1;
  }

  console.log(`typecheck-ratchet: ${errors.length} known error(s) in the baseline, none new.`);
  if (resolved > 0) {
    console.log(
      `typecheck-ratchet: ${resolved} baselined error(s) no longer occur; re-record to drop them (UPDATE_TYPECHECK_BASELINE=1).`,
    );
  }
  return 0;
}

const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.exitCode = main();
