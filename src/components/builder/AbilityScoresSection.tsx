import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Character, AbilityKey, RolledAbilityResult } from "../../types/character";
import { STANDARD_ARRAY } from "../../constants/rules";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles } from "./builderStyles";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

export interface AbilityScoresSectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  effectiveScores: Record<AbilityKey, number>;
  modifiers: Record<AbilityKey, number>;
  pointBuyRemaining: number;
  saAssignments: Partial<Record<AbilityKey, number>>;
  assignedValues: number[];
  pendingValue: number | null;
  onPoolTap: (v: number) => void;
  onSlotTap: (key: AbilityKey) => void;
  onUnassignSlot: (key: AbilityKey) => void;
  onResetSA: () => void;
  onUpdateBaseScore: (key: AbilityKey, delta: number) => void;
  onSetManualScore: (key: AbilityKey, val: string) => void;
  rolledResults: RolledAbilityResult[];
  rolledPicks: Partial<Record<AbilityKey, number>>;
  pendingRoll: number | null;
  onRoll: () => void;
  onRollPoolTap: (index: number) => void;
  onRollSlotTap: (key: AbilityKey) => void;
  onUnassignRollSlot: (key: AbilityKey) => void;
  onResetRolled: () => void;
  theme: any;
}

export const AbilityScoresSection: React.FC<AbilityScoresSectionProps> = ({
  character,
  onUpdate,
  effectiveScores,
  modifiers,
  pointBuyRemaining,
  saAssignments,
  assignedValues,
  pendingValue,
  onPoolTap,
  onSlotTap,
  onUnassignSlot,
  onResetSA,
  onUpdateBaseScore,
  onSetManualScore,
  rolledResults,
  rolledPicks,
  pendingRoll,
  onRoll,
  onRollPoolTap,
  onRollSlotTap,
  onUnassignRollSlot,
  onResetRolled,
  theme,
}) => {
  const { isCompact } = useResponsiveLayout();

  return (
    <View style={styles.section}>
      {/* Method selector */}
      <View style={styles.methodRow}>
        {(["pointBuy", "standardArray", "manual", "rolled"] as const).map((m) => {
          const active = character.abilityMethod === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => {
                // Re-tapping the active method does nothing: it must not clear the placements it shows.
                if (m === character.abilityMethod) return;
                if (m === "pointBuy") {
                  const cur = character.baseAbilityScores || { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
                  const newScores: Record<AbilityKey, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
                  for (const k of ABILITY_KEYS) {
                    const val = cur[k];
                    if (typeof val === "number" && val >= 8 && val <= 15) {
                      newScores[k] = val;
                    }
                  }
                  onUpdate({ abilityMethod: m, baseAbilityScores: newScores });
                } else {
                  onUpdate({ abilityMethod: m });
                }
                if (m === "standardArray") onResetSA();
                if (m === "rolled") onResetRolled();
              }}
              style={[
                styles.methodBtn,
                { minHeight: 44 },
                {
                  backgroundColor: active ? theme.accentGlow : theme.surface,
                  borderColor: active ? theme.accentHover : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.methodText,
                  { color: active ? theme.accentHover : theme.textSecondary, fontWeight: active ? "700" : "400" },
                ]}
              >
                {m === "pointBuy" ? "Point Buy" : m === "standardArray" ? "Std Array" : m === "manual" ? "Manual" : "Rolled"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Point Buy counter */}
      {character.abilityMethod === "pointBuy" && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: theme.surfaceHighlight,
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            },
          ]}
        >
          <Text style={{ color: theme.textSecondary, fontSize: 13, flexShrink: 1 }}>
            Points remaining:{" "}
            <Text
              style={{
                color: pointBuyRemaining >= 0 ? theme.accentHover : theme.danger,
                fontWeight: "800",
                fontSize: 16,
              }}
            >
              {pointBuyRemaining}
            </Text>
            {" / 27"}
          </Text>
          <TouchableOpacity
            onPress={() => onUpdate({ baseAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } })}
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: 1,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "600" }}>Reset (8s)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Standard Array pool */}
      {character.abilityMethod === "standardArray" && (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {STANDARD_ARRAY.map((v, idx) => {
              const timesInArray = STANDARD_ARRAY.filter((x) => x === v).length;
              const timesUsed = assignedValues.filter((x) => x === v).length;
              const available = timesUsed < timesInArray;
              const isPending = pendingValue === v;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => (available || isPending ? onPoolTap(v) : undefined)}
                  style={[
                    styles.poolChip,
                    {
                      backgroundColor: isPending ? theme.accentGlow : available ? theme.surfaceRaised : theme.surfaceHighlight,
                      borderColor: isPending ? theme.accentHover : theme.border,
                      opacity: !available && !isPending ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isPending ? theme.text : available ? theme.text : theme.textMuted,
                      fontWeight: "800",
                      fontSize: 20,
                    }}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Button title="Reset" variant="outline" size="sm" onPress={onResetSA} />
        </Card>
      )}

      {/* Rolled Abilities results */}
      {character.abilityMethod === "rolled" && (
        <Card style={{ gap: 10 }}>
          {rolledResults.length > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              {rolledResults.map((result, index) => {
                const used = Object.values(rolledPicks).includes(index);
                const isPending = pendingRoll === index;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => (used ? undefined : onRollPoolTap(index))}
                    style={[
                      styles.rollChip,
                      {
                        backgroundColor: isPending ? theme.accentGlow : used ? theme.surfaceHighlight : theme.surfaceRaised,
                        borderColor: isPending ? theme.accentHover : theme.border,
                        opacity: used ? 0.35 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.text,
                        fontWeight: "800",
                        fontSize: 18,
                      }}
                    >
                      {result.total}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 3 }}>
                      {result.dice.map((die, dieIndex) => {
                        const dropped = dieIndex === result.droppedIndex;
                        return (
                          <Text
                            key={dieIndex}
                            style={{
                              color: isPending ? theme.text : theme.textSecondary,
                              fontSize: 11,
                              fontWeight: "600",
                              opacity: dropped ? 0.4 : 1,
                              textDecorationLine: dropped ? "line-through" : "none",
                            }}
                          >
                            {die.face}
                          </Text>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Button title={rolledResults.length > 0 ? "Reroll" : "Roll"} variant="outline" size="sm" onPress={onRoll} />
        </Card>
      )}

      {/* Scores grid */}
      <View style={styles.scoresGrid}>
        {ABILITY_KEYS.map((key) => {
          const base = character.baseAbilityScores?.[key] ?? (character.abilityMethod === "pointBuy" ? 8 : 10);
          const racialBonus = character.racialAbilityBonuses[key] || 0;
          const total = effectiveScores[key];
          const mod = modifiers[key];
          const isSA = character.abilityMethod === "standardArray";
          const isRolled = character.abilityMethod === "rolled";
          const isPlacement = isSA || isRolled;
          const isAssigned = isSA ? saAssignments[key] != null : isRolled ? rolledPicks[key] != null : false;
          const pending = isSA ? pendingValue : pendingRoll;

          return (
            <TouchableOpacity
              key={key}
              onPress={() => (isSA ? onSlotTap(key) : isRolled ? onRollSlotTap(key) : undefined)}
              activeOpacity={isPlacement ? 0.7 : 1}
              style={[
                isCompact ? styles.scoreCardCompact : styles.scoreCard,
                {
                  backgroundColor: theme.surface,
                  borderColor:
                    isPlacement && pending != null
                      ? theme.accentHover
                      : isAssigned
                      ? theme.accentGlow
                      : theme.border,
                  borderWidth: isPlacement && pending != null ? 2 : 1,
                },
              ]}
            >
              <View style={isCompact ? styles.scoreCardLabel : undefined}>
                <Text style={[styles.abilityLabel, { color: theme.textSecondary }]}>{ABILITY_LABELS[key]}</Text>
                {isCompact && (
                  <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>
                    {racialBonus ? `${base}+${racialBonus}=${total}` : `= ${total}`}
                  </Text>
                )}
              </View>

              <Text style={[styles.abilityMod, { color: theme.accentHover, marginRight: isCompact ? 12 : 0 }]}>{mod >= 0 ? `+${mod}` : mod}</Text>

              {character.abilityMethod === "manual" ? (
                <TextInput
                  style={[
                    styles.scoreInput,
                    { backgroundColor: theme.surfaceHighlight, color: theme.text, borderColor: theme.border },
                  ]}
                  keyboardType="number-pad"
                  value={String(base)}
                  onChangeText={(t) => onSetManualScore(key, t)}
                />
              ) : isPlacement ? (
                <View
                  style={[
                    styles.saSlot,
                    {
                      backgroundColor: isAssigned ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: isAssigned ? theme.accentHover : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isAssigned ? theme.accentHover : theme.textMuted,
                      fontWeight: "800",
                      fontSize: 20,
                    }}
                  >
                    {isAssigned ? base : "—"}
                  </Text>
                  {isAssigned && (
                    <TouchableOpacity
                      onPress={(e) => {
                         e.stopPropagation?.();
                         if (isSA) onUnassignSlot(key);
                         else onUnassignRollSlot(key);
                      }}
                      style={styles.saX}
                    >
                      <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    onPress={() => onUpdateBaseScore(key, -1)}
                    style={[styles.stepperBtn, { backgroundColor: theme.surfaceHighlight }]}
                  >
                    <Ionicons name="remove" size={20} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.baseNum, { color: theme.text }]}>{base}</Text>
                  <TouchableOpacity
                    onPress={() => onUpdateBaseScore(key, 1)}
                    style={[styles.stepperBtn, { backgroundColor: theme.surfaceHighlight }]}
                  >
                    <Ionicons name="add" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>
              )}

              {!isCompact && (
                <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 4, textAlign: "center" }}>
                  {racialBonus ? `${base}+${racialBonus}=${total}` : `= ${total}`}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
