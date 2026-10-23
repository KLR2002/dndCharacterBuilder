import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { currentCompendium } from "../../services/compendium";
import { formatModifier } from "../../services/dndRules";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import {
  getTacticalActionLedger,
  SAVING_THROW_MANEUVERS,
  STANDARD_ACTIONS,
} from "../../rules/tacticalActions";
import { findStandardWeapon } from "../../rules/attacks";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

export const ActionsTab: React.FC = () => {
  const { currentCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  // Unified Character Evaluation pass
  const evaluated = useMemo(() => {
    if (!currentCharacter) return null;
    return evaluateCharacter(currentCharacter, { compendium: currentCompendium(), activeBooks });
  }, [currentCharacter, activeBooks]);

  // Tactical Action Ledger from pure domain engine
  const ledger = useMemo(() => {
    if (!currentCharacter || !evaluated) return null;
    return getTacticalActionLedger(currentCharacter, evaluated, { activeBooks });
  }, [currentCharacter, evaluated, activeBooks]);

  const weaponAttacks = ledger?.weaponAttacks ?? [];
  const dualWield = ledger?.dualWield ?? { isDualWielding: false };
  const extraAttackCount = ledger?.extraAttackCount ?? 1;
  const spellAttacks = ledger?.spellAttacks ?? [];
  const sneakAttackDice = ledger?.sneakAttackDice ?? null;
  const maneuverDetails = ledger?.maneuvers ?? [];
  const classBonusActions = ledger?.bonusActions ?? [];
  const classReactions = ledger?.reactions ?? [];
  const maneuverDc = evaluated?.combatDcs?.maneuverSaveDc ?? 8;
  const superiorityDice = evaluated?.combatDice?.superiorityDice ?? null;

  // Ki Spellcasting Profile (Monk)
  const kiProfile = useMemo(() => {
    return (evaluated?.spellProfiles || []).find((p) => p.className === "Monk");
  }, [evaluated]);

  // Giant Spellcasting Profile (Barbarian)
  const giantProfile = useMemo(() => {
    return (evaluated?.spellProfiles || []).find(
      (p) => p.className === "Barbarian" && Boolean(p.subclass?.toLowerCase().includes("giant"))
    );
  }, [evaluated]);



  if (!currentCharacter || !evaluated) return null;

  const profBonus = evaluated.proficiencyBonus;
  const { modifiers } = evaluated.effectiveScores;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Attack Count Banner */}
      <Card style={[styles.bannerCard, { borderColor: theme.accent }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.bannerTitle, { color: theme.accent }]}>
              ATTACK ACTION ({extraAttackCount} {extraAttackCount === 1 ? "Attack" : "Attacks"} per Action)
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Proficiency Bonus +{profBonus} • Str Mod {formatModifier(modifiers.str)} • Dex Mod {formatModifier(modifiers.dex)}
            </Text>
          </View>
          <Ionicons name="flash" size={24} color={theme.accent} />
        </View>
      </Card>

      {/* Equipped Weapon Attacks */}
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
          EQUIPPED WEAPON ATTACKS
        </Text>

        {weaponAttacks.length === 0 ? (
          <Card style={{ padding: 14 }}>
            {/* Unarmed Strike Default */}
            <View style={[styles.attackRow, {
              flexDirection: isCompact ? "column" : "row",
              alignItems: isCompact ? "flex-start" : "center",
              minHeight: 44,
            }]}>
              <View style={{ flex: isCompact ? undefined : 1, width: isCompact ? "100%" : undefined }}>
                <Text style={[styles.attackTitle, { color: theme.text }]}>Unarmed Strike</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>Melee • Bludgeoning</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: isCompact ? 6 : 0 }}>
                <Badge label={`+${profBonus + modifiers.str} to hit`} variant="accent" />
                <Badge label={`${1 + modifiers.str} dmg`} variant="secondary" />
              </View>
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 8 }}>
              Equip weapons in the Inventory tab to see custom attack bonuses and damage formulas.
            </Text>
          </Card>
        ) : (
          <Card style={{ padding: 4 }}>
            {weaponAttacks.map((attack, idx) => {
              const std = findStandardWeapon(attack.name);
              const properties: string[] = (attack.item as any)?.properties || std?.properties || [];
              const rangeStr = attack.range ? attack.range : attack.isRanged ? "Ranged" : "Melee";
              const statUpper = attack.statUsed.toUpperCase();

              return (
                <TouchableOpacity
                  key={`${attack.item.id}_${idx}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    const bonusBreakdown = [
                      `Proficiency ${attack.isProficient ? `+${profBonus}` : "+0"}`,
                      `${statUpper} ${formatModifier(modifiers[attack.statUsed])}`,
                      attack.archeryBonus ? `Archery +${attack.archeryBonus}` : null,
                      attack.infusionBonus ? `Infusion +${attack.infusionBonus}` : null,
                    ]
                      .filter(Boolean)
                      .join(" + ");

                    const dmgNotes = [
                      attack.duelingBonus ? `includes Dueling +${attack.duelingBonus}` : null,
                      attack.infusionBonus ? `includes Infusion +${attack.infusionBonus}` : null,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    setDetailModal({
                      visible: true,
                      title: attack.name,
                      subtitle: `${statUpper}-based Attack`,
                      content: `• Attack Bonus: ${formatModifier(attack.attackBonus)} (${bonusBreakdown})\n• Damage: ${attack.damage}${attack.damageType ? ` ${attack.damageType}` : ""}${dmgNotes ? ` (${dmgNotes})` : ""}${attack.isSneakAttackEligible && attack.sneakAttackDice ? `\n• Sneak Attack: Eligible for +${attack.sneakAttackDice} once per turn` : ""}\n• Range: ${rangeStr}\n• Properties: ${properties.length > 0 ? properties.join(", ") : "None"}\n\n${attack.item.description || ""}`,
                    });
                  }}
                  style={[
                    styles.attackRow,
                    {
                      borderBottomColor: theme.border,
                      borderBottomWidth: idx === weaponAttacks.length - 1 ? 0 : 1,
                      flexDirection: isCompact ? "column" : "row",
                      alignItems: isCompact ? "flex-start" : "center",
                      minHeight: 44,
                    },
                  ]}>
                  <View style={{ flex: isCompact ? undefined : 1, width: isCompact ? "100%" : undefined }}>
                    <Text style={[styles.attackTitle, { color: theme.text }]}>{attack.name}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                      {statUpper} • {rangeStr}{attack.damageType ? ` • ${attack.damageType}` : ""}
                    </Text>
                    {properties.length > 0 && (
                      <Text style={{ color: theme.textMuted, fontSize: 10, marginTop: 2 }}>
                        {properties.join(", ")}
                      </Text>
                    )}
                    {attack.calculationBadges && attack.calculationBadges.length > 0 && (
                      <View style={{ marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                        {attack.calculationBadges.map((badge) => (
                          <Badge key={badge} label={badge} variant="outline" size="sm" />
                        ))}
                      </View>
                    )}
                    {attack.isSneakAttackEligible && attack.sneakAttackDice && (
                      <View style={{ marginTop: 4, flexDirection: "row" }}>
                        <Badge
                          label={`Sneak Attack Eligible: +${attack.sneakAttackDice}`}
                          variant="warning"
                          size="sm"
                        />
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: isCompact ? 6 : 0 }}>
                    <Badge label={`${formatModifier(attack.attackBonus)} to hit`} variant="accent" />
                    <Badge label={`${attack.damage}${attack.damageType ? ` ${attack.damageType}` : ""}`} variant="secondary" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}
      </View>

      {/* Sneak Attack Action Card */}
      {sneakAttackDice && (
        <Card style={[styles.sneakAttackCard, { borderColor: theme.accent, borderWidth: 1, backgroundColor: theme.surface }]}>
          <TouchableOpacity
            onPress={() =>
              setDetailModal({
                visible: true,
                title: `Sneak Attack (${sneakAttackDice})`,
                subtitle: "Rogue Feature",
                content: `Beginning at 1st level, you know how to strike subtly and exploit a foe's distraction.\n\nOnce per turn, you can deal an extra ${sneakAttackDice} damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon.\n\nYou don't need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn't incapacitated, and you don't have disadvantage on the attack roll.`,
              })
            }
            style={{ padding: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <Ionicons name="skull-outline" size={22} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>
                    Sneak Attack ({sneakAttackDice})
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                    Once per turn • Finesse or Ranged weapon • Advantage or adjacent ally
                  </Text>
                </View>
              </View>
              <Badge label={`+${sneakAttackDice}`} variant="accent" />
            </View>
          </TouchableOpacity>
        </Card>
      )}

      {/* Off-Hand Attack (Bonus Action / Two-Weapon Fighting) */}
      {dualWield.isDualWielding && dualWield.offHand && (
        <Card style={[styles.dualWieldCard, { borderColor: theme.warning, borderWidth: 1, backgroundColor: theme.surface }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="git-merge" size={18} color={theme.warning} />
            <Text style={{ color: theme.warning, fontWeight: "700", fontSize: 13, flex: 1 }}>
              Off-Hand Attack (Bonus Action / Two-Weapon Fighting)
            </Text>
          </View>
          <View style={[styles.attackRow, { 
            paddingHorizontal: 0, 
            paddingVertical: 4,
            flexDirection: isCompact ? "column" : "row",
            alignItems: isCompact ? "flex-start" : "center",
            minHeight: 44,
          }]}>
            <View style={{ flex: isCompact ? undefined : 1, width: isCompact ? "100%" : undefined }}>
              <Text style={[styles.attackTitle, { color: theme.text }]}>
                {dualWield.offHand.name} (Off-Hand)
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                Bonus Action • No ability mod to damage • {dualWield.offHand.range || (dualWield.offHand.isRanged ? "Ranged" : "Melee")}{dualWield.offHand.damageType ? ` • ${dualWield.offHand.damageType}` : ""}
              </Text>
              {dualWield.offHand.calculationBadges && dualWield.offHand.calculationBadges.length > 0 && (
                <View style={{ marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  {dualWield.offHand.calculationBadges.map((badge) => (
                    <Badge key={badge} label={badge} variant="outline" size="sm" />
                  ))}
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: isCompact ? 6 : 0 }}>
              <Badge label={`${formatModifier(dualWield.offHand.attackBonus)} to hit`} variant="warning" />
              <Badge label={`${dualWield.offHand.damage}${dualWield.offHand.damageType ? ` ${dualWield.offHand.damageType}` : ""}`} variant="secondary" />
            </View>
          </View>
        </Card>
      )}

      {/* Ki Spellcasting Profile Summary */}
      {kiProfile && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
            KI SPELLCASTING PROFILE
          </Text>
          <Card style={{ padding: 12, borderColor: theme.accent, backgroundColor: theme.surfaceHighlight, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={16} color={theme.accent} />
                <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
                  Monk Ki Spellcasting ({kiProfile.subclass || "Monastic Tradition"})
                </Text>
              </View>
              <Badge label="Ki-Powered" variant="accent" />
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
              Ki Save DC: {kiProfile.spellSaveDc} • Spell Attack: +{kiProfile.spellAttackBonus} (Wisdom)
            </Text>
          </Card>
        </View>
      )}

      {/* Giant Spellcasting Profile Summary */}
      {giantProfile && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
            GIANT SPELLCASTING PROFILE
          </Text>
          <Card style={{ padding: 12, borderColor: theme.accent, backgroundColor: theme.surfaceHighlight, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={16} color={theme.accent} />
                <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
                  Giant Power ({giantProfile.subclass || "Path of the Giant"})
                </Text>
              </View>
              <Badge label="Wisdom" variant="accent" />
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
              Spell Save DC: {giantProfile.spellSaveDc} • Spell Attack: +{giantProfile.spellAttackBonus} (Wisdom)
            </Text>
          </Card>
        </View>
      )}

      {/* Spell Attacks / Cantrips */}
      {spellAttacks.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
            SPELL ATTACKS & COMBAT CANTRIPS
          </Text>
          <Card style={{ padding: 4 }}>
            {spellAttacks.map((sp, idx) => (
              <TouchableOpacity
                key={sp.name}
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: sp.name,
                    subtitle: `${sp.level === 0 ? "Cantrip" : `Level ${sp.level}`} • ${sp.time}`,
                    content: sp.desc,
                  })
                }
                style={[
                  styles.attackRow,
                  {
                    borderBottomColor: theme.border,
                    borderBottomWidth: idx === spellAttacks.length - 1 ? 0 : 1,
                    flexDirection: isCompact ? "column" : "row",
                    alignItems: isCompact ? "flex-start" : "center",
                    minHeight: 44,
                  },
                ]}>
                <View style={{ flex: isCompact ? undefined : 1, width: isCompact ? "100%" : undefined }}>
                  <Text style={[styles.attackTitle, { color: theme.text }]}>{sp.name}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                    {sp.time} • Range: {sp.range}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: isCompact ? 6 : 0, width: isCompact ? "100%" : undefined, justifyContent: isCompact ? "space-between" : "flex-end" }}>
                  <Badge label={sp.damage} variant="outline" />
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      )}

      {/* Battle Master Maneuvers */}
      {maneuverDetails.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginBottom: 0 }]}>
              BATTLE MASTER MANEUVERS ({maneuverDetails.length})
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Badge label={`Save DC ${maneuverDc}`} variant="accent" size="sm" />
              {superiorityDice && (
                <Badge label={`Die: ${superiorityDice.die}`} variant="secondary" size="sm" />
              )}
            </View>
          </View>
          <Card style={{ padding: 4 }}>
            {maneuverDetails.map((m, idx) => (
              <TouchableOpacity
                key={m.name}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: m.name,
                    subtitle: `${m.categoryLabel} • Superiority Die [${superiorityDice ? superiorityDice.die : "d8"}]${
                      SAVING_THROW_MANEUVERS.has(m.name.toLowerCase()) ? ` • Save DC ${maneuverDc}` : ""
                    }`,
                    content: `${m.description}\n\n• Action Type: ${m.categoryLabel}\n• Superiority Die: ${
                      superiorityDice ? superiorityDice.die : "d8"
                    }${
                      SAVING_THROW_MANEUVERS.has(m.name.toLowerCase())
                        ? `\n• Maneuver Save DC: ${maneuverDc} (8 + PB ${profBonus} + max(Str, Dex))`
                        : ""
                    }`,
                  })
                }
                style={[
                  styles.actionItemRow,
                  {
                    borderBottomColor: theme.border,
                    borderBottomWidth: idx === maneuverDetails.length - 1 ? 0 : 1,
                  },
                ]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.actionItemTitle, { color: theme.text }]}>{m.name}</Text>
                    <Badge
                      label={m.categoryLabel}
                      size="sm"
                      variant={
                        m.category === "Reaction"
                          ? "warning"
                          : m.category === "Bonus Action"
                          ? "secondary"
                          : "outline"
                      }
                    />
                    {SAVING_THROW_MANEUVERS.has(m.name.toLowerCase()) && (
                      <Badge
                        label={`DC ${maneuverDc}`}
                        size="sm"
                        variant="accent"
                      />
                    )}
                    <Badge
                      label={`+${superiorityDice ? superiorityDice.die : "d8"}`}
                      size="sm"
                      variant="secondary"
                    />
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                    {m.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      )}

      {/* Bonus Actions Cheatsheet */}
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
          BONUS ACTIONS ({classBonusActions.length})
        </Text>
        <Card style={{ padding: 4 }}>
          {classBonusActions.length === 0 ? (
            <View style={{ padding: 12 }}>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                No active class bonus actions available at current level.
              </Text>
            </View>
          ) : (
            classBonusActions.map((ba, idx) => (
              <TouchableOpacity
                key={ba.name}
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: ba.name,
                    subtitle: `Bonus Action (${ba.source})`,
                    content: ba.desc,
                  })
                }
                style={[
                  styles.actionItemRow,
                  {
                    borderBottomColor: theme.border,
                    borderBottomWidth: idx === classBonusActions.length - 1 ? 0 : 1,
                  },
                ]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.actionItemTitle, { color: theme.text }]}>{ba.name}</Text>
                    <Badge label={ba.source} size="sm" variant="secondary" />
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                    {ba.desc}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </Card>
      </View>

      {/* Reactions Cheatsheet */}
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
          REACTIONS ({classReactions.length})
        </Text>
        <Card style={{ padding: 4 }}>
          {classReactions.map((re, idx) => (
            <TouchableOpacity
              key={re.name}
              onPress={() =>
                setDetailModal({
                  visible: true,
                  title: re.name,
                  subtitle: `Reaction (${re.source})`,
                  content: re.desc,
                })
              }
              style={[
                styles.actionItemRow,
                {
                  borderBottomColor: theme.border,
                  borderBottomWidth: idx === classReactions.length - 1 ? 0 : 1,
                },
              ]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.actionItemTitle, { color: theme.text }]}>{re.name}</Text>
                  <Badge label={re.source} size="sm" variant="secondary" />
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                  {re.desc}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>
      </View>

      {/* Standard Actions Cheatsheet */}
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
          STANDARD COMBAT ACTIONS
        </Text>
        <Card style={{ padding: 4 }}>
          {STANDARD_ACTIONS.map((act, idx) => (
            <TouchableOpacity
              key={act.name}
              onPress={() =>
                setDetailModal({
                  visible: true,
                  title: act.name,
                  subtitle: act.type,
                  content: act.desc,
                })
              }
              style={[
                styles.actionItemRow,
                {
                  borderBottomColor: theme.border,
                  borderBottomWidth: idx === STANDARD_ACTIONS.length - 1 ? 0 : 1,
                },
              ]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionItemTitle, { color: theme.text }]}>{act.name}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                  {act.desc}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>
      </View>

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
  bannerCard: {
    padding: 14,
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  attackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  attackTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  dualWieldCard: {
    padding: 12,
    marginBottom: 16,
  },
  sneakAttackCard: {
    padding: 0,
    marginBottom: 16,
  },
  actionItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  actionItemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
});
