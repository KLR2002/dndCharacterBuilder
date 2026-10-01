import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import {
  calculateEffectiveAbilityScores,
  calculateMaxHp,
  calculateTotalLevel,
} from "../services/dndRules";
import { applyLongRest, applyShortRest } from "../rules/rest";
import { Character } from "../types/character";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Modal } from "./ui/Modal";

import { useCharacters } from "../context/CharacterContext";

function rollDie(faces: number): number {
  return Math.floor(Math.random() * faces) + 1;
}

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
  const { currentCharacter, updateCharacter } = useCharacters();
  const [mode, setMode] = useState<"short" | "long">("short");
  const [spentLog, setSpentLog] = useState<string[]>([]);

  const character = propChar || currentCharacter;
  const onUpdateCharacter = propUpdate || ((updates: Partial<Character>) => {
    if (character) {
      updateCharacter(character.id, updates);
    }
  });

  if (!character) return null;

  const maxHp = calculateMaxHp(character);
  const { modifiers } = calculateEffectiveAbilityScores(character);
  const conMod = modifiers.con;
  const totalLevel = calculateTotalLevel(character);

  // Available Hit Dice
  const hitDicePool: Record<string, { total: number; used: number }> = {};
  for (const c of character.classes || []) {
    const die = c.className === "Barbarian" ? "d12" : ["Fighter", "Paladin", "Ranger"].includes(c.className) ? "d10" : ["Sorcerer", "Wizard"].includes(c.className) ? "d6" : "d8";
    if (!hitDicePool[die]) hitDicePool[die] = { total: 0, used: 0 };
    hitDicePool[die].total += c.level;
    hitDicePool[die].used += character.usedHitDice?.[die] || 0;
  }

  const spendHitDie = (die: string) => {
    const currentUsed = character.usedHitDice?.[die] || 0;
    const pool = hitDicePool[die];
    if (!pool || currentUsed >= pool.total) return;

    const faces = parseInt(die.replace("d", ""), 10) || 8;
    const roll = rollDie(faces);
    const healAmount = Math.max(1, roll + conMod);
    const newHp = Math.min(maxHp, character.currentHp + healAmount);

    const newUsed = { ...(character.usedHitDice || {}), [die]: currentUsed + 1 };
    setSpentLog((prev) => [
      `Rolled ${die} (${roll}) + Con (${conMod >= 0 ? `+${conMod}` : conMod}) = healed ${healAmount} HP`,
      ...prev,
    ]);

    onUpdateCharacter({
      currentHp: newHp,
      usedHitDice: newUsed,
    });
  };

  const executeShortRest = () => {
    const updated = applyShortRest(character);
    onUpdateCharacter(updated);
    if (onTakeRest) onTakeRest();
    onClose();
  };

  const executeLongRest = () => {
    const updated = applyLongRest(character);
    onUpdateCharacter(updated);
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
                    onPress={() => spendHitDie(die)}
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
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
