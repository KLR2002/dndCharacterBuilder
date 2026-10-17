import type { AbilityKey, AbilityScores, Character, CharacterClass, KnownSpell, RuleChoiceEntry } from "../types/character.ts";
import type { SpellData } from "../types/dnd5e.ts";
import type { ResolvedAncestry } from "./types.ts";
import { CLASS_DATA, isThirdCaster, PHB_HALF_CASTER_SLOTS, PHB_THIRD_CASTER_SLOTS } from "./classData.ts";
import {
  GIANT_BARBARIAN_OWNER_KEY,
  GIANT_POWER_CANTRIPS,
  MULTICLASS_SPELL_SLOTS,
  WARLOCK_PACT_SLOTS,
} from "../constants/rules.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { getSubclassSpells, normalizeKey } from "./subclassSpells.ts";

export interface ClassSpellProfile {
  className: string;
  subclass?: string;
  /** The character's Rule Choices, kept so subclass variants (e.g. a Genie kind) resolve as chosen. */
  ruleChoices?: RuleChoiceEntry[];
  source: string;
  level: number;
  ability: AbilityKey;
  spellSaveDc: number;
  spellAttackBonus: number;
  maxSpellLevel: number;
  preparedLimit?: number;
  alwaysPreparedSpells?: SpellData[];
  subclassKnownSpells?: SpellData[];
  /** The Spell Owner key this class's known and prepared spells are stored under. */
  ownerKey: string;
  knownSpells: KnownSpell[];
  preparedSpells: string[];
}

export function isKiCaster(c: CharacterClass): boolean {
  if (c.className !== "Monk" || c.level < 3) return false;
  const sub = (c.subclassName || c.subclass || (c as { archetype?: string }).archetype || "").toLowerCase();
  return (
    sub.includes("four elements") ||
    sub.includes("elements") ||
    sub.includes("shadow") ||
    sub.includes("sun soul") ||
    sub.includes("sunsoul")
  );
}

export function isGiantBarbarian(c: CharacterClass): boolean {
  if (c.className !== "Barbarian" || c.level < 3) return false;
  const sub = (c.subclassName || c.subclass || (c as { archetype?: string }).archetype || "").toLowerCase();
  return sub.includes("giant");
}

/**
 * The Spell Owner key for a class's spellcasting. Giant Barbarians own their granted cantrips
 * under the Path of the Giant key, so the key is never derived from the class name alone.
 */
function spellOwnerKey(c: CharacterClass): string {
  return isGiantBarbarian(c) ? GIANT_BARBARIAN_OWNER_KEY : `${c.className}__${c.source || "PHB"}`;
}

export function isCastingClass(c: CharacterClass): boolean {
  if (c.level < 1) return false;
  if (isThirdCaster(c)) return true;
  if (c.className === "Artificer") return true;
  if (isKiCaster(c)) return true;
  if (isGiantBarbarian(c)) return true;
  const kind = CLASS_DATA[c.className]?.caster;
  if (kind === "half") return c.level >= 2;
  return kind === "full" || kind === "pact";
}

export function getSpellcastingAbility(c: CharacterClass): AbilityKey | undefined {
  if (isThirdCaster(c)) return "int";
  if (c.className === "Artificer") return "int";
  if (isKiCaster(c)) return "wis";
  if (isGiantBarbarian(c)) return "wis";
  return CLASS_DATA[c.className]?.spellAbility;
}

export function getMaxSpellLevel(c: CharacterClass): number {
  if (isThirdCaster(c)) {
    return PHB_THIRD_CASTER_SLOTS[Math.min(c.level, 20)]?.length || 0;
  }
  if (isGiantBarbarian(c)) {
    return 0;
  }
  if (isKiCaster(c)) {
    if (c.level >= 17) return 5;
    if (c.level >= 11) return 3;
    if (c.level >= 6) return 2;
    if (c.level >= 3) return 2;
    return 0;
  }
  const kind = CLASS_DATA[c.className]?.caster;
  if (kind === "full") {
    return MULTICLASS_SPELL_SLOTS[Math.min(c.level, 20)]?.length || 0;
  }
  if (kind === "half") {
    return PHB_HALF_CASTER_SLOTS[Math.min(c.level, 20)]?.length || 0;
  }
  if (kind === "pact") {
    return WARLOCK_PACT_SLOTS[Math.min(c.level, 20)]?.slotLevel || 0;
  }
  if (c.className === "Artificer") {
    return Math.min(5, Math.ceil(c.level / 4));
  }
  return 0;
}

export function getPreparedLimit(c: CharacterClass, modifiers: AbilityScores): number | undefined {
  if (c.className === "Cleric" || c.className === "Druid") {
    return Math.max(1, c.level + modifiers.wis);
  }
  if (c.className === "Wizard") {
    return Math.max(1, c.level + modifiers.int);
  }
  if (c.className === "Paladin") {
    return Math.max(1, Math.floor(c.level / 2) + modifiers.cha);
  }
  if (c.className === "Artificer") {
    return Math.max(1, Math.floor(c.level / 2) + modifiers.int);
  }
  return undefined;
}

export function calculateWarlockPactSlots(character: Character): { count: number; level: number } | null {
  const warlock = (character.classes || []).find(c => c.className === "Warlock");
  if (!warlock || warlock.level < 1) return null;
  const pact = WARLOCK_PACT_SLOTS[Math.min(warlock.level, 20)];
  return pact ? { count: pact.slotCount, level: pact.slotLevel } : null;
}

export function getClassSpellProfiles(
  character: Character,
  opts: ResolvedAncestry & {
    activeBooks?: string[];
    biome?: string;
    affinity?: string;
    swaps?: Record<string, string>;
  } = {}
): ClassSpellProfile[] {
  const castingClasses = (character.classes || []).filter(isCastingClass);
  if (castingClasses.length === 0) return [];

  const pb = proficiencyBonus(totalLevel(character));
  const { modifiers } = effectiveScores(character, opts);
  const isSingleCaster = castingClasses.length === 1;

  return castingClasses.map(c => {
    const ability = getSpellcastingAbility(c) || "int";
    const abilityMod = modifiers[ability] ?? 0;
    const spellSaveDc = 8 + pb + abilityMod;
    const spellAttackBonus = pb + abilityMod;
    const maxSpellLevel = getMaxSpellLevel(c);
    const preparedLimit = getPreparedLimit(c, modifiers);
    const classOwnerKey = spellOwnerKey(c);

    const subName = c.subclassName || c.subclass || (c as { archetype?: string }).archetype;

    const subSpells = getSubclassSpells(c.className, subName, c.level, {
      biome: opts.biome,
      affinity: opts.affinity,
      swaps: character.subclassSpellSwaps || opts.swaps,
      activeBooks: opts.activeBooks,
      ruleChoices: character.ruleChoices,
    });

    const alwaysPrepNames = new Set((subSpells.prepared || []).map(s => s.name.toLowerCase()));

    const knownSpells: KnownSpell[] = (character.knownSpells || [])
      .filter(k => {
        if (k.ownerKey === classOwnerKey) return true;
        if (c.className === "Warlock" && (k.ownerKey === "Warlock__Tome" || k.ownerKey === "Warlock__PHB")) return true;
        if (k.ownerKey && k.ownerKey.startsWith("Warlock__") && c.className !== "Warlock") return false;
        if (isSingleCaster) return true;
        if (!k.ownerKey && k.className === c.className) return true;
        return false;
      })
      .map(k => ({
        name: k.name,
        source: k.source,
        ownerKey: k.ownerKey && k.ownerKey !== "unknown__unknown" ? k.ownerKey : classOwnerKey,
        ...(k.className ? { className: k.className } : {}),
        ...(k.ability ? { ability: k.ability } : isGiantBarbarian(c) ? { ability: "wis" as AbilityKey } : {}),
      }));

    if (isGiantBarbarian(c)) {
      for (const sp of subSpells.cantrips) {
        if (!knownSpells.some((k) => k.name.toLowerCase() === sp.name.toLowerCase())) {
          knownSpells.push({
            name: sp.name,
            source: sp.source || "PHB",
            ownerKey: classOwnerKey,
            ability: "wis",
            className: "Barbarian",
          });
        }
      }
    }

    const preparedSpells: string[] = (character.preparedSpells || []).filter(key => {
      const spellName = key.split("__")[0].toLowerCase();
      if (alwaysPrepNames.has(spellName)) return false;
      if (key.endsWith(`__${classOwnerKey}`)) return true;
      if (isSingleCaster) return true;
      return false;
    });

    const profile: ClassSpellProfile = {
      className: c.className,
      subclass: subName,
      ...(character.ruleChoices ? { ruleChoices: character.ruleChoices } : {}),
      source: c.source || "PHB",
      level: c.level,
      ability,
      spellSaveDc,
      spellAttackBonus,
      maxSpellLevel,
      ...(preparedLimit !== undefined ? { preparedLimit } : {}),
      alwaysPreparedSpells: subSpells.prepared,
      subclassKnownSpells: [...subSpells.known, ...subSpells.cantrips],
      knownSpells,
      preparedSpells,
      ownerKey: classOwnerKey,
    };

    return profile;
  });
}

export interface SpellAvailabilityContext {
  subclassName?: string;
  classLevel?: number;
  kind?: string;
  ruleChoices?: RuleChoiceEntry[];
}

/**
 * The availability context for a class profile's Spell Owner: its subclass and the character's rule
 * choices, so a subclass variant (e.g. the Genie kind) resolves as the character chose it.
 */
export function profileSpellContext(profile: ClassSpellProfile): SpellAvailabilityContext {
  return { subclassName: profile.subclass, ruleChoices: profile.ruleChoices };
}

/**
 * Determines whether a spell is available for a given class or archetype,
 * taking into account active sourcebooks, subclass expanded lists (e.g. Warlock patrons),
 * cross-class spell access (e.g. Divine Soul Sorcerers), and cross-book alternative spell lists (e.g. TCE).
 */
export function isSpellAvailableForClass(
  spell: SpellData,
  className: string,
  activeBooks?: string[],
  context?: SpellAvailabilityContext | string
): boolean {
  if (!spell || !className) return false;

  const parsedContext: SpellAvailabilityContext =
    typeof context === "string" ? { subclassName: context } : (context || {});
  const subclassName = parsedContext.subclassName;
  const classLevel = parsedContext.classLevel ?? 20;

  // Normalize third casters (Eldritch Knight, Arcane Trickster) to Wizard
  let targetClass = className.trim();
  const lower = targetClass.toLowerCase();
  const subLower = subclassName?.toLowerCase() || "";
  if (
    lower.includes("eldritch knight") ||
    lower.includes("arcane trickster") ||
    (lower === "fighter" && subLower.includes("eldritch knight")) ||
    (lower === "rogue" && subLower.includes("arcane trickster"))
  ) {
    targetClass = "Wizard";
  }

  const targetLower = targetClass.toLowerCase();

  // Warlock Otherworldly Patron expanded spell lists (Subclass Feature Supremacy applies):
  // If the spell is granted by the subclass expanded list and that subclass is active in activeBooks, allow it.
  if (targetLower === "warlock" && subclassName) {
    const subSpells = getSubclassSpells("Warlock", subclassName, classLevel, {
      activeBooks,
      kind: parsedContext.kind,
      ruleChoices: parsedContext.ruleChoices,
    });
    if (subSpells.expanded.some((e) => normalizeKey(e) === normalizeKey(spell.name))) {
      return true;
    }
  }

  // Path of the Giant Barbarian cantrip access (Druidcraft / Thaumaturgy)
  if (targetLower === "barbarian" && subLower.includes("giant")) {
    if (GIANT_POWER_CANTRIPS.has(spell.name.toLowerCase())) {
      return true;
    }
  }

  // Active book gating: spell's own sourcebook must be active if activeBooks is provided
  if (activeBooks !== undefined) {
    const isSpellSourceActive =
      (spell.source || "").toUpperCase() === "SRD" ||
      activeBooks.some((b) => b.toUpperCase() === (spell.source || "").toUpperCase());
    if (!isSpellSourceActive) return false;
  }

  // Divine Soul Sorcerers have access to the complete Cleric spell list
  if (targetLower === "sorcerer" && subclassName?.toLowerCase().includes("divine soul")) {
    if (spell.classes?.some((c) => c.toLowerCase() === "cleric")) {
      return true;
    }
  }

  // 1. Native class grant from the spell's own sourcebook
  if (spell.classes?.some((c) => c.toLowerCase() === targetLower)) {
    return true;
  }

  // 2. Cross-book alternative spell list variant grant (e.g. TCE alternative spell lists)
  if (spell.classVariants && spell.classVariants.length > 0) {
    const hasVariantGrant = spell.classVariants.some((v) => {
      if (v.name.toLowerCase() !== targetLower) return false;
      if (activeBooks === undefined) return true;
      return activeBooks.some(
        (b) => b.toUpperCase() === (v.definedInSource || "").toUpperCase()
      );
    });
    if (hasVariantGrant) return true;
  }

  return false;
}

/**
 * Filters a collection of spells to those available to the specified class under active books.
 */
export function getAvailableSpellsForClass(
  spells: SpellData[],
  className: string,
  activeBooks?: string[],
  context?: SpellAvailabilityContext | string
): SpellData[] {
  if (!Array.isArray(spells)) return [];
  return spells.filter((s) => isSpellAvailableForClass(s, className, activeBooks, context));
}
