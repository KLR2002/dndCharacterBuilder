import React, { useState } from "react";
import { View } from "react-native";
import type { SpellData } from "../../types/dnd5e";
import type { LevelUpPlan } from "../../rules/levelUpFlow";
import { SearchBar } from "../ui/SearchBar";
import { ChoiceRow } from "./ChoiceRow";

/**
 * The Spells step: the spells the new level makes available to the planned class (minus the known ones,
 * from `newSpellsForLevelUp`). Toggling a spell adds or removes it from the plan's `learnedSpells`.
 */
export function SpellsStep({
  plan,
  spells,
  onToggle,
}: {
  plan: LevelUpPlan;
  spells: SpellData[];
  onToggle: (spell: { name: string; source: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const known = new Set((plan.picks.learnedSpells ?? []).map((s) => s.name.toLowerCase()));
  const shown = spells.filter(
    (s) => !query || s.name.toLowerCase().includes(query) || (s.school ?? "").toLowerCase().includes(query),
  );
  return (
    <View style={{ gap: 8 }}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search spells…" />
      {shown.map((spell) => (
        <ChoiceRow
          key={`${spell.name}_${spell.source}`}
          label={spell.name}
          detail={spell.level === 0 ? "Cantrip" : `Lvl ${spell.level}`}
          selected={known.has(spell.name.toLowerCase())}
          accessibilityLabel={`Learn ${spell.name}`}
          onPress={() => onToggle({ name: spell.name, source: spell.source })}
        />
      ))}
    </View>
  );
}
