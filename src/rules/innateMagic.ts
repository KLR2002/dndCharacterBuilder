import type { AbilityKey } from "../types/character.ts";

export interface InnateSpellEntry {
  name: string;
  level: number;
  minCharacterLevel: number;
  castingTime: string;
  source: string;
  isCantrip: boolean;
  resourceCounterId?: string;
  maxUses?: number;
  /** The short note the reviewed catalog data gives the spell on its grant, shown after its name. */
  note?: string;
}

/** One Innate Magic source: a race, subrace or feat's spells, with the casting ability they use (ADR 0017). */
export interface InnateSpellProfile {
  title: string;
  /** Whether the source is the character's race or subrace, or one of its feats. */
  origin: "race" | "feat";
  /** Absent while the source's casting ability is still to be recorded. */
  ability?: AbilityKey;
  spellSaveDc?: number;
  spellAttackBonus?: number;
  spells: InnateSpellEntry[];
  /** Needs-review notices for the parts of the source that are not yet resolved. */
  notices?: string[];
}
