import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Character } from "../../types/character";
import { CLASS_STARTING_EQUIPMENT, STARTING_GOLD_BY_CLASS } from "../../rules/builderTransitions";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { builderStyles as styles } from "./builderStyles";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

export interface StartingGrantsSectionProps {
  character: Character;
  primaryClass?: string;
  onClaimGold: () => void;
  onClaimEquipment: () => void;
  onClaimAgain: () => void;
  onUpdateOption: (opt: "equipment" | "gold") => void;
  theme: any;
}

export const StartingGrantsSection: React.FC<StartingGrantsSectionProps> = ({
  character,
  primaryClass,
  onClaimGold,
  onClaimEquipment,
  onClaimAgain,
  onUpdateOption,
  theme,
}) => {
  const { isCompact } = useResponsiveLayout();
  const hasAnyClass = (character.classes || []).length > 0;
  if (!hasAnyClass) return null;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[styles.heading, { color: theme.text }]}>Starting Equipment & Gold:</Text>
        {character.startingGrantsApplied && <Badge label="Claimed" variant="success" size="sm" />}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {(["equipment", "gold"] as const).map((opt) => {
          const active = character.startingOption === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                if (character.startingOption !== opt) {
                  if (character.startingGrantsApplied) {
                    if (opt === "gold") onClaimGold();
                    else onClaimEquipment();
                  } else {
                    onUpdateOption(opt);
                  }
                }
              }}
              style={[
                styles.optionChip,
                {
                  backgroundColor: active ? theme.accentGlow : theme.surface,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.accent : theme.textSecondary,
                  fontWeight: "600",
                  fontSize: 13,
                  flexShrink: 1,
                }}
              >
                {opt === "equipment" ? "🎒 Equipment" : "💰 Gold"}
                {character.startingGrantsApplied && active ? " (Active)" : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {character.startingGrantsApplied ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            padding: 10,
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 }}>
            <Ionicons name="checkmark-circle" size={20} color={theme.success} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>
                Starting Grants Claimed ({character.startingOption === "gold" ? "Starting Gold" : "Starting Equipment"})
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
                {character.startingOption === "gold"
                  ? "Starting gold is in your pouch. You can switch to equipment anytime above."
                  : "Starting equipment is in your inventory. You can switch to gold anytime above."}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", flexShrink: 1, gap: 8 }}>
            <Button
              title={character.startingOption === "gold" ? "Switch to Equipment" : "Switch to Gold"}
              variant="outline"
              size="sm"
              onPress={() => {
                if (character.startingOption === "gold") onClaimEquipment();
                else onClaimGold();
              }}
            />
            <Button
              title={`Claim ${character.startingOption === "gold" ? "Gold" : "Equipment"} again`}
              variant="outline"
              size="sm"
              onPress={onClaimAgain}
            />
          </View>
        </View>
      ) : (
        <>
          {character.startingOption === "gold" ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                Average starting gold for {primaryClass || "Class"}:{" "}
                <Text style={{ color: theme.accent, fontWeight: "700" }}>
                  {STARTING_GOLD_BY_CLASS[primaryClass || "Fighter"] ?? 100} gp
                </Text>
              </Text>
              <View style={{ flexDirection: isCompact ? "column" : "row" }}>
                <Button
                  title={`Claim Starting Gold (${STARTING_GOLD_BY_CLASS[primaryClass || "Fighter"] ?? 100} gp)`}
                  variant="primary"
                  size="sm"
                  icon="cash-outline"
                  onPress={onClaimGold}
                  style={isCompact ? { width: "100%" } : undefined}
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                Standard equipment pack for {primaryClass || "Class"}:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {(CLASS_STARTING_EQUIPMENT[primaryClass || "Fighter"] || []).map((eq) => (
                  <Badge
                    key={eq.name}
                    label={`${eq.name}${eq.quantity > 1 ? ` (×${eq.quantity})` : ""}`}
                    variant="surface"
                    size="sm"
                  />
                ))}
              </View>
              <View style={{ flexDirection: isCompact ? "column" : "row" }}>
                <Button
                  title="Claim Starting Equipment"
                  variant="primary"
                  size="sm"
                  icon="bag-add-outline"
                  onPress={onClaimEquipment}
                  style={isCompact ? { width: "100%" } : undefined}
                />
              </View>
            </View>
          )}
        </>
      )}
    </Card>
  );
};
