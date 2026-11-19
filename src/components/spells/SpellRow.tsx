import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../../context/ThemeContext";
import type { SpellPageRow } from "../../rules/spellPage";
import type { SpellData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

/** What a row's controls ask for. The Spells tab writes the character; the row only reports the tap. */
export interface SpellRowActions {
  onTogglePrepared: (row: SpellPageRow) => void;
  onShowSpell: (spell: SpellData | undefined) => void;
  onSwap: (row: SpellPageRow) => void;
  onReset: (row: SpellPageRow) => void;
  onForget: (row: SpellPageRow) => void;
}

interface SpellRowProps {
  row: SpellPageRow;
  isLast: boolean;
  actions: SpellRowActions;
}

/** One row of the Spell Page: the prepare control, the name and badges, the swap and reset, and forget. */
export const SpellRow: React.FC<SpellRowProps> = ({ row, isLast, actions }) => {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.spellRow,
        {
          borderBottomColor: theme.border,
          borderBottomWidth: isLast ? 0 : 1,
        },
      ]}>
      {/* Prepared Checkbox (for non-cantrips) */}
      {row.prepare !== "none" ? (
        row.prepare === "locked" ? (
          <View style={styles.prepToggle}>
            <Ionicons name="lock-closed" size={16} color={theme.accentHover} />
          </View>
        ) : (
          <TouchableOpacity onPress={() => actions.onTogglePrepared(row)} style={styles.prepToggle}>
            <Ionicons
              name={row.prepared ? "radio-button-on" : "radio-button-off"}
              size={18}
              color={row.prepared ? theme.accentHover : theme.textMuted}
            />
          </TouchableOpacity>
        )
      ) : (
        <View style={{ width: 26 }} />
      )}

      {/* Spell Name & Info (opens detail modal) */}
      <TouchableOpacity onPress={() => actions.onShowSpell(row.details)} style={{ flex: 1, paddingVertical: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={[styles.spellTitle, { color: theme.text }]}>{row.name}</Text>
          {row.badges.map((badge) => (
            <Badge key={badge.label} label={badge.label} variant={badge.tone} size="sm" />
          ))}
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>{row.subtitle}</Text>
      </TouchableOpacity>

      {/* Swap Actions for Subclass-Granted Known Spells */}
      {row.swap && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {row.swap.canReset && (
            <Button title="Reset to Default" size="sm" variant="ghost" onPress={() => actions.onReset(row)} />
          )}
          <Button
            title="Swap"
            icon="swap-horizontal-outline"
            size="sm"
            variant="outline"
            onPress={() => actions.onSwap(row)}
          />
        </View>
      )}

      {/* Remove Spell */}
      {row.canForget && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Remove ${row.name}`}
          onPress={() => actions.onForget(row)}
          style={{ padding: 6, minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  spellRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  prepToggle: {
    padding: 4,
  },
  spellTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
});
