import React, { useState } from "react";
import { View } from "react-native";
import { SearchBar } from "../ui/SearchBar";
import { ChoiceRow } from "./ChoiceRow";
import type { LevelUpClassOption } from "../../rules/levelUpFlow";

/**
 * The Class step: the held classes first with only their level change ("3 → 4"), then the other classes of
 * the active books with "1". A class whose multiclass requirement is missed is disabled and shows only the
 * missing score ("Int 13"). The rows come from `classStepOptions` in the rules module.
 */
export function ClassStep({
  options,
  selectedClassName,
  onPick,
}: {
  options: LevelUpClassOption[];
  selectedClassName?: string;
  onPick: (option: LevelUpClassOption) => void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const shown = options.filter((option) => option.className.toLowerCase().includes(query));
  return (
    <View style={{ gap: 8 }}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search classes…" />
      {shown.map((option) => {
        const selected = selectedClassName?.toLowerCase() === option.className.toLowerCase();
        const detail = option.missingRequirement ?? (option.held ? `${option.fromLevel} → ${option.toLevel}` : `${option.toLevel}`);
        return (
          <ChoiceRow
            key={`${option.className}__${option.source}`}
            label={option.className}
            detail={detail}
            selected={selected}
            disabled={option.missingRequirement !== undefined}
            accessibilityLabel={`Level up ${option.className}`}
            onPress={() => onPick(option)}
          />
        );
      })}
    </View>
  );
}
