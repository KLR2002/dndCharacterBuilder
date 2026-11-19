import type { ActiveBooks } from "../constants/books.ts";
import { DEFAULT_ACTIVE_BOOK_CODES, SRD_SOURCE } from "../constants/books.ts";
import type { AbilityKey, AsiSelection, Character, CharacterClass } from "../types/character.ts";
import type { FeatData, SpellData } from "../types/dnd5e.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { effectiveScores, formatModifier } from "./abilities.ts";
import { asiLevels, casterKindOf, heldClass, hitDieOf, isThirdCaster } from "./classData.ts";
import { subclassLevel } from "./leveling.ts";
import { featIncreaseOptions, findFeat, type FeatAbilityBonusOptions } from "./featIncrease.ts";
import { featPickView, type FeatSlotPick } from "./featSlot.ts";
import {
  applyAsiWithHitPoints,
  changeSubclass,
  confirmLevelUp,
  missingMulticlassRequirement,
  setOptionalFeatureEnabled,
  validateMulticlass,
} from "./builderTransitions.ts";
import { learnSpell } from "./characterSpells.ts";
import { getClassSpellProfiles } from "./spellcasting.ts";
import { learnableSpells, type LearnableSpells } from "./learnableSpells.ts";
import { maxHp, recordRolledHitPoints } from "./hp.ts";
import {
  classChoicesAtLevel,
  classChoicesLevelView,
  expertiseFilled,
  hasClassChoices,
  newExpertiseMilestones,
  newOptionalFeatures,
  type ClassChoicesStepView,
  type ClassLevelChoices,
} from "./classChoices.ts";
import { getMilestonePicks, toggleExpertiseChoice, type ExpertiseMilestone } from "./expertise.ts";
import type { OptionalFeatureOption } from "./optionalFeatures.ts";
import { currentRandom, rollDie, type RandomSource, type Roll } from "./dice.ts";
import { totalLevel } from "./proficiencies.ts";
import { allCatalogClasses, catalogListings, findClassData } from "./catalogs.ts";
import { featGrantedRuleChoices, pickRuleChoice } from "./ruleChoices.ts";
import type { AvailableRuleChoice } from "./choices/types.ts";

/** The highest class level and total character level the 2014 rules allow. */
export const MAX_LEVEL = 20;

/** The sidekick classes are not playable classes, so the Class step and the builder never offer them. */
export const SIDEKICK_CLASSES = new Set(["Expert Sidekick", "Spellcaster Sidekick", "Warrior Sidekick"]);

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
  /** The options picked on each of the level's class choices, by choice id. */
  classChoicePicks?: Record<string, string[]>;
  /** The options picked on each of the picked feat's own rule choices (fighting style, maneuvers, invocation), by choice id. */
  featPicks?: Record<string, string[]>;
  /** The Expertise options picked on the new level's milestones. */
  expertisePicks?: string[];
  /** The optional features the level's class gains, by feature name: enabled or not. */
  optionalFeatures?: Record<string, boolean>;
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
  /** The class choices the new level brings (proficiency and rule choices), read from the shared classChoices module. */
  classChoices?: AvailableRuleChoice[];
  /** The Expertise milestones the new level brings, with the options each may take. */
  expertiseMilestones?: ExpertiseMilestone[];
}

export type PlanLevelUpResult = { ok: true; plan: LevelUpPlan } | { ok: false; reason: string };

export interface PlanLevelUpOptions {
  className: string;
  /** The source of a class the Character does not hold yet. */
  source?: string;
  hitPoints?: { mode: "average" } | { mode: "roll" };
  /** The random source a rolled Hit Points pick draws its die face from. Defaults to the dice module's current source. */
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

  const wanted = new Set<LevelUpStepId>(["class", "hitPoints", "review"]);
  // A level that reaches the subclass level brings a Subclass step only when the active books offer at
  // least one; with none offered the step could never complete, so it is skipped like `leveling.ts` does.
  const offeredSubclasses =
    toLevel >= subclassLevel(className) && !heldSubclass ? subclassOptions(className, source, { compendium, activeBooks }) : [];
  if (offeredSubclasses.length > 0) wanted.add("subclass");
  if (asiLevels(className).includes(toLevel)) wanted.add("asiFeat");
  const picks: LevelUpPicks = { ...options.picks };
  // A single offered subclass is the plan's pick from the start: the Subclass step shows it selected and
  // the confirmed plan applies it, whatever catalog is active (applyLevelUpPlan never auto-applies on an
  // integrated catalog, so the pick has to be here).
  if (wanted.has("subclass") && !picks.subclass && offeredSubclasses.length === 1) {
    picks.subclass = { name: offeredSubclasses[0].name, source: offeredSubclasses[0].source };
  }
  // The same shared readers the Creation Flow uses decide the Class Choices step, evaluated on the
  // planned entry at the new level; a multiclass entry's skill pick is found here too.
  const choices = plannedLevelChoices(character, { className, source, fromLevel, toLevel, subclassName: picks.subclass?.name }, {
    compendium,
    activeBooks,
  });
  if (bringsClassChoices(choices)) wanted.add("classChoices");
  if (wantsSpellsStep(plannedClassEntry(character, { className, source, toLevel, subclassName: picks.subclass?.name }))) {
    wanted.add("spells");
  }
  const steps = STEP_ORDER.filter((id) => wanted.has(id)).map((id) => ({ id, className, classLevel: toLevel }));

  const conMod = effectiveScores(character).modifiers.con ?? 0;
  const die = hitDieOf({ className, source, level: toLevel });
  const firstLevel = character.classes.length === 0;
  const mode = options.hitPoints?.mode ?? "average";
  let hitPoints: HitPointsPlan;
  if (mode === "roll") {
    const roll = rollDie(die, options.random ?? currentRandom());
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
      picks,
      classChoices: [...choices.choices.proficiencyChoices, ...choices.choices.ruleChoices],
      expertiseMilestones: choices.expertise,
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
  // A stale plan is refused when its class is no longer at fromLevel: applying the same plan twice
  // (a double-tapped Review) changes nothing.
  if ((held?.level ?? 0) !== plan.fromLevel) return character;

  // A rolled level records the die face it rolled before the level is confirmed, so the full heal
  // on level-up fills to the rolled max; `maxHp` adds the current Constitution modifier to the face
  // once the level exists.
  let next = character;
  if (plan.hitPoints.mode === "roll" && plan.hitPoints.roll !== undefined) {
    const held = character.classes.find((c) => sameName(c.className, plan.className));
    next = recordRolledHitPoints(next, held?.className ?? plan.className, plan.toLevel, plan.hitPoints.roll);
  }
  next = confirmLevelUp(next, plan.className, plan.source, fullHeal);
  // A subclass is applied only when the plan has a Subclass step (the class reaches its subclass
  // level without one held) and the Character still holds no subclass, the same conditions the
  // builder's sole-subclass pass applies — including its rule that an integrated catalog is never
  // auto-changed. A plan whose class offers exactly one subclass in the active books takes it.
  const hasSubclassStep = plan.steps.some((s) => s.id === "subclass");
  const heldSubclass = held?.subclassName ?? held?.subclass;
  const subclassPick =
    hasSubclassStep && !heldSubclass
      ? (plan.picks.subclass ??
        (compendium.integrated
          ? undefined
          : (() => {
              const options = subclassOptionsForPlan(plan, { compendium, activeBooks });
              return options.length === 1 ? { name: options[0].name, source: options[0].source } : undefined;
            })()))
      : undefined;
  if (subclassPick) {
    next = changeSubclass(
      next,
      plan.className,
      subclassPick.name,
      subclassPick.source,
      [],
      compendium,
      activeBooks
    );
  }
  // The level's class choices, picked on the plan, applied through the same rule-choice transition the
  // builder uses (a Proficiency Choice pick lands in `proficiencyPicks` through it too).
  for (const choice of plan.classChoices ?? []) {
    for (const option of plan.picks.classChoicePicks?.[choice.id] ?? []) {
      next = pickRuleChoice(next, choice, option, compendium, activeBooks);
    }
  }
  // The level's Expertise picks, through the builder's Expertise toggle once the level exists (it reads the
  // milestone the new level opens); an option the Character already holds is not toggled off again.
  for (const item of plan.picks.expertisePicks ?? []) {
    if (next.chosenExpertise?.some((held) => held.trim().toLowerCase() === item.trim().toLowerCase())) continue;
    next = toggleExpertiseChoice(next, item, { compendium, activeBooks });
  }
  for (const [featureName, enabled] of Object.entries(plan.picks.optionalFeatures ?? {})) {
    if (enabled) next = setOptionalFeatureEnabled(next, featureName, true, compendium, { activeBooks });
  }
  if (plan.picks.asi) {
    next = applyAsiWithHitPoints(
      next,
      { ...plan.picks.asi, className: plan.className, classLevel: plan.toLevel, level: plan.toLevel },
      fullHeal,
      compendium,
      activeBooks
    );
    // The feat's own rule choices (a fighting style, maneuvers, an invocation), read on the updated
    // Character now that it holds the feat, applied through the same rule-choice transition.
    for (const choice of featGrantedRuleChoices(next, activeBooks, compendium)) {
      for (const option of plan.picks.featPicks?.[choice.id] ?? []) {
        next = pickRuleChoice(next, choice, option, compendium, activeBooks);
      }
    }
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

/** The flow's steps as the components read them: only the Class step before a class is picked, the plan's own steps after. */
export function flowSteps(plan: LevelUpPlan | null): LevelUpStep[] {
  if (!plan) return [{ id: "class", className: "", classLevel: 0 }];
  return plan.steps;
}

/** One row of the Class step: a held class with its level change, or a new class at 1, disabled with its missing score. */
export interface LevelUpClassOption {
  className: string;
  source: string;
  held: boolean;
  fromLevel: number;
  toLevel: number;
  /** The unmet multiclass requirement as a short score ("Int 13"), when the class cannot be picked. */
  missingRequirement?: string;
}

/**
 * The Class step's rows: every held class first with the level change it gets, then every other class of
 * the active books at level 1. A new class the multiclass requirements refuse carries only the missing
 * score. Components read this list; the refusal itself is `planLevelUp`'s.
 */
export function classStepOptions(
  character: Character,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): LevelUpClassOption[] {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const classes = catalogListings({ compendium, activeBooks }).classes();
  const { scores } = effectiveScores(character);
  const options: LevelUpClassOption[] = [];
  for (const held of character.classes) {
    options.push({ className: held.className, source: held.source, held: true, fromLevel: held.level, toLevel: held.level + 1 });
  }
  const heldNames = new Set(character.classes.map((c) => c.className.trim().toLowerCase()));
  const seen = new Set<string>();
  for (const cl of classes) {
    const key = cl.name.trim().toLowerCase();
    if (heldNames.has(key) || seen.has(key) || SIDEKICK_CLASSES.has(cl.name)) continue;
    seen.add(key);
    const missing = missingMulticlassRequirement(character, cl.name, scores);
    options.push({
      className: cl.name,
      source: cl.source,
      held: false,
      fromLevel: 0,
      toLevel: 1,
      ...(missing ? { missingRequirement: missing } : {}),
    });
  }
  return options;
}

/** The Hit Die and Constitution modifier a plan's Hit Points pick is computed from. */
function hitPointsInputs(character: Character, plan: LevelUpPlan): { die: number; conMod: number } {
  const die = hitDieOf({ className: plan.className, source: plan.source, level: plan.toLevel });
  const conMod = effectiveScores(character).modifiers.con ?? 0;
  return { die, conMod };
}

/** The fixed average a level adds: the Hit Die's fixed value plus Constitution (the full die at the character's first level). */
export function planAverageHitPoints(plan: LevelUpPlan, character: Character): number {
  const { die, conMod } = hitPointsInputs(character, plan);
  const firstLevel = character.classes.length === 0;
  return Math.max(1, (firstLevel ? die : Math.floor(die / 2) + 1) + conMod);
}

/** Sets the plan's Hit Points pick to the fixed average. The given plan is never mutated. */
export function chooseAverageHitPoints(plan: LevelUpPlan, character: Character): LevelUpPlan {
  return { ...plan, hitPoints: { mode: "average", amount: planAverageHitPoints(plan, character) } };
}

/**
 * Rolls the plan's Hit Die once through the dice module and sets the pick to the roll, never less than 1.
 * Returns the rolled plan and the completed Roll, so the caller can publish it to the Roll Log. The
 * given plan is never mutated.
 */
export function rollPlanHitPoints(
  plan: LevelUpPlan,
  character: Character,
  random: RandomSource = currentRandom()
): { plan: LevelUpPlan; roll: Roll } {
  const { die, conMod } = hitPointsInputs(character, plan);
  const face = rollDie(die, random);
  const roll: Roll = { dice: [{ sides: die, face, dropped: false }], modifier: conMod, total: face + conMod };
  return {
    plan: { ...plan, hitPoints: { mode: "roll", roll: face, amount: Math.max(1, face + conMod) } },
    roll,
  };
}

/**
 * The planned class entry a level's choices are read on: the class at the new level with the subclass the
 * plan picks, or else the subclass the Character holds.
 */
function plannedClassEntry(
  character: Character,
  plan: { className: string; source: string; toLevel: number; subclassName?: string }
): CharacterClass {
  const held = character.classes.find((c) => sameName(c.className, plan.className));
  const subclass = plan.subclassName ?? held?.subclassName ?? held?.subclass;
  return { className: plan.className, source: plan.source, level: plan.toLevel, ...(subclass ? { subclassName: subclass } : {}) };
}

/** Whether a class entry brings the Spells step: a spellcasting class, or a third caster subclass. */
function wantsSpellsStep(entry: CharacterClass): boolean {
  return casterKindOf(entry) !== undefined || isThirdCaster(entry);
}

/** What the planned level brings on its class: the skill and rule choices, the Expertise milestones and the optional features. */
interface PlannedLevelChoices {
  choices: ClassLevelChoices;
  expertise: ExpertiseMilestone[];
  optionalFeatures: OptionalFeatureOption[];
}

/** What the planned level brings, read on the planned class entry through the shared classChoices readers. */
function plannedLevelChoices(
  character: Character,
  plan: { className: string; source: string; fromLevel: number; toLevel: number; subclassName?: string },
  opts: { compendium: Compendium; activeBooks: ActiveBooks }
): PlannedLevelChoices {
  const entry = plannedClassEntry(character, plan);
  return {
    choices: classChoicesAtLevel(character, entry, plan.fromLevel, opts),
    expertise: newExpertiseMilestones(character, entry, opts),
    optionalFeatures: newOptionalFeatures(character, entry, plan.fromLevel, opts),
  };
}

/** Whether the planned level brings anything for the Class Choices step: a choice, an Expertise milestone or an optional feature. */
function bringsClassChoices(levelChoices: PlannedLevelChoices): boolean {
  return (
    hasClassChoices(levelChoices.choices) ||
    levelChoices.expertise.length > 0 ||
    levelChoices.optionalFeatures.length > 0
  );
}

/**
 * Sets the plan's subclass pick and re-derives the level's class choices on the picked subclass: the plan's
 * `classChoices`, the Class Choices step in `steps` (kept in STEP_ORDER), and the picks of choices that are
 * still offered. Hit points, the ASI/Feat pick and the spells are left as they are. The given plan is never mutated.
 */
export function setPlanSubclass(
  character: Character,
  plan: LevelUpPlan,
  name: string,
  source: string,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): LevelUpPlan {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const levelChoices = plannedLevelChoices(
    character,
    { className: plan.className, source: plan.source, fromLevel: plan.fromLevel, toLevel: plan.toLevel, subclassName: name },
    { compendium, activeBooks }
  );
  const classChoices = [...levelChoices.choices.proficiencyChoices, ...levelChoices.choices.ruleChoices];
  const offered = new Set(classChoices.map((choice) => choice.id));
  const classChoicePicks = Object.fromEntries(
    Object.entries(plan.picks.classChoicePicks ?? {}).filter(([choiceId]) => offered.has(choiceId))
  );
  // The Expertise and optional-feature picks of the previous subclass that the new one does not offer go with them.
  const offeredExpertise = new Set(levelChoices.expertise.flatMap((milestone) => milestone.options.map((o) => o.toLowerCase())));
  const expertisePicks = (plan.picks.expertisePicks ?? []).filter((pick) => offeredExpertise.has(pick.toLowerCase()));
  const offeredFeatures = new Set(levelChoices.optionalFeatures.map((option) => option.name));
  const optionalFeatures = Object.fromEntries(
    Object.entries(plan.picks.optionalFeatures ?? {}).filter(([name]) => offeredFeatures.has(name))
  );

  const stepIds = new Set<LevelUpStepId>(plan.steps.map((step) => step.id));
  if (bringsClassChoices(levelChoices)) stepIds.add("classChoices");
  else stepIds.delete("classChoices");
  const spells = wantsSpellsStep(plannedClassEntry(character, { className: plan.className, source: plan.source, toLevel: plan.toLevel, subclassName: name }));
  if (spells) stepIds.add("spells");
  else stepIds.delete("spells");
  const steps = STEP_ORDER.filter((id) => stepIds.has(id)).map((id) => ({ id, className: plan.className, classLevel: plan.toLevel }));

  const next: LevelUpPlan = {
    ...plan,
    steps,
    classChoices,
    expertiseMilestones: levelChoices.expertise,
    picks: { ...plan.picks, subclass: { name, source }, classChoicePicks, expertisePicks, optionalFeatures },
  };
  // Without a Spells step the learned spells go with it; with one, only the spells it still offers stay picked.
  if (!spells) {
    const picks = { ...next.picks };
    delete picks.learnedSpells;
    return { ...next, picks };
  }
  const offeredSpells = new Set(newSpellsForLevelUp(character, next, opts).map((spell) => spell.name.toLowerCase()));
  const learnedSpells = (plan.picks.learnedSpells ?? []).filter((spell) => offeredSpells.has(spell.name.toLowerCase()));
  return { ...next, picks: { ...next.picks, learnedSpells } };
}

/** Sets the plan's ASI/Feat pick. The given plan is never mutated. */
export function setPlanAsi(plan: LevelUpPlan, asi: AsiSelection): LevelUpPlan {
  return { ...plan, picks: { ...plan.picks, asi } };
}

/**
 * Sets the picked options of one of the picked feat's own rule choices (toggling `option` within
 * `choose`). Once the cap is reached a new option is refused — the plan is returned unchanged — while the
 * picked ones stay deselectable. The given plan is never mutated.
 */
export function setPlanFeatPick(plan: LevelUpPlan, choiceId: string, option: string, choose: number): LevelUpPlan {
  const current = plan.picks.featPicks?.[choiceId] ?? [];
  const has = current.some((name) => name.toLowerCase() === option.toLowerCase());
  const cap = Math.max(1, choose);
  if (!has && current.length >= cap) return plan;
  const nextPicks = has ? current.filter((name) => name.toLowerCase() !== option.toLowerCase()) : [...current, option];
  return { ...plan, picks: { ...plan.picks, featPicks: { ...plan.picks.featPicks, [choiceId]: nextPicks } } };
}

/**
 * The rule choices a feat selection grants (a fighting style, maneuvers, an invocation), read on the
 * Character with the selection added to its ASI picks, the same way the builder's ASI/Feat section
 * offers them. Empty for an ASI pick or a feat that grants no rule choice.
 */
export function featSubChoicesForSelection(
  character: Character,
  selection: AsiSelection,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): AvailableRuleChoice[] {
  if (selection.type !== "feat" || !selection.featName) return [];
  return featPickView(character, asiPickOf(selection), opts).subChoices;
}

/** The Feat Slot pick an ASI/Feat selection of the Level-Up Flow stands for. */
function asiPickOf(selection: AsiSelection): FeatSlotPick {
  return {
    slot: {
      kind: "asi",
      className: selection.className ?? "",
      classLevel: selection.classLevel ?? selection.level,
    },
    featName: selection.featName ?? null,
    featSource: selection.featSource,
    featAbility: selection.featAbility,
  };
}

/** The feat sub-choices of the plan's ASI/Feat pick, read on the Character with the pick added. */
export function asiFeatSubChoices(
  plan: LevelUpPlan,
  character: Character,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): AvailableRuleChoice[] {
  const asi = plan.picks.asi;
  if (!asi) return [];
  return featSubChoicesForSelection(character, asi, opts);
}

/**
 * Whether the plan's feat pick still misses its ability increase: a feat offering +1 to one of several
 * abilities is incomplete until one is chosen.
 */
export function asiFeatAbilityPending(
  asi: AsiSelection,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): boolean {
  if (asi.type !== "feat" || !asi.featName) return false;
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const feat = findFeat(asi.featName, asi.featSource, compendium, activeBooks);
  return featIncreaseOptions(feat).type === "choice" && !asi.featAbility;
}

/** What the ASI/Feat step shows, derived from the plan's pick alone. */
export interface AsiFeatStepView {
  /** The tab the step opens on: the feat tab when the plan holds a feat, the ASI tab otherwise. */
  tab: "asi" | "feat";
  asiMode: "plus2" | "plus1plus1";
  plus2Pick: AbilityKey | null;
  plus1Picks: AbilityKey[];
  featName: string | null;
  selectedFeat: FeatData | null;
  featAbility: AbilityKey | null;
  featAbilityOptions: FeatAbilityBonusOptions;
  subChoices: AvailableRuleChoice[];
}

/**
 * The ASI/Feat step's whole selection, derived from `plan.picks.asi` alone. The step only renders
 * while it is open, so it remounts when the player leaves it and returns (or switches class and
 * comes back), and nothing of the selection may live in component state: the plan is the source of
 * truth, so a remounted step shows the picked feat, its ability, its sub-choices and the ASI picks
 * again exactly as the plan holds them — a half-finished ASI pick included, never a stale feat.
 */
export function asiFeatStepView(
  plan: LevelUpPlan,
  character: Character,
  feats: FeatData[] = [],
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): AsiFeatStepView {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const asi = plan.picks.asi;
  if (asi?.type === "feat" && asi.featName) {
    const featName = asi.featName;
    const matches = (f: FeatData) => sameName(f.name, featName) && (!asi.featSource || f.source === asi.featSource);
    const feat = feats.find(matches) ?? findFeat(featName, asi.featSource, compendium, activeBooks);
    const featAbilityOptions = featIncreaseOptions(feat);
    const featAbility = asi.featAbility ?? (featAbilityOptions.type === "fixed" ? featAbilityOptions.abilities[0] : null);
    return {
      tab: "feat",
      asiMode: "plus2",
      plus2Pick: null,
      plus1Picks: [],
      featName,
      selectedFeat: feat,
      featAbility,
      featAbilityOptions,
      subChoices: asiFeatSubChoices(plan, character, { compendium, activeBooks }),
    };
  }
  const entries = Object.entries(asi?.asi ?? {}) as [string, number][];
  const plus2Pick = (entries.find(([, value]) => value >= 2)?.[0] ?? null) as AbilityKey | null;
  const plus1Picks = entries.filter(([, value]) => value === 1).map(([key]) => key as AbilityKey);
  return {
    tab: "asi",
    asiMode: plus2Pick ? "plus2" : plus1Picks.length > 0 ? "plus1plus1" : "plus2",
    plus2Pick,
    plus1Picks,
    featName: null,
    selectedFeat: null,
    featAbility: null,
    featAbilityOptions: { type: "none", abilities: [], amount: 0 },
    subChoices: [],
  };
}

/** Adds or removes a learned spell on the plan. The given plan is never mutated. */
export function togglePlanSpell(plan: LevelUpPlan, spell: { name: string; source: string }): LevelUpPlan {
  const current = plan.picks.learnedSpells ?? [];
  const has = current.some((s) => sameName(s.name, spell.name));
  const learnedSpells = has ? current.filter((s) => !sameName(s.name, spell.name)) : [...current, spell];
  return { ...plan, picks: { ...plan.picks, learnedSpells } };
}

/**
 * Sets the picked options of one of the plan's class choices (toggling `option` within `choose`). The
 * given plan is never mutated.
 */
export function setPlanClassChoicePick(plan: LevelUpPlan, choiceId: string, option: string, choose: number): LevelUpPlan {
  const current = plan.picks.classChoicePicks?.[choiceId] ?? [];
  const has = current.some((name) => name.toLowerCase() === option.toLowerCase());
  let next: string[];
  if (has) next = current.filter((name) => name.toLowerCase() !== option.toLowerCase());
  else next = [...current, option].slice(0, Math.max(1, choose));
  return { ...plan, picks: { ...plan.picks, classChoicePicks: { ...plan.picks.classChoicePicks, [choiceId]: next } } };
}

/**
 * Toggles one Expertise option on the plan's new milestones. An option no milestone has a free slot for is refused:
 * the plan is returned unchanged. The given plan is never mutated.
 */
export function setPlanExpertisePick(plan: LevelUpPlan, option: string): LevelUpPlan {
  const current = plan.picks.expertisePicks ?? [];
  const has = current.some((name) => name.toLowerCase() === option.toLowerCase());
  if (has) {
    const expertisePicks = current.filter((name) => name.toLowerCase() !== option.toLowerCase());
    return { ...plan, picks: { ...plan.picks, expertisePicks } };
  }
  const next = [...current, option];
  const placed = getMilestonePicks(plan.expertiseMilestones ?? [], next).some(({ chosen }) =>
    chosen.some((name) => name.toLowerCase() === option.toLowerCase())
  );
  if (!placed) return plan;
  return { ...plan, picks: { ...plan.picks, expertisePicks: next } };
}

/** Sets whether the level's optional feature is enabled on the plan. The given plan is never mutated. */
export function setPlanOptionalFeature(plan: LevelUpPlan, name: string, enabled: boolean): LevelUpPlan {
  return { ...plan, picks: { ...plan.picks, optionalFeatures: { ...plan.picks.optionalFeatures, [name]: enabled } } };
}

/** Removes every pick of one of the plan's class choices. The given plan is never mutated. */
export function clearPlanClassChoicePick(plan: LevelUpPlan, choiceId: string): LevelUpPlan {
  const classChoicePicks = { ...plan.picks.classChoicePicks };
  delete classChoicePicks[choiceId];
  return { ...plan, picks: { ...plan.picks, classChoicePicks } };
}

/**
 * The Class Choices step's view of the plan's new level, read the way `planLevelUp` reads the level's choices: the
 * planned class entry with the subclass the character holds, after the level before the plan's.
 */
export function levelUpClassChoicesView(
  character: Character,
  plan: LevelUpPlan,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): ClassChoicesStepView {
  const entry = plannedClassEntry(character, {
    className: plan.className,
    source: plan.source,
    toLevel: plan.toLevel,
    subclassName: plan.picks.subclass?.name,
  });
  return classChoicesLevelView(character, entry, plan.fromLevel, opts, plan.picks.expertisePicks ?? []);
}

/** The subclasses a class offers in the active books. */
export function subclassOptions(
  className: string,
  source: string,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): { name: string; source: string }[] {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const classes = allCatalogClasses({ compendium, activeBooks });
  const cd = findClassData(classes, { className, source });
  const upper = activeBooks.map((b) => b.toUpperCase());
  return (cd?.subclasses ?? [])
    // The SRD Baseline's records count as active whatever books are switched on.
    .filter((sub) => !sub.source || sub.source.toUpperCase() === SRD_SOURCE || upper.includes(sub.source.toUpperCase()))
    .map((sub) => ({ name: sub.name, source: sub.source }));
}

/** The subclasses the planned class offers at the new level in the active books. */
export function subclassOptionsForPlan(
  plan: LevelUpPlan,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): { name: string; source: string }[] {
  return subclassOptions(plan.className, plan.source, opts);
}

/**
 * Whether a plan step's own requirement is met, so the flow can advance past it: Class needs a picked
 * class (a plan), Subclass a pick (a single offered subclass is pre-selected as the pick by `planLevelUp`),
 * ASI/Feat a pick with its sub-choices made (the feat's ability increase when it offers a choice, and
 * every rule choice the feat grants fully picked), Class Choices every choice fully picked, Review every
 * step before it. Hit Points and Spells are always complete. The ASI/Feat sub-choices are read on
 * `opts.character` with the pick added.
 */
export function levelUpStepComplete(
  plan: LevelUpPlan | null,
  stepId: LevelUpStepId,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks; character?: Character } = {}
): boolean {
  if (!plan) return false;
  switch (stepId) {
    case "class":
      return true;
    case "hitPoints":
      return true;
    case "subclass":
      return plan.picks.subclass !== undefined;
    case "asiFeat": {
      const asi = plan.picks.asi;
      if (!asi) return false;
      if (asi.type === "feat") {
        if (asiFeatAbilityPending(asi, opts)) return false;
        if (opts.character) {
          return asiFeatSubChoices(plan, opts.character, opts).every(
            (choice) => (plan.picks.featPicks?.[choice.id] ?? []).length >= choice.choose
          );
        }
        return true;
      }
      // A plain ASI is complete only once both improvement points are placed (+2 to one or +1 to
      // two); a half-finished +1/+1 pick stays incomplete, like a feat missing its ability.
      const placed = Object.values(asi.asi ?? {}).reduce((sum, value) => sum + value, 0);
      return placed >= 2;
    }
    case "classChoices":
      return (
        (plan.classChoices ?? []).every((choice) => (plan.picks.classChoicePicks?.[choice.id] ?? []).length >= choice.choose) &&
        expertiseFilled(getMilestonePicks(plan.expertiseMilestones ?? [], plan.picks.expertisePicks ?? []))
      );
    case "spells":
      return true;
    case "review":
      return plan.steps.filter((s) => s.id !== "review").every((s) => levelUpStepComplete(plan, s.id, opts));
  }
}

/** One label/value row of the Review step. */
export interface LevelUpSummaryRow {
  label: string;
  value: string;
}

/**
 * The Review step's rows: what the confirmed plan changes, with level and hit points before → after,
 * read by applying the plan to a copy. The given Character is never mutated.
 */
export function levelUpSummary(
  plan: LevelUpPlan,
  character: Character,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks; fullHealOnLevelUp?: boolean } = {}
): LevelUpSummaryRow[] {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const applied = applyLevelUpPlan(character, plan, { ...opts, compendium, activeBooks });
  const held = character.classes.some((c) => sameName(c.className, plan.className));
  const { die, conMod } = hitPointsInputs(character, plan);
  const rows: LevelUpSummaryRow[] = [
    {
      label: "Class",
      value: held ? `${plan.className} ${plan.fromLevel} → ${plan.toLevel}` : `${plan.className} ${plan.toLevel} (new)`,
    },
    { label: "Level", value: `${totalLevel(character)} → ${totalLevel(applied)}` },
    { label: "Hit points", value: `${maxHp(character)} → ${maxHp(applied)}` },
    {
      label: "Hit points method",
      value:
        plan.hitPoints.mode === "roll" && plan.hitPoints.roll !== undefined
          ? `Roll 1d${die}${formatModifier(conMod)}: ${plan.hitPoints.roll} → +${plan.hitPoints.amount}`
          : `Average +${plan.hitPoints.amount}`,
    },
  ];
  if (plan.picks.subclass) rows.push({ label: "Subclass", value: plan.picks.subclass.name });
  if (plan.picks.asi) {
    const asi = plan.picks.asi;
    rows.push({
      label: "ASI/Feat",
      value:
        asi.type === "feat"
          ? asi.featName ?? ""
          : Object.entries(asi.asi ?? {})
              .map(([key, value]) => `${key.toUpperCase()} +${value}`)
              .join(", "),
    });
  }
  for (const choice of asiFeatSubChoices(plan, character, opts)) {
    const picked = plan.picks.featPicks?.[choice.id] ?? [];
    if (picked.length > 0) rows.push({ label: choice.traitName, value: picked.join(", ") });
  }
  for (const choice of plan.classChoices ?? []) {
    const picked = plan.picks.classChoicePicks?.[choice.id] ?? [];
    if (picked.length > 0) rows.push({ label: choice.traitName, value: picked.join(", ") });
  }
  const expertise = getMilestonePicks(plan.expertiseMilestones ?? [], plan.picks.expertisePicks ?? []).flatMap((p) => p.chosen);
  if (expertise.length > 0) rows.push({ label: "Expertise", value: expertise.join(", ") });
  const features = Object.entries(plan.picks.optionalFeatures ?? {})
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  if (features.length > 0) rows.push({ label: "Optional & Replacement Class Features", value: features.join(", ") });
  if (plan.picks.learnedSpells?.length) {
    rows.push({ label: "Spells", value: plan.picks.learnedSpells.map((s) => s.name).join(", ") });
  }
  return rows;
}

/**
 * The spells the new level makes available: every spell of the planned class at or under its new maximum
 * spell level that the Character does not already know. Read through the same availability rules the
 * Spells tab uses.
 */
export function newSpellsForLevelUp(
  character: Character,
  plan: LevelUpPlan,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): SpellData[] {
  return levelUpLearnableSpells(character, plan, opts).spells;
}

/**
 * The planned class's learnable spells at the new level, with the restricted schools the Spells step
 * shows as a toggle. An empty list when the planned class has no Spell Owner.
 */
export function levelUpLearnableSpells(
  character: Character,
  plan: LevelUpPlan,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): LearnableSpells {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const classes = allCatalogClasses({ compendium, activeBooks });
  const atLevel: CharacterClass = {
    className: plan.className,
    source: plan.source,
    level: plan.toLevel,
    ...(plan.picks.subclass ? { subclassName: plan.picks.subclass.name, subclassSource: plan.picks.subclass.source } : {}),
  };
  const index = character.classes.findIndex((c) => sameName(c.className, plan.className));
  const planned: Character = {
    ...character,
    classes:
      index === -1
        ? [...character.classes, atLevel]
        : character.classes.map((c, i) => (i === index ? atLevel : c)),
  };
  const profile = getClassSpellProfiles(planned, { activeBooks, compendium, classes }).find((p) =>
    sameName(p.className, plan.className)
  );
  if (!profile) return { spells: [], restrictedSchools: [] };
  return learnableSpells(planned, profile, { compendium, activeBooks });
}
