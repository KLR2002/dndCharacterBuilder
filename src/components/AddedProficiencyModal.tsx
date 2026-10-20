import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import type { AddedCategory } from "../rules/addedProficiencies";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

interface AddedProficiencyModalProps {
  visible: boolean;
  category: AddedCategory;
  /** Known names the sheet does not hold yet. */
  options: string[];
  /** Whether a typed name would be accepted (not empty, not already held). */
  isAddable: (raw: string) => boolean;
  onAdd: (raw: string) => void;
  onClose: () => void;
}

/** The custom-name field. It mounts only while the modal is open, so closing it clears the typed text. */
const CustomNameRow: React.FC<{ isAddable: (raw: string) => boolean; onAdd: (raw: string) => void }> = ({
  isAddable,
  onAdd,
}) => {
  const { theme } = useAppTheme();
  const [custom, setCustom] = useState("");
  return (
    <View style={styles.customRow}>
      <TextInput
        value={custom}
        onChangeText={setCustom}
        placeholder="Custom name"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
      />
      <Button title="Add" size="sm" disabled={!isAddable(custom)} onPress={() => onAdd(custom)} />
    </View>
  );
};

/** Picks a tool or language to add by hand: the known list, then a custom name. Labels only. */
export const AddedProficiencyModal: React.FC<AddedProficiencyModalProps> = ({
  visible,
  category,
  options,
  isAddable,
  onAdd,
  onClose,
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal visible={visible} onClose={onClose} title={category === "tools" ? "Add Tool Proficiency" : "Add Language"}>
      <View style={{ gap: 8 }}>
        {options.map((name) => (
          <TouchableOpacity
            key={name}
            accessibilityRole="button"
            onPress={() => onAdd(name)}
            style={[styles.option, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}
          >
            <Text style={{ color: theme.text, fontSize: 14 }}>{name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {visible ? <CustomNameRow isAddable={isAddable} onAdd={onAdd} /> : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  option: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  customRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  input: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 0,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 14,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
});
