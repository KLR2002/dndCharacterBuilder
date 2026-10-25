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
import { getConditions } from "../../services/dataService";
import { currentCompendium } from "../../services/compendium";
import {
  spendHitDie,
  recoverHitDie,
} from "../../rules/hitDice";
import { damage, heal } from "../../rules/hitPoints";
import { setWildShapeTempHp } from "../../rules/wildShapeHp";
import { formatModifier } from "../../services/dndRules";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { proficiencySheet } from "../../rules/proficiencySheet";
import {
  addAddedProficiency,
  addedProficiencyOptions,
  removeAddedProficiency,
  type AddedCategory,
} from "../../rules/addedProficiencies";
import { AbilityKey } from "../../types/character";
import { AddedProficiencyModal } from "../AddedProficiencyModal";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { RestModal } from "../RestModal";
import { HpQuickEditModal } from "../HpQuickEditModal";
import { HitPointBlock } from "../HitPointBlock";
import { ActiveWildShapeCard } from "../ActiveWildShapeCard";
import { useHpQuickEdit } from "../../hooks/useHpQuickEdit";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

const ABILITY_ORDER: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const SKILL_ABILITY_GROUPS: { key: AbilityKey; label: string }[] = [
  { key: "str", label: "STRENGTH" },
  { key: "dex", label: "DEXTERITY" },
  { key: "int", label: "INTELLIGENCE" },
  { key: "wis", label: "WISDOM" },
  { key: "cha", label: "CHARISMA" },
];

export const StatsTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [maxHpOverrideVisible, setMaxHpOverrideVisible] = useState(false);
  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  const [hpChangeAmount, setHpChangeAmount] = useState("1");
  const [tempHpAmount, setTempHpAmount] = useState("");
  const [maxHpOverrideInput, setMaxHpOverrideInput] = useState("");
  const [addModal, setAddModal] = useState<AddedCategory | null>(null);

  const evaluated = useMemo(() => {
    if (!currentCharacter) return null;
    return evaluateCharacter(currentCharacter, { compendium: currentCompendium(), activeBooks });
  }, [currentCharacter, activeBooks]);

  const sheet = useMemo(() => {
    if (!currentCharacter) return null;
    return proficiencySheet(currentCharacter, { compendium: currentCompendium(), activeBooks });
  }, [currentCharacter, activeBooks]);

  const derivedProficiencies = useMemo(() => {
    return evaluated?.proficiencies ?? { armor: [], weapons: [], tools: [], languages: [] };
  }, [evaluated]);

  // Rule-granted languages make the summary line; added ones get their own rows.
  const derivedLanguages = useMemo(() => {
    return sheet?.languages.filter((l) => l.ruleGranted).map((l) => l.name) ?? ["Common"];
  }, [sheet]);

  const addedLanguages = useMemo(() => {
    return sheet?.languages.filter((l) => !l.ruleGranted) ?? [];
  }, [sheet]);

  const addedToolNames = useMemo(() => {
    return new Set((sheet?.tools ?? []).filter((t) => !t.ruleGranted).map((t) => t.name));
  }, [sheet]);

  const classDice = useMemo(() => {
    return evaluated?.combatDice ?? { bardicInspiration: null, sneakAttack: null, martialArts: null, superiorityDice: null };
  }, [evaluated]);

  // Hit Dice
  const hdPools = useMemo(() => evaluated?.hitDice ?? {}, [evaluated]);
  const hdEntries = useMemo(() => {
    return Object.entries(hdPools).sort((a, b) => {
      const faceA = parseInt(a[0].replace(/\D/g, ""), 10) || 0;
      const faceB = parseInt(b[0].replace(/\D/g, ""), 10) || 0;
      return faceB - faceA;
    });
  }, [hdPools]);

  const totalHitDice = useMemo(() => hdEntries.reduce((sum, [, p]) => sum + p.total, 0), [hdEntries]);
  const availableHd = useMemo(() => hdEntries.reduce((sum, [, p]) => sum + p.remaining, 0), [hdEntries]);
  const usedHdCount = useMemo(() => hdEntries.reduce((sum, [, p]) => sum + p.used, 0), [hdEntries]);

  const hitDiceLabel = useMemo(() => {
    if (hdEntries.length === 0) return "1d8";
    return hdEntries.map(([die, p]) => `${p.total}${die}`).join(" + ");
  }, [hdEntries]);

  const hpQuickEdit = useHpQuickEdit(currentCharacter, evaluated?.hp.max ?? 0);

  if (!currentCharacter || !evaluated) return null;

  const addCatalogs = () => ({ compendium: currentCompendium(), activeBooks });
  const handleAdd = (category: AddedCategory, raw: string) => {
    const result = addAddedProficiency(currentCharacter, addCatalogs(), category, raw);
    if (!result.ok) return;
    updateCharacter(currentCharacter.id, result.character);
    setAddModal(null);
  };
  const handleRemove = (category: AddedCategory, name: string) => {
    updateCharacter(currentCharacter.id, (c) => removeAddedProficiency(c, category, name));
  };

  const profBonus = evaluated.proficiencyBonus;
  const { scores, modifiers } = evaluated.effectiveScores;
  const calculatedMaxHp = evaluated.hp.max;
  const { ac, breakdown: acBreakdown } = evaluated.armorClass;
  const hasDefenseAc = acBreakdown.includes("(Defense)");
  const edMatch = acBreakdown.match(/\+\s*(\d+)\s*\(Enhanced Defense\)/);
  const repMatch = acBreakdown.match(/\+\s*(\d+)\s*\(Repulsion Shield\)/);
  const infusionBonusAc =
    (edMatch ? parseInt(edMatch[1], 10) : 0) +
    (repMatch ? parseInt(repMatch[1], 10) : 0);
  const speeds = evaluated.speeds;
  const initiative = evaluated.initiative;
  const saves = evaluated.saves;
  const skills = evaluated.skills;
  const passivePerception = skills.find((s) => s.name === "Perception")?.passiveBonus ?? 10;
  const passiveInvestigation = skills.find((s) => s.name === "Investigation")?.passiveBonus ?? 10;
  const passiveInsight = skills.find((s) => s.name === "Insight")?.passiveBonus ?? 10;
  const allConditions = getConditions();

  // HP Handlers
  const hpState = { currentHp: currentCharacter.currentHp, tempHp: currentCharacter.tempHp };

  const applyDamage = (amount: number) => {
    updateCharacter(currentCharacter.id, damage(hpState, amount));
  };

  const applyHeal = (amount: number) => {
    updateCharacter(currentCharacter.id, heal(hpState, amount, calculatedMaxHp));
  };

  const setTempHp = () => {
    const val = parseInt(tempHpAmount, 10);
    if (!isNaN(val) && val >= 0) {
      // While a form is active, temp HP goes on the form (see wildShapeHp.ts), not the character.
      const patch = currentCharacter.activeWildShape ? setWildShapeTempHp(currentCharacter, val) : { tempHp: val };
      updateCharacter(currentCharacter.id, patch);
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
    setMaxHpOverrideVisible(false);
  };

  // Conditions
  const toggleCondition = (name: string) => {
    const current = currentCharacter.conditions || [];
    const updated = current.includes(name)
      ? current.filter((c: string) => c !== name)
      : [...current, name];
    updateCharacter(currentCharacter.id, { conditions: updated });
  };

  const handleUseHitDie = (die?: string) => {
    const targetDie = die ?? hdEntries.find(([, p]) => p.remaining > 0)?.[0];
    if (!targetDie) return;
    const res = spendHitDie(currentCharacter, targetDie);
    if (res.healed > 0) {
      updateCharacter(currentCharacter.id, {
        currentHp: res.character.currentHp,
        usedHitDice: res.character.usedHitDice,
      });
    }
  };

  const handleRecoverHitDie = (die?: string) => {
    const updated = recoverHitDie(currentCharacter, die);
    updateCharacter(currentCharacter.id, {
      usedHitDice: updated.usedHitDice,
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

      <ActiveWildShapeCard character={currentCharacter} />

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
                  <TouchableOpacity onPress={() => toggleCondition(cond)} style={{ paddingLeft: 4 }} hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}>
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
        <HitPointBlock
          label="HIT POINTS"
          currentHp={currentCharacter.currentHp}
          maxHp={calculatedMaxHp}
          tempHp={currentCharacter.tempHp}
          numberProps={hpQuickEdit.triggerProps}
          headerRight={
            <TouchableOpacity
              onPress={() => {
                setMaxHpOverrideInput(currentCharacter.maxHpOverride ? String(currentCharacter.maxHpOverride) : "");
                setMaxHpOverrideVisible(true);
              }}
              style={[styles.hpEditBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
              <Ionicons name="settings-outline" size={16} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>HP Settings</Text>
            </TouchableOpacity>
          }
          amount={hpChangeAmount}
          onAmountChange={setHpChangeAmount}
          onDamage={() => applyDamage(parseInt(hpChangeAmount, 10) || 1)}
          onHeal={() => applyHeal(parseInt(hpChangeAmount, 10) || 1)}
        />

        {/* Temp HP Row */}
        <View style={styles.tempHpRow}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1, flexBasis: "auto", flexShrink: 1 }}>
            {currentCharacter.activeWildShape ? "Wild Shape Temp HP:" : "Temp HP:"}
          </Text>
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
                    hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
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
                    hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          {(hasDefenseAc || infusionBonusAc > 0) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 3, marginTop: 4 }}>
              {hasDefenseAc && <Badge label="Defense +1" variant="outline" size="sm" />}
              {infusionBonusAc > 0 && <Badge label={`Infused +${infusionBonusAc}`} variant="outline" size="sm" />}
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="flash" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{formatModifier(initiative)}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>INITIATIVE</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            const speedContent = [
              `Walking Speed: ${speeds.walk} ft`,
              ...speeds.details.filter(d => d.mode === "walk").map(d => `• ${d.source}`),
              "",
              ...(speeds.swim != null && speeds.swim > 0
                ? [`Swimming Speed: ${speeds.swim} ft`, ...speeds.details.filter(d => d.mode === "swim").map(d => `• ${d.source}`), ""]
                : []),
              ...(speeds.climb != null && speeds.climb > 0
                ? [`Climbing Speed: ${speeds.climb} ft`, ...speeds.details.filter(d => d.mode === "climb").map(d => `• ${d.source}`), ""]
                : []),
              ...(speeds.fly != null || speeds.flyRestricted
                ? [
                    `Flying Speed: ${speeds.fly ?? 0} ft${speeds.flyRestricted ? " (Restricted)" : ""}`,
                    ...speeds.details.filter(d => d.mode === "fly").map(d => `• ${d.source}`),
                    speeds.flyRestricted ? "\n⚠️ Flight is restricted while wearing medium or heavy armor." : "",
                  ]
                : []),
            ]
              .join("\n")
              .trim();

            setDetailModal({
              visible: true,
              title: "Movement Speeds",
              subtitle: `Walking: ${speeds.walk} ft`,
              content: speedContent,
            });
          }}
          style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="walk" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>{speeds.walk} ft</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>SPEED</Text>
          {((speeds.swim != null && speeds.swim > 0) || (speeds.climb != null && speeds.climb > 0) || speeds.fly != null || speeds.flyRestricted) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, marginTop: 4 }}>
              {speeds.swim != null && speeds.swim > 0 && (
                <Badge label={`🏊 ${speeds.swim} ft`} variant="secondary" size="sm" />
              )}
              {speeds.climb != null && speeds.climb > 0 && (
                <Badge label={`🧗 ${speeds.climb} ft`} variant="secondary" size="sm" />
              )}
              {speeds.fly != null && speeds.fly > 0 && !speeds.flyRestricted && (
                <Badge label={`🪽 ${speeds.fly} ft`} variant="accent" size="sm" />
              )}
              {speeds.flyRestricted && (
                <Badge label="🪽 0 ft (Armor)" variant="warning" size="sm" />
              )}
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="ribbon" size={18} color={theme.accent} />
          <Text style={[styles.statBoxValue, { color: theme.text }]}>+{profBonus}</Text>
          <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>PROFICIENCY</Text>
        </View>
      </View>

      {/* Active Class Dice Summary Strip */}
      {(classDice.bardicInspiration || classDice.sneakAttack || classDice.martialArts || classDice.superiorityDice) && (
        <View style={[styles.classDiceStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.classDiceStripLabel, { color: theme.textMuted }]}>CLASS COMBAT DICE</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {classDice.bardicInspiration && (
              <TouchableOpacity
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: "Bardic Inspiration Die",
                    subtitle: classDice.bardicInspiration ?? undefined,
                    content: `Your Bardic Inspiration die is currently a ${classDice.bardicInspiration}.\n\nYou can use a bonus action to grant one creature within 60 feet this die to add to one ability check, attack roll, or saving throw within 10 minutes.`,
                  })
                }>
                <Badge label={`Bardic Inspiration: ${classDice.bardicInspiration}`} variant="accent" size="sm" />
              </TouchableOpacity>
            )}
            {classDice.sneakAttack && (
              <TouchableOpacity
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: "Sneak Attack Dice",
                    subtitle: classDice.sneakAttack ?? undefined,
                    content: `Once per turn, you can deal an extra ${classDice.sneakAttack} damage to one creature you hit with an attack if you have advantage on the attack roll, or if another enemy of the target is within 5 feet of it (and you don't have disadvantage). Attack must use a finesse or ranged weapon.`,
                  })
                }>
                <Badge label={`Sneak Attack: ${classDice.sneakAttack}`} variant="accent" size="sm" />
              </TouchableOpacity>
            )}
            {classDice.martialArts && (
              <TouchableOpacity
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: "Martial Arts Die",
                    subtitle: classDice.martialArts ?? undefined,
                    content: `Your unarmed strikes and monk weapons can use this die (${classDice.martialArts}) in place of normal damage. You can also use Dexterity instead of Strength for attack and damage rolls with monk weapons and unarmed strikes.`,
                  })
                }>
                <Badge label={`Martial Arts: ${classDice.martialArts}`} variant="accent" size="sm" />
              </TouchableOpacity>
            )}
            {classDice.superiorityDice && (
              <TouchableOpacity
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: "Superiority Dice",
                    subtitle: `${classDice.superiorityDice?.count}${classDice.superiorityDice?.die}`,
                    content: `You have ${classDice.superiorityDice?.count} superiority dice, which are ${classDice.superiorityDice?.die}s.\n\nYou expend superiority dice to fuel your Battle Master maneuvers. You regain all of your expended superiority dice when you finish a short or long rest.`,
                  })
                }>
                <Badge label={`Superiority Dice: ${classDice.superiorityDice.count}${classDice.superiorityDice.die}`} variant="accent" size="sm" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Hit Dice Card */}
      <Card style={styles.hitDiceCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>HIT DICE</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {availableHd} / {totalHitDice} Remaining ({hitDiceLabel})
            </Text>
          </View>
          {hdEntries.length <= 1 && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Use" size="sm" variant="danger" onPress={() => handleUseHitDie()} disabled={availableHd <= 0} />
              <Button title="Recover" size="sm" variant="secondary" onPress={() => handleRecoverHitDie()} disabled={usedHdCount <= 0} />
            </View>
          )}
        </View>

        {hdEntries.length > 1 && (
          <View style={{ marginTop: 8, gap: 6, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 }}>
            {hdEntries.map(([die, pool]) => (
              <View key={die} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>
                  {pool.remaining} / {pool.total} {die.toUpperCase()}
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Button
                    title="Use"
                    size="sm"
                    variant="danger"
                    onPress={() => handleUseHitDie(die)}
                    disabled={pool.remaining <= 0}
                  />
                  <Button
                    title="Recover"
                    size="sm"
                    variant="secondary"
                    onPress={() => handleRecoverHitDie(die)}
                    disabled={pool.used <= 0}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* 6 Ability Scores Grid */}
      <Text style={[styles.blockTitle, { color: theme.textSecondary }]}>ABILITY SCORES & MODIFIERS</Text>
      <View style={styles.abilityGrid}>
        {ABILITY_ORDER.map((key) => {
          const score = scores[key];
          const mod = modifiers[key];
          return (
            <View key={key} style={[styles.abilityTile, { backgroundColor: theme.surface, borderColor: theme.border }, isCompact && { width: "48%" }]}>
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

      {/* Skills Grouped by Ability */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <Text style={[styles.blockTitle, { color: theme.textSecondary, marginTop: 0, marginBottom: 0 }]}>
          SKILLS BY ABILITY (PASSIVES IN BRACKETS)
        </Text>
      </View>
      <Card style={{ padding: 6, gap: 12 }}>
        {SKILL_ABILITY_GROUPS.map((group) => {
          const groupSkills = skills.filter((s) => s.ability === group.key);
          if (groupSkills.length === 0) return null;
          return (
            <View key={group.key} style={{ gap: 2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: theme.surfaceHighlight,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
                  {group.label} ({group.key.toUpperCase()})
                </Text>
              </View>
              {groupSkills.map((skill, index) => {
                const isPassiveSkill = ["investigation", "insight", "perception"].includes(skill.name.toLowerCase());
                return (
                  <View
                    key={skill.name}
                    style={[
                      styles.skillRow,
                      {
                        borderBottomColor: theme.border,
                        borderBottomWidth: index === groupSkills.length - 1 ? 0 : 1,
                        backgroundColor: index % 2 === 0 ? "transparent" : theme.surfaceHighlight + "30",
                      },
                    ]}
                  >
                    {/* Prof / Expertise / Jack Indicator */}
                    <View style={styles.skillProfCol}>
                      {skill.isExpertise ? (
                        <View
                          style={[
                            styles.profIndicator,
                            {
                              borderColor: theme.warning,
                              backgroundColor: theme.warning,
                            },
                          ]}
                        >
                          <View style={[styles.expertiseInnerDot, { backgroundColor: "#fff" }]} />
                        </View>
                      ) : skill.isProficient ? (
                        <View
                          style={[
                            styles.profIndicator,
                            {
                              borderColor: theme.accent,
                              backgroundColor: theme.accent,
                            },
                          ]}
                        />
                      ) : skill.halfProficiency ? (
                        <View
                          style={[
                            styles.profIndicator,
                            {
                              borderColor: theme.accent,
                              backgroundColor: "transparent",
                            },
                          ]}
                        >
                          <Text style={{ color: theme.accent, fontSize: 8, fontWeight: "800", lineHeight: 10 }}>½</Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.profIndicator,
                            {
                              borderColor: theme.border,
                              backgroundColor: "transparent",
                            },
                          ]}
                        />
                      )}
                    </View>

                    {/* Skill Name */}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.skillName, { color: theme.text }]}>
                        {skill.name}
                      </Text>
                    </View>

                    {/* Passive Score in ( ) - strictly Investigation, Insight, Perception */}
                    <View style={{ width: 85, alignItems: "center" }}>
                      {isPassiveSkill && (
                        <Text style={[styles.passiveText, { color: theme.textSecondary }]}>
                          ({skill.passiveBonus})
                        </Text>
                      )}
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
                              : skill.halfProficiency
                              ? theme.text
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {formatModifier(skill.bonus)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
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
          <View style={[styles.headingRow, { marginBottom: 4 }]}>
            <Text style={[styles.profCatTitle, { color: theme.accent }]}>Tool Proficiencies</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Add tool proficiency"
              onPress={() => setAddModal("tools")}
              hitSlop={8}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color={theme.accent} />
            </TouchableOpacity>
          </View>
          {evaluated.tools && evaluated.tools.length > 0 ? (
            <View style={{ gap: 6 }}>
              {evaluated.tools.map((t, idx) => (
                <View
                  key={`${t.name}_${idx}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 2,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View style={styles.skillProfCol}>
                      {t.isExpertise ? (
                        <View
                          style={[
                            styles.profIndicator,
                            {
                              borderColor: theme.warning,
                              backgroundColor: theme.warning,
                            },
                          ]}
                        >
                          <View style={[styles.expertiseInnerDot, { backgroundColor: "#fff" }]} />
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.profIndicator,
                            {
                              borderColor: theme.accent,
                              backgroundColor: theme.accent,
                            },
                          ]}
                        />
                      )}
                    </View>
                    <Text style={{ color: theme.text, fontSize: 13, flex: 1 }}>
                      {t.name}
                    </Text>
                    {addedToolNames.has(t.name) ? (
                      <Text style={[styles.addedMark, { color: theme.textSecondary, borderColor: theme.border }]}>
                        added
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.trailing}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "bold",
                        color: t.isExpertise ? theme.warning : theme.accent,
                      }}
                    >
                      {t.ability
                        ? `(${t.displayModifier}, ${t.ability.charAt(0).toUpperCase() + t.ability.slice(1)})`
                        : `(${t.displayModifier})`}
                    </Text>
                    {addedToolNames.has(t.name) ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${t.name}`}
                        onPress={() => handleRemove("tools", t.name)}
                        hitSlop={8}
                        style={styles.removeBtn}
                      >
                        <Text style={{ color: theme.textSecondary, fontSize: 16, fontWeight: "bold" }}>×</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: theme.text, fontSize: 13 }}>None</Text>
          )}
        </View>
      </Card>

      {/* Languages Summary */}
      <View style={[styles.headingRow, { marginTop: 20, marginBottom: 8 }]}>
        <Text style={[styles.blockTitle, { color: theme.textSecondary, marginBottom: 0 }]}>
          LANGUAGES
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add language"
          onPress={() => setAddModal("languages")}
          hitSlop={8}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>
      <Card style={{ gap: 6 }}>
        {derivedLanguages.length > 0 || addedLanguages.length === 0 ? (
          <Text style={{ color: theme.text, fontSize: 13, lineHeight: 20 }}>
            {derivedLanguages.length > 0 ? derivedLanguages.join(", ") : "Common"}
          </Text>
        ) : null}
        {addedLanguages.map((l) => (
          <View key={l.name} style={styles.addedRow}>
            <Text style={{ color: theme.text, fontSize: 13, flexShrink: 1 }}>{l.name}</Text>
            <View style={styles.trailing}>
              <Text style={[styles.addedMark, { color: theme.textSecondary, borderColor: theme.border }]}>
                added
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove ${l.name}`}
                onPress={() => handleRemove("languages", l.name)}
                hitSlop={8}
                style={styles.removeBtn}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 16, fontWeight: "bold" }}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>

      <AddedProficiencyModal
        visible={addModal !== null}
        category={addModal ?? "tools"}
        options={addModal ? addedProficiencyOptions(currentCharacter, addCatalogs(), addModal) : []}
        isAddable={(raw) => addModal !== null && addAddedProficiency(currentCharacter, addCatalogs(), addModal, raw).ok}
        onAdd={(raw) => {
          if (addModal) handleAdd(addModal, raw);
        }}
        onClose={() => setAddModal(null)}
      />

      {/* HP Override Settings Modal */}
      <RNModal visible={maxHpOverrideVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>
              HP Configuration
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 8 }}>
              Standard calculated Max HP: <Text style={{ color: theme.accent, fontWeight: "bold" }}>{evaluateCharacter({ ...currentCharacter, maxHpOverride: null }).hp.max}</Text>
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
              <Button title="Cancel" variant="secondary" size="sm" onPress={() => setMaxHpOverrideVisible(false)} />
              <Button title="Save" variant="primary" size="sm" onPress={setMaxHpOverride} />
            </View>
          </Card>
        </View>
      </RNModal>

      {/* Hit Points Quick Edit Modal */}
      <HpQuickEditModal {...hpQuickEdit.modalProps} />

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
  hpEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
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
    minWidth: 96,
    flexGrow: 1,
    maxWidth: 160,
    minHeight: 36,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 13,
    textAlignVertical: "center",
    includeFontPadding: false,
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
    flexWrap: "wrap",
  },
  classDiceStrip: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  classDiceStripLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statBox: {
    flex: 1,
    minWidth: 80,
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
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  addBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 2,
  },
  trailing: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 1,
  },
  addedMark: {
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: 4,
  },
  removeBtn: {
    minWidth: 24,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
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
