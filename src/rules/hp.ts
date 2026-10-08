import type { Character } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import { CLASS_DATA, type ClassRules } from "./classData.ts";
import { effectiveScores, hasFeat } from "./abilities.ts";
import { totalLevel } from "./proficiencies.ts";

export function maxHp(character: Character, opts: ResolvedAncestry = {}, classes: Record<string, ClassRules> = CLASS_DATA): number {
  if (character.maxHpOverride != null && character.maxHpOverride > 0) return character.maxHpOverride;
  const con = effectiveScores(character, opts).modifiers.con;
  if (!character.classes.length) return Math.max(1, 10 + con);
  let hp = 0, first = true;
  for (const c of character.classes) {
    const die = classes[c.className]?.hitDie ?? 8;
    for (let level = 1; level <= c.level; level++) {
      hp += Math.max(1, (first ? die : Math.floor(die / 2) + 1) + con);
      first = false;
    }
  }
  return Math.max(1, hp + (hasFeat(character, "Tough") ? 2 * totalLevel(character) : 0));
}
export function hitDiceByType(character: Character, classes: Record<string, ClassRules> = CLASS_DATA) {
  const pools: Record<string, { total: number; used: number; remaining: number }> = {};
  for (const c of character.classes) {
    const key = `d${classes[c.className]?.hitDie ?? 8}`;
    pools[key] ??= { total: 0, used: 0, remaining: 0 };
    pools[key].total += c.level;
  }
  const usedMap = character.usedHitDice ?? {};
  for (const [key, pool] of Object.entries(pools)) {
    pool.used = Math.min(pool.total, Math.max(0, usedMap[key] || 0));
    pool.remaining = pool.total - pool.used;
  }
  return pools;
}
