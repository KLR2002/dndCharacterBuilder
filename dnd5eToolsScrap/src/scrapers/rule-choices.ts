import { renderEntries } from "../parser/entry-renderer.js";

/**
 * A Rule Choice is a selection the player makes from a fixed set of options
 * granted by a single rule, where exactly one option takes effect.
 *
 * 5e.tools stores these uniformly, and this module is the only place that knows
 * the shapes: an `inset` whose entries are all named options (and which may
 * carry `data.overwrite` naming the feature it replaces), or a `list` whose
 * items are all named, guarded by a "choose" instruction somewhere in the
 * owning entries.
 */

export interface RuleChoiceOption {
  name: string;
  description: string;
}

export interface ExtractedRuleChoice {
  /** The trait that grants the choice. */
  traitName: string;
  pick: number;
  options: RuleChoiceOption[];
  /** Set when the source data marks this choice as replacing another feature. */
  replaces?: string;
  /** Position among choices granted by the same trait, so repeats stay distinct. */
  index: number;
}

const CHOOSE_INSTRUCTION = /\bchoose\b/i;

/** True when every element is a named option (`{ name, ... }`). */
function isNamedOptionList(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => !!item && typeof item === "object" && typeof (item as any).name === "string")
  );
}

function optionsFromNamedEntries(entries: unknown): RuleChoiceOption[] {
  return (entries as Array<Record<string, any>>).map((option) => ({
    name: String(option.name),
    description: renderEntries(option.entries ?? option.entry, "markdown"),
  }));
}

function optionsFromListItems(items: unknown): RuleChoiceOption[] {
  return (items as Array<Record<string, any>>).map((item) => ({
    name: String(item.name),
    description: renderEntries(item.entry ?? item.entries, "markdown"),
  }));
}

/** A named `list` node whose items are all named options, plus its owner. */
interface OwnedOptions {
  ownerName: string;
  items: Array<Record<string, any>>;
}

/**
 * Finds every named-option list together with the nearest enclosing named
 * entry, which is the trait that grants the choice. A trait can grant more than
 * one choice (Simic Hybrid picks one animal enhancement now and a second at 5th
 * level), so all of them are returned in document order.
 */
function findAllOwnedNamedLists(entries: unknown, ownerName?: string, acc: OwnedOptions[] = []): OwnedOptions[] {
  if (!entries) return acc;
  if (!Array.isArray(entries)) {
    const node = entries as Record<string, any>;
    if (node?.type === "list" && isNamedOptionList(node.items) && ownerName) {
      acc.push({ ownerName, items: node.items });
      return acc;
    }
    return findAllOwnedNamedLists(
      node?.entries,
      typeof node?.name === "string" ? node.name : ownerName,
      acc
    );
  }
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const node = entry as Record<string, any>;
    const nestedOwner = typeof node?.name === "string" ? node.name : ownerName;
    if (node?.type === "list" && isNamedOptionList(node?.items)) {
      if (nestedOwner) acc.push({ ownerName: nestedOwner, items: node.items });
      continue;
    }
    findAllOwnedNamedLists(node?.entries, nestedOwner, acc);
  }
  return acc;
}

/** An `inset`/`entries` node whose entries are all named options. */
function findNamedOptionBlock(entries: unknown): Record<string, any> | null {
  if (!entries || !Array.isArray(entries)) return null;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const node = entry as Record<string, any>;
    if ((node.type === "inset" || node.type === "entries") && isNamedOptionList(node.entries)) {
      return node;
    }
  }
  return null;
}

/**
 * Extracts every Rule Choice granted by `entries`.
 *
 * `siblingTexts` is the rendered text of the owning entity (race or subrace),
 * because the instruction that a choice exists is often a sibling entry rather
 * than part of the trait itself — the Eladrin's season instruction sits beside
 * Fey Step, not inside it.
 */
export function extractRuleChoices(entries: unknown, siblingTexts: string[] = []): ExtractedRuleChoice[] {
  const found: ExtractedRuleChoice[] = [];
  const block = findNamedOptionBlock(entries);
  if (block) {
    found.push({
      traitName: String(block.name),
      pick: 1,
      options: optionsFromNamedEntries(block.entries),
      ...(typeof block.data?.overwrite === "string" ? { replaces: block.data.overwrite } : {}),
      index: 0,
    });
    return found;
  }

  if (!siblingTexts.some((text) => CHOOSE_INSTRUCTION.test(text))) return found;
  const perTrait = new Map<string, number>();
  for (const owned of findAllOwnedNamedLists(entries)) {
    const index = perTrait.get(owned.ownerName) ?? 0;
    perTrait.set(owned.ownerName, index + 1);
    found.push({
      traitName: owned.ownerName,
      pick: 1,
      options: optionsFromListItems(owned.items),
      index,
    });
  }
  return found;
}

export interface RuleChoiceLevel {
  /** Character level at which the choice becomes available. */
  level: number;
  /** Set when the chosen option's effect only applies from a later level. */
  effectLevel?: number;
  /**
   * Set when the option is chosen moment to moment rather than recorded on the
   * sheet — a breath weapon picked on the turn it is used, a Fey Gift picked
   * each time the Help action is taken. The catalog offers these identically to
   * build-time choices, and nothing structural separates them, so they are
   * curated out here rather than guessed at from prose.
   */
  momentary?: true;
  /**
   * Set when the catalog offers the choice but this work does not surface it.
   * Distinct from `momentary`, which is a property of the rule itself.
   */
  deferred?: true;
}

/**
 * Curated unlock levels, keyed by `source__race__subrace__trait`.
 *
 * These are deliberately hand-maintained rather than parsed: "When you reach
 * 3rd level" exists upstream only as an English sentence inside a description,
 * and a source reformatting must not silently change when a choice unlocks.
 * `checks/rule-choices.test.ts` fails if the catalog yields a choice with no
 * entry here.
 */
export const RULE_CHOICE_LEVELS: Record<string, RuleChoiceLevel> = {
  // In scope for this work: the three reported rules.
  "MPMM__Aasimar____Celestial Revelation": { level: 3, effectLevel: 3 },
  "MPMM__Eladrin____Fey Step": { level: 1, effectLevel: 3 },
  "MTF__Elf__Eladrin__Fey Step": { level: 1, effectLevel: 3 },
  "SCAG__Half-Elf__Variant; Drow Descent__Variant Feature (Choose 1)": { level: 1 },
  "SCAG__Half-Elf__Variant; Aquatic Elf Descent__Variant Feature (Choose 1)": { level: 1 },
  "SCAG__Half-Elf__Variant; Moon Elf or Sun Elf Descent__Variant Feature (Choose 1)": { level: 1 },
  "SCAG__Half-Elf__Variant; Wood Elf Descent__Variant Feature (Choose 1)": { level: 1 },

  // Real build-time choices the catalog also offers. Curated so the catalog
  // guard passes; not surfaced until a later ticket claims them.
  "GGR__Simic Hybrid____Animal Enhancement": { level: 1 },
  // Both Simic enhancements hang off one trait, and a trait carries a single
  // choice; the second is left for a ticket that models multiple choices.
  "GGR__Simic Hybrid____Animal Enhancement#1": { level: 5, deferred: true },
  "MPMM__Kobold____Kobold Legacy": { level: 1 },
  "MPMM__Shifter____Shifting": { level: 1 },

  // Chosen per use rather than recorded on the sheet.
  "FTD__Dragonborn (Metallic)____Metallic Breath Weapon": { level: 5, momentary: true },
  "MPMM__Hobgoblin____Fey Gift": { level: 3, momentary: true },
  "VRGR__Hexblood____Eerie Token": { level: 1, momentary: true },
};

export interface RuleChoiceKeyParts {
  source: string;
  race: string;
  subrace?: string | null;
  trait: string;
  index?: number;
}

/** Stable identity for a Rule Choice. Source leads: two Eladrins share a name. */
export function ruleChoiceKey({ source, race, subrace, trait, index }: RuleChoiceKeyParts): string {
  const base = [source, race, subrace ?? "", trait].join("__");
  return index ? `${base}#${index}` : base;
}