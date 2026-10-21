import type { Character } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import type { ClassData } from "../types/dnd5e.ts";
import { hitDieOf } from "./classData.ts";
import { allCatalogClasses } from "./catalogs.ts";
import { effectiveScores, hasFeat } from "./abilities.ts";
import { totalLevel } from "./proficiencies.ts";

export function maxHp(character: Character, opts: ResolvedAncestry = {}, classes: readonly ClassData[] = allCatalogClasses()): number {
  if (character.maxHpOverride != null && character.maxHpOverride > 0) return character.maxHpOverride;
  const con = effectiveScores(character, opts).modifiers.con;
  const isHillDwarf =
    character.race?.name === "Dwarf" &&
    (character.race.subraceName === "Hill" || character.race.subraceName === "Hill Dwarf");
  const dwarvenToughness = isHillDwarf ? totalLevel(character) : 0;
  if (!character.classes.length) return Math.max(1, 10 + con + (isHillDwarf ? 1 : 0));
  let hp = 0, first = true;
  for (const c of character.classes) {
    const die = hitDieOf(c, classes);
    for (let level = 1; level <= c.level; level++) {
      hp += Math.max(1, (first ? die : Math.floor(die / 2) + 1) + con);
      first = false;
    }
  }
  return Math.max(1, hp + (hasFeat(character, "Tough") ? 2 * totalLevel(character) : 0) + dwarvenToughness);
}
export function hitDiceByType(character: Character, classes: readonly ClassData[] = allCatalogClasses()) {
  const pools: Record<string, { total: number; used: number; remaining: number }> = {};
  for (const c of character.classes) {
    const key = `d${hitDieOf(c, classes)}`;
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
