import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { Card } from "../ui/Card";
import type { LevelUpSummaryRow } from "../../rules/levelUpFlow";

/** The Review step: what the confirmed plan changes, in label/value rows. The "Level up" action is the flow's primary action. */
export function ReviewStep({ rows }: { rows: LevelUpSummaryRow[] }) {
  const { theme } = useAppTheme();
  return (
    <Card style={{ gap: 10 }}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{row.label}</Text>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={2}>
            {row.value || "—"}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  label: {
    width: 110,
    flexShrink: 0,
    fontSize: 13,
  },
  value: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
});
