import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../../context/ThemeContext";
import { formatModifier } from "../../rules/abilities";
import type { LockedPreparedCard } from "../../rules/spellcasting";
import type { SpellPageAtWillCard, SpellPageGrantedCard, SpellPageGrantedSpell } from "../../rules/spellPage";
import type { SpellData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { formatOrdinal } from "./spellFormat";

/** The copy of a race's Innate Magic card: its subtitle, and whether its rows show the Min Level. */
const RACE_INNATE_COPY = {
  subtitle: "Innate racial magic from your ancestry (Long Rest reset)",
  showMinLevel: true,
};

/** The copy of a feat's Innate Magic card: its subtitle, and whether its rows show the Min Level. */
const FEAT_INNATE_COPY = {
  subtitle: "Spells from this feat (Long Rest reset)",
  showMinLevel: false,
};

interface GrantedSpellCardProps {
  profile: SpellPageGrantedCard;
  onToggleUse: (spell: SpellPageGrantedSpell) => void;
  onShowSpell: (spell: SpellData | undefined) => void;
}

/** A race's or feat's Innate Magic: the ability, save DC and attack bonus, and each spell with its uses. */
export const GrantedSpellCard: React.FC<GrantedSpellCardProps> = ({ profile, onToggleUse, onShowSpell }) => {
  const { theme } = useAppTheme();
  if (profile.spells.length === 0 && !profile.notices?.length) return null;

  const copy = profile.origin === "race" ? RACE_INNATE_COPY : FEAT_INNATE_COPY;
  const sign = (profile.spellAttackBonus ?? 0) >= 0 ? "+" : "";
  const ability = profile.ability;

  return (
    <Card style={[styles.innateCard, { borderColor: theme.accentHover, backgroundColor: theme.surface }]}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>
            {profile.title.toUpperCase()}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
            {copy.subtitle}
          </Text>
        </View>
        {ability && (
          <Badge
            label={`${ability.toUpperCase()} (DC ${profile.spellSaveDc} / ${sign}${profile.spellAttackBonus})`}
            variant="accent"
            size="sm"
          />
        )}
      </View>

      {profile.notices?.map((notice) => (
        <Text key={notice} style={{ color: theme.warning, fontSize: 12, marginBottom: 6 }}>
          {notice}
        </Text>
      ))}

      {ability && (
        <View style={[styles.innateStatsRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <View style={styles.innateStatCol}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>ABILITY</Text>
            <Text style={[styles.innateStatVal, { color: theme.accentHover }]}>
              {ability.toUpperCase()}
            </Text>
          </View>
          <View style={styles.innateStatCol}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>SAVE DC</Text>
            <Text style={[styles.innateStatVal, { color: theme.text }]}>
              {profile.spellSaveDc ?? "—"}
            </Text>
          </View>
          <View style={styles.innateStatCol}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>ATTACK BONUS</Text>
            <Text style={[styles.innateStatVal, { color: theme.text }]}>
              {profile.spellAttackBonus === undefined ? "—" : formatModifier(profile.spellAttackBonus)}
            </Text>
          </View>
        </View>
      )}

      {/* Spells List */}
      <View style={{ marginTop: 8, gap: 6 }}>
        {profile.spells.map((spell) => {
          const max = spell.maxUses ?? 1;
          const isUsed = spell.remaining === 0;

          return (
            <View
              key={`innate_${spell.name}_${spell.level}`}
              style={[
                styles.innateSpellRow,
                {
                  borderBottomColor: theme.border,
                  backgroundColor: isUsed ? theme.surfaceHighlight + "50" : "transparent",
                },
              ]}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onShowSpell(spell.details)}
                style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text
                    style={[
                      styles.spellTitle,
                      {
                        color: isUsed ? theme.textMuted : theme.text,
                        textDecorationLine: isUsed ? "line-through" : "none",
                        flexShrink: 1,
                      },
                    ]}>
                    {spell.name}
                    {spell.note !== undefined && (
                      <Text style={{ fontWeight: "400", color: theme.textSecondary }}>{` (${spell.note.replace(/ /g, " ")})`}</Text>
                    )}
                  </Text>
                  {spell.isCantrip ? (
                    <Badge label="Cantrip" variant="surface" size="sm" />
                  ) : (
                    <Badge
                      label={`${formatOrdinal(spell.level)} Level`}
                      variant="surface"
                      size="sm"
                    />
                  )}
                  {spell.blast && <Badge label={spell.blast.badge.label} variant={spell.blast.badge.tone} size="sm" />}
                  <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                  {spell.castingTime}
                  {copy.showMinLevel ? ` • Min Level ${spell.minCharacterLevel}` : ""}
                  {spell.blast ? ` • ${spell.blast.damage}` : ""}
                </Text>
              </TouchableOpacity>

              {spell.resourceCounterId === undefined ? (
                <Badge label="At Will" variant="secondary" size="sm" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {isUsed ? `0/${max} (Used)` : `${max}/${max}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onToggleUse(spell)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.slotCheckbox,
                      {
                        borderColor: theme.accentHover,
                        backgroundColor: isUsed ? theme.accentGlow : "transparent",
                      },
                    ]}>
                    {isUsed && <Ionicons name="checkmark" size={14} color={theme.accentHover} />}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
};

interface LockedSpellCardProps {
  card: LockedPreparedCard;
  onShowSpell: (spell: SpellData | undefined) => void;
}

/** The locked card of a source's plain prepared spells: each spell carries the lock, with no counter and no ability row. */
export const LockedSpellCard: React.FC<LockedSpellCardProps> = ({ card, onShowSpell }) => {
  const { theme } = useAppTheme();

  return (
    <Card style={[styles.innateCard, { borderColor: theme.accentHover, backgroundColor: theme.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>{card.title.toUpperCase()}</Text>
      <View style={{ marginTop: 8, gap: 6 }}>
        {card.spells.map((spell) => (
          <View key={`locked_${card.title}_${spell.name}`} style={[styles.innateSpellRow, { borderBottomColor: theme.border }]}>
            <Ionicons name="lock-closed" size={16} color={theme.accentHover} />
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onShowSpell(spell)}
              style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[styles.spellTitle, { color: theme.text }]}>{spell.name}</Text>
                <Badge
                  label={spell.level === 0 ? "Cantrip" : `${formatOrdinal(spell.level)} Level`}
                  variant="surface"
                  size="sm"
                />
                <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{spell.castingTime}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Card>
  );
};

interface AtWillSpellCardProps {
  cards: SpellPageAtWillCard[];
  onShowSpell: (spell: SpellData | undefined) => void;
}

/** The at-will spells the Eldritch Invocations grant. */
export const AtWillSpellCard: React.FC<AtWillSpellCardProps> = ({ cards, onShowSpell }) => {
  const { theme } = useAppTheme();
  if (cards.length === 0) return null;

  return (
    <Card style={[styles.innateCard, { borderColor: theme.accentHover, backgroundColor: theme.surface, marginBottom: 16 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>
            AT-WILL MAGIC (ELDRITCH INVOCATIONS)
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
            Cast at will without expending spell slots
          </Text>
        </View>
        <Badge label="At Will" variant="accent" size="sm" />
      </View>
      <View style={{ marginTop: 8, gap: 6 }}>
        {cards.map(({ invocationName, spellName, details: spell, blast }) => {
          return (
            <View
              key={`at_will_${invocationName}_${spellName}`}
              style={[styles.innateSpellRow, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onShowSpell(spell)}
                style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={[styles.spellTitle, { color: theme.text }]}>
                    {spellName}
                  </Text>
                  <Badge label="At Will - Invocation" variant="accent" size="sm" />
                  {blast && <Badge label={blast.badge.label} variant={blast.badge.tone} size="sm" />}
                  <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                  {spell?.castingTime || "1 action"} • {invocationName}
                  {blast ? ` • ${blast.damage}` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  innateCard: {
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  innateStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
  },
  innateStatCol: {
    alignItems: "center",
  },
  innateStatVal: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  innateSpellRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  spellTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  slotCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
});
