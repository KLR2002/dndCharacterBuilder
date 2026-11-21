import type { AbilityKey } from "../types/character.ts";
import { UNSET_ABILITY_SCORE } from "../constants/rules.ts";
import { ABILITIES } from "./abilities.ts";

/** The point-buy budget a creation's base scores may spend (2014 rules). */
export const POINT_BUY_BUDGET = 27;

const POINT_BUY_MIN = 8;
const POINT_BUY_MAX = 15;

/** The points one base score costs, by score. */
export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** The points a set of base scores spends. A score the cost table lacks spends nothing. */
export function pointBuySpent(scores: Partial<Record<AbilityKey, number>>): number {
  let spent = 0;
  for (const ability of ABILITIES) {
    spent += POINT_BUY_COST[scores[ability] ?? UNSET_ABILITY_SCORE] ?? 0;
  }
  return spent;
}

/** Whether ability can be set to next: the score stays within 8 to 15 and the set stays within the budget. */
export function canSetPointBuyScore(
  scores: Partial<Record<AbilityKey, number>>,
  ability: AbilityKey,
  next: number,
): boolean {
  if (next < POINT_BUY_MIN || next > POINT_BUY_MAX) return false;
  const current = scores[ability] ?? UNSET_ABILITY_SCORE;
  const change = (POINT_BUY_COST[next] ?? 0) - (POINT_BUY_COST[current] ?? 0);
  return pointBuySpent(scores) + change <= POINT_BUY_BUDGET;
}

/** Whether every base score is within 8 to 15 and the set spends no more than the budget. */
export function pointBuyValid(scores: Partial<Record<AbilityKey, number>>): boolean {
  for (const ability of ABILITIES) {
    const score = scores[ability] ?? UNSET_ABILITY_SCORE;
    if (score < POINT_BUY_MIN || score > POINT_BUY_MAX) return false;
  }
  return pointBuySpent(scores) <= POINT_BUY_BUDGET;
}
