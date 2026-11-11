import React from "react";
import { View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { RuleChoicePicker } from "../builder/builderStyles";
import type { LevelUpPlan } from "../../rules/levelUpFlow";

/**
 * The Class Choices step: the choices the new level brings, read from the plan's `classChoices` (the same
 * shared reader the Creation Flow uses). Picks toggle into the plan's `classChoicePicks`; nothing is
 * written to the Character before Review.
 */
export function ClassChoicesStep({
  plan,
  onToggle,
}: {
  plan: LevelUpPlan;
  onToggle: (choiceId: string, option: string, choose: number) => void;
}) {
  const { theme } = useAppTheme();
  const choices = plan.classChoices ?? [];
  if (choices.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      {choices.map((choice) => (
        <RuleChoicePicker
          key={choice.id}
          label={`${choice.traitName} (choose ${choice.choose})`}
          choose={choice.choose}
          from={choice.options.map((o) => o.name)}
          chosen={plan.picks.classChoicePicks?.[choice.id] ?? []}
          onToggle={(option) => onToggle(choice.id, option, choice.choose)}
          theme={theme}
        />
      ))}
    </View>
  );
}
