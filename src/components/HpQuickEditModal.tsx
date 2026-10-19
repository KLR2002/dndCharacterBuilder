import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { damage, heal, HitPointState, parseAmount, setCurrentHp } from "../rules/hitPoints";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export interface HpQuickEditModalProps {
  visible: boolean;
  onClose: () => void;
  currentHp: number;
  tempHp: number;
  maxHp: number;
  onChange: (patch: HitPointState) => void;
}

/**
 * Shared hit point editor opened from the character header and the Stats tab.
 * Damage, Heal and Set to all read the amount field. The modal stays open after each change.
 */
export const HpQuickEditModal: React.FC<HpQuickEditModalProps> = ({
  visible,
  onClose,
  currentHp,
  tempHp,
  maxHp,
  onChange,
}) => {
  const { theme } = useAppTheme();
  const [amountInput, setAmountInput] = useState("1");

  // Each opening starts from the default amount rather than the last typed value. Adjusting state
  // while rendering (not in an effect) keeps this to one render when `visible` turns true.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setAmountInput("1");
  }

  const amount = parseAmount(amountInput);
  const valid = amount !== undefined;
  const state: HitPointState = { currentHp, tempHp };

  const applyWith = (next: (value: number) => HitPointState) => {
    if (amount === undefined) return;
    onChange(next(amount));
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Hit Points">
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: theme.text }]}>
          {currentHp} / {maxHp}
        </Text>
        {tempHp > 0 && (
          <Text style={[styles.tempText, { color: theme.tempHpYellow }]}>+{tempHp} Temp</Text>
        )}
      </View>

      <View style={styles.amountRow}>
        <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>Amount</Text>
        <TextInput
          accessibilityLabel="Amount"
          style={[
            styles.amountInput,
            { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
          ]}
          value={amountInput}
          onChangeText={setAmountInput}
          keyboardType="number-pad"
          selectTextOnFocus
          placeholder="Amt"
          placeholderTextColor={theme.textMuted}
        />
      </View>

      {!valid && (
        <Text style={[styles.hintText, { color: theme.danger }]}>Enter a whole number, 0 or more.</Text>
      )}

      <View style={styles.actionRow}>
        <Button
          title="Damage"
          variant="danger"
          disabled={!valid}
          onPress={() => applyWith((value) => damage(state, value))}
          style={styles.actionButton}
        />
        <Button
          title="Heal"
          variant="success"
          disabled={!valid}
          onPress={() => applyWith((value) => heal(state, value, maxHp))}
          style={styles.actionButton}
        />
        <Button
          title="Set to"
          variant="secondary"
          disabled={!valid}
          onPress={() => applyWith((value) => setCurrentHp(state, value, maxHp))}
          style={styles.actionButton}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 16,
  },
  summaryText: {
    flexShrink: 1,
    fontSize: 28,
    fontWeight: "bold",
  },
  tempText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  amountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  amountLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  amountInput: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 16,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  hintText: {
    fontSize: 12,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 96,
  },
});
