import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../../context/ThemeContext";
import type { SpellPageRitualBook } from "../../rules/spellPage";
import type { SpellData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { SpellDetailPayload } from "./spellFormat";

interface RitualBookCardProps {
  ritual: SpellPageRitualBook;
  onInscribe: () => void;
  onRemove: (ritualName: string) => void;
  onShowSpell: (spell: SpellData | undefined) => void;
  onShowDetail: (detail: SpellDetailPayload) => void;
}

/** The Book of Ancient Secrets: the inscribed rituals, with the Inscribe button and removal of rituals taken from the book. */
export const RitualBookCard: React.FC<RitualBookCardProps> = ({ ritual, onInscribe, onRemove, onShowSpell, onShowDetail }) => {
  const { theme } = useAppTheme();

  return (
    <Card style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              RITUAL BOOK (BOOK OF ANCIENT SECRETS)
            </Text>
            <Badge label="Ritual Casting" variant="accent" size="sm" />
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
            {ritual.entries.length} inscribed rituals • Max level {ritual.maxLevel} (half Warlock level rounded up)
          </Text>
        </View>
        <Button
          title="Inscribe Ritual"
          icon="add"
          size="sm"
          variant="secondary"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onInscribe}
        />
      </View>

      {ritual.entries.length === 0 ? (
        <Text style={{ color: theme.textMuted, fontSize: 12, fontStyle: "italic", paddingVertical: 4 }}>
          No rituals inscribed yet. Choose your 2 starting rituals in the builder or inscribe rituals found during adventures.
        </Text>
      ) : (
        <View style={{ gap: 4 }}>
          {ritual.entries.map((item, idx) => (
            <View
              key={`ritual_${item.name}_${idx}`}
              style={[
                styles.spellRow,
                {
                  borderBottomColor: theme.border,
                  borderBottomWidth: idx === ritual.entries.length - 1 ? 0 : 1,
                  paddingVertical: 6,
                },
              ]}>
              <TouchableOpacity
                onPress={() => {
                  if (item.details) {
                    onShowSpell(item.details);
                  } else {
                    onShowDetail({
                      title: item.name,
                      subtitle: `Level ${item.level} Ritual (${item.source})`,
                      content: "Ritual spell inscribed in Book of Shadows.",
                    });
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ flex: 1, paddingVertical: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={[styles.spellTitle, { color: theme.text }]}>
                    {item.name}
                  </Text>
                  <Badge label="[Ritual Only]" variant="accent" size="sm" />
                  <Badge label={`Level ${item.level}`} variant="secondary" size="sm" />
                  {item.isStarting ? (
                    <Badge label="Starting" variant="secondary" size="sm" />
                  ) : (
                    <Badge label="Inscribed" variant="secondary" size="sm" />
                  )}
                </View>
              </TouchableOpacity>

              {!item.isStarting && (
                <TouchableOpacity
                  onPress={() => onRemove(item.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  spellRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  spellTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
});
