import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import type { InitiativePart } from "../rules/initiative";
import { formatModifier } from "../services/dndRules";
import { Modal } from "./ui/Modal";

export interface InitiativeBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  /** The parts of the initiative, Dexterity first. */
  parts: InitiativePart[];
  total: number;
}

/** Lists each part of the initiative by its source, with its signed value, and the total. Numbers only. */
export const InitiativeBreakdownModal: React.FC<InitiativeBreakdownModalProps> = ({
  visible,
  onClose,
  parts,
  total,
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal visible={visible} onClose={onClose} title="Initiative">
      {parts.map((part, index) => (
        <View key={index} style={[styles.row, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.text }]}>{part.label}</Text>
          <Text style={[styles.value, { color: theme.text }]}>{formatModifier(part.value)}</Text>
        </View>
      ))}
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <Text style={[styles.label, styles.totalLabel, { color: theme.text }]}>Total</Text>
        <Text style={[styles.value, styles.totalValue, { color: theme.accent }]}>{formatModifier(total)}</Text>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15,
  },
  value: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: "600",
  },
  totalLabel: {
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
  },
});
