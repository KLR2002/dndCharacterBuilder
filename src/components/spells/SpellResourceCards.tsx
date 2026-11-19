import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../../context/ThemeContext";
import { formatModifier } from "../../rules/abilities";
import { SPELL_LEVEL_NAMES } from "../../rules/spellPage";
import type { SpellPageArcanumTier } from "../../rules/spellPage";
import type { PactSlotLedger, SorceryPointsLedger, SpellSlotLedgerEntry } from "../../rules/characterSpells";
import type { SpellData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { METAMAGIC_OPTIONS } from "./metamagicOptions";
import { formatOrdinal, type SpellDetailPayload } from "./spellFormat";

export interface SpellResourceActions {
  onSpendSorceryPoint: () => void;
  onRegainSorceryPoint: () => void;
  onOpenMetamagic: () => void;
  onTogglePactSlot: (slotIndex: number) => void;
  onToggleSlot: (level: number, slotIndex: number) => void;
  onToggleArcanumCast: (level: number) => void;
  onShowSpell: (spell: SpellData | undefined) => void;
  onShowDetail: (detail: SpellDetailPayload) => void;
}

interface SpellResourceCardsProps {
  sorceryPoints: SorceryPointsLedger | null;
  metamagic: { allowance: number; chosen: string[] } | null;
  pactSlots: PactSlotLedger | null;
  mysticArcanum: SpellPageArcanumTier[];
  slots: SpellSlotLedgerEntry[] | null;
  actions: SpellResourceActions;
}

/** The sorcery points with Metamagic, the Warlock's pact slots, the Mystic Arcanum tiers and the spell slots. */
export const SpellResourceCards: React.FC<SpellResourceCardsProps> = ({
  sorceryPoints,
  metamagic,
  pactSlots,
  mysticArcanum,
  slots,
  actions,
}) => {
  const { theme } = useAppTheme();

  // Sorcery points show from Sorcerer 2; the Metamagic button and list from Sorcerer 3.
  const sorcererLevel = sorceryPoints?.max ?? 0;
  const usedSorceryPoints = sorceryPoints?.used ?? 0;
  const currentSorceryPoints = sorceryPoints?.remaining ?? 0;
  const maxMetamagic = metamagic?.allowance ?? 0;
  const selectedMetamagic = metamagic?.chosen ?? [];

  const pactSlotsUsed = pactSlots?.used ?? 0;
  const remainingPactSlots = pactSlots?.remaining ?? 0;

  return (
    <>
      {/* Sorcery points (Sorcerer 2); the Metamagic button and list from Sorcerer 3 */}
      {sorceryPoints && (
        <Card style={[styles.sorceryCard, { borderColor: theme.accentHover }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>SORCERY POINTS</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                {currentSorceryPoints} / {sorcererLevel} Available (Long Rest reset)
              </Text>
            </View>

            <View style={styles.sorceryButtons}>
              <Button
                title="-1"
                size="sm"
                variant="danger"
                onPress={actions.onSpendSorceryPoint}
                disabled={currentSorceryPoints <= 0}
              />
              <Button
                title="+1"
                size="sm"
                variant="success"
                onPress={actions.onRegainSorceryPoint}
                disabled={usedSorceryPoints <= 0}
              />
              {metamagic && (
                <Button
                  title={`Metamagic (${selectedMetamagic.length}/${maxMetamagic})`}
                  size="sm"
                  variant="outline"
                  onPress={actions.onOpenMetamagic}
                />
              )}
            </View>
          </View>

          {/* Chosen Metamagic list */}
          {metamagic && selectedMetamagic.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {selectedMetamagic.map((m: string) => {
                const opt = METAMAGIC_OPTIONS.find((o) => o.name === m);
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() =>
                      actions.onShowDetail({
                        title: m,
                        subtitle: opt?.cost,
                        content: opt?.desc || "",
                      })
                    }
                    style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight, borderColor: theme.accentHover }]}>
                    <Text style={{ color: theme.accentHover, fontSize: 12, fontWeight: "600" }}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>
      )}

      {/* Warlock Pact Slots (Strictly Separate from Multiclass Slots) */}
      {pactSlots && (
        <Card style={[styles.pactCard, { borderColor: theme.accentHover }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>WARLOCK PACT MAGIC</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                {pactSlots.total} {pactSlots.total === 1 ? "slot" : "slots"} of {formatOrdinal(pactSlots.level)} level (Short Rest reset)
              </Text>
            </View>
            <Badge label="Short Rest reset" variant="secondary" size="sm" />
          </View>

          <View style={styles.slotsTrackerRow}>
            {Array.from({ length: pactSlots.total }).map((_, slotIdx) => {
              const isUsed = slotIdx < pactSlotsUsed;
              return (
                <TouchableOpacity
                  key={`pact_slot_${slotIdx}`}
                  onPress={() => actions.onTogglePactSlot(slotIdx)}
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
              );
            })}
            <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 8 }}>
              {remainingPactSlots} / {pactSlots.total} remaining
            </Text>
          </View>
        </Card>
      )}

      {/* Mystic Arcanum (Warlock Level >= 11) */}
      {mysticArcanum.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: theme.accentHover }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>
                  MYSTIC ARCANUM
                </Text>
                <Badge label="1/Long Rest" variant="accent" size="sm" />
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                High-level patron magic (does not consume spell slots) • Long Rest reset
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {mysticArcanum.map((tier) => {
              const spell = tier.spellData;
              const isSpent = tier.isSpent;

              return (
                <View
                  key={`arcanum_tier_${tier.level}`}
                  style={[
                    styles.pickerSpellRow,
                    {
                      borderBottomColor: theme.border,
                      backgroundColor: isSpent ? theme.surfaceHighlight + "40" : "transparent",
                      borderRadius: 8,
                      padding: 8,
                    },
                  ]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "700" }}>
                        {formatOrdinal(tier.spellLevel).toUpperCase()} LEVEL (LVL {tier.level})
                      </Text>
                      {tier.chosenSpellName && (
                        <Badge
                          label={isSpent ? "Expended" : "Available"}
                          variant={isSpent ? "secondary" : "accent"}
                          size="sm"
                        />
                      )}
                    </View>

                    {tier.chosenSpellName ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (spell) {
                            actions.onShowSpell(spell);
                          } else {
                            actions.onShowDetail({
                              title: tier.chosenSpellName!,
                              subtitle: `${formatOrdinal(tier.spellLevel)} Level Arcanum`,
                              content: `Mystic Arcanum spell: ${tier.chosenSpellName}`,
                            });
                          }
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text
                          style={[
                            styles.spellTitle,
                            {
                              color: isSpent ? theme.textMuted : theme.text,
                              textDecorationLine: isSpent ? "line-through" : "none",
                            },
                          ]}>
                          {tier.chosenSpellName}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                          {spell?.castingTime || "1 action"} • {spell?.range || "Self"} • DC {tier.dc ?? "—"} • {tier.attackBonus === null ? "—" : formatModifier(tier.attackBonus)} Atk
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {tier.chosenSpellName && (
                    <Button
                      title={isSpent ? "Expended" : "Cast (1/Long Rest)"}
                      size="sm"
                      variant={isSpent ? "secondary" : "primary"}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => actions.onToggleArcanumCast(tier.spellLevel)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Multiclass / Standard Spell Slots Table (Levels 1-9) */}
      {slots && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>SPELL SLOTS</Text>
            <Badge label="Long Rest reset" variant="secondary" size="sm" />
          </View>
          <View style={{ gap: 8 }}>
            {slots.map(({ level: lvl, total: maxSlots, used, remaining }) => {
              return (
                <View key={`slot_row_${lvl}`} style={styles.slotRow}>
                  <View style={{ width: 80 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>
                      {SPELL_LEVEL_NAMES[lvl]}
                    </Text>
                  </View>

                  <View style={styles.slotCheckboxesRow}>
                    {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                      const isUsed = slotIdx < used;
                      return (
                        <TouchableOpacity
                          key={`lvl_${lvl}_slot_${slotIdx}`}
                          onPress={() => actions.onToggleSlot(lvl, slotIdx)}
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
                      );
                    })}
                  </View>

                  <Text style={{ color: theme.textSecondary, fontSize: 12, width: 45, textAlign: "right" }}>
                    {remaining}/{maxSlots}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  sorceryCard: {
    padding: 14,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitleBlock: {
    flexShrink: 1,
    minWidth: 0,
  },
  sorceryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  pactCard: {
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  slotsTrackerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotCheckboxesRow: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    paddingHorizontal: 10,
  },
  slotCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  spellTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  pickerSpellRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
});
