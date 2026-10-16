import type { Character } from "../types/character.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { pruneInvalidExpertise } from "./expertise.ts";
import { pruneInvalidFightingStyles } from "./choices/fightingStyles.ts";
import { pruneInvalidManeuvers } from "./choices/maneuvers.ts";
import { pruneInvalidInfusions } from "./choices/artificerInfusions.ts";
import {
  pruneInvalidInvocations,
  pruneInvalidMysticArcanum,
  syncWarlockTomeCantrips,
  syncAncientSecretsRituals,
} from "./choices/warlockChoices.ts";

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
 * Fighting styles run before maneuvers because Superior Technique is gated on a fighting style.
 */
export function reconcile(character: Character, compendium: Compendium): Character {
  let updated = character;

  updated = pruneInvalidFightingStyles(updated);
  updated = pruneInvalidManeuvers(updated);
  updated = pruneInvalidInvocations(updated, compendium);
  updated = syncWarlockTomeCantrips(updated, compendium);
  updated = syncAncientSecretsRituals(updated, compendium);
  updated = pruneInvalidMysticArcanum(updated);
  updated = pruneInvalidInfusions(updated);
  updated = pruneInvalidExpertise(updated, { compendium });

  return updated;
}

/**
 * Cleanly removes subclass-specific data from a character when changing or removing a subclass:
 * 1. Clears obsolete subclass RuleChoices (e.g. Circle of the Land Biome, Divine Soul Affinity, Domain Cantrips)
 * 2. Clears subclassSpellSwaps (for Sorcerer or general)
 * 3. Removes old subclass-specific resource counters
 */
export function teardownSubclass(
  character: Character,
  className: string,
  previousSubclassName?: string,
  _newSubclassName?: string,
  compendium: Compendium = currentCompendium()
): Character {
  const clsLower = className.toLowerCase();

  // 1. Clear obsolete subclass rule choices for this class
  const keptRuleChoices = (character.ruleChoices || []).filter((rc) => {
    if (rc.origin === "subclass") {
      const idLower = rc.id.toLowerCase();
      const traitLower = rc.trait.toLowerCase();
      if (idLower.includes(clsLower) || traitLower.includes(clsLower)) return false;
      if (clsLower === "druid" && (idLower.includes("land") || traitLower.includes("biome"))) return false;
      if (clsLower === "sorcerer" && (idLower.includes("divine soul") || traitLower.includes("affinity"))) return false;
      if (clsLower === "cleric" && (idLower.includes("nature") || idLower.includes("death") || idLower.includes("arcana"))) return false;
      if (clsLower === "bard" && (idLower.includes("swords") || traitLower.includes("swords"))) return false;
    }
    if (clsLower === "fighter" && previousSubclassName?.toLowerCase().includes("champion") && rc.id.includes("Additional Fighting Style")) {
      return false;
    }
    if (clsLower === "fighter" && previousSubclassName?.toLowerCase().includes("battle master") && rc.id.includes("Battle Master__Maneuvers")) {
      return false;
    }
    return true;
  });

  // 2. Clear subclassSpellSwaps if this class is Sorcerer (or if previous subclass was a swapper)
  let nextSwaps = character.subclassSpellSwaps;
  if (
    clsLower === "sorcerer" ||
    previousSubclassName?.toLowerCase().includes("clockwork") ||
    previousSubclassName?.toLowerCase().includes("aberrant")
  ) {
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
      }
    }
  }

  // 4. Remove granted subclass spells from knownSpells (e.g. Barbarian__BGG Giant Power cantrips)
  let nextKnownSpells = character.knownSpells;
  if (
    clsLower === "barbarian" ||
    previousSubclassName?.toLowerCase().includes("giant")
  ) {
    nextKnownSpells = (character.knownSpells || []).filter(
      (k) => !(k.ownerKey === "Barbarian__BGG" && ["druidcraft", "thaumaturgy"].includes(k.name.toLowerCase()))
    );
  }

  const cleaned: Character = {
    ...character,
    ruleChoices: keptRuleChoices,
    subclassSpellSwaps: nextSwaps,
    resourceCounters: nextCounters,
    knownSpells: nextKnownSpells,
  };

  return reconcile(cleaned, compendium);
}
