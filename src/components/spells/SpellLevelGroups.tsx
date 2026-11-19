import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import type { SpellPageLevel } from "../../rules/spellPage";
import { Card } from "../ui/Card";
import { SpellRow, type SpellRowActions } from "./SpellRow";

interface SpellLevelGroupsProps {
  levels: SpellPageLevel[];
  actions: SpellRowActions;
}

/** The Spell Page's rows grouped by level, each level under its header. */
export const SpellLevelGroups: React.FC<SpellLevelGroupsProps> = ({ levels, actions }) => {
  const { theme } = useAppTheme();

  return (
    <>
      {levels.map((group) => {
        const spellsAtLevel = group.rows;

        return (
          <View key={`level_group_${group.level}`} style={{ marginBottom: 14 }}>
            <Text style={[styles.levelHeader, { color: theme.textSecondary }]}>
              {group.title} ({spellsAtLevel.length})
            </Text>

            <Card style={{ padding: 4 }}>
              {spellsAtLevel.map((row, idx) => (
                <SpellRow
                  key={`${row.name}__${row.source}__${row.ownerKey || ""}`}
                  row={row}
                  isLast={idx === spellsAtLevel.length - 1}
                  actions={actions}
                />
              ))}
            </Card>
          </View>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  levelHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
});
