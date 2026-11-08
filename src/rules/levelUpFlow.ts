import type { AsiSelection, Character, CharacterClass } from "../types/character.ts";
import { effectiveScores } from "./abilities.ts";
import { asiLevels, casterKindOf, heldClass, hitDieOf, isThirdCaster } from "./classData.ts";
import { subclassLevel } from "./leveling.ts";

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
  hitPoints?: { mode: "average" };
  picks?: LevelUpPicks;
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

/** Whether the class record, or its subclass of that name, carries a pick at the given level. */
function offersClassChoiceAtLevel(className: string, source: string, level: number, subclassName?: string): boolean {
  const data = heldClass({ className, source });
  if (!data) return false;
  if (data.features.some((f) => f.level === level && Boolean(f.choices))) return true;
  if (!subclassName) return false;
  const sub = data.subclasses.find((s) => sameName(s.name, subclassName) || sameName(s.shortName, subclassName));
  return Boolean(sub?.features.some((f) => f.level === level && Boolean(f.choices)));
}

/**
 * Plans one level of `className` for the Character: the steps that level brings, and its Hit
 * Points pick. A class the Character does not hold yet is checked against the multiclass
 * requirements; a refusal names the unmet requirement in `reason`.
 */
export function planLevelUp(character: Character, options: PlanLevelUpOptions): PlanLevelUpResult {
  const className = options.className;
  const existing = character.classes.find((c) => sameName(c.className, className));
  const source = existing?.source ?? options.source ?? heldClass({ className })?.source ?? "PHB";
  const fromLevel = existing?.level ?? 0;
  const toLevel = fromLevel + 1;
  const heldSubclass = existing?.subclassName ?? existing?.subclass;

  const wanted = new Set<LevelUpStepId>(["class", "hitPoints", "review"]);
  if (toLevel >= subclassLevel(className) && !heldSubclass) wanted.add("subclass");
  if (asiLevels(className).includes(toLevel)) wanted.add("asiFeat");
  if (offersClassChoiceAtLevel(className, source, toLevel, heldSubclass)) wanted.add("classChoices");
  const atLevel: CharacterClass = { className, source, level: toLevel, ...(heldSubclass ? { subclassName: heldSubclass } : {}) };
  if (casterKindOf(atLevel) !== undefined || isThirdCaster(atLevel)) wanted.add("spells");
  const steps = STEP_ORDER.filter((id) => wanted.has(id)).map((id) => ({ id, className, classLevel: toLevel }));

  const conMod = effectiveScores(character).modifiers.con ?? 0;
  const die = hitDieOf({ className, source, level: toLevel });
  const firstLevel = character.classes.length === 0;
  const hitPoints: HitPointsPlan = {
    mode: "average",
    amount: Math.max(1, (firstLevel ? die : Math.floor(die / 2) + 1) + conMod),
  };

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
