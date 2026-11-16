import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDieToExpression,
  bumpExpressionModifier,
  evaluateRolls,
  expressionD20Mode,
  expressionModifier,
  MAX_DICE_PER_EXPRESSION,
  MAX_ROLLS_PER_EXPRESSION,
  MAX_SIDES,
  parseRollExpression,
  planRollDice,
  setExpressionD20Mode,
  type RollExpressionResult,
} from "../src/rules/rollExpression.ts";
import type { RandomSource, Roll } from "../src/rules/dice.ts";
import { isD20Test } from "../src/rules/rollLog.ts";

/** A random source with fixed faces, cycling: the next die lands on the next queued face. */
function fixedFaces(faces: number[]): RandomSource {
  let index = 0;
  return (sides) => Math.min(sides, Math.max(1, faces[index++ % faces.length]));
}

/** Every die lands on its top face, so ties resolve to the first argument. */
const topFace: RandomSource = (sides) => sides;

/** Parses an expression that must be valid and returns its Rolls. */
function parseOk(text: string) {
  const parsed = parseRollExpression(text);
  if (!parsed.ok) assert.fail(`expected ${JSON.stringify(text)} to parse: ${parsed.message}`);
  return parsed.rolls;
}

/** A die as the tests describe it: "d20", "d20(dropped)", "-d4" (subtracted). */
function describeDie(die: Roll["dice"][number]): string {
  return `${die.subtracted ? "-" : ""}d${die.sides}${die.dropped ? "(dropped)" : ""}`;
}

/** Per-roll text, dice and flat modifier, read from the Rolls the expression evaluates to. */
function describeResults(text: string, random: RandomSource = topFace) {
  return evaluateRolls(parseOk(text), random).map(({ text: rollText, roll }) => ({
    text: rollText,
    dice: roll.dice.map(describeDie),
    modifier: roll.modifier,
  }));
}

/** Seeded PRNG (mulberry32), so the random-expression test is repeatable. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A valid expression built from the grammar: dice, numbers, a(...), d(...), comma-separated Rolls. */
function randomExpression(next: () => number): string {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  const sidesChoices = [1, 2, 4, 6, 8, 10, 12, 20, 100, 1000];
  const d20Arg = () => {
    const modifier = pick(["", "", "+3", "-1", "+10"]);
    return `d20${modifier}`;
  };
  const rolls: string[] = [];
  const rollCount = 1 + Math.floor(next() * 3);
  for (let r = 0; r < rollCount; r += 1) {
    const count = 1 + Math.floor(next() * 3);
    let text = `${count === 1 ? "" : count}d${pick(sidesChoices)}`;
    const extra = Math.floor(next() * 4);
    for (let t = 0; t < extra; t += 1) {
      const sign = pick(["+", "-"]);
      const kind = pick(["dice", "num", "fn", "fn"]);
      if (kind === "dice") {
        const diceCount = 1 + Math.floor(next() * 3);
        text += `${sign}${diceCount === 1 ? "" : diceCount}d${pick(sidesChoices)}`;
      } else if (kind === "num") {
        text += `${sign}${Math.floor(next() * 21)}`;
      } else {
        const fn = pick(["a", "d"]);
        const args = next() < 0.3 ? [d20Arg()] : [d20Arg(), d20Arg()];
        text += `${sign}${fn}(${args.join(",")})`;
      }
    }
    rolls.push(text);
  }
  return rolls.join(",");
}

const acceptedWithRolls: [string, { text: string; dice: string[]; modifier: number }[]][] = [
  ["d20+5", [{ text: "d20+5", dice: ["d20"], modifier: 5 }]],
  ["2d6+1d8+3", [{ text: "2d6+d8+3", dice: ["d6", "d6", "d8"], modifier: 3 }]],
  ["3+d6", [{ text: "3+d6", dice: ["d6"], modifier: 3 }]],
  ["d3+d7", [{ text: "d3+d7", dice: ["d3", "d7"], modifier: 0 }]],
  ["2d2+d1000", [{ text: "2d2+d1000", dice: ["d2", "d2", "d1000"], modifier: 0 }]],
  ["d20-d4+2", [{ text: "d20-d4+2", dice: ["d20", "-d4"], modifier: 2 }]],
  ["a(d20+5,d20+2)", [{ text: "a(d20+5,d20+2)", dice: ["d20", "d20(dropped)"], modifier: 5 }]],
  ["A(D20)", [{ text: "a(d20)", dice: ["d20", "d20(dropped)"], modifier: 0 }]],
  ["a(d20,d20,d20)", [{ text: "a(d20,d20,d20)", dice: ["d20", "d20(dropped)", "d20(dropped)"], modifier: 0 }]],
  ["d(d20,d20)-1", [{ text: "d(d20,d20)-1", dice: ["d20", "d20(dropped)"], modifier: -1 }]],
  ["a(d20,d20)+d4+2", [{ text: "a(d20,d20)+d4+2", dice: ["d20", "d20(dropped)", "d4"], modifier: 2 }]],
  [
    "d20,d20",
    [
      { text: "d20", dice: ["d20"], modifier: 0 },
      { text: "d20", dice: ["d20"], modifier: 0 },
    ],
  ],
  [
    "4d6,4d6,4d6",
    Array.from({ length: 3 }, () => ({ text: "4d6", dice: ["d6", "d6", "d6", "d6"], modifier: 0 })),
  ],
  [
    "2a(d20,d20)",
    Array.from({ length: 2 }, () => ({ text: "a(d20,d20)", dice: ["d20", "d20(dropped)"], modifier: 0 })),
  ],
  [
    "2a(d20+5,d20+5)+2",
    Array.from({ length: 2 }, () => ({ text: "a(d20+5,d20+5)+2", dice: ["d20", "d20(dropped)"], modifier: 7 })),
  ],
  [
    "d4+2a(d20,d20)",
    Array.from({ length: 2 }, () => ({ text: "d4+a(d20,d20)", dice: ["d4", "d20", "d20(dropped)"], modifier: 0 })),
  ],
  [
    "a(d20)+2d(d20)+d4",
    Array.from({ length: 2 }, () => ({
      text: "a(d20)+d(d20)+d4",
      dice: ["d20", "d20(dropped)", "d20", "d20(dropped)", "d4"],
      modifier: 0,
    })),
  ],
  [
    "10a(d20)",
    Array.from({ length: 10 }, () => ({ text: "a(d20)", dice: ["d20", "d20(dropped)"], modifier: 0 })),
  ],
];

for (const [input, expected] of acceptedWithRolls) {
  test(`accepted expression ${input} reads as its Rolls`, () => {
    assert.deepEqual(describeResults(input), expected);
  });
}

test("accepted expressions ignore case and spaces", () => {
  assert.deepEqual(describeResults(" 2D6 + 1 d8 + 3 "), describeResults("2d6+1d8+3"));
});

const rejected = [
  "",
  "+d6",
  "-d20",
  "d20+",
  "d20-",
  "d20,",
  ",d20",
  "d20,,d20",
  "d20,-d6",
  "5",
  "d20,5",
  "0d6",
  "1d0",
  "d1001",
  "101d6",
  "11a(d20)",
  "a(d4,d4)",
  "a(2d20,d20)",
  "a(d20,a(d20,d20))",
  "a(d20+d4,d20)",
  "a()",
  "a(d20,d20",
  "2a(d20,d20)+3d(d20,d20)",
  "dd6",
  "a",
  "d",
];

for (const input of rejected) {
  test(`rejected expression ${JSON.stringify(input)} gives a message and a position`, () => {
    const parsed: RollExpressionResult = parseRollExpression(input);
    if (parsed.ok) assert.fail(`expected ${JSON.stringify(input)} to be rejected`);
    assert.equal(typeof parsed.message, "string");
    assert.ok(parsed.message.length > 0 && parsed.message.length <= 100, parsed.message);
    assert.ok(!parsed.message.includes("\n"));
    assert.equal(typeof parsed.position, "number");
  });
}

test("the dice, sides, roll and argument limits are exported and enforced", () => {
  assert.equal(MAX_ROLLS_PER_EXPRESSION, 10);
  assert.equal(MAX_DICE_PER_EXPRESSION, 100);
  assert.equal(MAX_SIDES, 1000);
  assert.equal(parseRollExpression("100d6").ok, true);
  assert.equal(parseRollExpression("101d6").ok, false);
  assert.equal(parseRollExpression("1d1000").ok, true);
  assert.equal(parseRollExpression("10a(d20)").ok, true);
  assert.equal(parseRollExpression("11a(d20)").ok, false);
});

const hostile = [
  "50000000a(d20)",
  "99999999999999999999a(d20)",
  "99999999999999999999d6",
  "d99999999999999999999",
  "99999999999999999999d(d20)",
  Array.from({ length: 20 }, () => "2a(d20)").join(","),
];

for (const input of hostile) {
  test(`hostile count ${input.slice(0, 40)} is rejected promptly with a message`, () => {
    const started = Date.now();
    const parsed = parseRollExpression(input);
    assert.ok(Date.now() - started < 1000, "parsing took too long");
    if (parsed.ok) assert.fail(`expected the expression to be rejected`);
    assert.equal(typeof parsed.message, "string");
    assert.ok(parsed.message.length > 0, parsed.message);
  });
}

test("advantage keeps the argument with the higher total and drops the other argument's dice and modifier", () => {
  const [{ text, roll }] = evaluateRolls(parseOk("a(d20+5,d20+2)"), fixedFaces([3, 10]));
  assert.equal(text, "a(d20+5,d20+2)");
  assert.deepEqual(roll, {
    dice: [
      { sides: 20, face: 3, dropped: true },
      { sides: 20, face: 10, dropped: false },
    ],
    modifier: 2,
    total: 12,
  });
});

test("disadvantage keeps the argument with the lower total", () => {
  const [{ roll }] = evaluateRolls(parseOk("d(d20+5,d20+2)"), fixedFaces([3, 10]));
  assert.deepEqual(roll, {
    dice: [
      { sides: 20, face: 3, dropped: false },
      { sides: 20, face: 10, dropped: true },
    ],
    modifier: 5,
    total: 8,
  });
});

test("a tie keeps the first argument", () => {
  const [{ roll }] = evaluateRolls(parseOk("a(d20+5,d20+5)"), fixedFaces([10, 10]));
  assert.equal(roll.total, 15);
  assert.deepEqual(roll.dice.map((die) => die.dropped), [false, true]);
});

test("advantage over three arguments keeps the highest", () => {
  const [{ roll }] = evaluateRolls(parseOk("a(d20,d20,d20)"), fixedFaces([4, 17, 9]));
  assert.deepEqual(roll.dice.map((die) => [die.face, die.dropped]), [
    [4, true],
    [17, false],
    [9, true],
  ]);
  assert.equal(roll.total, 17);
});

test("subtracted dice are marked and count negatively in the total", () => {
  const [{ roll }] = evaluateRolls(parseOk("d20-d4+2"), fixedFaces([15, 3]));
  assert.deepEqual(roll, {
    dice: [
      { sides: 20, face: 15, dropped: false },
      { sides: 4, face: 3, dropped: false, subtracted: true },
    ],
    modifier: 2,
    total: 14,
  });
});

test("a subtracted function keeps its sign on the kept die", () => {
  const [{ roll }] = evaluateRolls(parseOk("d20-a(d20,d20)"), fixedFaces([10, 4, 12]));
  assert.deepEqual(roll, {
    dice: [
      { sides: 20, face: 10, dropped: false },
      { sides: 20, face: 4, dropped: true, subtracted: true },
      { sides: 20, face: 12, dropped: false, subtracted: true },
    ],
    modifier: 0,
    total: -2,
  });
});

test("roll.total equals the kept subtracted-aware dice plus the kept modifier over 2000 random expressions", () => {
  const next = seeded(20260601);
  const faceNext = seeded(77);
  for (let i = 0; i < 2000; i += 1) {
    const text = randomExpression(next);
    const rolls = parseOk(text);
    const results = evaluateRolls(rolls, (sides) => 1 + Math.floor(faceNext() * sides));
    assert.equal(results.length, rolls.length, text);
    for (const { roll } of results) {
      const kept = roll.dice.filter((die) => !die.dropped);
      const diceTotal = kept.reduce((sum, die) => sum + (die.subtracted ? -die.face : die.face), 0);
      assert.equal(roll.total, diceTotal + roll.modifier, text);
      for (const die of roll.dice) assert.ok(die.face >= 1 && die.face <= die.sides, text);
    }
  }
});

test("planRollDice matches the random calls evaluateRolls makes over 2000 random expressions", () => {
  const next = seeded(20260601);
  const faceNext = seeded(913);
  for (let i = 0; i < 2000; i += 1) {
    const text = randomExpression(next);
    const rolls = parseOk(text);
    const calls: number[] = [];
    const results = evaluateRolls(rolls, (sides) => {
      calls.push(sides);
      return 1 + Math.floor(faceNext() * sides);
    });
    assert.deepEqual(planRollDice(rolls), calls, text);
    assert.equal(planRollDice(rolls).length, results.reduce((sum, { roll }) => sum + roll.dice.length, 0), text);
  }
});

test("planRollDice lists the sides in evaluation order, functions included", () => {
  assert.deepEqual(planRollDice(parseOk("d4+a(d20)")), [4, 20, 20]);
});

test("addDieToExpression adds a die of the given sides", () => {
  assert.equal(addDieToExpression("", 6), "d6");
  assert.equal(addDieToExpression("d6", 6), "2d6");
  assert.equal(addDieToExpression("2d6+3", 8), "2d6+3+d8");
  assert.equal(addDieToExpression("d20,d6", 6), "d20,2d6");
});

test("bumpExpressionModifier moves the trailing modifier", () => {
  assert.equal(bumpExpressionModifier("d20", 1), "d20+1");
  assert.equal(bumpExpressionModifier("d20+1", -1), "d20");
  assert.equal(bumpExpressionModifier("2d6+d8", 1), "2d6+d8+1");
});

test("expressionModifier reads the trailing flat modifier", () => {
  assert.equal(expressionModifier("d20+5"), 5);
  assert.equal(expressionModifier("d20-2"), -2);
  assert.equal(expressionModifier("d20"), 0);
});

test("expressionD20Mode reads the d20 mode of a lone d20 and is null otherwise", () => {
  assert.equal(expressionD20Mode("2d6"), null);
  assert.equal(expressionD20Mode("a(d20)+3"), "advantage");
  assert.equal(expressionD20Mode("d(d20,d20)"), "disadvantage");
  assert.equal(expressionD20Mode("d20"), "none");
});

test("setExpressionD20Mode switches the d20 mode and keeps the modifier", () => {
  assert.equal(setExpressionD20Mode("d20+3", "advantage"), "a(d20,d20)+3");
  assert.equal(setExpressionD20Mode("a(d20,d20)+3", "none"), "d20+3");
  assert.equal(setExpressionD20Mode("d20", "disadvantage"), "d(d20,d20)");
});

test("isD20Test is true for a(d20+5,d20+2) and false for a(d20,d20,d20)+d4", () => {
  const [{ roll: keptD20 }] = evaluateRolls(parseOk("a(d20+5,d20+2)"), topFace);
  assert.equal(isD20Test(keptD20), true);
  const [{ roll: mixed }] = evaluateRolls(parseOk("a(d20,d20,d20)+d4"), topFace);
  assert.equal(isD20Test(mixed), false);
});
