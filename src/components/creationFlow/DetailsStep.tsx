import React from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import type { Character } from "../../types/character";
import { Card } from "../ui/Card";

/**
 * The Details step: name (required), gender and alignment (optional). The inputs follow the Android input
 * rules: no fixed height, and on Android no vertical padding or font padding so the text does not clip.
 */
export function DetailsStep({
  character,
  onUpdate,
}: {
  character: Character;
  onUpdate: (updates: Partial<Character>) => void;
}) {
  const { theme } = useAppTheme();
  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.surfaceHighlight,
      borderColor: theme.border,
    },
    Platform.OS === "android" && styles.androidInput,
  ];
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
        <TextInput
          style={inputStyle}
          value={character.name}
          onChangeText={(text) => onUpdate({ name: text })}
          placeholder="Character Name"
          placeholderTextColor={theme.textMuted}
          maxLength={60}
          accessibilityLabel="Character name"
        />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Gender</Text>
        <TextInput
          style={inputStyle}
          value={character.gender ?? ""}
          onChangeText={(text) => onUpdate({ gender: text })}
          placeholder="Optional"
          placeholderTextColor={theme.textMuted}
          maxLength={40}
          accessibilityLabel="Gender"
        />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Alignment</Text>
        <TextInput
          style={inputStyle}
          value={character.alignment ?? ""}
          onChangeText={(text) => onUpdate({ alignment: text })}
          placeholder="Optional"
          placeholderTextColor={theme.textMuted}
          maxLength={40}
          accessibilityLabel="Alignment"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    minHeight: 44,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  androidInput: {
    paddingVertical: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
});
