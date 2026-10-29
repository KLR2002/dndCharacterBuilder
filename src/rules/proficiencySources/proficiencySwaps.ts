import type { ItemData, OriginProficiencyKind, ProficiencyGrant, ProficiencySwapRow } from "../../types/dnd5e.ts";
import { DND_SKILLS } from "../../constants/rules.ts";
import type { FeatureInstance } from "../types.ts";
import { ALL_TOOLS, normalizeToolName } from "../proficienciesAndLanguages.ts";
import { poolNames, validPicks, type ChoiceProficiencyGrant } from "../proficiencyPools.ts";
import { normalizeSkillName } from "../skills.ts";
import { swapId } from "./swapIds.ts";

/** The categories a Race or Subrace proficiency swap can replace. Languages have their own pool (languageSwaps.ts). */
export type SwappableCategory = "skills" | "tools" | "weapons" | "armor";

/** One entry a swap may pick: its name and the category it lands in on the sheet. */
export interface SwapPoolEntry {
  name: string;
  category: "skills" | "tools" | "weapons";
}

/** One proficiency a Race or Subrace grant gives that a swap may replace. */
export interface ProficiencySwapSlot {
  /** The swap id: the grant's id, the swap mark, and the original (for a choice, the picked name). */
  id: string;
  /** The Race or Subrace feature the original is printed on. */
  featureId: string;
  /** The grant the original sits on: a fixed grant, or a narrower choice whose pick it is. */
  grantId: string;
  kind: "fixed" | "choice";
  category: SwappableCategory;
  original: string;
  pool: SwapPoolEntry[];
  replacement?: SwapPoolEntry;
}

/** A proficiency the Race or Subrace features hold, before the swap pool is set. */
interface SwapCandidate {
  featureId: string;
  grantId: string;
  kind: "fixed" | "choice";
  category: SwappableCategory;
  original: string;
  kindOf: OriginProficiencyKind;
}

export interface ProficiencySwapInput {
  features: readonly FeatureInstance[];
  items: readonly ItemData[];
  rows: readonly ProficiencySwapRow[];
  /** Whether a name is already held from any source other than the slot it would replace. */
  held: (category: SwapPoolEntry["category"], name: string) => boolean;
  picks: Record<string, string[]> | undefined;
  /** Without `available` no pick is in effect: slots are listed, none has a replacement. */
  available: boolean;
}

const SWAPPABLE: ReadonlySet<string> = new Set<SwappableCategory>(["skills", "tools", "weapons", "armor"]);

/** The key two spellings of one name share: case-insensitive, and singular, so "Shortswords" matches "Shortsword". */
export function swapNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/s$/, "");
}

/** The Catalog weapon a name is, matched by name, with its simple or martial category. Undefined when it cannot be classified. */
function weaponItemOf(name: string, items: readonly ItemData[]): ItemData | undefined {
  const key = swapNameKey(name);
  return items.find(
    (item) => item.itemCategory === "Weapon" && item.weaponCategory !== undefined && swapNameKey(item.name) === key,
  );
}

/** The table kind of a held proficiency, and its spelling on the sheet. Undefined when the Catalog cannot classify it. */
function kindOfOriginal(
  category: SwappableCategory,
  name: string,
  items: readonly ItemData[],
): { kindOf: OriginProficiencyKind; name: string } | undefined {
  if (category === "skills") return { kindOf: "skill", name: normalizeSkillName(name) };
  if (category === "tools") return { kindOf: "tool", name: normalizeToolName(name) };
  if (category === "armor") return { kindOf: "armor", name: name.trim() };
  const item = weaponItemOf(name, items);
  if (!item?.weaponCategory) return undefined;
  return { kindOf: item.weaponCategory === "simple" ? "simple weapon" : "martial weapon", name: item.name };
}

function weaponEntries(base: "simple" | "martial", items: readonly ItemData[]): SwapPoolEntry[] {
  const grant: ChoiceProficiencyGrant = {
    id: "",
    kind: "choice",
    category: "weapons",
    count: 1,
    pool: { kind: "weapons", base: [base], withoutProperties: [], plus: [] },
  };
  return poolNames(grant, items).map((name) => ({ name, category: "weapons" }));
}

/** The names a table kind may be replaced with. Armor is never a replacement, so it has no pool. */
function poolOf(kind: OriginProficiencyKind, items: readonly ItemData[]): SwapPoolEntry[] {
  if (kind === "skill") return DND_SKILLS.map((skill) => ({ name: normalizeSkillName(skill.name), category: "skills" }));
  if (kind === "tool") return ALL_TOOLS.map((name) => ({ name, category: "tools" }));
  if (kind === "simple weapon") return weaponEntries("simple", items);
  if (kind === "martial weapon") return weaponEntries("martial", items);
  return [];
}

/** Every Race or Subrace proficiency a swap may replace: each distinct fixed name once, and each pick of a narrower choice. */
function candidatesOf(features: readonly FeatureInstance[], items: readonly ItemData[], picks: Record<string, string[]> | undefined): SwapCandidate[] {
  const seen = new Set<string>();
  const candidates: SwapCandidate[] = [];
  for (const feature of features) {
    if (feature.origin !== "Race" && feature.origin !== "Subrace") continue;
    for (const grant of feature.grants ?? []) {
      if (grant.kind === "fixed" && SWAPPABLE.has(grant.category)) {
        for (const raw of grant.names) {
          const classified = kindOfOriginal(grant.category as SwappableCategory, raw, items);
          if (!classified) continue;
          const key = `${grant.category}|${swapNameKey(classified.name)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({ featureId: feature.id, grantId: grant.id, kind: "fixed", category: grant.category as SwappableCategory, original: classified.name, kindOf: classified.kindOf });
        }
      }
      if (grant.kind === "choice" && grant.pool.kind === "names" && (grant.category === "skills" || grant.category === "tools" || grant.category === "weapons")) {
        for (const pick of validPicks(grant, picks?.[grant.id] ?? [], items)) {
          const classified = kindOfOriginal(grant.category, pick, items);
          if (!classified) continue;
          candidates.push({ featureId: feature.id, grantId: grant.id, kind: "choice", category: grant.category, original: classified.name, kindOf: classified.kindOf });
        }
      }
    }
  }
  return candidates;
}

/**
 * The swap slots of the Race and Subrace features, in feature order. A candidate's pool is the names its table row allows,
 * minus its own original, what `held` reports, and the replacements of earlier valid swaps, so the earlier one keeps a name.
 * A replacement is set only while the rule is available and the saved pick is in the pool.
 */
export function proficiencySwapSlots(input: ProficiencySwapInput): ProficiencySwapSlot[] {
  const allowed = (kindOf: OriginProficiencyKind) =>
    [...new Set(input.rows.filter((row) => row.from === kindOf).flatMap((row) => row.to))];
  const taken = new Set<string>();
  return candidatesOf(input.features, input.items, input.picks).map((candidate) => {
    const originKey = swapNameKey(candidate.original);
    const seen = new Set<string>();
    const pool = allowed(candidate.kindOf)
      .flatMap((kind) => poolOf(kind, input.items))
      .filter((entry) => {
        const key = `${entry.category}|${swapNameKey(entry.name)}`;
        if (swapNameKey(entry.name) === originKey || seen.has(key) || taken.has(key)) return false;
        seen.add(key);
        return !input.held(entry.category, entry.name);
      });
    const id = swapId(candidate.grantId, candidate.original);
    const pick = input.available ? input.picks?.[id]?.[0] : undefined;
    const replacement = pick === undefined ? undefined : pool.find((entry) => swapNameKey(entry.name) === swapNameKey(pick));
    if (replacement) taken.add(`${replacement.category}|${swapNameKey(replacement.name)}`);
    return {
      id,
      featureId: candidate.featureId,
      grantId: candidate.grantId,
      kind: candidate.kind,
      category: candidate.category,
      original: candidate.original,
      pool,
      replacement,
    };
  });
}

/**
 * The features with each applied swap in effect. A fixed original leaves every Race and Subrace grant of its category that
 * names it, a narrower choice's pool loses its original, and the replacement is a fixed grant on the same feature, in the
 * replacement's own category, with the swap id. Background, class, subclass and feat features are returned as they are.
 */
export function withProficiencySwaps(features: readonly FeatureInstance[], slots: readonly ProficiencySwapSlot[]): FeatureInstance[] {
  const valid = slots.filter((slot) => slot.replacement !== undefined);
  if (valid.length === 0) return [...features];
  const removedFixed = new Set(valid.filter((slot) => slot.kind === "fixed").map((slot) => `${slot.category}|${swapNameKey(slot.original)}`));
  const removedFromChoice = new Map<string, Set<string>>();
  for (const slot of valid.filter((candidate) => candidate.kind === "choice")) {
    const removed = removedFromChoice.get(slot.grantId) ?? new Set<string>();
    removed.add(swapNameKey(slot.original));
    removedFromChoice.set(slot.grantId, removed);
  }
  return features.map((feature) => {
    const isRaceSource = feature.origin === "Race" || feature.origin === "Subrace";
    const grants = (feature.grants ?? []).flatMap((grant): ProficiencyGrant[] => {
      if (!isRaceSource) return [grant];
      if (grant.kind === "fixed" && SWAPPABLE.has(grant.category)) {
        const names = grant.names.filter((name) => !removedFixed.has(`${grant.category}|${swapNameKey(name)}`));
        if (names.length === grant.names.length) return [grant];
        return names.length > 0 ? [{ ...grant, names }] : [];
      }
      const removed = grant.kind === "choice" ? removedFromChoice.get(grant.id) : undefined;
      if (grant.kind === "choice" && removed && grant.pool.kind === "names") {
        return [{ ...grant, pool: { kind: "names", names: grant.pool.names.filter((name) => !removed.has(swapNameKey(name))) } }];
      }
      return [grant];
    });
    const added: ProficiencyGrant[] = valid
      .filter((slot) => slot.featureId === feature.id)
      .map((slot) => ({ id: slot.id, kind: "fixed", category: slot.replacement!.category, names: [slot.replacement!.name] }));
    return grants.length === 0 && added.length === 0 ? feature : { ...feature, grants: [...grants, ...added] };
  });
}

/** The skills a valid swap replaces, by key. The race and subrace trait text that names one of them no longer grants it. */
export function replacedSkillKeys(slots: readonly ProficiencySwapSlot[]): Set<string> {
  return new Set(
    slots
      .filter((slot) => slot.replacement !== undefined && slot.category === "skills")
      .map((slot) => swapNameKey(slot.original)),
  );
}
