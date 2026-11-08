/**
 * A source of die faces: given a die's sides, it returns the face that lands, in [1, sides].
 * Tests inject a fixed sequence of faces; the app rolls with `appRandom`.
 */
export type RandomSource = (sides: number) => number;

/** The app's random source. */
export const appRandom: RandomSource = (sides) => 1 + Math.floor(Math.random() * sides);

export interface DiceTerm {
  count: number;
  sides: number;
}

export interface DicePool {
  dice: DiceTerm[];
  modifier: number;
}

/** One die of a Roll: its sides, the face it landed on, and whether it counts toward the total. */
export interface RolledDie {
  sides: number;
  face: number;
  dropped: boolean;
}

/** One throw of a dice pool with a flat modifier: each die's face and the total. */
export interface Roll {
  dice: RolledDie[];
  modifier: number;
  total: number;
}

function rollDie(sides: number, random: RandomSource): number {
  return Math.min(sides, Math.max(1, Math.floor(random(sides))));
}

/**
 * Parses a pool written like "2d6+1d8+3" or "d20-2": dice terms plus a flat modifier, whitespace
 * tolerated. Returns null when the text is not such a pool.
 */
export function parseDicePool(text: string): DicePool | null {
  const cleaned = text.toLowerCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  const terms = cleaned.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join("") !== cleaned) return null;
  const dice: DiceTerm[] = [];
  let modifier = 0;
  for (const rawTerm of terms) {
    const negative = rawTerm.startsWith("-");
    const term = rawTerm.replace(/^[+-]/, "");
    const diceMatch = /^(\d*)d(\d+)$/.exec(term);
    if (diceMatch) {
      if (negative) return null;
      const count = diceMatch[1] === "" ? 1 : Number.parseInt(diceMatch[1], 10);
      const sides = Number.parseInt(diceMatch[2], 10);
      if (count < 1 || sides < 1) return null;
      dice.push({ count, sides });
    } else if (/^\d+$/.test(term)) {
      const value = Number.parseInt(term, 10);
      modifier += negative ? -value : value;
    } else {
      return null;
    }
  }
  return dice.length > 0 ? { dice, modifier } : null;
}

function rollParsed(pool: DicePool, random: RandomSource): Roll {
  const dice: RolledDie[] = [];
  let sum = 0;
  for (const term of pool.dice) {
    for (let i = 0; i < term.count; i += 1) {
      const face = rollDie(term.sides, random);
      dice.push({ sides: term.sides, face, dropped: false });
      sum += face;
    }
  }
  return { dice, modifier: pool.modifier, total: sum + pool.modifier };
}

/** Rolls a pool like "2d6+1d8+3": every die's face, and a total of their sum plus the modifier. */
export function rollDicePool(pool: string, random: RandomSource = appRandom): Roll {
  const parsed = parseDicePool(pool);
  if (!parsed) throw new Error(`Not a dice pool: "${pool}"`);
  return rollParsed(parsed, random);
}
