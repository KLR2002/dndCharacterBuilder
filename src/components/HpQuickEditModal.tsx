import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { parseAmount } from "../rules/hitPoints";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export type HpActionKind = "damage" | "heal" | "set";

/** One change the player asked for. The owner of the HP value decides what it does to the state. */
export interface HpAction {
  kind: HpActionKind;
  amount: number;
}

export interface HpQuickEditModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  currentHp: number;
  maxHp: number;
  /** Shows a Temp HP line when provided and above 0. Omit it for a target without temp HP. */
  tempHp?: number;
  onAction: (action: HpAction) => void;
}

/**
 * Shared hit point editor, presentational only: it reads the amount field and reports one
 * action. The caller turns the action into a patch (see useHpQuickEdit). The modal stays open after each change.
 */
export const HpQuickEditModal: React.FC<HpQuickEditModalProps> = ({
  visible,
  onClose,
  title = "Hit Points",
  currentHp,
  maxHp,
  tempHp,
  onAction,
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

  const act = (kind: HpActionKind) => {
    if (amount === undefined) return;
    onAction({ kind, amount });
  };

  return (
    <Modal visible={visible} onClose={onClose} title={title}>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: theme.text }]}>
          {currentHp} / {maxHp}
        </Text>
        {tempHp !== undefined && tempHp > 0 && (
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
          onPress={() => act("damage")}
          style={styles.actionButton}
        />
        <Button
          title="Heal"
          variant="success"
          disabled={!valid}
          onPress={() => act("heal")}
          style={styles.actionButton}
        />
        <Button
          title="Set to"
          variant="secondary"
          disabled={!valid}
          onPress={() => act("set")}
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
