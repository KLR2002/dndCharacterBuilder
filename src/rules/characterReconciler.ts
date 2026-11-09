import type { ActiveBooks } from "../constants/books.ts";
import type { Character, CharacterClass, KnownSpell } from "../types/character.ts";
import type { ClassData } from "../types/dnd5e.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { GIANT_BARBARIAN_OWNER_KEY, GIANT_POWER_CANTRIPS } from "../constants/rules.ts";
import { getMaxSpellLevel } from "./spellcasting.ts";
import { pruneInvalidExpertise } from "./expertise.ts";
import { fightingStyleOwnerOf, moveLegacyFightingStyleIds, pruneInvalidFightingStyles } from "./choices/fightingStyles.ts";
import { maneuverOwnerOf, pruneInvalidManeuvers } from "./choices/maneuvers.ts";
import { infusionOwnerOf, pruneInvalidInfusions } from "./choices/artificerInfusions.ts";
import { type ChoiceOwner, GIANT_POWER_CHOICE_ID } from "./choices/types.ts";
import { pruneInvalidFeatSpellPicks, pruneReleasedFeatCounters } from "./choices/featSpells.ts";
import { moveLegacyInnateCounters } from "./grantedSpells.ts";
import { releaseStrandedExpandedSpells } from "./backgroundSpells.ts";
import { withNotices } from "./needsReview.ts";
import {
  pruneInvalidInvocations,
  pruneInvalidMysticArcanum,
  syncWarlockTomeCantrips,
  syncAncientSecretsRituals,
  warlockOwnerOf,
} from "./choices/warlockChoices.ts";
import { tableOwnerOf } from "./subclassChoiceTable.ts";
import {
  dropLegacyMulticlassSkillEntries,
  moveAliasedProficiencyPicks,
  moveLegacyClassToolPicks,
  moveExpertisePicksToGrants,
  moveLegacySkillPicks,
  moveLegacySourcePicks,
  pruneInvalidProficiencyPicks,
} from "./proficiencyPicks.ts";
import { dropLegacyBackgroundSkills } from "./legacyBackgroundSkills.ts";
import { pruneStartingEquipmentPicks } from "./startingEquipmentPicks.ts";
import { releaseSizeChoice } from "./sizeChoice.ts";
import { reconcileOriginAbilities } from "./originCustomization.ts";

/**
 * The single seam every state-changing builder transition ends in. Idempotent: reconciling a
 * valid character returns it unchanged. Each pass prunes choices whose prerequisites no longer
 * hold and appends a notice to `needsReview` for every removal.
 *
 * Pass order is fixed. The Warlock ordering dependency is:
 *   - Invocations run before Tome cantrips and Ancient Secrets rituals. Pact Boon and the
 *     Book of Ancient Secrets invocation are invocation choices, so the sync passes must read
 *     the pruned state, not the stale one.
 *   - Mystic Arcanum runs after those two sync passes. It reads only Warlock level and its own
 *     choices, so it is independent of them, but it keeps the order the former invocation-prune
 *     chain used.
 * Fighting styles run before maneuvers because Superior Technique is gated on a fighting style. A fighting style pick saved under
 * an id with another source moves to the id its class now gives first, so the style passes read the current ids.
 * The Giant Power cantrip sync reads only its own choice and the Barbarian's known spells, so
 * its position is free; it sits with the other known-spell syncs. A held class's spells above its
 * maximum spell level (0 included, so a class that can no longer cast loses its leveled spells)
 * are released with them.
 * Picks saved under a grant's former id move to the grant's id first, so every later pass reads the current ids.
 * The class tool bucket is moved into its Proficiency Choice's pick next, so the pick check sees it, and the
 * race and background tool and language buckets follow it. The race and background skill picks saved in the
 * old skill choices move into their own Proficiency Choices after those buckets. Empty multiclass skill entries
 * from older saves are dropped with them. Expertise picks saved on a skill choice that now carries Expertise move
 * into it next, so the pick release sees them.
 * Proficiency picks are released before Expertise, so Expertise is pruned against the released state. A
 * background skill copy that only a turned-off background granted is dropped first, for the same reason.
 *
 * Starting equipment picks are dropped first when the first class is no longer the one they were made for.
 *
 * `options.activeBooks` scopes only the Expertise pass: an Expertise mark on a skill that no active book
 * grants is released. With ALL_BOOKS, the pass is unscoped, as it has always been.
 */
export function reconcile(
  character: Character,
  compendium: Compendium,
  options: { activeBooks: ActiveBooks },
): Character {
  const classes = compendium.for().classes();
  let updated = pruneStartingEquipmentPicks(character);
  updated = releaseSizeChoice(updated, compendium, options.activeBooks);
  updated = reconcileOriginAbilities(updated, compendium, options.activeBooks);

  updated = moveLegacyFightingStyleIds(updated, classes);
  updated = pruneInvalidFightingStyles(updated, classes);
  updated = pruneInvalidManeuvers(updated);
  updated = pruneInvalidInvocations(updated, compendium);
  updated = syncWarlockTomeCantrips(updated, compendium);
  updated = syncAncientSecretsRituals(updated, compendium);
  updated = syncGiantPowerCantrip(updated);
  updated = pruneInvalidMysticArcanum(updated);
  updated = releaseOverLevelClassSpells(updated, compendium, options.activeBooks);
  updated = pruneInvalidInfusions(updated, compendium);
  updated = moveAliasedProficiencyPicks(updated, compendium, options.activeBooks);
  updated = moveLegacyClassToolPicks(updated, compendium);
  updated = moveLegacySourcePicks(updated, compendium, options.activeBooks);
  updated = moveLegacySkillPicks(updated, compendium, options.activeBooks);
  updated = moveExpertisePicksToGrants(updated, compendium, options.activeBooks);
  updated = dropLegacyMulticlassSkillEntries(updated);
  updated = dropLegacyBackgroundSkills(updated, compendium, options.activeBooks);
  updated = pruneInvalidProficiencyPicks(updated, compendium, options.activeBooks);
  updated = pruneInvalidFeatSpellPicks(updated, compendium, options.activeBooks);
  updated = pruneReleasedFeatCounters(updated, compendium, options.activeBooks);
  updated = moveLegacyInnateCounters(updated, compendium, options.activeBooks);
  updated = pruneInvalidExpertise(updated, { compendium, activeBooks: options.activeBooks });

  return updated;
}

/**
 * Reconciles a character against the books now active, for the moments the active books change or a
 * character is opened. Expertise is released where no active book grants the skill or tool, and a
 * released mark is not restored when the book is re-enabled (the player marks it again).
 *
 * Returns the input itself when nothing changes, so a caller can skip the save. Some passes rebuild
 * their lists even when nothing is pruned, so "changed" is judged on the saved form, not on identity.
 */
export function reconcileForActiveBooks(
  character: Character,
  compendium: Compendium,
  activeBooks: string[],
): Character {
  const reconciled = releaseStrandedExpandedSpells(reconcile(character, compendium, { activeBooks }), compendium, activeBooks);
  return JSON.stringify(reconciled) === JSON.stringify(character) ? character : reconciled;
}

/**
 * Releases the known spells each held class owns whose spell level is above the maximum that class casts at
 * its level — including when that maximum is 0, so a class that can no longer cast releases its leveled
 * class-owned spells (cantrips are level 0 and stay). Each release drops the prepared key too and gets a
 * review notice. A name the catalog does not hold is kept.
 */
function releaseOverLevelClassSpells(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const classes = compendium.for(activeBooks).classes();
  let updated = character;
  for (const entry of character.classes ?? []) {
    updated = releaseOverLevelSpellsOf(updated, entry, classes, compendium);
  }
  return updated;
}

/** Releases the spells `entry`'s class owns above its maximum spell level; see releaseOverLevelClassSpells. */
function releaseOverLevelSpellsOf(
  character: Character,
  entry: CharacterClass,
  classes: readonly ClassData[],
  compendium: Compendium,
): Character {
  const maxSpellLevel = getMaxSpellLevel(entry, classes);
  const ownerPrefix = `${entry.className}__`.toLowerCase();
  const classLower = entry.className.toLowerCase();
  const ownedByClass = (k: { name: string; source: string; ownerKey?: string; className?: string }) =>
    k.ownerKey?.toLowerCase().startsWith(ownerPrefix) ?? (!k.ownerKey && k.className?.toLowerCase() === classLower);
  const notices: string[] = [];
  const released = new Set<string>();
  const knownSpells = (character.knownSpells ?? []).filter((known) => {
    if (!ownedByClass(known)) return true;
    const spell = compendium.findSpell(known.name, known.source);
    if (!spell || spell.level <= maxSpellLevel) return true;
    released.add(known.name.toLowerCase());
    notices.push(`${known.name} removed: spell level above ${entry.className} ${entry.level}`);
    return false;
  });
  if (released.size === 0) return character;
  const keptNames = new Set(knownSpells.map((known) => known.name.toLowerCase()));
  const preparedSpells = (character.preparedSpells ?? []).filter((prepared) => {
    const key = prepared.split("__")[0].toLowerCase();
    return !released.has(key) || keptNames.has(key);
  });
  return withNotices({ ...character, knownSpells, preparedSpells }, notices);
}

/**
 * Keeps the Path of the Giant cantrip in knownSpells in step with the recorded Giant Power
 * pick: the picked cantrip is known under the Giant owner, and no other Giant cantrip is.
 * Returns the character unchanged when knownSpells already agrees. A Giant cantrip dropped
 * here gets a review notice.
 */
function syncGiantPowerCantrip(character: Character): Character {
  const picked = character.ruleChoices?.find((rc) => rc.id === GIANT_POWER_CHOICE_ID)?.picked?.[0];
  const known = character.knownSpells ?? [];
  const isGiantCantrip = (k: { name: string; ownerKey?: string }) =>
    k.ownerKey === GIANT_BARBARIAN_OWNER_KEY && GIANT_POWER_CANTRIPS.has(k.name.toLowerCase());

  const granted = known.filter(isGiantCantrip);
  if (!picked && granted.length === 0) return character;
  if (picked && granted.length === 1 && granted[0].name === picked) return character;

  const others = known.filter((k) => !isGiantCantrip(k));
  const pickedSpell: KnownSpell | undefined = picked
    ? { name: picked, source: "PHB", ownerKey: GIANT_BARBARIAN_OWNER_KEY, ability: "wis", className: "Barbarian" }
    : undefined;
  const knownSpells = pickedSpell ? [...others, pickedSpell] : others;

  const reason = picked ? `Giant Power pick is now ${picked}` : "Giant Power pick no longer held";
  const notices = granted
    .filter((k) => k.name !== picked)
    .map((k) => `Giant Power cantrip ${k.name} removed: ${reason}`);
  return withNotices({ ...character, knownSpells }, notices);
}

/**
 * The owner of a Rule Choice id, looked up in the subclass choice table and then in each
 * specialised choice module. Undefined for an id none of them recognises.
 */
function ruleChoiceOwnerOf(id: string): ChoiceOwner | undefined {
  return (
    tableOwnerOf(id) ??
    fightingStyleOwnerOf(id) ??
    maneuverOwnerOf(id) ??
    warlockOwnerOf(id) ??
    infusionOwnerOf(id)
  );
}

const SUBCLASS_NO_LONGER_HELD = "subclass no longer held";

/**
 * Cleanly removes subclass-specific data from a character when changing or removing a subclass:
 * 1. Clears the Rule Choices the class's subclass owns (e.g. Circle of the Land Biome, Divine Soul Affinity, Domain Cantrips)
 * 2. Clears subclassSpellSwaps when a Sorcerer's Clockwork Soul or Aberrant Mind is torn down
 * 3. Removes old subclass-specific resource counters
 * 4. Removes the Path of the Giant cantrips when a Giant Barbarian's subclass is torn down
 * Every removal appends a review notice. `activeBooks` scopes the reconcile that ends the teardown, as in `reconcile`.
 */
export function teardownSubclass(
  character: Character,
  className: string,
  previousSubclassName: string | undefined,
  compendium: Compendium = currentCompendium(),
  activeBooks: ActiveBooks
): Character {
  const clsLower = className.toLowerCase();
  const prevLower = previousSubclassName?.toLowerCase() ?? "";
  const notices: string[] = [];

  // 1. Remove the Rule Choices this class's subclass owns. Owner is looked up by id, so a choice
  // whose id no table or module recognises is never removed, and a choice owned by another class,
  // or by the class itself with no subclass, is kept.
  const keptRuleChoices = (character.ruleChoices || []).filter((rc) => {
    const owner = ruleChoiceOwnerOf(rc.id);
    const ownedBySubclass = owner?.subclass !== undefined && owner.className.toLowerCase() === clsLower;
    if (!ownedBySubclass) return true;
    notices.push(`${rc.trait} removed: ${SUBCLASS_NO_LONGER_HELD}`);
    return false;
  });

  // 2. Clear subclassSpellSwaps only when the swapping subclass itself is torn down: both the
  // class and the subclass must match.
  const swapsOwnedBySubclass =
    clsLower === "sorcerer" && (prevLower.includes("clockwork") || prevLower.includes("aberrant"));
  let nextSwaps = character.subclassSpellSwaps;
  if (swapsOwnedBySubclass) {
    if (character.subclassSpellSwaps) {
      notices.push(`Subclass spell swaps removed: ${SUBCLASS_NO_LONGER_HELD}`);
    }
    nextSwaps = undefined;
  }

  // 3. Remove old subclass resource counters
  const nextCounters = { ...(character.resourceCounters || {}) };
  if (previousSubclassName) {
    const prevNorm = previousSubclassName.toLowerCase();
    const isBladesinger = prevNorm.includes("bladesing");
    for (const [key, counter] of Object.entries(nextCounters)) {
      const kLower = key.toLowerCase();
      const nLower = counter.name.toLowerCase();
      if (
        kLower.includes(prevNorm) ||
        nLower.includes(prevNorm) ||
        (isBladesinger && (kLower.includes("bladesong") || nLower.includes("bladesong")))
      ) {
        delete nextCounters[key];
        notices.push(`${counter.name} removed: ${SUBCLASS_NO_LONGER_HELD}`);
      }
    }
  }

  // 4. Remove granted subclass spells from knownSpells (e.g. Barbarian__BGG Giant Power cantrips).
  // Both the class and the subclass must match, so another class's cantrips are never touched.
  const knownSpells = character.knownSpells || [];
  let nextKnownSpells = character.knownSpells;
  if (clsLower === "barbarian" && prevLower.includes("giant")) {
    const isGiantCantrip = (k: { name: string; ownerKey?: string }) =>
      k.ownerKey === GIANT_BARBARIAN_OWNER_KEY && GIANT_POWER_CANTRIPS.has(k.name.toLowerCase());
    for (const k of knownSpells.filter(isGiantCantrip)) {
      notices.push(`Giant Power cantrip ${k.name} removed: ${SUBCLASS_NO_LONGER_HELD}`);
    }
    nextKnownSpells = knownSpells.filter((k) => !isGiantCantrip(k));
  }

  const cleaned: Character = {
    ...character,
    ruleChoices: keptRuleChoices,
    subclassSpellSwaps: nextSwaps,
    resourceCounters: nextCounters,
    knownSpells: nextKnownSpells,
  };

  return reconcile(withNotices(cleaned, notices), compendium, { activeBooks });
}
