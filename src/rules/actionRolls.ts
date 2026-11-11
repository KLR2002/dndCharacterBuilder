import {
  currentRandom,
  isNatural20,
  parseDicePool,
  rollD20,
  rollDamage,
  type D20Mode,
  type RandomSource,
  type Roll,
} from "./dice.ts";
import type { RollLogEntryInput } from "./rollLog.ts";

/**
 * The rollable rows of the Actions tab: the Tactical Action Ledger's weapon attacks satisfy this shape,
 * and so does any other ledger row that gives an attack bonus (a spell attack). Bonuses and damage are
 * read from the ledger; this module never recomputes them.
 */
export interface RollAttackSpec {
  attackBonus: number;
  /** The ledger's damage string, like "1d8 + 3"; flat or unparseable damage is not a roll. */
  damage: string;
}

/** Where a roll is logged from. */
export interface ActionRollOrigin {
  /** The d20 roll's source, e.g. "Longsword attack". With a damage-only roll, the damage source. */
  source: string;
  /** The damage follow-up's source, e.g. "Longsword damage". Defaults to `source`. */
  damageSource?: string;
  characterName?: string;
}

/** The one publishing seam: the Roll Log provider passes its `publishRoll` here. */
export type PublishRoll = (input: RollLogEntryInput) => void;

// The dice pool at the start of a damage string: "1d8+3" out of "1d8 + 3 slashing".
const LEADING_POOL = /^((?:\d*d\d+|\d+)(?:\s*[+-]\s*(?:\d*d\d+|\d+))*)/;

/**
 * The pool at the start of a damage string, like "1d8 + 3" or "1d10" out of "1d10 force". Null when the
 * text carries no leading dice (a flat value like "5", or a label like "Cantrip scaling"): that damage is
 * shown plain, without a roll affordance.
 */
export function damagePoolOf(text: string): string | null {
  const match = LEADING_POOL.exec(text.trim());
  if (!match) return null;
  return parseDicePool(match[1]) ? match[1] : null;
}

/**
 * Rolls an attack row: a d20 with the row's bonus in the chosen mode, published with the damage follow-up
 * when the row's damage is a pool ("Roll damage", or "Roll critical damage" after a kept natural 20, then
 * rolled with doubled dice and the modifier once). Rolls spend nothing: this only publishes.
 */
export function rollActionAttack(
  attack: RollAttackSpec,
  origin: ActionRollOrigin,
  mode: D20Mode,
  publish: PublishRoll,
  random: RandomSource = currentRandom(),
): Roll {
  const roll = rollD20(attack.attackBonus, mode, random);
  const pool = damagePoolOf(attack.damage);
  const critical = isNatural20(roll);
  publish({
    roll,
    source: origin.source,
    characterName: origin.characterName,
    d20Mode: mode,
    followUp: pool
      ? {
          label: critical ? "Roll critical damage" : "Roll damage",
          onPress: () => {
            publish({
              roll: rollDamage(pool, { critical }, random),
              source: origin.damageSource ?? origin.source,
              characterName: origin.characterName,
              critical,
            });
          },
        }
      : undefined,
  });
  return roll;
}

/** Rolls only a damage pool (the damage badge's tap): the pool with its modifier, critical or not. */
export function rollActionDamage(
  damage: string,
  origin: Pick<ActionRollOrigin, "source" | "characterName">,
  publish: PublishRoll,
  critical = false,
  random: RandomSource = currentRandom(),
): Roll {
  const pool = damagePoolOf(damage);
  if (!pool) throw new Error(`Not a damage roll: "${damage}"`);
  const roll = rollDamage(pool, { critical }, random);
  publish({ roll, source: origin.source, characterName: origin.characterName, critical });
  return roll;
}

/** What a RollBadge hands its press handler: the badge's own props. */
export interface RollBadgePress {
  modifier?: number;
  pool?: string;
  source: string;
  poolSource?: string;
  characterName?: string;
}

/**
 * The badge's tap, in one place so tests drive the same path the component does: a d20 badge rolls the
 * attack (with the damage follow-up when it has a pool), a damage-only badge rolls the pool. Rolls
 * spend nothing: this only publishes.
 */
export function pressRollBadge(
  badge: RollBadgePress,
  mode: D20Mode,
  publish: PublishRoll,
  random: RandomSource = currentRandom(),
): Roll | null {
  if (badge.modifier !== undefined) {
    return rollActionAttack(
      { attackBonus: badge.modifier, damage: badge.pool ?? "" },
      { source: badge.source, damageSource: badge.poolSource ?? badge.source, characterName: badge.characterName },
      mode,
      publish,
      random,
    );
  }
  if (badge.pool) {
    return rollActionDamage(badge.pool, { source: badge.source, characterName: badge.characterName }, publish, false, random);
  }
  return null;
}
