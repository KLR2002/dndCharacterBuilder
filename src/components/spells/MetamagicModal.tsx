import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../../context/ThemeContext";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { METAMAGIC_OPTIONS } from "./metamagicOptions";

interface MetamagicModalProps {
  visible: boolean;
  onClose: () => void;
  sorcererLevel: number;
  allowance: number;
  chosen: string[];
  onToggle: (name: string) => void;
}

/** The Metamagic picks: each option toggles while the allowance has room, and the rest are disabled. */
export const MetamagicModal: React.FC<MetamagicModalProps> = ({
  visible,
  onClose,
  sorcererLevel,
  allowance,
  chosen,
  onToggle,
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal visible={visible} onClose={onClose} title="Choose Metamagic Options">
      <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 12 }}>
        Select up to {allowance} options (Level {sorcererLevel} Sorcerer). Selected: {chosen.length}/{allowance}
      </Text>

      {METAMAGIC_OPTIONS.map((opt) => {
        const isChosen = chosen.includes(opt.name);
        const isMaxReached = chosen.length >= allowance && !isChosen;

        return (
          <TouchableOpacity
            key={opt.name}
            onPress={() => onToggle(opt.name)}
            disabled={isMaxReached}
            style={[
              styles.metaOptionCard,
              {
                backgroundColor: isChosen ? theme.accentGlow : theme.surfaceHighlight,
                borderColor: isChosen ? theme.accentHover : theme.border,
                opacity: isMaxReached ? 0.5 : 1,
              },
            ]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: isChosen ? theme.accentHover : theme.text, fontWeight: "700" }}>
                  {opt.name}
                </Text>
                <Badge label={opt.cost} size="sm" variant="secondary" />
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                {opt.desc}
              </Text>
            </View>
            <Ionicons
              name={isChosen ? "checkbox" : "square-outline"}
              size={20}
              color={isChosen ? theme.accentHover : theme.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </Modal>
  );
};

const styles = StyleSheet.create({
  metaOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
});
