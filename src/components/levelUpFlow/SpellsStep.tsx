import React from "react";
import type { LevelUpPlan } from "../../rules/levelUpFlow";
import type { LearnableSpells } from "../../rules/learnableSpells";
import type { SpellData } from "../../types/dnd5e";
import { SpellLearnList } from "../spells/SpellLearnList";

/**
 * The Spells step: the spells the new level makes available to the planned class. Toggling a spell adds
 * or removes it from the plan's `learnedSpells`.
 */
export function SpellsStep({
  plan,
  learnable,
  onToggle,
}: {
  plan: LevelUpPlan;
  learnable: LearnableSpells;
  onToggle: (spell: { name: string; source: string }) => void;
}) {
  return (
    <SpellLearnList
      spells={learnable.spells}
      restrictedSchools={learnable.restrictedSchools}
      selectedNames={(plan.picks.learnedSpells ?? []).map((s) => s.name)}
      searchPlaceholder="Search spells…"
      onToggle={(spell: SpellData) => onToggle({ name: spell.name, source: spell.source })}
    />
  );
}
