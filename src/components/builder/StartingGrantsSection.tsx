import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Character } from "../../types/character";
import { STARTING_GOLD_BY_CLASS } from "../../rules/builderTransitions";
import type { StartingEquipmentAddress, StartingEquipmentCard } from "../../rules/startingEquipment";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { builderStyles as styles } from "./builderStyles";
import { StartingEquipmentChoices } from "./StartingEquipmentChoices";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

export interface StartingGrantsSectionProps {
  character: Character;
  primaryClass?: string;
  startingCard: StartingEquipmentCard;
  onPickOption: (slot: number, letter: string) => void;
  onPickItems: (address: StartingEquipmentAddress, names: string[]) => void;
  onClaimGold: () => void;
  onClaimEquipment: () => void;
  onClaimAgain: () => void;
  onUpdateOption: (opt: "equipment" | "gold") => void;
  theme: any;
}

export const StartingGrantsSection: React.FC<StartingGrantsSectionProps> = ({
  character,
  primaryClass,
  startingCard,
  onPickOption,
  onPickItems,
  onClaimGold,
  onClaimEquipment,
  onClaimAgain,
  onUpdateOption,
  theme,
}) => {
  const { isCompact } = useResponsiveLayout();
  const hasAnyClass = (character.classes || []).length > 0;
  if (!hasAnyClass) return null;

  const claimed = character.startingGrantsApplied === true;
  // A class with no equipment slots takes gold only: no Equipment option is shown.
  const equipmentOffered = startingCard.hasSlots;
  const goldChosen = !equipmentOffered || character.startingOption === "gold";
  // Equipment cannot be claimed or switched to until every slot is picked; the claim returns the character unchanged then.
  const equipmentBlocked = !startingCard.complete;
  // The picks stay visible while equipment is the chosen option, and after any claim so they can be changed.
  const showChoices = equipmentOffered && (character.startingOption === "equipment" || claimed);
  const options = equipmentOffered ? (["equipment", "gold"] as const) : (["gold"] as const);

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text style={[styles.heading, { color: theme.text, flexShrink: 1 }]}>Starting Equipment & Gold:</Text>
        {character.startingGrantsApplied && <Badge label="Claimed" variant="success" size="sm" />}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {options.map((opt) => {
          const active = opt === "gold" ? goldChosen : character.startingOption === "equipment";
          const blocked = opt === "equipment" && claimed && equipmentBlocked;
          return (
            <TouchableOpacity
              key={opt}
              disabled={blocked}
              onPress={() => {
                if (!active) {
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
                  opacity: blocked ? 0.4 : 1,
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

      {claimed ? (
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
              disabled={character.startingOption === "gold" && equipmentBlocked}
              onPress={() => {
                if (character.startingOption === "gold") onClaimEquipment();
                else onClaimGold();
              }}
            />
            <Button
              title={`Claim ${character.startingOption === "gold" ? "Gold" : "Equipment"} again`}
              variant="outline"
              size="sm"
              disabled={character.startingOption === "equipment" && equipmentBlocked}
              onPress={onClaimAgain}
            />
          </View>
        </View>
      ) : null}

      {!claimed && goldChosen ? (
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
      ) : null}

      {showChoices ? (
        <StartingEquipmentChoices card={startingCard} onPickOption={onPickOption} onPickItems={onPickItems} theme={theme} />
      ) : null}

      {!claimed && equipmentOffered && character.startingOption === "equipment" ? (
        <View style={{ gap: 8 }}>
          {equipmentBlocked ? (
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Choose one option for each equipment slot to claim it.
            </Text>
          ) : null}
          <View style={{ flexDirection: isCompact ? "column" : "row" }}>
            <Button
              title="Claim Starting Equipment"
              variant="primary"
              size="sm"
              icon="bag-add-outline"
              disabled={equipmentBlocked}
              onPress={onClaimEquipment}
              style={isCompact ? { width: "100%" } : undefined}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
};
