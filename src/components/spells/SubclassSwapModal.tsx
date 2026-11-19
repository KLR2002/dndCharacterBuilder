import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import type { SpellData } from "../../types/dnd5e";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SearchBar } from "../ui/SearchBar";

interface SubclassSwapModalProps {
  visible: boolean;
  onClose: () => void;
  subtitle: string | undefined;
  search: string;
  onSearchChange: (text: string) => void;
  allowedSchools: string[];
  /** The replacements that match the search. */
  eligible: SpellData[];
  onSelect: (spell: SpellData) => void;
  onShowSpell: (spell: SpellData) => void;
}

/** The replacements a subclass spell may swap to, with their allowed schools and a search. */
export const SubclassSwapModal: React.FC<SubclassSwapModalProps> = ({
  visible,
  onClose,
  subtitle,
  search,
  onSearchChange,
  allowedSchools,
  eligible,
  onSelect,
  onShowSpell,
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal visible={visible} onClose={onClose} title="Swap Subclass Spell" subtitle={subtitle}>
      <SearchBar value={search} onChangeText={onSearchChange} placeholder="Search eligible replacement spells..." />

      <View style={{ marginVertical: 6 }}>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
          Allowed Schools: {allowedSchools.join(", ")} • Sorcerer, Warlock, Wizard
        </Text>
      </View>

      {eligible.length === 0 ? (
        <View style={{ padding: 24, alignItems: "center" }}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>
            No eligible replacement spells found.
          </Text>
        </View>
      ) : (
        eligible.map((s) => (
          <View key={`${s.name}_${s.source}`} style={[styles.pickerSpellRow, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => onShowSpell(s)} style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{s.name}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {s.level === 0 ? "Cantrip" : `Lvl ${s.level}`} • {s.school || ""} • {s.source}
              </Text>
            </TouchableOpacity>

            <Button title="Select" size="sm" variant="primary" onPress={() => onSelect(s)} />
          </View>
        ))
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  pickerSpellRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
});
