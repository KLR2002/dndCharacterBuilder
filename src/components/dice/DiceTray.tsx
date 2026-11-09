import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { useRollLog, type TraySegment } from "../../context/RollLogContext";
import { rollD20, rollDicePool, type D20Mode } from "../../rules/dice.ts";
import { DIE_SIZES, isSingleD20, poolExpression, poolLabel, addDieToPool, removePoolTerm, type PoolTerm } from "../../rules/rollLog.ts";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { RollLogList } from "./rollViews";

const MODE_CHOICES: { mode: D20Mode; label: string }[] = [
  { mode: "disadvantage", label: "Disadvantage" },
  { mode: "none", label: "Normal" },
  { mode: "advantage", label: "Advantage" },
];

/**
 * The dice tray behind the floating button, in the shared Modal shell: a pool builder on the "Dice"
 * segment (die buttons each add one die, the pool reads as removable chips, a modifier stepper, and
 * Disadvantage / Normal / Advantage for a lone d20) and the session Roll Log on the "Log" segment.
 * Rolling publishes through the Roll Log seam and closes the tray, so the result card shows above
 * the floating button.
 */
export function DiceTray() {
  const { theme } = useAppTheme();
  const { trayVisible, traySegment, closeTray, selectTraySegment, entries, publishRoll } = useRollLog();
  const [terms, setTerms] = useState<PoolTerm[]>([]);
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<D20Mode>("none");

  const singleD20 = isSingleD20(terms);
  const poolEmpty = terms.length === 0;
  const rollLabel = poolEmpty ? "Roll" : `Roll ${poolLabel(terms, modifier)}`;

  const rollPool = () => {
    if (poolEmpty) return;
    const roll = singleD20 ? rollD20(modifier, mode) : rollDicePool(poolExpression(terms, modifier));
    publishRoll({ roll, source: "Dice tray", d20Mode: singleD20 ? mode : "none" });
    closeTray();
  };

  const stepper = (value: number, onDelta: (delta: number) => void, label: string) => (
    <View style={styles.stepperRow}>
      <Text style={[styles.stepperLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} decrease`}
        onPress={() => onDelta(-1)}
        style={({ pressed }) => [
          styles.stepBtn,
          { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHighlight : theme.surfaceRaised },
        ]}>
        <Ionicons name="remove" size={18} color={theme.text} />
      </Pressable>
      <Text style={[styles.stepValue, { color: theme.text }]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} increase`}
        onPress={() => onDelta(1)}
        style={({ pressed }) => [
          styles.stepBtn,
          { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHighlight : theme.surfaceRaised },
        ]}>
        <Ionicons name="add" size={18} color={theme.text} />
      </Pressable>
    </View>
  );

  const body = (
    <View style={{ gap: 14 }}>
      <View style={[styles.segmentBar, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
        {(["dice", "log"] as TraySegment[]).map((segment) => {
          const selected = traySegment === segment;
          return (
            <Pressable
              key={segment}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectTraySegment(segment)}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor: selected ? theme.accentGlow : "transparent",
                  borderColor: selected ? theme.accentBorder : "transparent",
                },
              ]}>
              <Text
                style={{
                  color: selected ? theme.accentHover : theme.textSecondary,
                  fontSize: 13,
                  fontWeight: selected ? "700" : "500",
                }}>
                {segment === "dice" ? "Dice" : "Log"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {traySegment === "dice" ? (
        <View style={{ gap: 14 }}>
          <View style={styles.dieButtonsRow}>
            {DIE_SIZES.map((sides) => (
              <Pressable
                key={sides}
                accessibilityRole="button"
                accessibilityLabel={`Add d${sides}`}
                onPress={() => setTerms((prev) => addDieToPool(prev, sides))}
                style={({ pressed }) => [
                  styles.dieBtn,
                  { borderColor: theme.border, backgroundColor: pressed ? theme.accentGlow : theme.surfaceRaised },
                ]}>
                <Text style={[styles.dieBtnLabel, { color: theme.text }]}>d{sides}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipsRow}>
            {terms.map((term) => (
              <Pressable
                key={term.sides}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${term.count}d${term.sides}`}
                onPress={() => setTerms((prev) => removePoolTerm(prev, term.sides))}
                style={({ pressed }) => [
                  styles.termChip,
                  {
                    borderColor: theme.accentBorder,
                    backgroundColor: pressed ? theme.accentGlow : theme.surfaceRaised,
                  },
                ]}>
                <Text style={[styles.termChipLabel, { color: theme.accentHover }]}>
                  {term.count}d{term.sides}
                </Text>
                <Ionicons name="close" size={13} color={theme.accentHover} />
              </Pressable>
            ))}
          </View>
          {stepper(modifier, (delta) => setModifier((value) => value + delta), "Modifier")}
          {singleD20 ? (
            <View style={styles.modeRow}>
              {MODE_CHOICES.map(({ mode: choice, label }) => {
                const selected = mode === choice;
                return (
                  <Pressable
                    key={choice}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setMode(choice)}
                    style={[
                      styles.modeSeg,
                      {
                        borderColor: selected ? theme.accentBorder : theme.border,
                        backgroundColor: selected ? theme.accentGlow : theme.surfaceRaised,
                      },
                    ]}>
                    <Text
                      style={{
                        color: selected ? theme.accentHover : theme.textSecondary,
                        fontSize: 12,
                        fontWeight: selected ? "700" : "500",
                      }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : (
        <RollLogList entries={entries} />
      )}
    </View>
  );

  const footer =
    traySegment === "dice" ? (
      <Button
        title={rollLabel}
        variant="primary"
        size="lg"
        icon="dice-outline"
        disabled={poolEmpty}
        onPress={rollPool}
        style={{ width: "100%" }}
      />
    ) : undefined;

  return (
    <Modal visible={trayVisible} onClose={closeTray} title="Dice tray" footer={footer} maxHeightPercent={92}>
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  dieButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dieBtn: {
    minWidth: 52,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  dieBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    minHeight: 36,
    alignItems: "center",
  },
  termChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    minHeight: 36,
  },
  termChipLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
  },
  modeSeg: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBar: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
