import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import type { LevelUpPlan } from "../../rules/levelUpFlow";

/**
 * The Subclass step: the subclasses the planned class offers at the new level, as chips. The pick lives in
 * the plan; `planLevelUp` pre-selects it when exactly one subclass is offered, so its chip starts selected.
 */
export function SubclassStep({
  plan,
  options,
  onPick,
}: {
  plan: LevelUpPlan;
  options: { name: string; source: string }[];
  onPick: (name: string, source: string) => void;
}) {
  const { theme } = useAppTheme();
  const selected = plan.picks.subclass?.name;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => {
        const isCurrent = selected?.toLowerCase() === option.name.toLowerCase();
        return (
          <TouchableOpacity
            key={`${option.name}__${option.source}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent }}
            aria-selected={isCurrent}
            accessibilityLabel={`Subclass ${option.name}`}
            onPress={() => onPick(option.name, option.source)}
            activeOpacity={0.7}
            style={[
              styles.subclassChip,
              {
                backgroundColor: isCurrent ? theme.accentGlow : theme.surfaceHighlight,
                borderColor: isCurrent ? theme.accentHover : theme.border,
              },
            ]}
          >
            <Text
              style={{
                color: isCurrent ? theme.accentHover : theme.text,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {option.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subclassChip: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
});
