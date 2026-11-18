import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { useRollLog, type TraySegment } from "../../context/RollLogContext";
import { formatModifier } from "../../rules/abilities.ts";
import type { D20Mode } from "../../rules/dice.ts";
import {
  addDieToExpression,
  bumpExpressionModifier,
  evaluateRolls,
  expressionD20Mode,
  expressionModifier,
  parseRollExpression,
  setExpressionD20Mode,
} from "../../rules/rollExpression.ts";
import { DIE_SIZES } from "../../rules/rollLog.ts";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { RollLogList } from "./rollViews";

const MODE_CHOICES: { mode: D20Mode; label: string }[] = [
  { mode: "disadvantage", label: "Disadvantage" },
  { mode: "none", label: "Normal" },
  { mode: "advantage", label: "Advantage" },
];

/**
 * The dice tray behind the floating button, in the shared Modal shell: on the "Dice" segment a Roll
 * Expression field (die buttons append to it, the modifier stepper moves its trailing modifier, and
 * Disadvantage / Normal / Advantage shows for a lone d20), and on the "Log" segment the session Roll Log.
 * Rolling publishes each Roll of the expression as one batch, empties the field and closes the tray, so
 * the result card shows above the floating button.
 */
export function DiceTray() {
  const { theme } = useAppTheme();
  const { trayVisible, traySegment, closeTray, selectTraySegment, entries, rollAndPublish, expression, setExpression } = useRollLog();
  const parsed = parseRollExpression(expression);
  const valid = parsed.ok;
  const text = expression.trim();
  const d20Mode = expressionD20Mode(text);
  const modifier = expressionModifier(text);
  // A long expression is cut in the button's title only; the field keeps the full text.
  const titleText = text.length > 28 ? `${text.slice(0, 28)}…` : text;
  const rollLabel = text ? `Roll ${titleText}` : "Roll";

  const rollExpression = () => {
    if (!parsed.ok) return;
    const rolls = parsed.rolls;
    rollAndPublish((random) =>
      evaluateRolls(rolls, random).map(({ text: rollText, roll }) => ({
        roll,
        source: "Dice tray",
        label: rollText,
        d20Mode: expressionD20Mode(rollText) ?? "none",
      })),
    );
    setExpression("");
    closeTray();
  };

  const stepButton = (icon: "remove" | "add", label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepBtn,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHighlight : theme.surfaceRaised },
      ]}>
      <Ionicons name={icon} size={18} color={theme.text} />
    </Pressable>
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
          <TextInput
            accessibilityLabel="Roll Expression"
            value={expression}
            onChangeText={setExpression}
            onSubmitEditing={() => {
              if (valid) rollExpression();
            }}
            placeholder="2d6+3"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            style={[
              styles.expressionInput,
              { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
            ]}
          />
          {!parsed.ok && text ? <Text style={[styles.errorText, { color: theme.danger }]}>{parsed.message}</Text> : null}
          <View style={styles.dieButtonsRow}>
            {DIE_SIZES.map((sides) => (
              <Pressable
                key={sides}
                accessibilityRole="button"
                accessibilityLabel={`Add d${sides}`}
                onPress={() => setExpression(addDieToExpression(expression, sides))}
                style={({ pressed }) => [
                  styles.dieBtn,
                  { borderColor: theme.border, backgroundColor: pressed ? theme.accentGlow : theme.surfaceRaised },
                ]}>
                <Text style={[styles.dieBtnLabel, { color: theme.text }]}>d{sides}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.stepperRow}>
            <Text style={[styles.stepperLabel, { color: theme.textSecondary }]}>Modifier</Text>
            {stepButton("remove", "Modifier decrease", () => setExpression(bumpExpressionModifier(expression, -1)))}
            <Text style={[styles.stepValue, { color: theme.text }]}>{formatModifier(modifier)}</Text>
            {stepButton("add", "Modifier increase", () => setExpression(bumpExpressionModifier(expression, 1)))}
          </View>
          {d20Mode !== null ? (
            <View style={styles.modeRow}>
              {MODE_CHOICES.map(({ mode, label }) => {
                const selected = d20Mode === mode;
                return (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setExpression(setExpressionD20Mode(expression, mode))}
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
        disabled={!valid}
        onPress={rollExpression}
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
  expressionInput: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
  },
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
    minHeight: 48,
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
    minHeight: 48,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
