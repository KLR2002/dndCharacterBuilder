// The pure helpers of `npm run android:roll` (scripts/android-roll.mjs): the argument parser, the escaping
// of an expression for `adb shell input text`, the die label and die chip parsers, the comparison of the
// labels with the chips per dice mode, the settle rule of a dump, the lookup of the Roll button and of nodes
// by resource-id, the FATAL count of a logcat dump and the one-line report. Every function takes parsed
// dump nodes (scripts/lib/uiautomator.mjs) or plain values, so the tests in checks/androidRoll.test.ts run
// them without a device.

import { hasPositiveArea, visibleBounds } from "./uiautomator.mjs";

export const MODES = ["throw", "tumble", "off"];

// The finger of a swipe on the Options screen stays this far from every edge of the screen.
export const EDGE_CLEAR_PX = 96;
export const SCROLL_PAD_PX = 8;
export const OPTIONS_SWIPE_MS = 300;

// `input swipe` args that scroll the Options list: mid-width, up (the finger moves up, the content moves up)
// or down, over `distance` px of finger travel (the whole list span when omitted). The finger stays
// EDGE_CLEAR_PX clear of every screen edge and SCROLL_PAD_PX inside the scroller, so a swipe that starts on
// the title above the list does not scroll it.
/**
 * @param {{width: number, height: number, topBar?: number, bottomBar?: number}} view
 * @param {string} [direction]
 * @param {{bounds: {x1: number, y1: number, x2: number, y2: number} | null} | null} [scroller]
 * @param {number | null} [distance]
 * @returns {number[]}
 */
export function optionsSwipeArgs(view, direction = "up", scroller = null, distance = null) {
  const x = Math.round(view.width / 2);
  let near = EDGE_CLEAR_PX;
  let far = view.height - EDGE_CLEAR_PX;
  if (scroller?.bounds) {
    near = Math.max(near, scroller.bounds.y1 + SCROLL_PAD_PX);
    far = Math.min(far, scroller.bounds.y2 - SCROLL_PAD_PX);
  }
  const travel = Math.min(distance ?? far - near, far - near);
  return direction === "down"
    ? [x, near, x, near + travel, OPTIONS_SWIPE_MS]
    : [x, far, x, far - travel, OPTIONS_SWIPE_MS];
}

// The scrollable node of a dump with a positive area: the Options list.
export function scrollerOf(nodes) {
  return nodes.find((node) => node.scrollable && hasPositiveArea(node.bounds)) ?? null;
}

// The scroll that brings a node into the scroller, as { direction, distance }. A node clipped above the
// scroller's top edge (its bottom at or above that edge) needs the content to move down by the gap plus
// REVEAL_MARGIN_PX; one clipped below needs the content to move up by its gap. A node not listed at all is
// searched for in REVEAL_STEP_PX steps up: shorter than the list, so a step never jumps over a row.
// uiautomator lists a scrolled-out node with inverted bounds, so the gap is read from the box edges.
export const REVEAL_STEP_PX = 400;
export const REVEAL_MARGIN_PX = 120;

/**
 * @param {{bounds: {x1: number, y1: number, x2: number, y2: number} | null} | null} node
 * @param {{bounds: {x1: number, y1: number, x2: number, y2: number} | null} | null} scroller
 * @returns {{direction: string, distance: number}}
 */
export function revealSwipe(node, scroller) {
  if (!node?.bounds || !scroller?.bounds) return { direction: "up", distance: REVEAL_STEP_PX };
  if (node.bounds.y2 <= scroller.bounds.y1) {
    return { direction: "down", distance: scroller.bounds.y1 - node.bounds.y2 + REVEAL_MARGIN_PX };
  }
  if (node.bounds.y1 >= scroller.bounds.y2) {
    return { direction: "up", distance: node.bounds.y1 - scroller.bounds.y2 + REVEAL_MARGIN_PX };
  }
  return { direction: "up", distance: REVEAL_STEP_PX };
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

// The chips inside result-card, in dump order. A chip is a View with no listed children: its face and sides are
// Text nodes listed after it whose centres lie inside its bounds, so the chip's text is those nodes joined in
// dump order ("14" + "d20", or "−14" + "d20" for a subtracted die).
export function chipsOf(nodes) {
  const card = findNodeById(nodes, "result-card");
  if (!card) return [];
  const inCard = (node) => {
    for (let p = node.parent; p; p = p.parent) if (p === card) return true;
    return false;
  };
  const within = (node, box) => {
    if (!node.bounds) return false;
    const cx = (node.bounds.x1 + node.bounds.x2) / 2;
    const cy = (node.bounds.y1 + node.bounds.y2) / 2;
    return cx >= box.x1 && cx <= box.x2 && cy >= box.y1 && cy <= box.y2;
  };
  return nodes.flatMap((chip, index) => {
    if (!idIs(chip, "die-chip") || !inCard(chip) || !chip.bounds) return [];
    // The Text nodes that follow the chip in the dump, while their centres lie inside it. Text drawn underneath
    // the card (the Home list, say) is listed earlier and is not part of the chip.
    let text = "";
    for (let j = index + 1; j < nodes.length && within(nodes[j], chip.bounds); j++) text += nodes[j].text ?? "";
    return [{ text }];
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

// The point a tap on `node` lands on, in drawing order: the dump lists views bottom to top, so only a clickable
// node listed after `node` covers it, and only when it is not inside `node`. Returns the centre of the visible
// part when uncovered, else the nearest uncovered point of a 5x5 grid over it, else null.
export function uncoveredTapPoint(node, view, nodes) {
  const box = visibleBounds(node, view);
  const index = nodes.indexOf(node);
  if (!box || index < 0) return null;
  const inside = (b, p) => p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2;
  const isWithin = (n) => {
    for (let p = n.parent; p; p = p.parent) if (p === node) return true;
    return false;
  };
  const covers = (p) =>
    nodes.some((n, j) => j > index && n.clickable && hasPositiveArea(n.bounds) && !isWithin(n) && inside(n.bounds, p));
  const centre = { x: Math.round((box.x1 + box.x2) / 2), y: Math.round((box.y1 + box.y2) / 2) };
  if (!covers(centre)) return centre;
  const grid = [];
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      grid.push({ x: Math.round(box.x1 + ((box.x2 - box.x1) * i) / 4), y: Math.round(box.y1 + ((box.y2 - box.y1) * j) / 4) });
    }
  }
  grid.sort((p, q) => (p.x - centre.x) ** 2 + (p.y - centre.y) ** 2 - ((q.x - centre.x) ** 2 + (q.y - centre.y) ** 2));
  return grid.find((p) => !covers(p)) ?? null;
}

// The Roll button: a clickable node whose content-desc starts with "Roll " other than the field
// ("Roll Expression"). The button of this expression is preferred when more than one is listed.
// The button's accessible name is an icon glyph, a comma and "Roll <title>" on the device, so the label is the
// part from "Roll " on; the field is "Roll Expression" and is not a button. A disabled button (an expression the
// tray refuses) is still listed.
export function findRollButton(nodes, expression) {
  const label = (node) => {
    const at = node.contentDesc.indexOf("Roll ");
    return at < 0 ? "" : node.contentDesc.slice(at);
  };
  const candidates = nodes.filter((node) => label(node).startsWith("Roll ") && label(node) !== "Roll Expression" && node.bounds);
  if (candidates.length === 0) return null;
  const title = rollTitle(expression);
  return candidates.find((node) => label(node) === `Roll ${title}`) ?? candidates[0];
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
