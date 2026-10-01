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
import { findSpell, getClasses } from "../../services/dataService";
import {
  checkDualWielding,
  findStandardWeapon,
  getWeaponAttacks,
} from "../../rules/attacks";
import {
  calculateEffectiveAbilityScores,
  calculateProficiencyBonus,
  calculateTotalLevel,
  formatModifier,
} from "../../services/dndRules";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

const STANDARD_ACTIONS = [
  {
    name: "Attack",
    type: "Action",
    desc: "Make one melee or ranged attack. Certain features, such as the Extra Attack feature of the fighter, allow you to make more than one attack with this action.",
  },
  {
    name: "Cast a Spell",
    type: "Action / Bonus / Reaction",
    desc: "Cast a spell with a casting time of 1 action. If you cast a bonus action spell, you can only cast a cantrip with casting time of 1 action on the same turn.",
  },
  {
    name: "Dash",
    type: "Action",
    desc: "Gain extra movement for the current turn. The increase equals your speed, after applying any modifiers.",
  },
  {
    name: "Disengage",
    type: "Action",
    desc: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
  },
  {
    name: "Dodge",
    type: "Action",
    desc: "Until the start of your next turn, any attack roll made against you has disadvantage if you can see the attacker, and you make Dexterity saving throws with advantage.",
  },
  {
    name: "Help",
    type: "Action",
    desc: "Lend aid to an ally. The target gains advantage on the next ability check it makes to perform the task, or advantage on its next attack roll against a target within 5 feet of you.",
  },
  {
    name: "Hide",
    type: "Action",
    desc: "Make a Dexterity (Stealth) check in an attempt to hide, concealed from enemies that cannot clearly see you.",
  },
  {
    name: "Ready",
    type: "Action",
    desc: "Wait for a particular circumstance before you act. Choose the perceptible trigger and the action you will take in response, which uses your Reaction when triggered.",
  },
  {
    name: "Search",
    type: "Action",
    desc: "Devote your attention to finding something. The DM might call for a Wisdom (Perception) check or an Intelligence (Investigation) check.",
  },
  {
    name: "Use an Object",
    type: "Action",
    desc: "Interact with a second object on your turn, drink or administer a potion, or use a complex item or mechanical device.",
  },
];

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

  // Dynamic Weapon Attacks from Equipped Items via rules/attacks
  const weaponAttacks = useMemo(() => {
    if (!currentCharacter) return [];
    const allClasses = getClasses(activeBooks || []);
    return getWeaponAttacks(currentCharacter, { classes: allClasses });
  }, [currentCharacter, activeBooks]);

  // Two-Weapon Fighting Check via rules/attacks
  const dualWield = useMemo(() => {
    if (!currentCharacter) return { isDualWielding: false };
    return checkDualWielding(currentCharacter, weaponAttacks);
  }, [currentCharacter, weaponAttacks]);

  // Extra Attack check
  const extraAttackCount = useMemo(() => {
    if (!currentCharacter) return 1;
    let count = 1;
    for (const c of currentCharacter.classes || []) {
      if (c.className === "Fighter") {
        if (c.level >= 20) count = Math.max(count, 4);
        else if (c.level >= 11) count = Math.max(count, 3);
        else if (c.level >= 5) count = Math.max(count, 2);
      } else if (["Barbarian", "Paladin", "Ranger"].includes(c.className) && c.level >= 5) {
        count = Math.max(count, 2);
      } else if (c.className === "Monk" && c.level >= 5) {
        count = Math.max(count, 2);
      }
    }
    return count;
  }, [currentCharacter]);

  // Damaging Cantrips & Spell Attacks
  const spellAttacks = useMemo(() => {
    if (!currentCharacter) return [];
    const known = currentCharacter.knownSpells || [];
    const list: { name: string; level: number; damage: string; time: string; range: string; desc: string }[] = [];

    for (const k of known) {
      const sp = findSpell(k.name, k.source);
      if (sp && (sp.level === 0 || (sp.description || "").toLowerCase().includes("make a ranged spell attack") || (sp.description || "").toLowerCase().includes("make a melee spell attack"))) {
        list.push({
          name: sp.name,
          level: sp.level,
          damage: sp.level === 0 ? "Cantrip scaling" : "Spell attack",
          time: sp.castingTime || "1 action",
          range: sp.range || "60 ft",
          desc: sp.description || "",
        });
      }
    }
    return list;
  }, [currentCharacter]);

  // Class Bonus Actions
  const classBonusActions = useMemo(() => {
    if (!currentCharacter) return [];
    const list: { name: string; source: string; desc: string }[] = [];

    for (const c of currentCharacter.classes || []) {
      if (c.className === "Rogue" && c.level >= 2) {
        list.push({
          name: "Cunning Action",
          source: "Rogue 2",
          desc: "You can take a bonus action on each of your turns in combat to take the Dash, Disengage, or Hide action.",
        });
      }
      if (c.className === "Barbarian") {
        list.push({
          name: "Enter Rage",
          source: "Barbarian 1",
          desc: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.",
        });
      }
      if (c.className === "Fighter") {
        list.push({
          name: "Second Wind",
          source: "Fighter 1",
          desc: `You have a limited well of stamina. On your turn, you can use a bonus action to regain hit points equal to 1d10 + ${c.level}.`,
        });
      }
      if (c.className === "Monk") {
        list.push({
          name: "Martial Arts Strike",
          source: "Monk 1",
          desc: "When you use the Attack action with an unarmed strike or a monk weapon on your turn, you can make one unarmed strike as a bonus action.",
        });
        if (c.level >= 2) {
          list.push({
            name: "Flurry of Blows (1 Ki)",
            source: "Monk 2",
            desc: "Immediately after you take the Attack action on your turn, you can spend 1 ki point to make two unarmed strikes as a bonus action.",
          });
          list.push({
            name: "Patient Defense (1 Ki)",
            source: "Monk 2",
            desc: "You can spend 1 ki point to take the Dodge action as a bonus action on your turn.",
          });
          list.push({
            name: "Step of the Wind (1 Ki)",
            source: "Monk 2",
            desc: "You can spend 1 ki point to take the Disengage or Dash action as a bonus action on your turn, and your jump distance is doubled for the turn.",
          });
        }
      }
      if (c.className === "Bard") {
        list.push({
          name: "Bardic Inspiration",
          source: "Bard 1",
          desc: `You can inspire others through stirring words or music. Use a bonus action to give a creature within 60 ft a Bardic Inspiration die (1d${c.level >= 15 ? 12 : c.level >= 10 ? 10 : c.level >= 5 ? 8 : 6}).`,
        });
      }
    }

    if (dualWield.isDualWielding && dualWield.offHand) {
      list.unshift({
        name: `Off-Hand Attack (${dualWield.offHand.name})`,
        source: "Two-Weapon Fighting",
        desc: `When you take the Attack action and attack with a light melee weapon in one hand, you can use a bonus action to attack with a different light melee weapon in the other hand. Attack bonus: ${formatModifier(dualWield.offHand.attackBonus)} to hit, Damage: ${dualWield.offHand.damage}${dualWield.offHand.damageType ? ` ${dualWield.offHand.damageType}` : ""}. You don't add your ability modifier to the damage of the bonus attack, unless that modifier is negative.`,
      });
    }

    return list;
  }, [currentCharacter, dualWield]);

  // Class Reactions
  const classReactions = useMemo(() => {
    if (!currentCharacter) return [];
    const list: { name: string; source: string; desc: string }[] = [
      {
        name: "Opportunity Attack",
        source: "Standard Combat Rule",
        desc: "You can make an opportunity attack when a hostile creature that you can see moves out of your reach. To make the opportunity attack, you use your reaction to make one melee attack against the provoking creature.",
      },
      {
        name: "Readied Action Trigger",
        source: "Standard Combat Rule",
        desc: "When the trigger condition set by your Ready action occurs, you can take your reaction right after the trigger finishes, or ignore it.",
      },
    ];

    for (const c of currentCharacter.classes || []) {
      if (c.className === "Rogue" && c.level >= 5) {
        list.push({
          name: "Uncanny Dodge",
          source: "Rogue 5",
          desc: "When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you.",
        });
      }
      if (c.className === "Monk" && c.level >= 3) {
        list.push({
          name: "Deflect Missiles",
          source: "Monk 3",
          desc: "You can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack. Damage is reduced by 1d10 + Dex mod + Monk level.",
        });
      }
    }

    // Check for Reaction spells
    const known = currentCharacter.knownSpells || [];
    for (const k of known) {
      const sp = findSpell(k.name, k.source);
      if (sp && (sp.castingTime || "").toLowerCase().includes("reaction")) {
        list.push({
          name: sp.name,
          source: `Spell (${sp.castingTime})`,
          desc: sp.description || "",
        });
      }
    }

    return list;
  }, [currentCharacter]);

  if (!currentCharacter) return null;

  const totalLevel = calculateTotalLevel(currentCharacter);
  const profBonus = calculateProficiencyBonus(totalLevel);
  const { modifiers } = calculateEffectiveAbilityScores(currentCharacter);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Attack Count Banner */}
      <Card style={[styles.bannerCard, { borderColor: theme.accent }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
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
                  onPress={() =>
                    setDetailModal({
                      visible: true,
                      title: attack.name,
                      subtitle: `${statUpper}-based Attack`,
                      content: `• Attack Bonus: ${formatModifier(attack.attackBonus)} (Proficiency ${attack.isProficient ? `+${profBonus}` : "+0"} + ${statUpper} ${formatModifier(modifiers[attack.statUsed])})\n• Damage: ${attack.damage}${attack.damageType ? ` ${attack.damageType}` : ""}\n• Range: ${rangeStr}\n• Properties: ${properties.length > 0 ? properties.join(", ") : "None"}\n\n${attack.item.description || ""}`,
                    })
                  }
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
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: isCompact ? 6 : 0 }}>
              <Badge label={`${formatModifier(dualWield.offHand.attackBonus)} to hit`} variant="warning" />
              <Badge label={`${dualWield.offHand.damage}${dualWield.offHand.damageType ? ` ${dualWield.offHand.damageType}` : ""}`} variant="secondary" />
            </View>
          </View>
        </Card>
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
