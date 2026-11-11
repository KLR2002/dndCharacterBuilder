import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";

/**
 * One choice row of a Level-Up Flow step: a label, a right-aligned detail (the level change, the missing
 * score, the rolled result), a checkmark when selected. Disabled rows show only their detail.
 */
export function ChoiceRow({
  label,
  detail,
  selected,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  detail?: string;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      aria-selected={selected ?? false}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.choiceRow,
        {
          borderColor: selected ? theme.accentBorder : theme.border,
          backgroundColor: selected ? theme.accentGlow : theme.surface,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        style={[{ fontSize: 15, fontWeight: selected ? "700" : "500", flex: 1, minWidth: 0 }, { color: theme.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {detail ? (
        <Text
          style={[
            {
              fontSize: 13,
              flexShrink: 0,
              fontVariant: ["tabular-nums"],
              textAlign: "right",
            },
            { color: selected ? theme.accentHover : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      ) : null}
      {selected ? <Ionicons name="checkmark" size={16} color={theme.accentHover} style={{ flexShrink: 0 }} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  choiceRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
