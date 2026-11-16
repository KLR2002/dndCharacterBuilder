// The pure helpers of `npm run android:roll` (scripts/android-roll.mjs): the argument parser, the escaping
// of an expression for `adb shell input text`, the die label and die chip parsers, the comparison of the
// labels with the chips per dice mode, the settle rule of a dump, the lookup of the Roll button and of nodes
// by resource-id, the FATAL count of a logcat dump and the one-line report. Every function takes parsed
// dump nodes (scripts/lib/uiautomator.mjs) or plain values, so the tests in checks/androidRoll.test.ts run
// them without a device.

export const MODES = ["throw", "tumble", "off"];

// The finger of a swipe on the Options screen stays this far from every edge of the screen.
export const EDGE_CLEAR_PX = 96;
export const OPTIONS_SWIPE_MS = 300;

// `input swipe` args that scroll the Options screen up: from the bottom to the top, mid-width, EDGE_CLEAR_PX
// clear of every edge.
export function optionsSwipeArgs(view) {
  const x = Math.round(view.width / 2);
  return [x, view.height - EDGE_CLEAR_PX, x, EDGE_CLEAR_PX, OPTIONS_SWIPE_MS];
}

// How many die labels a batch shows: Throw labels its first 20 dice, Tumble its first 10. Chips are not capped.
export const LABEL_CAPS = { throw: 20, tumble: 10 };

const LABEL_PREFIX = { throw: "throw-die-", tumble: "die-solid-" };

export function usage() {
  return [
    "usage: npm run android:roll -- [--mode throw|tumble|off] [--shots <dir>] [--record] <expression>...",
    "",
    "Rolls each expression on the running emulator through the dice tray and checks that the die labels",
    "match the result chips. Needs exactly one emulator with the app installed. Without --mode the",
    "current Dice animation setting is kept.",
    "",
    "  --mode throw|tumble|off  set the Dice animation first (through the Options screen)",
    "  --shots <dir>            where the screenshots go (default: a fresh folder under the temp dir)",
    "  --record                 also record each Roll with screenrecord (about 12 s) and pull the mp4",
    "  --help                   print this text",
    "",
    "Exit: 0 every expression passes, 1 a label differs from its chip, a FATAL appears or a wait times out,",
    "2 a refusal or a bad argument.",
  ].join("\n");
}

// The command line: flags first, then one or more expressions. Always returns one shape; `ok` is false
// with `error` set when the command line is refused.
/**
 * @param {string[]} argv
 * @returns {{ok: boolean, error: string | null, help: boolean, mode: string | null, shots: string | null, record: boolean, expressions: string[]}}
 */
export function parseRollArgs(argv) {
  /** @type {{ok: boolean, error: string | null, help: boolean, mode: string | null, shots: string | null, record: boolean, expressions: string[]}} */
  const parsed = { ok: true, error: null, help: false, mode: null, shots: null, record: false, expressions: [] };
  const refuse = (error) => ({ ...parsed, ok: false, error });
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--record") {
      parsed.record = true;
    } else if (arg === "--mode" || arg === "--shots") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return refuse(`${arg} needs a value`);
      i += 1;
      if (arg === "--shots") {
        parsed.shots = value;
      } else if (MODES.includes(value)) {
        parsed.mode = value;
      } else {
        return refuse(`--mode must be one of ${MODES.join(", ")}, not "${value}"`);
      }
    } else if (arg.startsWith("--")) {
      return refuse(`unknown option ${arg}`);
    } else {
      if (arg.trim() === "") return refuse("an expression is blank");
      parsed.expressions.push(arg);
    }
  }
  if (parsed.help) return parsed;
  if (parsed.expressions.length === 0) return refuse("no expression given");
  return parsed;
}

// The text `adb shell input text` gets for an expression. The device shell reads the adb arguments as a
// command line, so every character outside letters, digits and + - . _ is backslash-escaped (`(` and `)`
// failed unescaped, a comma needs it too), and a space is %s, the form `input text` reads as a space.
export function inputTextArg(expression) {
  let out = "";
  for (const ch of expression) {
    if (ch === " ") out += "%s";
    else if (/[A-Za-z0-9+\-._]/.test(ch)) out += ch;
    else out += `\\${ch}`;
  }
  return out;
}

// A die label ("d20 showing 14", "d20 showing 3, dropped"; src/components/dice/dieLabel.ts) as its parts.
export function parseLabel(desc) {
  const match = /^d(\d+) showing (\d+)(, dropped)?$/.exec(desc ?? "");
  if (!match) return null;
  return { sides: Number(match[1]), face: Number(match[2]), dropped: match[3] !== undefined };
}

// A chip's text ("14d20", or "−4d6" for a subtracted die) as its parts.
export function parseChip(text) {
  const match = /^([−-]?)(\d+)d(\d+)$/.exec(text ?? "");
  if (!match) return null;
  return { sides: Number(match[3]), face: Number(match[2]), subtracted: match[1] !== "" };
}

// The resource-id of a node matches `id`, with or without the package prefix ("pkg:id/dice-button").
export function idIs(node, id) {
  const resourceId = node.resourceId ?? "";
  return resourceId === id || resourceId.endsWith(`:id/${id}`) || resourceId.endsWith(`/${id}`);
}

export function findNodeById(nodes, id) {
  return nodes.find((node) => idIs(node, id)) ?? null;
}

// The die labels of a dump: those of the Throw layer or of the Tumble bodies, whichever the dump holds,
// in index order. `kind` is "throw", "tumble" or null when the dump has no labels at all (Off).
export function dieLabels(nodes) {
  for (const kind of ["throw", "tumble"]) {
    const prefix = LABEL_PREFIX[kind];
    const found = [];
    for (const node of nodes) {
      const match = new RegExp(`^(?:.*:id/)?${prefix}(\\d+)$`).exec(node.resourceId ?? "");
      if (match) found.push({ index: Number(match[1]), desc: node.contentDesc });
    }
    if (found.length > 0) {
      found.sort((a, b) => a.index - b.index);
      return { kind, labels: found };
    }
  }
  return { kind: null, labels: [] };
}

// The chips inside result-card, in dump order: each chip's text is its Text children joined ("14" + "d20").
export function chipsOf(nodes) {
  const card = findNodeById(nodes, "result-card");
  if (!card) return [];
  const inCard = (node) => {
    for (let p = node.parent; p; p = p.parent) if (p === card) return true;
    return false;
  };
  return nodes
    .filter((node) => idIs(node, "die-chip") && inCard(node))
    .map((chip) => {
      const texts = nodes.filter((node) => {
        if (node === chip || !node.text) return false;
        for (let p = node.parent; p; p = p.parent) if (p === chip) return true;
        return false;
      });
      return { text: texts.map((node) => node.text).join("") };
    });
}

// Compares the label n with the chip n for every label the mode shows. The mode is "throw", "tumble" or
// "off"; in Off there must be no labels. In Throw and Tumble the label count must be the chip count capped
// at the mode's cap. A dropped die's label is compared by its face, which is all its chip shows.
export function compareDice({ mode, labels, chips }) {
  const cap = LABEL_CAPS[mode];
  const expected = cap === undefined ? 0 : Math.min(chips.length, cap);
  /** @type {Array<{index: number, label: string, chip: string | null, reason: string}>} */
  const mismatches = [];
  /** @type {{ok: boolean, error?: string, mode: string, expected: number, labelCount: number, chipCount: number, mismatches: typeof mismatches}} */
  const result = { ok: true, mode, expected, labelCount: labels.length, chipCount: chips.length, mismatches };
  if (mode === "off") {
    if (labels.length > 0) {
      result.ok = false;
      result.mismatches.push({ index: labels[0].index, label: labels[0].desc, chip: null, reason: "labels in Off" });
    }
    return result;
  }
  if (labels.length !== expected) {
    result.ok = false;
    result.error = `${labels.length} labels, expected ${expected}`;
  }
  for (let n = 0; n < Math.max(labels.length, expected); n++) {
    const label = labels[n];
    const chip = chips[n];
    const labelText = label?.desc ?? "(no label)";
    const chipText = chip?.text ?? "(no chip)";
    if (!label || label.index !== n) {
      result.mismatches.push({ index: n, label: labelText, chip: chipText, reason: "missing label" });
      continue;
    }
    const parsedLabel = parseLabel(label.desc);
    const parsedChip = parseChip(chip?.text);
    if (!parsedLabel || !parsedChip) {
      result.mismatches.push({ index: n, label: labelText, chip: chipText, reason: "unreadable" });
      continue;
    }
    if (parsedLabel.sides !== parsedChip.sides || parsedLabel.face !== parsedChip.face) {
      result.mismatches.push({ index: n, label: labelText, chip: chipText, reason: "differs" });
    }
  }
  if (result.mismatches.length > 0) result.ok = false;
  return result;
}

// The mode a run checks: the one given, else the one the dump's labels show, else Off.
export function resolveMode(requested, kind) {
  return requested ?? kind ?? "off";
}

// The settle rule: a dump is settled when result-card exists and its die labels equal those of the dump
// before. Returns the signature of a dump (the labels and the chips), or null while no result-card exists.
export function settleSignature(nodes) {
  if (!findNodeById(nodes, "result-card")) return null;
  const { labels } = dieLabels(nodes);
  return JSON.stringify({ labels, chips: chipsOf(nodes).map((chip) => chip.text) });
}

// The Roll button: a clickable node whose content-desc starts with "Roll " other than the field
// ("Roll Expression"). The button of this expression is preferred when more than one is listed.
export function findRollButton(nodes, expression) {
  const candidates = nodes.filter(
    (node) => node.clickable && node.contentDesc.startsWith("Roll ") && node.contentDesc !== "Roll Expression" && node.bounds,
  );
  if (candidates.length === 0) return null;
  const title = rollTitle(expression);
  return candidates.find((node) => node.contentDesc === `Roll ${title}`) ?? candidates[0];
}

// The button's title for an expression: the trimmed expression, cut to 28 characters and an ellipsis
// (src/components/dice/DiceTray.tsx).
export function rollTitle(expression) {
  const text = expression.trim();
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}

// The number of FATAL EXCEPTION lines in a logcat dump.
export function fatalCount(logcat) {
  return (logcat.match(/FATAL EXCEPTION/g) ?? []).length;
}

// The one-line report of an expression. `result` is compareDice's result, or { ok: false, error } when the
// roll never settled.
export function formatResultLine({ expression, mode, result, fatal, shot }) {
  const head = `${expression} [${mode ?? "current"}]`;
  const tail = `FATAL ${fatal}, shot ${shot ?? "none"}`;
  if (result.labelCount === undefined) return `${head}: ${result.error}, ${tail}`;
  const parts = [`${result.labelCount} labels = ${result.chipCount} chips`];
  if (result.error) parts.push(`(${result.error})`);
  for (const m of result.mismatches) {
    parts.push(`MISMATCH label ${m.index} "${m.label}" vs chip ${m.index} "${m.chip}"${m.reason ? ` (${m.reason})` : ""}`);
  }
  return `${head}: ${parts.join("; ")}, ${tail}`;
}
