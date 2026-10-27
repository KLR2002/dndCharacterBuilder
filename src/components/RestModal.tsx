import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../context/ThemeContext";
import { evaluateCharacter } from "../rules/characterEvaluation";
import { applyLongRest, applyShortRest } from "../rules/rest";
import { spendHitDie } from "../rules/hitDice";
import { CHANGEABLE_AT_LONG_REST, offeredRuleChoices, pickRuleChoice } from "../rules/ruleChoices";
import { getRaces } from "../services/dataService";
import { Character } from "../types/character";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Modal } from "./ui/Modal";

import { useCharacters } from "../context/CharacterContext";

interface RestModalProps {
  visible: boolean;
  onClose: () => void;
  character?: Character;
  onUpdateCharacter?: (updates: Partial<Character>) => void;
  onTakeRest?: () => void;
}

export const RestModal: React.FC<RestModalProps> = ({
  visible,
  onClose,
  character: propChar,
  onUpdateCharacter: propUpdate,
  onTakeRest,
}) => {
  const { theme } = useAppTheme();
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const [mode, setMode] = useState<"short" | "long">("short");
  const [spentLog, setSpentLog] = useState<string[]>([]);

  const character = propChar || currentCharacter;
  // Picks made in the changeable panel are applied to the parent immediately, but
  // a long rest must be computed against them - otherwise resting wipes the season
  // the player just chose.
  const [pendingChoices, setPendingChoices] = useState<Partial<Character>>({});
  const onUpdateCharacter = propUpdate || ((updates: Partial<Character>) => {
    if (character) {
      updateCharacter(character.id, updates);
    }
  });

  const characterWithPending: Character | undefined = character
    ? ({ ...character, ...pendingChoices } as Character)
    : undefined;

  if (!character) return null;

  const evaluated = evaluateCharacter(character);
  const maxHp = evaluated.hp.max;
  const totalLevel = evaluated.totalLevel;

  // Available Hit Dice
  const hitDicePool = evaluated.hitDice;

  const handleSpendHitDie = (die: string) => {
    const res = spendHitDie(character, die);
    if (res.healed <= 0) return;

    setSpentLog((prev) => [
      `Rolled ${die} (${res.roll}) + Con (${res.conMod >= 0 ? `+${res.conMod}` : res.conMod}) = healed ${res.healed} HP`,
      ...prev,
    ]);

    onUpdateCharacter({
      currentHp: res.character.currentHp,
      usedHitDice: res.character.usedHitDice,
    });
  };

  const executeShortRest = () => {
    const updated = applyShortRest(character);
    onUpdateCharacter(updated);
    if (onTakeRest) onTakeRest();
    onClose();
  };

  // Choices the player may change because they finish a long rest: the eladrin's
  // season, per MToF. Long rest clears them, so they are offered here.
  const changeableChoices = offeredRuleChoices(characterWithPending ?? character, {
    raceCatalog: getRaces(activeBooks),
    activeBooks,
    origins: ["race"],
  }).filter((choice) => CHANGEABLE_AT_LONG_REST.has(choice.traitName));

  const executeLongRest = () => {
    const updated = applyLongRest(characterWithPending ?? character);
    onUpdateCharacter(updated);
    setPendingChoices({});
    if (onTakeRest) onTakeRest();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Rest & Recovery"
      subtitle="Take a breather or complete a full night's rest.">
      <View style={styles.container}>
        {/* Mode Selector */}
        <View style={[styles.tabRow, { borderColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => setMode("short")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.tabBtn,
              mode === "short" && { backgroundColor: theme.accentGlow, borderColor: theme.accent },
            ]}>
            <Text
              style={[
                styles.tabText,
                { color: mode === "short" ? theme.accent : theme.textSecondary },
              ]}>
              Short Rest (1 Hour)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("long")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.tabBtn,
              mode === "long" && { backgroundColor: theme.accentGlow, borderColor: theme.accent },
            ]}>
            <Text
              style={[
                styles.tabText,
                { color: mode === "long" ? theme.accent : theme.textSecondary },
              ]}>
              Long Rest (8 Hours)
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "short" ? (
          <View style={styles.section}>
            <Text style={[styles.desc, { color: theme.textSecondary }]}>
              Spend available Hit Dice to heal. Recharges Warlock pact slots and abilities that recover on a short rest.
            </Text>

            {/* Hit Dice Available */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Spend Hit Dice:</Text>
            <View style={styles.diceRow}>
              {Object.entries(hitDicePool).map(([die, info]) => {
                const remaining = info.total - info.used;
                const canSpend = remaining > 0 && character.currentHp < maxHp;

                return (
                  <TouchableOpacity
                    key={die}
                    disabled={!canSpend}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleSpendHitDie(die)}
                    style={[
                      styles.dieCard,
                      {
                        backgroundColor: canSpend ? theme.surfaceRaised : theme.surfaceHighlight,
                        borderColor: canSpend ? theme.accent : theme.border,
                        opacity: canSpend ? 1 : 0.4,
                      },
                    ]}>
                    <Text style={[styles.dieName, { color: theme.accent }]}>{die}</Text>
                    <Text style={[styles.dieCount, { color: theme.text }]}>
                      {remaining} / {info.total} left
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                      Tap to roll & heal
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Log */}
            {spentLog.length > 0 ? (
              <Card style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 4 }}>
                  Healing Log:
                </Text>
                {spentLog.map((log, i) => (
                  <Text key={i} style={{ fontSize: 12, color: theme.success }}>
                    ✓ {log}
                  </Text>
                ))}
              </Card>
            ) : null}

            {/* Attunement Reminder */}
            <Card style={{ marginTop: 12, backgroundColor: theme.surfaceRaised, borderColor: theme.border, padding: 12, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={16} color={theme.accent} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.accent }}>
                  Magic Item Attunement
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17 }}>
                Short Rest completed: You can attune or unattune magic items in your Inventory.
              </Text>
            </Card>

            <Button
              title="Finish Short Rest"
              onPress={executeShortRest}
              style={{ marginTop: 20 }}
            />
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.desc, { color: theme.textSecondary }]}>
              A Long Rest restores your character to peak readiness:
            </Text>

            <Card style={{ gap: 8 }}>
              <Text style={{ color: theme.text, fontSize: 14 }}>
                💚 Restores <Text style={{ color: theme.success, fontWeight: "700" }}>HP to Maximum</Text> ({maxHp} HP)
              </Text>
              <Text style={{ color: theme.text, fontSize: 14 }}>
                🎲 Recovers up to <Text style={{ color: theme.accent, fontWeight: "700" }}>{Math.max(1, Math.floor(totalLevel / 2))} Hit Dice</Text>
              </Text>
              <Text style={{ color: theme.text, fontSize: 14 }}>
                ✨ Resets all <Text style={{ color: theme.info, fontWeight: "700" }}>Spell Slots</Text> (Standard & Pact)
              </Text>
              <Text style={{ color: theme.text, fontSize: 14 }}>
                ⚡ Recharges all <Text style={{ color: theme.warning, fontWeight: "700" }}>Feature Resources</Text> (Rages, Ki, Channel Divinity, etc.)
              </Text>
            </Card>

            {changeableChoices.length > 0 && (
              <Card style={{ gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Changeable at a Long Rest
                </Text>
                {changeableChoices.map((choice) => {
                  const entry = (characterWithPending ?? character)?.ruleChoices?.find((rc) => rc.id === choice.id);
                  return (
                    <View key={choice.id} style={{ gap: 6 }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{choice.traitName}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {choice.options.map((option) => {
                          const chosen = entry?.picked?.includes(option.name);
                          return (
                            <TouchableOpacity
                              key={option.name}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() =>
                                setPendingChoices((prev) => ({
                                  ...prev,
                                  ...pickRuleChoice(characterWithPending ?? character, choice, option.name, undefined, activeBooks),
                                }))
                              }
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                minHeight: 44,
                                justifyContent: "center",
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: chosen ? theme.accent : theme.border,
                                backgroundColor: chosen ? theme.accentGlow : "transparent",
                              }}>
                              <Text
                                style={{
                                  color: chosen ? theme.accent : theme.textSecondary,
                                  fontSize: 12,
                                  fontWeight: "600",
                                }}>
                                {option.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}

            <Button
              title="Take Long Rest"
              onPress={executeLongRest}
              style={{ marginTop: 20 }}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  tabRow: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabText: {
    fontWeight: "600",
    fontSize: 13,
  },
  section: {
    gap: 12,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  diceRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  dieCard: {
    flex: 1,
    minWidth: 120,
    minHeight: 60,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dieName: {
    fontSize: 18,
    fontWeight: "700",
  },
  dieCount: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
});
