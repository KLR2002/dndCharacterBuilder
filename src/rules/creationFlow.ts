import type { ActiveBooks } from "../constants/books.ts";
import type { AsiSelection, Character, CharacterClass, CreationProgress, CreationStepId } from "../types/character.ts";
import type { ClassData, RaceData, SubraceData } from "../types/dnd5e.ts";
import { POINT_BUY_COST } from "../constants/rules.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { allCatalogClasses, allCatalogRaces, type CharacterCatalogs } from "./catalogs.ts";
import { heldClass } from "./classData.ts";
import { ABILITIES } from "./abilities.ts";
import { applyAsiSelection, asiLevels, getPendingLevelChoices, removeAsiSelection, subclassLevel } from "./leveling.ts";
import { getSubclassName } from "./ruleChoices.ts";
import { classChoicesAtLevel, hasClassChoices, type ClassLevelChoices } from "./classChoices.ts";
import { findHeldRace } from "./raceLookup.ts";
import { isCastingClass } from "./spellcasting.ts";
import { hasStartingEquipmentChoices } from "./startingEquipment.ts";
import { picksOfFirstClass } from "./startingEquipmentPicks.ts";
import {
  addMulticlassLevel,
  changeSubclass,
  clearBackground,
  removeClassLevel,
} from "./builderTransitions.ts";
import { applyAncestrySelection } from "./ancestryEngine.ts";
import { reconcile } from "./characterReconciler.ts";
import { maxHp } from "./hp.ts";
import { followRaisedMaxHp, fullHealAtLevelUp } from "./hitPoints.ts";

/**
 * The Creation Flow's steps, in the order the flow walks them: identity first (class, subclass, ancestry),
 * then the rest, name last. A step the character does not qualify for is skipped, so it never appears in
 * `applicableCreationSteps`. Creation builds a single class; Multiclassing enters only through the Level-Up
 * Flow.
 */
export const CREATION_STEP_ORDER: readonly CreationStepId[] = [
  "class",
  "subclass",
  "race",
  "subrace",
  "background",
  "abilities",
  "classChoices",
  "asiFeats",
  "spells",
  "equipment",
  "details",
  "review",
];

/** The catalogs the flow reads: defaults to the process-wide Compendium, unscoped. */
export interface CreationFlowOptions {
  compendium?: Compendium;
  activeBooks?: ActiveBooks;
}

/**
 * The Class step's offer: one class with a starting level from 1 to 20 defaulting to 1. Creation builds a
 * single class, so the offer carries no add-class action; Multiclassing enters only through the Level-Up
 * Flow.
 */
export interface ClassStepOffer {
  startingLevel: { min: number; max: number; default: number };
  canAddClass: false;
}

export function classStepOffer(): ClassStepOffer {
  return { startingLevel: { min: 1, max: 20, default: 1 }, canAddClass: false };
}

/**
 * How the build flow at `/build/<id>` was entered: Edit Build reopens a finished Character's flow to change its
 * picks, while the Level up path keeps the controls that add levels and classes. The Class step reads its
 * offer from `classStepModeOffer`.
 */
export type BuildFlowMode = "edit" | "levelup";

/**
 * What the Class step offers in each build-flow mode. Edit Build lowers a held class's level (releasing that
 * level's picks) but offers no way to raise a level or add a class; only Level up adds.
 */
export interface ClassStepModeOffer {
  canLowerLevel: boolean;
  canRaiseLevel: boolean;
  canAddClass: boolean;
}

export function classStepModeOffer(mode: BuildFlowMode): ClassStepModeOffer {
  if (mode === "levelup") return { canLowerLevel: true, canRaiseLevel: true, canAddClass: true };
  return { canLowerLevel: true, canRaiseLevel: false, canAddClass: false };
}

/**
 * The lowest level a held class can be lowered to in the given build-flow mode, by the class's index in
 * `classes`: 0 means lowering below 1 removes the class through `removeClassLevel`. Edit Build lowers a
 * class that is not the first below 1, removing it; the first class stays at least 1. Outside Edit Build
 * (the Level up path, the free-form builder, a draft) any class may be lowered to removal.
 */
export function classStepMinLevel(mode: BuildFlowMode | undefined, classIndex: number): number {
  if (mode === "edit") return classIndex > 0 ? 0 : 1;
  return 0;
}

/** Options of the step-change functions: `editBuild` records the change on a finished Character in Edit Build. */
export interface ApplyStepOptions extends CreationFlowOptions {
  /**
   * Edit Build: the Character is finished and stays finished; the released later steps are flagged in its
   * creation-progress record with the `editBuild` marker instead of re-anchoring it as a draft.
   */
  editBuild?: boolean;
}

export type CreationStepStatus = "finished" | "current" | "locked";

export interface CreationStep {
  id: CreationStepId;
  status: CreationStepStatus;
  /** Whether the step's own requirement is met. A later step stays locked until the current one is valid. */
  valid: boolean;
  /** An earlier step's change released this step's picks; it must be finished again. */
  needsAttention: boolean;
}

/**
 * A draft is a character whose creation progress is recorded. Absent means the character is finished, so a
 * save from the old builder counts as finished without a rewrite. A record marked `editBuild` is a finished
 * Character reopened in Edit Build: its attention marks ride along, but the character stays finished.
 */
export function isCreationFinished(character: Character): boolean {
  const progress = character.creationProgress;
  return progress === undefined || progress.editBuild === true;
}

/**
 * The step a draft is on: the recorded one while it still applies, else the first applicable step from its
 * position in the flow (an earlier pick can have removed the recorded step).
 */
function resolveCurrentStep(character: Character, applicable: readonly CreationStepId[]): CreationStepId {
  const recorded = character.creationProgress?.currentStep;
  if (recorded && applicable.includes(recorded)) return recorded;
  const recordedIndex = CREATION_STEP_ORDER.indexOf(recorded ?? "class");
  return applicable.find((id) => CREATION_STEP_ORDER.indexOf(id) >= recordedIndex) ?? applicable[applicable.length - 1];
}

/**
 * The step a draft resumes at, or null when the character is finished (no creation progress recorded).
 */
export function currentCreationStep(character: Character, opts: CreationFlowOptions = {}): CreationStepId | null {
  if (isCreationFinished(character)) return null;
  return resolveCurrentStep(character, applicableCreationSteps(character, opts));
}

/**
 * The applicable Creation Steps with their status: finished before the current step (revisitable), the
 * current step itself, locked after it. A finished character reports every applicable step as finished.
 */
export function creationSteps(character: Character, opts: CreationFlowOptions = {}): CreationStep[] {
  const applicable = applicableCreationSteps(character, opts);
  const current = isCreationFinished(character) ? null : resolveCurrentStep(character, applicable);
  const currentIndex = current === null ? -1 : applicable.indexOf(current);
  return applicable.map((id, index) => {
    let status: CreationStepStatus;
    if (current === null || index < currentIndex) status = "finished";
    else if (index === currentIndex) status = "current";
    else status = "locked";
    return { id, status, valid: isCreationStepValid(character, id, opts), needsAttention: creationStepNeedsAttention(character, id) };
  });
}

/**
 * Whether a Creation Step is marked as needing attention: a change on an earlier step released picks the step
 * held, and the mark stays until the step is finished again.
 */
export function creationStepNeedsAttention(character: Character, step: CreationStepId): boolean {
  return character.creationProgress?.needsAttention?.includes(step) ?? false;
}

/** The point-buy budget a creation's base scores may spend (2014 rules). */
const POINT_BUY_BUDGET = 27;

/**
 * Whether the Abilities step's method is fully picked: the whole standard array, scores within point buy,
 * or — for rolled — six rolled results with every one placed on an ability. Manual asks for nothing.
 */
function abilitiesValid(character: Character): boolean {
  if (character.abilityMethod === "standardArray") {
    const picks = character.standardArrayPicks ?? {};
    return ABILITIES.every((ability) => typeof picks[ability] === "number");
  }
  if (character.abilityMethod === "pointBuy") {
    let spent = 0;
    for (const ability of ABILITIES) {
      const score = character.baseAbilityScores?.[ability] ?? 8;
      if (score < 8 || score > 15) return false;
      spent += POINT_BUY_COST[score] ?? 0;
    }
    return spent <= POINT_BUY_BUDGET;
  }
  if (character.abilityMethod === "rolled") {
    const results = character.rolledAbilities ?? [];
    const picks = character.rolledAbilityPicks ?? {};
    return (
      results.length === 6 &&
      ABILITIES.every((ability) => {
        const index = picks[ability];
        return typeof index === "number" && Number.isInteger(index) && index >= 0 && index < results.length;
      })
    );
  }
  return true;
}

/**
 * Whether a Creation Step's own requirement is met, so the flow can advance past it. A step the character
 * does not qualify for is valid by vacuity. Details asks only for a name: gender and alignment may stay
 * empty. Review is valid when every step before it is.
 */
export function isCreationStepValid(
  character: Character,
  step: CreationStepId,
  opts: CreationFlowOptions = {},
): boolean {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks;
  const catalogs: CharacterCatalogs = { compendium, activeBooks };
  const classes = allCatalogClasses(catalogs);
  const races = allCatalogRaces(catalogs);
  const entries = character.classes ?? [];
  switch (step) {
    case "class":
      return entries.length >= 1 && entries.every((entry) => entry.level >= 1 && entry.level <= 20);
    case "subclass":
      return entries.every((entry) => !offersSubclass(entry, classes) || getSubclassName(entry).length > 0);
    case "race":
      return character.race != null;
    case "subrace": {
      if (!offersSubrace(character, races, activeBooks)) return true;
      return findHeldRace(races, character.race, activeBooks).subrace != null;
    }
    case "background":
      return character.background != null;
    case "abilities":
      return abilitiesValid(character);
    case "classChoices": {
      const choices = classChoicesOf(character, opts);
      if (!hasClassChoices(choices)) return true;
      return choices.allPicked;
    }
    case "asiFeats":
      return !offersAsiFeats(entries) || getPendingLevelChoices(character, [...classes]).pendingAsi.length === 0;
    case "spells":
      return true;
    case "equipment":
      return character.startingOption === "gold" || !hasStartingEquipmentChoices(character, catalogs) ||
        picksOfFirstClass(character) !== undefined;
    case "details":
      return character.name.trim().length > 0;
    case "review":
      return applicableCreationSteps(character, opts)
        .filter((id) => id !== "review")
        .every((id) => isCreationStepValid(character, id, opts));
  }
}

/** The one class a creation builds: the first entry, while the character holds at most one. */
function classEntryOf(character: Character): CharacterClass | undefined {
  return character.classes?.[0];
}

/**
 * Whether the Subclass step applies: the class's level has reached its subclass level and the catalog does
 * not hold the class with an empty subclass list (the same check `getPendingLevelChoices` makes).
 */
function offersSubclass(entry: CharacterClass | undefined, classes: readonly ClassData[]): boolean {
  if (!entry) return false;
  if (entry.level < subclassLevel(entry.className)) return false;
  const held = heldClass(entry, classes);
  if (held && Array.isArray(held.subclasses) && held.subclasses.length === 0) return false;
  return true;
}

/**
 * Whether the Subrace step applies: the held race resolves to a catalog record that lists more than one
 * subrace, the same threshold the ancestry section uses to offer a subrace picker.
 */
function offersSubrace(character: Character, races: readonly RaceData[], activeBooks: ActiveBooks): boolean {
  const { race } = findHeldRace(races, character.race, activeBooks);
  return Boolean(race && (race.subraces?.length ?? 0) > 1);
}

/**
 * The choices every held class brings at its level, read from the one shared module the Level-Up Flow
 * reads too. Creation builds from level 0, so every choice each class brings up to its held level is
 * listed; every class offers skill picks at level 1, so the step applies to every new character.
 * Ancestry, background and feat picks belong to their own steps, so they are left out.
 */
function classChoicesOf(character: Character, opts: CreationFlowOptions): ClassLevelChoices {
  const entries = character.classes ?? [];
  if (entries.length === 0) return { skillChoices: [], proficiencyChoices: [], ruleChoices: [], allPicked: true };
  const query = { compendium: opts.compendium ?? currentCompendium(), activeBooks: opts.activeBooks };
  const combined = entries.map((entry) => classChoicesAtLevel(character, entry, 0, query));
  return {
    skillChoices: combined.flatMap((choices) => choices.skillChoices),
    proficiencyChoices: combined.flatMap((choices) => choices.proficiencyChoices),
    ruleChoices: combined.flatMap((choices) => choices.ruleChoices),
    allPicked: combined.every((choices) => choices.allPicked),
  };
}

/** Whether the ASI/Feats step applies: any held class's level has reached one of its ASI levels. */
function offersAsiFeats(entries: readonly CharacterClass[]): boolean {
  return entries.some((entry) => asiLevels(entry.className).some((level) => entry.level >= level));
}

/** Whether the Spells step applies: any held class holds a Spellcasting Profile at its level, a subclass's included. */
function offersSpells(entries: readonly CharacterClass[], classes: readonly ClassData[]): boolean {
  return entries.some((entry) => isCastingClass(entry, classes));
}

/**
 * The Creation Steps that apply to the character, in flow order, skipping the ones it does not qualify for.
 * Step order and skipping are decided here only; components read this list and never decide it.
 */
export function applicableCreationSteps(character: Character, opts: CreationFlowOptions = {}): CreationStepId[] {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks;
  const classes = allCatalogClasses({ compendium, activeBooks });
  const races = allCatalogRaces({ compendium, activeBooks });
  const entries = character.classes ?? [];
  const steps: CreationStepId[] = ["class"];
  if (entries.some((entry) => offersSubclass(entry, classes))) steps.push("subclass");
  steps.push("race");
  if (offersSubrace(character, races, activeBooks)) steps.push("subrace");
  steps.push("background", "abilities");
  if (hasClassChoices(classChoicesOf(character, opts))) steps.push("classChoices");
  if (offersAsiFeats(entries)) steps.push("asiFeats");
  if (offersSpells(entries, classes)) steps.push("spells");
  steps.push("equipment", "details", "review");
  return steps;
}

/**
 * A pick on an earlier Creation Step changing: the class above all, also the subclass, the ancestry and the
 * background. Each change is applied through the builder's own transitions (`removeClassLevel`,
 * `addMulticlassLevel`, `changeSubclass`, `applyAncestrySelection`, `clearBackground`, `removeAsiSelection`,
 * `applyAsiSelection`), which all end in the Character Reconciler, so there is no second release path.
 */
export type CreationStepChange =
  | { step: "class"; className: string; source: string; level?: number }
  | { step: "subclass"; subclassName: string; subclassSource: string }
  | { step: "race"; race: RaceData; subrace?: SubraceData }
  | { step: "subrace"; race: RaceData; subrace: SubraceData }
  | { step: "background"; background: { name: string; source: string } | null };

/**
 * Releases a starting-grant claim the old first class's kit or gold was granted under: the `start_` items leave
 * the inventory, the granted gold leaves the pouch, and the claim markers reset to the unequipped option, so
 * the Equipment step has to be finished again. Unchanged when no claim was made.
 */
function releaseStartingGrantClaim(character: Character): Character {
  if (!character.startingGrantsApplied && character.startingEquipmentPicks === undefined) return character;
  const items = (character.items ?? []).filter((item) => !item.id.startsWith("start_"));
  const grantedGold = character.startingGrantedGold ?? 0;
  const pouch = { ...(character.pouch ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }) };
  if (grantedGold > 0) pouch.gp = Math.max(0, (pouch.gp ?? 0) - grantedGold);
  return {
    ...character,
    items,
    pouch,
    startingOption: "equipment",
    startingGrantsApplied: false,
    startingGrantedGold: undefined,
  };
}

/**
 * Changes the character's one creation class to `className` at `level` (the current level unless given). The
 * old class is removed level by level through `removeClassLevel` — its last level drops the class with its
 * skill picks and tears its subclass down — and the new one is added level by level through
 * `addMulticlassLevel`. ASI/Feat picks beyond the new class's levels are released through `removeAsiSelection`;
 * the ones still in range are re-recorded under the new class through `applyAsiSelection`. A starting-grant
 * claim made for the old class is released. Ends reconciled.
 */
function changeCreationClass(
  character: Character,
  change: { className: string; source: string; level?: number },
  compendium: Compendium,
  activeBooks: ActiveBooks,
  catalogs: CharacterCatalogs,
): Character {
  const old = classEntryOf(character);
  const newLevel = change.level ?? old?.level ?? classStepOffer().startingLevel.default;
  const sameClass = Boolean(old && old.className.toLowerCase() === change.className.toLowerCase());
  let next = character;

  if (old && !sameClass) {
    let remaining = old.level;
    while (next.classes.some((c) => c.className === old.className) && remaining-- > 0) {
      next = removeClassLevel(next, old.className, compendium, activeBooks);
    }
  }
  if (!sameClass) {
    for (let level = 1; level <= newLevel; level++) {
      next = addMulticlassLevel(next, change.className, change.source, catalogs);
    }
  } else if (old) {
    let current = old.level;
    while (current > newLevel) {
      next = removeClassLevel(next, old.className, compendium, activeBooks);
      current--;
    }
    while (current < newLevel) {
      next = addMulticlassLevel(next, old.className, old.source, catalogs);
      current++;
    }
  }

  // The ASI/Feat picks of the old class: each is dropped through removeAsiSelection, and the ones still within
  // the new class's levels are re-recorded under its name, so they keep counting for it.
  const selections = [...(next.asiSelections ?? [])];
  for (const selection of selections) {
    const level = selection.classLevel ?? selection.level;
    const owner = selection.className ?? next.classes[0]?.className ?? change.className;
    next = removeAsiSelection(next, owner, level, compendium, activeBooks);
  }
  for (const selection of selections) {
    const level = selection.classLevel ?? selection.level;
    if (asiLevels(change.className).includes(level) && level <= newLevel) {
      const reOwned: AsiSelection = { ...selection, className: change.className, classLevel: level, level };
      next = applyAsiSelection(next, reOwned, compendium, activeBooks);
    }
  }

  if (old && !sameClass) {
    next = releaseStartingGrantClaim(next);
  }
  const reconciled = reconcile(next, compendium, { activeBooks });
  // A draft is at full HP, so a starting level above 1 lifts current HP with the raised max instead of
  // leaving the draft wounded.
  const followed = followRaisedMaxHp(
    { currentHp: reconciled.currentHp, tempHp: reconciled.tempHp },
    maxHp(character),
    maxHp(reconciled),
  );
  return { ...reconciled, ...followed };
}

/** The class-origin picks the Class Choices step holds: its skill choices and its class/subclass rule choices. */
function classChoiceSignature(character: Character): string {
  return JSON.stringify([
    (character.skillChoices ?? []).filter((sc) => sc.origin === "class"),
    (character.ruleChoices ?? []).filter((rc) => rc.origin === "class" || rc.origin === "subclass"),
  ]);
}

function spellsSignature(character: Character): string {
  return JSON.stringify([character.knownSpells ?? [], character.preparedSpells ?? []]);
}

/** The picks the Equipment step holds: its option, its stored picks, the claim markers and the granted items. */
function equipmentSignature(character: Character): string {
  return JSON.stringify([
    character.startingOption,
    character.startingEquipmentPicks ?? null,
    character.startingGrantsApplied ?? null,
    character.startingGrantedGold ?? null,
    (character.items ?? []).filter((item) => item.id.startsWith("start_")),
  ]);
}

/** The held subclass picks of a character: a change that drops one released it. */
function heldSubclassCount(character: Character): number {
  return (character.classes ?? []).filter((c) => (c.subclassName ?? c.subclass ?? "").length > 0).length;
}

/**
 * The later steps a change at `changedStep` leaves needing attention: only the applicable later steps whose
 * stored picks the change released — a held subclass dropped, the ancestry record the subrace pick lives on
 * replaced, class choices dropped, ASI/Feat picks removed, spells or the starting-equipment claim gone with
 * the old pick. A step that is merely invalid is not flagged. Review is flagged when a release also left it
 * invalid, since it then has to be confirmed again.
 */
function computeNeedsAttention(
  before: Character,
  after: Character,
  changedStep: CreationStepId,
  opts: CreationFlowOptions,
): CreationStepId[] {
  const changedIndex = CREATION_STEP_ORDER.indexOf(changedStep);
  const applicable = new Set(applicableCreationSteps(after, opts));
  const released: Partial<Record<CreationStepId, boolean>> = {
    subclass: heldSubclassCount(before) > heldSubclassCount(after),
    subrace: JSON.stringify(before.race ?? null) !== JSON.stringify(after.race ?? null),
    classChoices: classChoiceSignature(before) !== classChoiceSignature(after),
    asiFeats: JSON.stringify(before.asiSelections ?? []) !== JSON.stringify(after.asiSelections ?? []),
    spells: spellsSignature(before) !== spellsSignature(after),
    equipment: equipmentSignature(before) !== equipmentSignature(after),
  };
  const flagged: CreationStepId[] = [];
  for (const id of CREATION_STEP_ORDER) {
    if (CREATION_STEP_ORDER.indexOf(id) <= changedIndex || !applicable.has(id)) continue;
    if (released[id]) flagged.push(id);
  }
  if (
    flagged.length > 0 &&
    applicable.has("review") &&
    CREATION_STEP_ORDER.indexOf("review") > changedIndex &&
    !isCreationStepValid(after, "review", opts)
  ) {
    flagged.push("review");
  }
  return flagged;
}

/**
 * Applies a change of a pick on an earlier Creation Step. The step's own transition releases the picks it
 * invalidates through `builderTransitions` and the Character Reconciler; the later steps that lost picks or
 * turned invalid are recorded as needing attention in the creation progress, and the draft sits on the
 * changed step again, so the later steps stay locked until it is finished. Picks the change does not affect
 * (the ancestry, the background, the abilities when the class changes) are kept. The given Character is never
 * mutated.
 */
export function applyCreationStepChange(
  character: Character,
  change: CreationStepChange,
  opts: ApplyStepOptions = {},
): Character {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks;
  const catalogs: CharacterCatalogs = { compendium, activeBooks };

  let next: Character;
  switch (change.step) {
    case "class":
      next = changeCreationClass(character, change, compendium, activeBooks, catalogs);
      break;
    case "subclass": {
      const entry = classEntryOf(character);
      if (!entry) return character;
      next = changeSubclass(character, entry.className, change.subclassName, change.subclassSource, [], compendium, activeBooks);
      break;
    }
    case "race":
    case "subrace":
      next = applyAncestrySelection(character, change.race, change.subrace, catalogs);
      break;
    case "background": {
      // clearBackground releases the old background's grants and clears its saved tool and language buckets.
      const base = character.background ? clearBackground(character, catalogs) : character;
      next =
        change.background === null
          ? base
          : reconcile(
              { ...base, background: { name: change.background.name, source: change.background.source } },
              compendium,
              { activeBooks },
            );
      break;
    }
  }

  return applyCreationStepEdit(character, change.step, () => next, opts);
}

/**
 * Applies an edit made on a Creation Step through the step's own transition (`edit` returns the character after
 * it), then records the step's change the same way `applyCreationStepChange` does: the later steps that lost
 * picks or turned invalid are marked as needing attention, and the draft sits on the changed step again, so the
 * later steps stay locked until it is finished. The given Character is never mutated.
 */
export function applyCreationStepEdit(
  character: Character,
  step: CreationStepId,
  edit: (current: Character) => Character,
  opts: ApplyStepOptions = {},
): Character {
  const next = edit(character);
  if (next === character) return character;
  // The new marks add to the existing ones: a mark clears only through finishCreationStep on its step.
  const prior = character.creationProgress?.needsAttention ?? [];
  const computed = computeNeedsAttention(character, next, step, opts);
  const needsAttention = [...new Set([...prior, ...computed])];
  if (opts.editBuild && isCreationFinished(character)) {
    // Edit Build on a finished character: the marks ride in the progress record with the editBuild marker, so
    // the character stays finished and every step stays reachable.
    const progress: CreationProgress = {
      currentStep: step,
      editBuild: true,
      ...(needsAttention.length > 0 ? { needsAttention } : {}),
    };
    return { ...next, creationProgress: progress };
  }
  const progress: CreationProgress = {
    currentStep: step,
    ...(needsAttention.length > 0 ? { needsAttention } : {}),
  };
  return { ...next, creationProgress: progress };
}

/**
 * The stored pick a Creation Step holds, as a signature: two characters with the same signature hold the same
 * pick on that step, so an update that changes it is a pick change. Undefined for the steps that hold no
 * single pick of their own (abilities, classChoices, asiFeats, spells, equipment, details, review).
 */
export function creationStepSignature(step: CreationStepId): ((character: Character) => string) | undefined {
  switch (step) {
    case "class":
      return (c) => JSON.stringify(c.classes ?? []);
    case "subclass":
      return (c) => JSON.stringify((c.classes ?? []).map((x) => [x.className, x.subclassName ?? null]));
    case "race":
    case "subrace":
      return (c) => JSON.stringify(c.race ?? null);
    case "background":
      return (c) => JSON.stringify(c.background ?? null);
    default:
      return undefined;
  }
}

/** The class an update added to the character's held classes, when it added one. */
export function addedClassPick(before: Character, after: Character): { className: string; source: string } | undefined {
  const beforeNames = new Set((before.classes ?? []).map((c) => c.className));
  return (after.classes ?? []).find((c) => !beforeNames.has(c.className));
}

/** Whether the update raises any held class's level. */
function raisesClassLevel(before: Character, after: Character): boolean {
  return (after.classes ?? []).some((c) => {
    const held = (before.classes ?? []).find((o) => o.className.toLowerCase() === c.className.toLowerCase());
    return held !== undefined && c.level > held.level;
  });
}

/**
 * Applies an update made on the open step of the build screen, deciding which transition records it:
 * a finished character on the Level up path keeps the plain update; Edit Build on a finished character
 * records the change through `applyCreationStepEdit` with the `editBuild` marker, refusing a class pick
 * added or a level raised there (the mode offers neither); a draft that picks a second class replaces its
 * held one through `applyCreationStepChange`; any other pick change on a step goes through
 * `applyCreationStepEdit`. An update that changes no stored pick of the step is kept as it is.
 * The given Character is never mutated.
 */
export function applyBuildStepUpdate(
  current: Character,
  next: Character,
  step: CreationStepId,
  mode: BuildFlowMode,
  opts: ApplyStepOptions = {},
): Character {
  if (next === current) return current;
  const draft = !isCreationFinished(current);
  if (!draft && mode !== "edit") return next;
  if (step === "class") {
    const added = addedClassPick(current, next);
    if (added) {
      if (!draft) return current;
      return applyCreationStepChange(current, { step: "class", className: added.className, source: added.source }, opts);
    }
    if (!draft && raisesClassLevel(current, next)) return current;
  }
  const signature = creationStepSignature(step);
  if (!signature || signature(current) === signature(next)) return next;
  return applyCreationStepEdit(current, step, () => next, draft ? opts : { ...opts, editBuild: true });
}

/**
 * Finishes a Creation Step: only a valid, applicable step of a draft can be finished, and a step after the
 * current one is locked, so finishing it is a no-op. The finished step's attention mark, if any, clears, and
 * the draft's current step moves to the later of the old current step and the next applicable step after the
 * finished one, so finishing an earlier step the player went back to never moves the draft backwards and
 * re-locks finished steps; a step marked as needing attention therefore stays the current step's blocker
 * until it is finished. Finishing Review leaves no creation progress, so the character is finished.
 * The given Character is never mutated.
 */
export function finishCreationStep(
  character: Character,
  step: CreationStepId,
  opts: CreationFlowOptions = {},
): Character {
  const progress = character.creationProgress;
  if (isCreationFinished(character)) {
    // Edit Build on a finished character: finishing a flagged step clears its mark and keeps the character
    // finished; when no mark is left the progress record is dropped entirely.
    if (!progress?.editBuild) return character;
    if (!creationStepNeedsAttention(character, step)) return character;
    if (!isCreationStepValid(character, step, opts)) return character;
    if (!applicableCreationSteps(character, opts).includes(step)) return character;
    const needsAttention = (progress.needsAttention ?? []).filter((id) => id !== step);
    return { ...character, creationProgress: needsAttention.length > 0 ? { ...progress, needsAttention } : undefined };
  }
  if (!isCreationStepValid(character, step, opts)) return character;
  const applicable = applicableCreationSteps(character, opts);
  const index = applicable.indexOf(step);
  if (index === -1) return character;
  const currentIndex = applicable.indexOf(resolveCurrentStep(character, applicable));
  // A step after the current one is locked: finishing it is a no-op.
  if (index > currentIndex) return character;
  const needsAttention = (character.creationProgress?.needsAttention ?? []).filter((id) => id !== step);
  const nextStep = applicable[Math.max(index + 1, currentIndex)];
  if (!nextStep) {
    // Finishing Review finishes the character, and a finished new character opens at full HP.
    const healed = fullHealAtLevelUp({ currentHp: character.currentHp, tempHp: character.tempHp }, maxHp(character));
    return { ...character, creationProgress: undefined, ...healed };
  }
  return {
    ...character,
    creationProgress: { currentStep: nextStep, ...(needsAttention.length > 0 ? { needsAttention } : {}) },
  };
}
