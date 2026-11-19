import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, TouchableOpacityProps, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { Button } from "./ui/Button";

export interface HitPointBlockProps {
  /** Small caps label above the number, e.g. "HIT POINTS". */
  label: string;
  currentHp: number;
  maxHp: number;
  /** Shows "(+N Temp)" beside the number when above 0. Omit for a target without temp HP. */
  tempHp?: number;
  /** Props for the touchable number (from useHpQuickEdit().triggerProps). Tapping it opens the HP box. Omit for a read-only number. */
  numberProps?: TouchableOpacityProps;
  /** Right side of the label row, such as the HP Settings button. */
  headerRight?: React.ReactNode;
  /** The Damage / Heal row. Omit for a read-only block. */
  actions?: {
    /** Typed amount for the buttons. The caller reads it. */
    amount: string;
    onAmountChange: (value: string) => void;
    onDamage: () => void;
    onHeal: () => void;
  };
}

/**
 * The HP read-out used by the Hit Points card and the Active Wild Shape box: label, big current
 * number with max, progress bar, and the Damage / Heal row when `actions` is given. Presentational only.
 */
export const HitPointBlock: React.FC<HitPointBlockProps> = ({
  label,
  currentHp,
  maxHp,
  tempHp,
  numberProps,
  headerRight,
  actions,
}) => {
  const { theme } = useAppTheme();
  const fillPercent = maxHp > 0 ? Math.min(100, Math.max(0, (currentHp / maxHp) * 100)) : 0;
  const numberContent = (
    <>
      <Text style={[styles.current, { color: currentHp > 0 ? theme.hpGreen : theme.danger }]}>{currentHp}</Text>
      <Text style={[styles.max, { color: theme.textSecondary }]}>/ {maxHp}</Text>
    </>
  );

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
          <View style={styles.numberRow}>
            {numberProps ? (
              <TouchableOpacity {...numberProps} style={styles.numberRow}>
                {numberContent}
              </TouchableOpacity>
            ) : (
              <View style={styles.numberRow}>{numberContent}</View>
            )}
            {tempHp !== undefined && tempHp > 0 && (
              <Text style={{ color: theme.tempHpYellow, fontWeight: "700", fontSize: 16 }}>(+{tempHp} Temp)</Text>
            )}
          </View>
        </View>
        {headerRight}
      </View>

      <View style={[styles.barTrack, { backgroundColor: theme.surfaceRaised }]}>
        <View
          style={[
            styles.barFill,
            {
              backgroundColor: currentHp > maxHp * 0.25 ? theme.hpGreen : theme.danger,
              width: `${fillPercent}%`,
            },
          ]}
        />
      </View>

      {actions && (
        <View style={styles.actionsRow}>
          <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={actions.amount}
              onChangeText={actions.onAmountChange}
              keyboardType="number-pad"
              placeholder="Amt"
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <Button title="Damage" variant="danger" size="sm" onPress={actions.onDamage} style={{ flex: 1 }} />
          <Button title="Heal" variant="success" size="sm" onPress={actions.onHeal} style={{ flex: 1 }} />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  headerMain: {
    flexShrink: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  numberRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 6,
  },
  current: {
    fontSize: 32,
    fontWeight: "bold",
  },
  max: {
    fontSize: 20,
    fontWeight: "600",
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginVertical: 8,
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  inputContainer: {
    flexBasis: 60,
    flexShrink: 1,
    minHeight: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    padding: 0,
  },
});
