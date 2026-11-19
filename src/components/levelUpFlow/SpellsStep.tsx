import React from "react";
import { View } from "react-native";
import type { LevelUpPlan } from "../../rules/levelUpFlow";
import type { LearnableSpells } from "../../rules/learnableSpells";
import type { SpellData } from "../../types/dnd5e";
import { SpellLearnList } from "../spells/SpellLearnList";
import { Badge } from "../ui/Badge";

/**
 * The Spells step: the spells the new level makes available to the planned class. Toggling a spell adds
 * or removes it from the plan's `learnedSpells`. Once a count is full, its unpicked spells are disabled.
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
  const due = plan.spellsDue ?? null;
  const levelOf = new Map(learnable.spells.map((s) => [s.name.toLowerCase(), s.level]));
  const pickedLevels = (plan.picks.learnedSpells ?? [])
    .map((s) => levelOf.get(s.name.toLowerCase()))
    .filter((level): level is number => level !== undefined);
  const cantrips = pickedLevels.filter((level) => level === 0).length;
  const spells = pickedLevels.length - cantrips;

  const cantripsFull = due !== null && cantrips >= due.cantrips;
  const spellsFull = due !== null && spells >= due.spells;
  const counters = [
    ...(due !== null && due.cantrips > 0 ? [`Cantrips ${cantrips}/${due.cantrips}`] : []),
    ...(due !== null && due.spells > 0 ? [`Spells ${spells}/${due.spells}`] : []),
  ];

  return (
    <View style={{ gap: 8 }}>
      {counters.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {counters.map((label) => (
            <Badge key={label} label={label} variant="secondary" size="sm" />
          ))}
        </View>
      )}
      <SpellLearnList
        spells={learnable.spells}
        restrictedSchools={learnable.restrictedSchools}
        selectedNames={(plan.picks.learnedSpells ?? []).map((s) => s.name)}
        isSpellDisabled={due === null ? undefined : (spell: SpellData) => (spell.level === 0 ? cantripsFull : spellsFull)}
        searchPlaceholder="Search spells…"
        onToggle={(spell: SpellData) => onToggle({ name: spell.name, source: spell.source })}
      />
    </View>
  );
}
