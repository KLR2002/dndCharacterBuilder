import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "../ui/Modal";
import { SearchBar } from "../ui/SearchBar";

interface OriginSwapPickerProps {
  /** The race's own name for the proficiency or language, listed first as the default entry. */
  original: string;
  /** The replacements the rule allows. */
  options: string[];
  /** The replacement in effect, if any. */
  replacement?: string;
  onChoose: (name: string) => void;
  theme: any;
}

/** One origin swap as a compact row. Tapping it opens the option list. */
export const OriginSwapPicker: React.FC<OriginSwapPickerProps> = ({ original, options, replacement, onChoose, theme }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const current = replacement ?? original;
  const query = search.trim().toLowerCase();
  const names = [original, ...options].filter((name) => name.toLowerCase().includes(query));

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${original}, ${current}`}
        onPress={() => setOpen(true)}
        style={[styles.row, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
      >
        <Text style={[styles.original, { color: theme.text }]}>{original}</Text>
        <View style={styles.value}>
          <Text style={[styles.current, { color: theme.accent }]}>{current}</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
        </View>
      </TouchableOpacity>
      <Modal visible={open} onClose={close} title={original}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search" />
        <View style={{ gap: 8 }}>
          {names.map((name) => {
            const selected = name === current;
            return (
              <TouchableOpacity
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (!selected) onChoose(name);
                  close();
                }}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text style={{ color: selected ? theme.accent : theme.text, fontSize: 14, fontWeight: selected ? "700" : "500", flexShrink: 1 }}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  original: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
  },
  value: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
    gap: 6,
  },
  current: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
