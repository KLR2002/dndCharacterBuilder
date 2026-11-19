import type { Character } from "../types/character.ts";
import type { SubclassData } from "../types/dnd5e.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { allCatalogClasses } from "./catalogs.ts";
import { heldClass, isThirdCaster } from "./classData.ts";
import { currentCompendium } from "../services/compendium.ts";
import type { ClassSpellProfile } from "./spellcasting.ts";

/** The per-level progressions a class's spellcasting or a subclass record carries. */
type CountedProgressions = Partial<Pick<SubclassData, "cantripsKnown" | "spellsKnown">> & { spellbookSpellsGained?: number[] };

export interface SpellCountPart {
  known: number;
  due: number;
}

export interface SpellCounts {
  cantrips: SpellCountPart | null;
  /** A Wizard's spellbook is a spell count of its own kind: due is the running total of its gains. */
  spells: (SpellCountPart & { kind: "known" | "spellbook" }) | null;
}

/**
 * The cantrips and spells one class Spell Owner knows against what its class level is due. The due numbers come from
 * the Catalog class, or from its Eldritch Knight or Arcane Trickster subclass at the class's level. The known spells are
 * the owner's own: subclass and always-prepared spells, Pact of the Tome and feat or race spells are left out. A part is
 * null when the Catalog has no number for it, and both are null while the Catalog is stale.
 */
export function spellCounts(character: Character, profile: ClassSpellProfile, catalogs?: CharacterCatalogs): SpellCounts {
  const compendium = catalogs?.compendium ?? currentCompendium();
  if (compendium.stale) return { cantrips: null, spells: null };

  const entry = (character.classes ?? []).find((c) => c.className === profile.className && (c.source || "PHB") === profile.source);
  const level = entry?.level ?? profile.level;
  const classRecord = heldClass({ className: profile.className, source: profile.source }, allCatalogClasses(catalogs));

  // An Eldritch Knight or Arcane Trickster counts by its subclass; every other caster by its class's spellcasting.
  const thirdCaster = isThirdCaster({ className: profile.className, source: profile.source, level, subclassName: profile.subclass });
  const counted: CountedProgressions | undefined = thirdCaster
    ? classRecord?.subclasses.find((sc: SubclassData) => sc.name === profile.subclass)
    : (classRecord?.spellcasting ?? undefined);

  const cantripsDue = dueAt(counted?.cantripsKnown, level);
  const knownDue = dueAt(counted?.spellsKnown, level);
  const spellsDue = counted?.spellbookSpellsGained
    ? { due: runningTotal(counted.spellbookSpellsGained, level), kind: "spellbook" as const }
    : knownDue === null ? null : { due: knownDue, kind: "known" as const };

  const excluded = new Set([
    ...(profile.alwaysPreparedSpells ?? []).map((s) => s.name.toLowerCase()),
    ...(profile.subclassKnownSpells ?? []).map((s) => s.name.toLowerCase()),
  ]);
  const owned = profile.knownSpells.filter(
    (k) => k.ownerKey === profile.ownerKey && !excluded.has(k.name.toLowerCase()),
  );
  // A spell the Compendium does not hold is listed as a cantrip, as the Spell Page lists it.
  const cantripsKnown = owned.filter((k) => (compendium.findSpell(k.name, k.source)?.level ?? 0) === 0).length;
  const spellsKnown = owned.length - cantripsKnown;

  return {
    cantrips: cantripsDue === null ? null : { known: cantripsKnown, due: cantripsDue },
    spells: spellsDue === null ? null : { known: spellsKnown, due: spellsDue.due, kind: spellsDue.kind },
  };
}

/** The number a per-level progression gives at a class level (index 0 is level 1), or null when it has none. */
function dueAt(progression: number[] | undefined, level: number): number | null {
  return progression?.[level - 1] ?? null;
}

/** The sum of a per-level progression up to a class level. */
function runningTotal(progression: number[], level: number): number {
  return progression.slice(0, level).reduce((sum, gain) => sum + gain, 0);
}
