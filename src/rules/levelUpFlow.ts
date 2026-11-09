import type { ActiveBooks } from "../constants/books.ts";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../constants/books.ts";
import type { AsiSelection, Character, CharacterClass } from "../types/character.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { effectiveScores } from "./abilities.ts";
import { asiLevels, casterKindOf, heldClass, hitDieOf, isThirdCaster } from "./classData.ts";
import { subclassLevel } from "./leveling.ts";
import {
  applyAsiWithHitPoints,
  changeSubclass,
  confirmLevelUp,
  validateMulticlass,
} from "./builderTransitions.ts";
import { learnSpell } from "./characterSpells.ts";
import { getClassSpellProfiles } from "./spellcasting.ts";
import { recordRolledHitPoints } from "./hp.ts";
import { classChoicesAtLevel, hasClassChoices } from "./classChoices.ts";
import { appRandom, rollDie, type RandomSource } from "./dice.ts";
import { totalLevel } from "./proficiencies.ts";

/** The highest class level and total character level the 2014 rules allow. */
const MAX_LEVEL = 20;

/**
 * Pure Level-Up Flow rules: plan one level for a chosen class and apply a confirmed plan in one
 * Character update through the existing level-up transitions. No UI, no storage; an unapplied
 * plan leaves the Character untouched.
 */

/** The steps of the Level-Up Flow in order. A plan lists only the ones the new level brings. */
export type LevelUpStepId = "class" | "hitPoints" | "subclass" | "asiFeat" | "classChoices" | "spells" | "review";

export interface LevelUpStep {
  id: LevelUpStepId;
  className: string;
  classLevel: number;
}

export interface HitPointsPlan {
  mode: "average" | "roll";
  /** The hit points the level adds. */
  amount: number;
  /** The die face, present when mode is "roll". */
  roll?: number;
}

/** The picks the player made on the plan's steps, applied together on confirm. */
export interface LevelUpPicks {
  subclass?: { name: string; source: string };
  asi?: AsiSelection;
  learnedSpells?: { name: string; source: string }[];
}

export interface LevelUpPlan {
  characterId: string;
  className: string;
  source: string;
  fromLevel: number;
  toLevel: number;
  steps: LevelUpStep[];
  hitPoints: HitPointsPlan;
  picks: LevelUpPicks;
}

export type PlanLevelUpResult = { ok: true; plan: LevelUpPlan } | { ok: false; reason: string };

export interface PlanLevelUpOptions {
  className: string;
  /** The source of a class the Character does not hold yet. */
  source?: string;
  hitPoints?: { mode: "average" } | { mode: "roll" };
  /** The random source a rolled Hit Points pick draws its die face from. Defaults to the app's source. */
  random?: RandomSource;
  picks?: LevelUpPicks;
  compendium?: Compendium;
  activeBooks?: ActiveBooks;
}

const STEP_ORDER: readonly LevelUpStepId[] = [
  "class",
  "hitPoints",
  "subclass",
  "asiFeat",
  "classChoices",
  "spells",
  "review",
];

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Plans one level of `className` for the Character: the steps that level brings, and its Hit
 * Points pick. A class the Character does not hold yet is checked against the multiclass
 * requirements; a refusal names the unmet requirement in `reason`.
 */
export function planLevelUp(character: Character, options: PlanLevelUpOptions): PlanLevelUpResult {
  const className = options.className;
  const existing = character.classes.find((c) => sameName(c.className, className));
  if (existing && existing.level >= MAX_LEVEL) {
    return { ok: false, reason: `${className} is already at level ${MAX_LEVEL}` };
  }
  if (totalLevel(character) >= MAX_LEVEL) {
    return { ok: false, reason: `a character cannot go beyond level ${MAX_LEVEL}` };
  }
  if (!existing) {
    const check = validateMulticlass(character, className, effectiveScores(character).scores);
    if (!check.ok) return { ok: false, reason: check.reason ?? `${className} requirement not met` };
  }
  const source = existing?.source ?? options.source ?? heldClass({ className })?.source ?? "PHB";
  const fromLevel = existing?.level ?? 0;
  const toLevel = fromLevel + 1;
  const heldSubclass = existing?.subclassName ?? existing?.subclass;
  const compendium = options.compendium ?? currentCompendium();
  const activeBooks = options.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;

  const atLevel: CharacterClass = { className, source, level: toLevel, ...(heldSubclass ? { subclassName: heldSubclass } : {}) };
  const wanted = new Set<LevelUpStepId>(["class", "hitPoints", "review"]);
  if (toLevel >= subclassLevel(className) && !heldSubclass) wanted.add("subclass");
  if (asiLevels(className).includes(toLevel)) wanted.add("asiFeat");
  // The same shared reader the Creation Flow uses decides the Class Choices step, evaluated on the
  // planned class at the new level; a multiclass entry's skill pick is found here too.
  if (hasClassChoices(classChoicesAtLevel(character, atLevel, fromLevel, { compendium, activeBooks }))) wanted.add("classChoices");
  if (casterKindOf(atLevel) !== undefined || isThirdCaster(atLevel)) wanted.add("spells");
  const steps = STEP_ORDER.filter((id) => wanted.has(id)).map((id) => ({ id, className, classLevel: toLevel }));

  const conMod = effectiveScores(character).modifiers.con ?? 0;
  const die = hitDieOf({ className, source, level: toLevel });
  const firstLevel = character.classes.length === 0;
  const mode = options.hitPoints?.mode ?? "average";
  let hitPoints: HitPointsPlan;
  if (mode === "roll") {
    const roll = rollDie(die, options.random ?? appRandom);
    hitPoints = { mode, roll, amount: Math.max(1, roll + conMod) };
  } else {
    hitPoints = { mode, amount: Math.max(1, (firstLevel ? die : Math.floor(die / 2) + 1) + conMod) };
  }

  return {
    ok: true,
    plan: {
      characterId: character.id,
      className,
      source,
      fromLevel,
      toLevel,
      steps,
      hitPoints,
      picks: options.picks ?? {},
    },
  };
}

export interface ApplyLevelUpOptions {
  fullHealOnLevelUp?: boolean;
  compendium?: Compendium;
  activeBooks?: ActiveBooks;
}

/**
 * Applies a confirmed plan in one Character update: the level (and the full heal when that
 * setting is on) through `confirmLevelUp`, then the plan's picks through `changeSubclass`,
 * `applyAsiWithHitPoints` and `learnSpell`. A class the Character does not hold is re-checked
 * against the multiclass requirements first; a refusal returns the Character unchanged. The
 * given Character is never mutated.
 */
export function applyLevelUpPlan(
  character: Character,
  plan: LevelUpPlan,
  options: ApplyLevelUpOptions = {}
): Character {
  const fullHeal = options.fullHealOnLevelUp ?? true;
  const compendium = options.compendium ?? currentCompendium();
  const activeBooks = options.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;

  const holds = character.classes.some((c) => sameName(c.className, plan.className));
  if (!holds) {
    const check = validateMulticlass(character, plan.className, effectiveScores(character).scores);
    if (!check.ok) return character;
  }
  // A stale plan is refused when it would take the class or the character beyond the level cap.
  if (plan.toLevel > MAX_LEVEL) return character;
  const held = character.classes.find((c) => sameName(c.className, plan.className));
  const otherLevels = totalLevel(character) - (held?.level ?? 0);
  if (otherLevels + plan.toLevel > MAX_LEVEL) return character;

  // A rolled level records the die face it rolled before the level is confirmed, so the full heal
  // on level-up fills to the rolled max; `maxHp` adds the current Constitution modifier to the face
  // once the level exists.
  let next = character;
  if (plan.hitPoints.mode === "roll" && plan.hitPoints.roll !== undefined) {
    const held = character.classes.find((c) => sameName(c.className, plan.className));
    next = recordRolledHitPoints(next, held?.className ?? plan.className, plan.toLevel, plan.hitPoints.roll);
  }
  next = confirmLevelUp(next, plan.className, plan.source, fullHeal);
  if (plan.picks.subclass) {
    next = changeSubclass(
      next,
      plan.className,
      plan.picks.subclass.name,
      plan.picks.subclass.source,
      [],
      compendium,
      activeBooks
    );
  }
  if (plan.picks.asi) {
    next = applyAsiWithHitPoints(
      next,
      { ...plan.picks.asi, className: plan.className, classLevel: plan.toLevel, level: plan.toLevel },
      fullHeal,
      compendium,
      activeBooks
    );
  }
  if (plan.picks.learnedSpells?.length) {
    const profile = getClassSpellProfiles(next, { activeBooks, compendium }).find((p) =>
      sameName(p.className, plan.className)
    );
    if (profile) {
      for (const spell of plan.picks.learnedSpells) {
        next = learnSpell(next, profile, spell, compendium, activeBooks);
      }
    }
  }
  return next;
}
