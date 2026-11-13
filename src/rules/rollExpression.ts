import { currentRandom, rollDie, type D20Mode, type RandomSource, type Roll, type RolledDie } from "./dice.ts";

export const MAX_ROLLS_PER_EXPRESSION = 10;
export const MAX_DICE_PER_EXPRESSION = 100;
export const MAX_SIDES = 1000;

const ARG_HINT = "a( ) and d( ) take only d20, for example a(d20+5,d20)";

type FnMode = "a" | "d";

interface NumNode {
  type: "num";
  value: number;
}

interface DiceNode {
  type: "dice";
  count: number;
  sides: number;
}

interface SumTerm {
  sign: number;
  node: Node;
}

/** A Roll, or one argument of a function: signed terms added together. */
export interface SumNode {
  type: "sum";
  terms: SumTerm[];
}

interface FnNode {
  type: "fn";
  mode: FnMode;
  /** The number before the function; it repeats the whole Roll. */
  repeatCount: number;
  /** A function with one argument rolls that argument twice, so `args` then holds the same argument twice. */
  implicit: boolean;
  args: SumNode[];
}

type Node = NumNode | DiceNode | SumNode | FnNode;

/** One independent Roll of a parsed expression. */
export type ParsedRoll = SumNode;

export type RollExpressionResult =
  | { ok: true; rolls: ParsedRoll[] }
  | { ok: false; message: string; position: number };

class ExprError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(message);
    this.position = position;
  }
}

/** Parses a Roll Expression. Case and whitespace are ignored. */
export function parseRollExpression(text: string): RollExpressionResult {
  try {
    return { ok: true, rolls: parseOrThrow(text) };
  } catch (error) {
    if (error instanceof ExprError) return { ok: false, message: error.message, position: error.position };
    throw error;
  }
}

function parseOrThrow(text: string): ParsedRoll[] {
  const s = String(text).toLowerCase().replace(/\s+/g, "");
  let p = 0;
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  const readInt = (): number | null => {
    const start = p;
    while (isDigit(s[p])) p += 1;
    return start === p ? null : Number.parseInt(s.slice(start, p), 10);
  };

  if (!s) throw new ExprError("Type a roll, for example 2d6+3", 0);

  function parseRoll(): { ast: ParsedRoll; repeat: number } {
    if (s[p] === "+" || s[p] === "-") throw new ExprError("A roll cannot start with + or -", p);
    if (s[p] === undefined || s[p] === ",") throw new ExprError('A roll is missing before ","', p);
    const terms: SumTerm[] = [];
    let sign = 1;
    let repeat = 1;
    for (;;) {
      const node = parseTerm();
      if (node.type === "fn" && node.repeatCount > 1) {
        if (repeat > 1) throw new ExprError("Only one function in a roll can have a count before it", p);
        repeat = node.repeatCount;
      }
      terms.push({ sign, node });
      if (s[p] === "+" || s[p] === "-") {
        sign = s[p] === "-" ? -1 : 1;
        p += 1;
        if (p >= s.length || s[p] === ",") throw new ExprError("A roll cannot end with + or -", p);
      } else {
        break;
      }
    }
    return { ast: { type: "sum", terms }, repeat };
  }

  function parseTerm(): Node {
    const n = readInt();
    const c = s[p];
    if (c === "d" && isDigit(s[p + 1])) {
      p += 1;
      const sides = readInt() ?? 0;
      const count = n ?? 1;
      if (count < 1) throw new ExprError(`A roll needs at least one die: ${count}d${sides}`, p);
      if (sides < 1) throw new ExprError("A die needs at least 1 side", p);
      if (sides > MAX_SIDES) throw new ExprError(`A die can have at most ${MAX_SIDES} sides`, p);
      return { type: "dice", count, sides };
    }
    if ((c === "d" || c === "a") && s[p + 1] === "(") {
      if (n !== null && n < 1) throw new ExprError(`The count before ${c}( must be at least 1`, p);
      const mode: FnMode = c === "a" ? "a" : "d";
      p += 2;
      const args = [parseArg()];
      while (s[p] === ",") {
        p += 1;
        args.push(parseArg());
      }
      if (s[p] !== ")") {
        throw new ExprError(s[p] === undefined ? "Missing )" : `Unexpected "${s[p]}", expected , or )`, p);
      }
      p += 1;
      const implicit = args.length === 1;
      return {
        type: "fn",
        mode,
        repeatCount: n ?? 1,
        implicit,
        args: implicit ? [args[0], args[0]] : args,
      };
    }
    if (c === "d") throw new ExprError('"d" needs a number of sides or ( after it', p);
    if (c === "a") throw new ExprError('"a" needs ( after it', p);
    if (n !== null) return { type: "num", value: n };
    throw new ExprError(c === undefined ? "The expression ends too early" : `Unexpected "${c}"`, p);
  }

  /** One argument of a( ) or d( ): a single d20 plus flat whole numbers, e.g. d20, d20+5, d20-1. */
  function parseArg(): SumNode {
    const n = readInt();
    if (s[p] !== "d" || !isDigit(s[p + 1])) throw new ExprError(ARG_HINT, p);
    p += 1;
    const sides = readInt() ?? 0;
    if (sides !== 20 || (n !== null && n !== 1)) throw new ExprError(ARG_HINT, p);
    const terms: SumTerm[] = [{ sign: 1, node: { type: "dice", count: 1, sides: 20 } }];
    while (s[p] === "+" || s[p] === "-") {
      const sign = s[p] === "-" ? -1 : 1;
      p += 1;
      const value = readInt();
      if (value === null) throw new ExprError("Inside a( ) or d( ) only whole numbers go after + or -", p);
      terms.push({ sign, node: { type: "num", value } });
    }
    return { type: "sum", terms };
  }

  const rolls: ParsedRoll[] = [];
  for (;;) {
    const { ast, repeat } = parseRoll();
    for (let i = 0; i < repeat; i += 1) rolls.push(ast);
    if (s[p] === ",") {
      p += 1;
      if (p >= s.length) throw new ExprError('The expression cannot end with ","', p);
      continue;
    }
    break;
  }
  if (p < s.length) throw new ExprError(`Unexpected "${s[p]}"`, p);

  const dice = rolls.reduce((sum, roll) => sum + countDice(roll), 0);
  if (rolls.some((roll) => countDice(roll) < 1)) throw new ExprError("Every roll needs at least one die", 0);
  if (dice > MAX_DICE_PER_EXPRESSION) {
    throw new ExprError(`At most ${MAX_DICE_PER_EXPRESSION} dice per expression (this one has ${dice})`, 0);
  }
  if (rolls.length > MAX_ROLLS_PER_EXPRESSION) {
    throw new ExprError(`At most ${MAX_ROLLS_PER_EXPRESSION} rolls per expression (this one has ${rolls.length})`, 0);
  }
  return rolls;
}

function countDice(node: Node): number {
  switch (node.type) {
    case "num":
      return 0;
    case "dice":
      return node.count;
    case "sum":
      return node.terms.reduce((sum, term) => sum + countDice(term.node), 0);
    case "fn":
      return node.args.reduce((sum, arg) => sum + countDice(arg), 0);
  }
}

/** The sides of every die, over all Rolls, in the order `evaluateRolls` asks the random source for them. */
export function planRollDice(rolls: ParsedRoll[]): number[] {
  const sides: number[] = [];
  const walk = (node: Node) => {
    switch (node.type) {
      case "num":
        return;
      case "dice":
        for (let i = 0; i < node.count; i += 1) sides.push(node.sides);
        return;
      case "sum":
        node.terms.forEach((term) => walk(term.node));
        return;
      case "fn":
        node.args.forEach((arg) => walk(arg));
        return;
    }
  };
  rolls.forEach((roll) => walk(roll));
  return sides;
}

type Result =
  | { type: "num"; value: number; total: number }
  | { type: "dice"; sides: number; faces: number[]; total: number }
  | { type: "sum"; items: { sign: number; result: Result }[]; total: number }
  | { type: "fn"; results: Result[]; pick: number; total: number };

function evaluate(node: Node, random: RandomSource): Result {
  switch (node.type) {
    case "num":
      return { type: "num", value: node.value, total: node.value };
    case "dice": {
      const faces: number[] = [];
      for (let i = 0; i < node.count; i += 1) faces.push(rollDie(node.sides, random));
      return { type: "dice", sides: node.sides, faces, total: faces.reduce((sum, face) => sum + face, 0) };
    }
    case "sum": {
      const items = node.terms.map((term) => ({ sign: term.sign, result: evaluate(term.node, random) }));
      return { type: "sum", items, total: items.reduce((sum, item) => sum + item.sign * item.result.total, 0) };
    }
    case "fn": {
      const results = node.args.map((arg) => evaluate(arg, random));
      let pick = 0;
      for (let i = 1; i < results.length; i += 1) {
        const better = node.mode === "a" ? results[i].total > results[pick].total : results[i].total < results[pick].total;
        if (better) pick = i;
      }
      return { type: "fn", results, pick, total: results[pick].total };
    }
  }
}

/** The flat shape of a Roll: every die with its dropped and subtracted marks, and the kept flat modifier. */
function toRoll(result: Result): Roll {
  const dice: RolledDie[] = [];
  let modifier = 0;
  const walk = (current: Result, dropped: boolean, sign: number) => {
    switch (current.type) {
      case "num":
        if (!dropped) modifier += sign * current.value;
        return;
      case "dice":
        for (const face of current.faces) {
          const die: RolledDie = { sides: current.sides, face, dropped };
          if (sign < 0) die.subtracted = true;
          dice.push(die);
        }
        return;
      case "sum":
        current.items.forEach((item) => walk(item.result, dropped, sign * item.sign));
        return;
      case "fn":
        current.results.forEach((argument, index) => walk(argument, dropped || index !== current.pick, sign));
        return;
    }
  };
  walk(result, false, 1);
  return { dice, modifier, total: result.total };
}

/** Canonical text of one Roll. */
function formatNode(node: Node): string {
  switch (node.type) {
    case "num":
      return String(node.value);
    case "dice":
      return `${node.count === 1 ? "" : node.count}d${node.sides}`;
    case "sum":
      return node.terms.map((term, index) => `${index === 0 ? "" : term.sign < 0 ? "-" : "+"}${formatNode(term.node)}`).join("");
    case "fn": {
      const inner = node.implicit ? formatNode(node.args[0]) : node.args.map(formatNode).join(",");
      return `${node.mode}(${inner})`;
    }
  }
}

export interface EvaluatedRoll {
  text: string;
  roll: Roll;
}

/** Rolls each Roll once, in order, drawing faces from `random`. */
export function evaluateRolls(rolls: ParsedRoll[], random: RandomSource = currentRandom()): EvaluatedRoll[] {
  return rolls.map((roll) => ({ text: formatNode(roll), roll: toRoll(evaluate(roll, random)) }));
}

// ---- Edit helpers behind the tray's die buttons, modifier stepper and d20 mode control.

const clean = (text: string) => String(text).toLowerCase().replace(/\s+/g, "");

/** Adds one die of `sides`: a count is raised when the text already ends with that die. */
export function addDieToExpression(text: string, sides: number): string {
  const t = clean(text);
  if (!t) return `d${sides}`;
  const match = new RegExp(`(^|[+\\-(,])(\\d*)d${sides}$`).exec(t);
  if (match) {
    const count = (match[2] === "" ? 1 : Number.parseInt(match[2], 10)) + 1;
    return `${t.slice(0, t.length - match[0].length)}${match[1]}${count}d${sides}`;
  }
  if (/[+\-(,]$/.test(t)) return `${t}d${sides}`;
  return `${t}+d${sides}`;
}

/** The flat modifier at the end of the text, or 0. */
export function expressionModifier(text: string): number {
  const match = /([+-])(\d+)$/.exec(clean(text));
  if (!match) return 0;
  const value = Number.parseInt(match[2], 10);
  return match[1] === "-" ? -value : value;
}

/** Moves the trailing flat modifier by `delta`; a modifier of 0 leaves none. */
export function bumpExpressionModifier(text: string, delta: number): string {
  const t = clean(text);
  if (!t) return t;
  const value = expressionModifier(t) + delta;
  const base = t.replace(/([+-])(\d+)$/, "");
  if (value === 0) return base;
  return `${base}${value > 0 ? "+" : ""}${value}`;
}

const D20_TEXT = /^(d20|a\(d20(?:,d20)?\)|d\(d20(?:,d20)?\))([+-]\d+)?$/;

/** The d20 mode of a text that is a lone d20 with an optional modifier; null for any other text. */
export function expressionD20Mode(text: string): D20Mode | null {
  const match = D20_TEXT.exec(clean(text));
  if (!match) return null;
  if (match[1].startsWith("a(")) return "advantage";
  if (match[1].startsWith("d(")) return "disadvantage";
  return "none";
}

/** Switches a lone d20 (with its modifier) to the given mode. Other texts are returned unchanged. */
export function setExpressionD20Mode(text: string, mode: D20Mode): string {
  const match = D20_TEXT.exec(clean(text));
  if (!match) return text;
  const tail = match[2] ?? "";
  const base = mode === "advantage" ? "a(d20,d20)" : mode === "disadvantage" ? "d(d20,d20)" : "d20";
  return `${base}${tail}`;
}
