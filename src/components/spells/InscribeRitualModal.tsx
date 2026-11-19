import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import type { SpellData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SearchBar } from "../ui/SearchBar";
import type { SpellDetailPayload } from "./spellFormat";

interface InscribeRitualModalProps {
  visible: boolean;
  onClose: () => void;
  maxRitualLevel: number;
  search: string;
  onSearchChange: (text: string) => void;
  levelFilter: number | null;
  onLevelFilterChange: (level: number | null) => void;
  /** The rituals the book can still take, narrowed by the search and the level filter. */
  offers: SpellData[];
  onInscribe: (spell: SpellData) => void;
  onShowDetail: (detail: SpellDetailPayload) => void;
}

/** The rituals a Book of Ancient Secrets can still take, with a level filter and a search. */
export const InscribeRitualModal: React.FC<InscribeRitualModalProps> = ({
  visible,
  onClose,
  maxRitualLevel,
  search,
  onSearchChange,
  levelFilter,
  onLevelFilterChange,
  offers,
  onInscribe,
  onShowDetail,
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Inscribe Ritual"
      subtitle={`Max level ${maxRitualLevel} • Cost: 50 gp & 2 hrs per spell level`}
    >
      <SearchBar value={search} onChangeText={onSearchChange} placeholder="Search rituals across classes..." />

      {/* Level Filter Pills up to maxRitualLevel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginVertical: 8 }}
        contentContainerStyle={{ alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => onLevelFilterChange(null)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.filterPill,
            {
              backgroundColor: levelFilter === null ? theme.accentGlow : theme.surfaceHighlight,
              borderColor: levelFilter === null ? theme.accentHover : theme.border,
              borderWidth: 1,
            },
          ]}>
          <Text style={{ color: levelFilter === null ? theme.text : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>All Levels (1-{maxRitualLevel})</Text>
        </TouchableOpacity>
        {Array.from({ length: maxRitualLevel }).map((_, idx) => {
          const lvl = idx + 1;
          return (
            <TouchableOpacity
              key={`inscribe_lvl_${lvl}`}
              onPress={() => onLevelFilterChange(lvl)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.filterPill,
                {
                  backgroundColor: levelFilter === lvl ? theme.accentGlow : theme.surfaceHighlight,
                  borderColor: levelFilter === lvl ? theme.accentHover : theme.border,
                  borderWidth: 1,
                },
              ]}>
              <Text style={{ color: levelFilter === lvl ? theme.text : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>Level {lvl}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {offers.length === 0 ? (
        <View style={{ padding: 16, alignItems: "center" }}>
          <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: "center" }}>
            No eligible rituals found matching your filters.
          </Text>
        </View>
      ) : (
        offers.map((s) => (
          <View key={`inscribe_row_${s.name}_${s.source}`} style={[styles.pickerSpellRow, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              onPress={() =>
                onShowDetail({
                  title: s.name,
                  subtitle: `Level ${s.level} Ritual (${s.source})`,
                  content: `${s.level}th-level ${s.school || ""} (Ritual)\n\n• Casting Time: ${s.castingTime || "1 action"}\n• Range: ${s.range || "Self"}\n• Components: ${s.componentsString || "V, S"}\n• Duration: ${s.duration || "Instantaneous"}\n• Classes: ${s.classes?.join(", ") || "None"}\n\n${s.description || ""}`,
                })
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ flex: 1, paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{s.name}</Text>
                <Badge label={`Level ${s.level}`} variant="secondary" size="sm" />
                {s.school && <Badge label={s.school} variant="secondary" size="sm" />}
                <Badge label={s.source} variant="secondary" size="sm" />
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                {s.classes?.join(", ") || "General"}
              </Text>
            </TouchableOpacity>

            <Button
              title="Inscribe"
              size="sm"
              variant="primary"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onInscribe(s)}
            />
          </View>
        ))
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerSpellRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
});
