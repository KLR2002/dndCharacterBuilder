import React, { useMemo, useState } from "react";
import {
  Modal as RNModal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { getBackgrounds, getClasses, getConditions, getRaces } from "../../services/dataService";
import { proficiencies } from "../../rules/proficiencies";
import { RACE_WEAPON_PROFICIENCIES } from "../../rules/attacks";
import {
  resolveCharacterTools,
  resolveCharacterLanguages,
} from "../../rules/proficienciesAndLanguages";
import {
  calculateArmorClass,
  calculateEffectiveAbilityScores,
  calculateMaxHp,
  calculateProficiencyBonus,
  calculateSavingThrows,
  calculateSkills,
  calculateSpeed,
  calculateTotalLevel,
  formatModifier,
} from "../../services/dndRules";
import { AbilityKey } from "../../types/character";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { RestModal } from "../RestModal";

const ABILITY_ORDER: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const StatsTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();

  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [hpModalVisible, setHpModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  const [hpChangeAmount, setHpChangeAmount] = useState("1");
  const [tempHpAmount, setTempHpAmount] = useState("");
  const [maxHpOverrideInput, setMaxHpOverrideInput] = useState("");

  const derivedProficiencies = useMemo(() => {
    if (!currentCharacter) {
      return { armor: [], weapons: [], tools: [] };
    }
    const allRaces = getRaces(activeBooks || []);
    const allBackgrounds = getBackgrounds(activeBooks || []);
    const allClasses = getClasses(activeBooks || []);
    const base = proficiencies(currentCharacter, allClasses);
    const armorSet = new Set<string>(base.armor);
    const weaponSet = new Set<string>(base.weapons);

    if (Array.isArray(currentCharacter.multiclassProficiencies)) {
      for (const mp of currentCharacter.multiclassProficiencies) {
        for (const a of mp.armor || []) armorSet.add(a);
        for (const w of mp.weapons || []) weaponSet.add(w);
      }
    }

    const raceName = currentCharacter.race?.name;
    const subraceName = currentCharacter.race?.subraceName;
    if (raceName) {
      const raceWeapons =
        RACE_WEAPON_PROFICIENCIES[raceName] ||
        (subraceName ? RACE_WEAPON_PROFICIENCIES[subraceName] : undefined);
      for (const w of raceWeapons || []) {
        weaponSet.add(w);
      }

      if (subraceName === "Mountain Dwarf" || raceName === "Mountain Dwarf") {
        armorSet.add("Light armor");
        armorSet.add("Medium armor");
      }
      if (raceName === "Githyanki") {
        armorSet.add("Light armor");
        armorSet.add("Medium armor");
      }
    }

    const tools = resolveCharacterTools(currentCharacter, {
      races: allRaces,
      backgrounds: allBackgrounds,
      classes: allClasses,
    });

    return {
      armor: Array.from(armorSet),
      weapons: Array.from(weaponSet),
      tools,
    };
  }, [currentCharacter, activeBooks]);

  const derivedLanguages = useMemo(() => {
    if (!currentCharacter) return ["Common"];
    const allRaces = getRaces(activeBooks || []);
    const allBackgrounds = getBackgrounds(activeBooks || []);
    return resolveCharacterLanguages(currentCharacter, {
      races: allRaces,
      backgrounds: allBackgrounds,
    });
  }, [currentCharacter, activeBooks]);

  if (!currentCharacter) return null;

  const totalLevel = calculateTotalLevel(currentCharacter);
  const profBonus = calculateProficiencyBonus(totalLevel);
  const { scores, modifiers } = calculateEffectiveAbilityScores(currentCharacter);
  const calculatedMaxHp = calculateMaxHp(currentCharacter);
  const { ac, breakdown: acBreakdown } = calculateArmorClass(currentCharacter);
  const speed = calculateSpeed(currentCharacter);
  const initiative = modifiers.dex;
  const saves = calculateSavingThrows(currentCharacter);
  const skills = calculateSkills(currentCharacter);
  const passivePerception = skills.find((s) => s.name === "Perception")?.passiveBonus ?? 10;
  const passiveInvestigation = skills.find((s) => s.name === "Investigation")?.passiveBonus ?? 10;
  const passiveInsight = skills.find((s) => s.name === "Insight")?.passiveBonus ?? 10;
  const allConditions = getConditions();

  // HP Handlers
  const applyDamage = (amount: number) => {
    let temp = currentCharacter.tempHp;
    let hp = currentCharacter.currentHp;

    if (temp > 0) {
      if (amount <= temp) {
        temp -= amount;
        amount = 0;
      } else {
        amount -= temp;
        temp = 0;
      }
    }
    hp = Math.max(0, hp - amount);
    updateCharacter(currentCharacter.id, { currentHp: hp, tempHp: temp });
  };

  const applyHeal = (amount: number) => {
    const newHp = Math.min(calculatedMaxHp, currentCharacter.currentHp + amount);
    updateCharacter(currentCharacter.id, { currentHp: newHp });
  };

  const setTempHp = () => {
    const val = parseInt(tempHpAmount, 10);
    if (!isNaN(val) && val >= 0) {
      updateCharacter(currentCharacter.id, { tempHp: val });
      setTempHpAmount("");
    }
  };

  const setMaxHpOverride = () => {
    const val = parseInt(maxHpOverrideInput, 10);
    if (!isNaN(val) && val > 0) {
      updateCharacter(currentCharacter.id, { maxHpOverride: val });
    } else {
      updateCharacter(currentCharacter.id, { maxHpOverride: null });
    }
    setHpModalVisible(false);
  };

  // Conditions
  const toggleCondition = (name: string) => {
    const current = currentCharacter.conditions || [];
    const updated = current.includes(name)
      ? current.filter((c: string) => c !== name)
      : [...current, name];
    updateCharacter(currentCharacter.id, { conditions: updated });
  };

  // Hit Dice
  const primaryClass = currentCharacter.classes[0]?.className || "Class";
  const usedHitDice = currentCharacter.usedHitDice || {};
  const totalHitDice = totalLevel;
  const usedHdCount = (Object.values(usedHitDice) as number[]).reduce((a: number, b: number) => a + b, 0);
  const availableHd = Math.max(0, totalHitDice - usedHdCount);

  const useHitDie = () => {
    if (availableHd <= 0) return;
    const currentClassUsed = usedHitDice[primaryClass] || 0;
    updateCharacter(currentCharacter.id, {
      usedHitDice: {
        ...usedHitDice,
        [primaryClass]: currentClassUsed + 1,
      },
    });
  };

  const recoverHitDie = () => {
    const currentClassUsed = usedHitDice[primaryClass] || 0;
    if (currentClassUsed <= 0) return;
    updateCharacter(currentCharacter.id, {
      usedHitDice: {
        ...usedHitDice,
        [primaryClass]: Math.max(0, currentClassUsed - 1),
      },
    });
  };

  // Death Saves
  const toggleDeathSaveSuccess = (index: number) => {
    const current = currentCharacter.deathSaves?.successes || 0;
    const next = current === index + 1 ? index : index + 1;
    updateCharacter(currentCharacter.id, {
      deathSaves: {
        successes: next,
        failures: currentCharacter.deathSaves?.failures || 0,
      },
    });
  };

  const toggleDeathSaveFailure = (index: number) => {
    const current = currentCharacter.deathSaves?.failures || 0;
    const next = current === index + 1 ? index : index + 1;
    updateCharacter(currentCharacter.id, {
      deathSaves: {
        successes: currentCharacter.deathSaves?.successes || 0,
        failures: next,
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Rest Buttons Bar */}
      <View style={styles.topActionsBar}>
        <Button
          title="Take Rest (Short / Long)"
          icon="bed"
          variant="outline"
          size="sm"
          onPress={() => setRestModalVisible(true)}
          style={{ flex: 1 }}
        />
        <Button
          title={`Conditions (${(currentCharacter.conditions || []).length})`}
          icon="warning"
          variant={currentCharacter.conditions?.length ? "danger" : "secondary"}
          size="sm"
          onPress={() => setConditionModalVisible(true)}
          style={{ flex: 1 }}
        />
      </View>

      {/* Active Conditions Display */}
      {currentCharacter.conditions && currentCharacter.conditions.length > 0 && (
        <Card style={[styles.activeConditionsCard, { borderColor: theme.danger }]}>
          <Text style={[styles.sectionTitle, { color: theme.danger, fontSize: 13 }]}>
            Active Conditions:
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {currentCharacter.conditions.map((cond: string) => {
              const condData = allConditions.find((c) => c.name.toLowerCase() === cond.toLowerCase());
              return (
                <TouchableOpacity
                  key={cond}
                  onPress={() => {
                    if (condData) {
                      setDetailModal({
                        visible: true,
                        title: condData.name,
                        subtitle: "Condition",
                        content: condData.description || "",
                      });
                    }
                  }}
                  style={[styles.conditionBadge, { backgroundColor: theme.danger + "25", borderColor: theme.danger }]}>
                  <Text style={{ color: theme.danger, fontSize: 12, fontWeight: "600" }}>{cond}</Text>
                  <TouchableOpacity onPress={() => toggleCondition(cond)} style={{ paddingLeft: 4 }}>
                    <Ionicons name="close-circle" size={14} color={theme.danger} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      )}

      {/* HP Section Card */}
      <Card style={styles.hpCard}>
        <View style={styles.hpHeader}>
          <View>
            <Text style={[styles.labelMuted, { color: theme.textMuted }]}>HIT POINTS</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={[styles.hpCurrentText, { color: currentCharacter.currentHp > 0 ? theme.hpGreen : theme.danger }]}>
                {currentCharacter.currentHp}
              </Text>
              <Text style={[styles.hpMaxText, { color: theme.textSecondary }]}>
                / {calculatedMaxHp}
              </Text>
              {currentCharacter.tempHp > 0 && (
                <Text style={{ color: theme.tempHpYellow, fontWeight: "700", fontSize: 16 }}>
                  (+{currentCharacter.tempHp} Temp)
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              setMaxHpOverrideInput(currentCharacter.maxHpOverride ? String(currentCharacter.maxHpOverride) : "");
              setHpModalVisible(true);
            }}
            style={[styles.hpEditBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <Ionicons name="settings-outline" size={16} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>HP Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Health Bar */}
        <View style={[styles.hpBarTrack, { backgroundColor: theme.surfaceRaised }]}>
          <View
            style={[
              styles.hpBarFill,
              {
                backgroundColor: currentCharacter.currentHp > calculatedMaxHp * 0.25 ? theme.hpGreen : theme.danger,
                width: `${Math.min(100, Math.max(0, (currentCharacter.currentHp / calculatedMaxHp) * 100))}%`,
              },
            ]}
          />
        </View>

        {/* HP Modification Quick Controls */}
        <View style={styles.hpActionsRow}>
          <View style={[styles.hpInputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <TextInput
              style={[styles.hpInput, { color: theme.text }]}
              value={hpChangeAmount}
              onChangeText={setHpChangeAmount}
              keyboardType="number-pad"
              placeholder="Amt"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <Button
            title="Damage"
            variant="danger"
            size="sm"
            onPress={() => {
              const val = parseInt(hpChangeAmount, 10) || 1;
              applyDamage(val);
            }}
            style={{ flex: 1 }}
          />

          <Button
            title="Heal"
            variant="success"
            size="sm"
            onPress={() => {
              const val = parseInt(hpChangeAmount, 10) || 1;
              applyHeal(val);
            }}
            style={{ flex: 1 }}
          />
        </View>

        {/* Temp HP Row */}
        <View style={styles.tempHpRow}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>Temp HP:</Text>
          <TextInput
            style={[styles.tempInput, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            value={tempHpAmount}
            onChangeText={setTempHpAmount}
            keyboardType="number-pad"
            placeholder="New Temp"
            placeholderTextColor={theme.textMuted}
          />
          <Button title="Apply" size="sm" variant="secondary" onPress={setTempHp} />
        </View>

        {/* Death Saves (if HP == 0) */}
        {currentCharacter.currentHp === 0 && (
          <View style={[styles.deathSavesContainer, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
            <Text style={{ color: theme.danger, fontWeight: "bold", fontSize: 13, textAlign: "center" }}>
              DEATH SAVING THROWS
            </Text>
            <View style={styles.deathSavesRow}>
              <Text style={{ color: theme.hpGreen, fontSize: 12, width: 75 }}>Successes:</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, 1, 2].map((idx) => (
                  <TouchableOpacity
                    key={`ds_suc_${idx}`}
                    onPress={() => toggleDeathSaveSuccess(idx)}
                    style={[
                      styles.deathSaveCircle,
                      {
                        borderColor: theme.hpGreen,
                        backgroundColor: (currentCharacter.deathSaves?.successes || 0) > idx ? theme.hpGreen : "transparent",
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.deathSavesRow}>
              <Text style={{ color: theme.danger, fontSize: 12, width: 75 }}>Failures:</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, 1, 2].map((idx) => (
                  <TouchableOpacity
                    key={`ds_fail_${idx}`}
                    onPress={() => toggleDeathSaveFailure(idx)}
                    style={[
                      styles.deathSaveCircle,
                      {
                        borderColor: theme.danger,
                        backgroundColor: (currentCharacter.deathSaves?.failures || 0) > idx ? theme.danger : "transparent",
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        )}
      </Card>

      {/* Combat Quick Badges (AC, Initiative, Speed, Prof Bonus) */}
      <View style={styles.combatRow}>
        <TouchableOpacity
          onPress={() =>
            setDetailModal({
              visible: true,
              title: "Armor Class",
              subtitle: `Total: ${ac}`,
              content: `Calculation Breakdown:\n${acBreakdown}\n\nBased on your equipped armor, shields, and class unarmored defense rules.`,
            })
          }
          style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="shield" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{ac}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>ARMOR CLASS</Text>
        </TouchableOpacity>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="flash" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{formatModifier(initiative)}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>INITIATIVE</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="walk" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{speed} ft</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>SPEED</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="ribbon" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>+{profBonus}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>PROFICIENCY</Text>
        </View>
      </View>

      {/* Hit Dice Card */}
      <Card style={styles.hitDiceCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>HIT DICE</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {availableHd} / {totalHitDice} Remaining (1d{currentCharacter.classes[0]?.className === "Barbarian" ? "12" : currentCharacter.classes[0]?.className === "Fighter" || currentCharacter.classes[0]?.className === "Paladin" || currentCharacter.classes[0]?.className === "Ranger" ? "10" : currentCharacter.classes[0]?.className === "Sorcerer" || currentCharacter.classes[0]?.className === "Wizard" ? "6" : "8"})
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Use" size="sm" variant="danger" onPress={useHitDie} disabled={availableHd <= 0} />
            <Button title="Recover" size="sm" variant="secondary" onPress={recoverHitDie} disabled={usedHdCount <= 0} />
          </View>
        </View>
      </Card>

      {/* 6 Ability Scores Grid */}
      <Text style={[styles.blockTitle, { color: theme.textSecondary }]}>ABILITY SCORES & MODIFIERS</Text>
      <View style={styles.abilityGrid}>
        {ABILITY_ORDER.map((key) => {
          const score = scores[key];
          const mod = modifiers[key];
          return (
            <View key={key} style={[styles.abilityTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.abilityTileName, { color: theme.textMuted }]}>{key.toUpperCase()}</Text>
              <Text style={[styles.abilityTileMod, { color: theme.accent }]}>{formatModifier(mod)}</Text>
              <View style={[styles.abilityTileScoreBadge, { backgroundColor: theme.surfaceRaised }]}>
                <Text style={[styles.abilityTileScoreText, { color: theme.textSecondary }]}>{score}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Saving Throws */}
      <Text style={[styles.blockTitle, { color: theme.textSecondary, marginTop: 20 }]}>SAVING THROWS</Text>
      <Card style={{ padding: 8 }}>
        <View style={styles.savesGrid}>
          {ABILITY_ORDER.map((key) => {
            const save = saves[key];
            return (
              <View key={`save_${key}`} style={styles.saveItem}>
                <View
                  style={[
                    styles.profIndicator,
                    {
                      borderColor: save.isProficient ? theme.accent : theme.border,
                      backgroundColor: save.isProficient ? theme.accent : "transparent",
                    },
                  ]}
                />
                <Text style={[styles.saveName, { color: theme.text }]}>{ABILITY_LABELS[key]}</Text>
                <Text style={[styles.saveBonus, { color: save.isProficient ? theme.accent : theme.textSecondary }]}>
                  {formatModifier(save.bonus)}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Passive Senses */}
      <Text style={[styles.blockTitle, { color: theme.textSecondary, marginTop: 20 }]}>
        PASSIVE SENSES
      </Text>
      <View style={styles.combatRow}>
        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="eye" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{passivePerception}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>PASSIVE PERCEPTION</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{passiveInvestigation}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>PASSIVE INVESTIGATION</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="bulb" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{passiveInsight}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>PASSIVE INSIGHT</Text>
        </View>
      </View>

      {/* Skills with Passives in Parentheses */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <Text style={[styles.blockTitle, { color: theme.textSecondary, marginTop: 0, marginBottom: 0 }]}>
          SKILLS (PASSIVES IN BRACKETS)
        </Text>
      </View>
      <Card style={{ padding: 4 }}>
        {skills.map((skill, index) => (
          <View
            key={skill.name}
            style={[
              styles.skillRow,
              {
                borderBottomColor: theme.border,
                borderBottomWidth: index === skills.length - 1 ? 0 : 1,
                backgroundColor: index % 2 === 0 ? "transparent" : theme.surfaceHighlight + "40",
              },
            ]}>
            {/* Prof / Expertise Indicator */}
            <View style={styles.skillProfCol}>
              <View
                style={[
                  styles.profIndicator,
                  {
                    borderColor: skill.isProficient ? theme.accent : theme.border,
                    backgroundColor: skill.isProficient ? theme.accent : "transparent",
                  },
                ]}>
                {skill.isExpertise && (
                  <View style={[styles.expertiseInnerDot, { backgroundColor: "#fff" }]} />
                )}
              </View>
            </View>

            {/* Skill Name & Ability */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.skillName, { color: theme.text }]}>
                {skill.name}{" "}
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>({skill.ability.toUpperCase()})</Text>
              </Text>
            </View>

            {/* Passive Score in ( ) */}
            <View style={{ width: 85, alignItems: "center" }}>
              <Text style={[styles.passiveText, { color: theme.textSecondary }]}>
                ({skill.passiveBonus})
              </Text>
            </View>

            {/* Total Roll Modifier */}
            <View style={{ width: 45, alignItems: "flex-end" }}>
              <Text
                style={[
                  styles.skillBonus,
                  {
                    color: skill.isExpertise
                      ? theme.warning
                      : skill.isProficient
                      ? theme.accent
                      : theme.textSecondary,
                  },
                ]}>
                {formatModifier(skill.bonus)}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Proficiencies & Training Summary */}
      <Text style={[styles.blockTitle, { color: theme.textSecondary, marginTop: 20 }]}>
        PROFICIENCIES & TRAINING
      </Text>
      <Card style={{ gap: 10 }}>
        <View>
          <Text style={[styles.profCatTitle, { color: theme.accent }]}>Armor Proficiencies</Text>
          <Text style={{ color: theme.text, fontSize: 13 }}>
            {derivedProficiencies.armor.length > 0
              ? derivedProficiencies.armor.join(", ")
              : "None"}
          </Text>
        </View>

        <View>
          <Text style={[styles.profCatTitle, { color: theme.accent }]}>Weapon Proficiencies</Text>
          <Text style={{ color: theme.text, fontSize: 13 }}>
            {derivedProficiencies.weapons.length > 0
              ? derivedProficiencies.weapons.join(", ")
              : "None"}
          </Text>
        </View>

        <View>
          <Text style={[styles.profCatTitle, { color: theme.accent }]}>Tool Proficiencies</Text>
          <Text style={{ color: theme.text, fontSize: 13 }}>
            {derivedProficiencies.tools.length > 0
              ? derivedProficiencies.tools.join(", ")
              : "None"}
          </Text>
        </View>
      </Card>

      {/* Languages Summary */}
      <Text style={[styles.blockTitle, { color: theme.textSecondary, marginTop: 20 }]}>
        LANGUAGES
      </Text>
      <Card style={{ gap: 6 }}>
        <Text style={{ color: theme.text, fontSize: 13, lineHeight: 20 }}>
          {derivedLanguages.length > 0 ? derivedLanguages.join(", ") : "Common"}
        </Text>
      </Card>

      {/* HP Override Settings Modal */}
      <RNModal visible={hpModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>
              HP Configuration
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 8 }}>
              Standard calculated Max HP: <Text style={{ color: theme.accent, fontWeight: "bold" }}>{calculateMaxHp({ ...currentCharacter, maxHpOverride: null })}</Text>
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Leave blank to use automatic calculation. Enter a number to manually override maximum hit points.
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={maxHpOverrideInput}
              onChangeText={setMaxHpOverrideInput}
              keyboardType="number-pad"
              placeholder="Override Max HP"
              placeholderTextColor={theme.textMuted}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="secondary" size="sm" onPress={() => setHpModalVisible(false)} />
              <Button title="Save" variant="primary" size="sm" onPress={setMaxHpOverride} />
            </View>
          </Card>
        </View>
      </RNModal>

      {/* Condition Picker Modal */}
      <RNModal visible={conditionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { maxHeight: "80%", backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Toggle Conditions</Text>
              <TouchableOpacity onPress={() => setConditionModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {allConditions.map((cond) => {
                const isActive = (currentCharacter.conditions || []).includes(cond.name);
                return (
                  <TouchableOpacity
                    key={cond.name}
                    onPress={() => toggleCondition(cond.name)}
                    style={[
                      styles.conditionSelectRow,
                      {
                        backgroundColor: isActive ? theme.danger + "20" : theme.surfaceHighlight,
                        borderColor: isActive ? theme.danger : theme.border,
                      },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isActive ? theme.danger : theme.text, fontWeight: "600", fontSize: 14 }}>
                        {cond.name}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={2}>
                        {cond.description?.replace(/\n/g, " ") || ""}
                      </Text>
                    </View>
                    <Ionicons
                      name={isActive ? "checkbox" : "square-outline"}
                      size={20}
                      color={isActive ? theme.danger : theme.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Card>
        </View>
      </RNModal>

      {/* Rest Modal */}
      <RestModal
        visible={restModalVisible}
        onClose={() => setRestModalVisible(false)}
        onTakeRest={() => setRestModalVisible(false)}
      />

      {/* Detail Modal */}
      <DetailModal
        visible={detailModal.visible}
        title={detailModal.title}
        subtitle={detailModal.subtitle}
        content={detailModal.content}
        onClose={() => setDetailModal({ visible: false, title: "", content: "" })}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topActionsBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  activeConditionsCard: {
    padding: 10,
    marginBottom: 12,
  },
  conditionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  hpCard: {
    padding: 14,
    marginBottom: 16,
  },
  hpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  labelMuted: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hpCurrentText: {
    fontSize: 32,
    fontWeight: "bold",
  },
  hpMaxText: {
    fontSize: 20,
    fontWeight: "600",
  },
  hpEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  hpBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginVertical: 8,
  },
  hpBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  hpActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  hpInputContainer: {
    width: 60,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hpInput: {
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    padding: 0,
  },
  tempHpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  tempInput: {
    width: 80,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  deathSavesContainer: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  deathSavesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  deathSaveCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  combatRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 2,
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },
  hitDiceCard: {
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  abilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  abilityTile: {
    width: "31%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  abilityTileName: {
    fontSize: 11,
    fontWeight: "700",
  },
  abilityTileMod: {
    fontSize: 22,
    fontWeight: "bold",
    marginVertical: 2,
  },
  abilityTileScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  abilityTileScoreText: {
    fontSize: 11,
    fontWeight: "600",
  },
  savesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  saveItem: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
  },
  profIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  expertiseInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  saveName: {
    fontSize: 13,
    flex: 1,
  },
  saveBonus: {
    fontSize: 13,
    fontWeight: "700",
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skillProfCol: {
    width: 24,
    alignItems: "flex-start",
  },
  skillName: {
    fontSize: 13,
    fontWeight: "500",
  },
  passiveText: {
    fontSize: 12,
    fontWeight: "600",
  },
  skillBonus: {
    fontSize: 13,
    fontWeight: "700",
  },
  profCatTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    padding: 16,
  },
  input: {
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  conditionSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
});
