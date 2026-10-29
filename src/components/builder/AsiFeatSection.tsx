import type { ActiveBooks } from "../../constants/books";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey, Character } from "../../types/character";
import { FeatData } from "../../types/dnd5e";
import { getFeatAbilityBonusOptions, removeAsiSelection } from "../../rules/leveling";
import { applyAsiWithHitPoints } from "../../rules/builderTransitions";
import { validateFeatPrerequisites } from "../../rules/feats";
import { findHeldRecord } from "../../rules/raceLookup";
import {
  battleMasterManeuverChoices,
  ELDRITCH_ADEPT_CHOICE_ID,
  FIGHTING_INITIATE_CHOICE_ID,
  MARTIAL_ADEPT_CHOICE_ID,
  featSpellChoicesOf,
  fightingStyleRuleChoices,
  pickRuleChoice,
  warlockInvocationChoices,
} from "../../rules/ruleChoices";
import { currentCompendium } from "../../services/compendium";
import { GrantedSpellPicks } from "./GrantedSpellPicks";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchBar } from "../ui/SearchBar";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles } from "./builderStyles";

export interface PendingAsiSlot {
  className: string;
  classLevel: number;
}

export interface AsiFeatSectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  pendingAsiSlots: PendingAsiSlot[];
  allFeats: FeatData[];
  primaryClass?: string;
  onViewDetail: (item: { title: string; subtitle?: string; source?: string; description?: string; tags?: string[] }) => void;
  theme: any;
  activeBooks: ActiveBooks;
  fullHealOnLevelUp: boolean;
}

export const AsiFeatSection: React.FC<AsiFeatSectionProps> = ({
  character,
  onUpdate,
  fullHealOnLevelUp,
  pendingAsiSlots,
  allFeats,
  primaryClass,
  onViewDetail,
  theme,
  activeBooks,
}) => {
  const [activeAsiSlot, setActiveAsiSlot] = useState<string | null>(null);
  const [asiTab, setAsiTab] = useState<"asi" | "feat">("asi");
  const [asiMode, setAsiMode] = useState<"plus2" | "plus1plus1">("plus2");
  const [asiPlus2Pick, setAsiPlus2Pick] = useState<AbilityKey | null>(null);
  const [asiPlus1Picks, setAsiPlus1Picks] = useState<AbilityKey[]>([]);
  const [asiSelectedFeat, setAsiSelectedFeat] = useState<FeatData | null>(null);
  const [asiSelectedFeatAbility, setAsiSelectedFeatAbility] = useState<AbilityKey | null>(null);
  const [asiSelectedFightingStyle, setAsiSelectedFightingStyle] = useState<string | null>(null);
  const [asiSelectedManeuvers, setAsiSelectedManeuvers] = useState<string[]>([]);
  const [asiSelectedInvocation, setAsiSelectedInvocation] = useState<string | null>(null);
  const [asiFeatSearch, setAsiFeatSearch] = useState("");

  const existingAsis = character.asiSelections || [];

  const handleSaveAsi = (className: string, classLevel: number) => {
    if (asiTab === "asi") {
      if (asiMode === "plus2") {
        if (!asiPlus2Pick) return;
        onUpdate((current) =>
          applyAsiWithHitPoints(current, {
            className,
            classLevel,
            level: classLevel,
            type: "asi",
            asi: { [asiPlus2Pick]: 2 },
          }, fullHealOnLevelUp, currentCompendium(), activeBooks)
        );
        setAsiPlus2Pick(null);
      } else {
        if (asiPlus1Picks.length !== 2) return;
        onUpdate((current) =>
          applyAsiWithHitPoints(current, {
            className,
            classLevel,
            level: classLevel,
            type: "asi",
            asi: { [asiPlus1Picks[0]]: 1, [asiPlus1Picks[1]]: 1 },
          }, fullHealOnLevelUp, currentCompendium(), activeBooks)
        );
        setAsiPlus1Picks([]);
      }
    } else {
      if (!asiSelectedFeat) return;
      const opts = getFeatAbilityBonusOptions(asiSelectedFeat.name, asiSelectedFeat);
      if (opts.type === "choice" && !asiSelectedFeatAbility) return;
      const featAbility = opts.type === "fixed" ? opts.abilities[0] : asiSelectedFeatAbility || undefined;
      onUpdate((current) => {
        let updated = applyAsiWithHitPoints(current, {
          className,
          classLevel,
          level: classLevel,
          type: "feat",
          featName: asiSelectedFeat.name,
          featSource: asiSelectedFeat.source,
          featAbility,
          asi: featAbility ? { [featAbility]: 1 } : undefined,
        }, fullHealOnLevelUp, currentCompendium(), activeBooks);
        if (asiSelectedFeat.name.toLowerCase() === "fighting initiate" && asiSelectedFightingStyle) {
          const fsChoices = fightingStyleRuleChoices(updated, activeBooks);
          const fiChoice = fsChoices.find((c) => c.id === FIGHTING_INITIATE_CHOICE_ID);
          if (fiChoice) {
            updated = pickRuleChoice(updated, fiChoice, asiSelectedFightingStyle, currentCompendium(), activeBooks);
          }
        }
        if (asiSelectedFeat.name.toLowerCase() === "martial adept" && asiSelectedManeuvers.length > 0) {
          const mChoices = battleMasterManeuverChoices(updated, activeBooks);
          const maChoice = mChoices.find((c) => c.id === MARTIAL_ADEPT_CHOICE_ID);
          if (maChoice) {
            for (const m of asiSelectedManeuvers) {
              updated = pickRuleChoice(updated, maChoice, m, currentCompendium(), activeBooks);
            }
          }
        }
        if (asiSelectedFeat.name.toLowerCase() === "eldritch adept" && asiSelectedInvocation) {
          const invChoices = warlockInvocationChoices(updated, activeBooks);
          const eaChoice = invChoices.find((c) => c.id === ELDRITCH_ADEPT_CHOICE_ID);
          if (eaChoice) {
            updated = pickRuleChoice(updated, eaChoice, asiSelectedInvocation, currentCompendium(), activeBooks);
          }
        }
        return updated;
      });
      setAsiSelectedFeat(null);
      setAsiSelectedFeatAbility(null);
      setAsiSelectedFightingStyle(null);
      setAsiSelectedManeuvers([]);
      setAsiSelectedInvocation(null);
      setAsiFeatSearch("");
    }
    setActiveAsiSlot(null);
  };

  if (pendingAsiSlots.length === 0 && existingAsis.length === 0) return null;

  return (
    <>
      {/* Pending ASI / Feat Slots */}
      {pendingAsiSlots.map((slot) => {
        const slotKey = `${slot.className}_${slot.classLevel}`;
        const isExpanded = activeAsiSlot === null || activeAsiSlot === slotKey;

        return (
          <Card key={slotKey} style={{ gap: 10, borderColor: theme.warning }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.warning, fontWeight: "700", fontSize: 14 }}>
                  ⚠️ Level-up Choice: {slot.className} Level {slot.classLevel}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  Choose an Ability Score Improvement or a Feat.
                </Text>
              </View>
              {!isExpanded && (
                <Button
                  title="Configure"
                  variant="outline"
                  size="sm"
                  onPress={() => setActiveAsiSlot(slotKey)}
                />
              )}
            </View>

            {isExpanded && (
              <View style={{ gap: 12, marginTop: 4 }}>
                {/* ASI vs Feat toggle */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setAsiTab("asi")}
                    style={[
                      styles.methodBtn,
                      {
                        backgroundColor: asiTab === "asi" ? theme.accentGlow : theme.surface,
                        borderColor: asiTab === "asi" ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        {
                          color: asiTab === "asi" ? theme.accent : theme.textSecondary,
                          fontWeight: asiTab === "asi" ? "700" : "500",
                        },
                      ]}
                    >
                      Ability Scores (+2 or +1/+1)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAsiTab("feat")}
                    style={[
                      styles.methodBtn,
                      {
                        backgroundColor: asiTab === "feat" ? theme.accentGlow : theme.surface,
                        borderColor: asiTab === "feat" ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        {
                          color: asiTab === "feat" ? theme.accent : theme.textSecondary,
                          fontWeight: asiTab === "feat" ? "700" : "500",
                        },
                      ]}
                    >
                      Feat
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ASI Options */}
                {asiTab === "asi" && (
                  <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setAsiMode("plus2")}
                        style={[
                          styles.lineageChip,
                          {
                            backgroundColor: asiMode === "plus2" ? theme.accentGlow : theme.surfaceHighlight,
                            borderColor: asiMode === "plus2" ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: asiMode === "plus2" ? theme.accent : theme.textSecondary,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          +2 to One Ability
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setAsiMode("plus1plus1")}
                        style={[
                          styles.lineageChip,
                          {
                            backgroundColor: asiMode === "plus1plus1" ? theme.accentGlow : theme.surfaceHighlight,
                            borderColor: asiMode === "plus1plus1" ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: asiMode === "plus1plus1" ? theme.accent : theme.textSecondary,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          +1 to Two Abilities
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {asiMode === "plus2" ? (
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Select 1 ability score for +2:</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {ABILITY_KEYS.map((k) => {
                            const selected = asiPlus2Pick === k;
                            return (
                              <TouchableOpacity
                                key={k}
                                onPress={() => setAsiPlus2Pick(selected ? null : k)}
                                style={[
                                  styles.choiceChip,
                                  {
                                    backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                                    borderColor: selected ? theme.accent : theme.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: selected ? theme.accent : theme.textSecondary,
                                    fontWeight: "700",
                                    fontSize: 13,
                                  }}
                                >
                                  {ABILITY_LABELS[k]} (+2)
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                          Select 2 abilities for +1 each ({asiPlus1Picks.length}/2):
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {ABILITY_KEYS.map((k) => {
                            const selected = asiPlus1Picks.includes(k);
                            const canPick = !selected && asiPlus1Picks.length < 2;
                            return (
                              <TouchableOpacity
                                key={k}
                                onPress={() => {
                                  if (selected) {
                                    setAsiPlus1Picks(asiPlus1Picks.filter((p) => p !== k));
                                  } else if (canPick) {
                                    setAsiPlus1Picks([...asiPlus1Picks, k]);
                                  }
                                }}
                                style={[
                                  styles.choiceChip,
                                  {
                                    backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                                    borderColor: selected ? theme.accent : theme.border,
                                    opacity: !selected && !canPick ? 0.4 : 1,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: selected ? theme.accent : theme.textSecondary,
                                    fontWeight: "700",
                                    fontSize: 13,
                                  }}
                                >
                                  {ABILITY_LABELS[k]} (+1)
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <Button
                      title={
                        asiMode === "plus2"
                          ? `Save ASI (+2 ${asiPlus2Pick ? asiPlus2Pick.toUpperCase() : ""})`
                          : `Save ASI (+1 ${asiPlus1Picks.map((p) => p.toUpperCase()).join(", ")})`
                      }
                      variant="primary"
                      size="sm"
                      disabled={asiMode === "plus2" ? !asiPlus2Pick : asiPlus1Picks.length !== 2}
                      onPress={() => handleSaveAsi(slot.className, slot.classLevel)}
                    />
                  </View>
                )}

                {/* Feat Options */}
                {asiTab === "feat" && (
                  <View style={{ gap: 8 }}>
                    <SearchBar value={asiFeatSearch} onChangeText={setAsiFeatSearch} placeholder="Search feats..." />
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled contentContainerStyle={{ gap: 6 }}>
                      {allFeats
                        .filter((f) => f.name.toLowerCase().includes(asiFeatSearch.toLowerCase()))
                        .map((f) => {
                          const isSelected = asiSelectedFeat?.name === f.name;
                          const prereqCheck = validateFeatPrerequisites(character, f);
                          return (
                            <TouchableOpacity
                              key={`${f.name}_${f.source}`}
                              onPress={() => {
                                setAsiSelectedFeat(f);
                                const opts = getFeatAbilityBonusOptions(f.name, f);
                                setAsiSelectedFeatAbility(opts.type === "fixed" ? opts.abilities[0] : null);
                                setAsiSelectedFightingStyle(null);
                                setAsiSelectedManeuvers([]);
                                setAsiSelectedInvocation(null);
                              }}
                              style={[
                                styles.featureRow,
                                {
                                  backgroundColor: isSelected ? theme.accentGlow : theme.surfaceHighlight,
                                  borderColor: isSelected ? theme.accent : theme.border,
                                  padding: 8,
                                  borderRadius: 6,
                                },
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <Text
                                    style={{
                                      color: isSelected ? theme.accent : theme.text,
                                      fontWeight: "700",
                                      fontSize: 13,
                                    }}
                                  >
                                    {f.name}
                                  </Text>
                                  {!prereqCheck.met && (
                                    <Badge label={`⚠️ ${prereqCheck.reason}`} variant="danger" size="sm" />
                                  )}
                                </View>
                                <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                                  {f.source}
                                  {f.prerequisite ? ` • Prereq: ${f.prerequisite}` : ""}
                                </Text>
                              </View>
                              <Button
                                title="Info"
                                variant="ghost"
                                size="sm"
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  onViewDetail({
                                    title: f.name,
                                    source: f.source,
                                    description: f.description,
                                    tags: f.prerequisite ? [`Prereq: ${f.prerequisite}`] : [],
                                  });
                                }}
                              />
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>

                    {asiSelectedFeat && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          padding: 8,
                          backgroundColor: theme.surfaceHighlight,
                          borderRadius: 6,
                        }}
                      >
                        <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                        <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>
                          Selected: {asiSelectedFeat.name} ({asiSelectedFeat.source})
                        </Text>
                      </View>
                    )}

                    {asiSelectedFeat &&
                      (() => {
                        const featOpts = getFeatAbilityBonusOptions(asiSelectedFeat.name, asiSelectedFeat);
                        if (featOpts.type === "none") return null;
                        return (
                          <View
                            style={{
                              gap: 6,
                              padding: 8,
                              backgroundColor: theme.surfaceHighlight,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                              {featOpts.type === "fixed"
                                ? `Ability Score Increase: +1 ${featOpts.abilities[0].toUpperCase()}`
                                : "Choose Ability Score to Increase (+1):"}
                            </Text>
                            {featOpts.type === "choice" && (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                {featOpts.abilities.map((ab) => {
                                  const isPicked = asiSelectedFeatAbility === ab;
                                  return (
                                    <TouchableOpacity
                                      key={ab}
                                      onPress={() => setAsiSelectedFeatAbility(ab)}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      style={[
                                        styles.choiceChip,
                                        {
                                          backgroundColor: isPicked ? theme.accentGlow : theme.surfaceHighlight,
                                          borderColor: isPicked ? theme.accent : theme.border,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={{
                                          color: isPicked ? theme.accent : theme.textSecondary,
                                          fontWeight: isPicked ? "700" : "500",
                                          fontSize: 12,
                                        }}
                                      >
                                        {ab.toUpperCase()} +1
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })()}

                    {asiSelectedFeat && asiSelectedFeat.name.toLowerCase() === "fighting initiate" && (() => {
                      const tempChar: Character = {
                        ...character,
                        asiSelections: [
                          ...(character.asiSelections || []),
                          { type: "feat", featName: "Fighting Initiate", level: 1 },
                        ],
                      };
                      const fsChoice = fightingStyleRuleChoices(tempChar, activeBooks).find((c) => c.id === FIGHTING_INITIATE_CHOICE_ID);
                      const options = fsChoice?.options ?? [];
                      return (
                        <View
                          style={{
                            gap: 6,
                            padding: 8,
                            backgroundColor: theme.surfaceHighlight,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                            Choose Fighting Style (Fighter):
                          </Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {options.map((opt) => {
                              const isPicked = asiSelectedFightingStyle === opt.name;
                              return (
                                <TouchableOpacity
                                  key={opt.name}
                                  onPress={() => setAsiSelectedFightingStyle(isPicked ? null : opt.name)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={[
                                    styles.choiceChip,
                                    {
                                      backgroundColor: isPicked ? theme.accentGlow : theme.surfaceHighlight,
                                      borderColor: isPicked ? theme.accent : theme.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      color: isPicked ? theme.accent : theme.textSecondary,
                                      fontWeight: isPicked ? "700" : "500",
                                      fontSize: 12,
                                    }}
                                  >
                                    {opt.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {asiSelectedFightingStyle && (() => {
                            const selectedOpt = options.find((o) => o.name === asiSelectedFightingStyle);
                            if (!selectedOpt?.description) return null;
                            return (
                              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                                <Text style={{ color: theme.accent, fontWeight: "600" }}>{selectedOpt.name}: </Text>
                                {selectedOpt.description}
                              </Text>
                            );
                          })()}
                        </View>
                      );
                    })()}

                    {asiSelectedFeat && asiSelectedFeat.name.toLowerCase() === "martial adept" && (() => {
                      const tempChar: Character = {
                        ...character,
                        asiSelections: [
                          ...(character.asiSelections || []),
                          { type: "feat", featName: "Martial Adept", level: 1 },
                        ],
                      };
                      const maChoice = battleMasterManeuverChoices(tempChar, activeBooks).find((c) => c.id === MARTIAL_ADEPT_CHOICE_ID);
                      const options = maChoice?.options ?? [];
                      return (
                        <View
                          style={{
                            gap: 6,
                            padding: 8,
                            backgroundColor: theme.surfaceHighlight,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                            Choose 2 Maneuvers (Martial Adept): ({asiSelectedManeuvers.length}/2)
                          </Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {options.map((opt) => {
                              const isPicked = asiSelectedManeuvers.includes(opt.name);
                              return (
                                <TouchableOpacity
                                  key={opt.name}
                                  onPress={() => {
                                    if (isPicked) {
                                      setAsiSelectedManeuvers((prev) => prev.filter((m) => m !== opt.name));
                                    } else {
                                      setAsiSelectedManeuvers((prev) =>
                                        prev.length >= 2 ? [...prev.slice(1), opt.name] : [...prev, opt.name]
                                      );
                                    }
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={[
                                    styles.choiceChip,
                                    {
                                      backgroundColor: isPicked ? theme.accentGlow : theme.surfaceHighlight,
                                      borderColor: isPicked ? theme.accent : theme.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      color: isPicked ? theme.accent : theme.textSecondary,
                                      fontWeight: isPicked ? "700" : "500",
                                      fontSize: 12,
                                    }}
                                  >
                                    {opt.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {asiSelectedManeuvers.length > 0 && (
                            <View style={{ gap: 2, marginTop: 4 }}>
                              {asiSelectedManeuvers.map((mName) => {
                                const opt = options.find((o) => o.name === mName);
                                if (!opt?.description) return null;
                                return (
                                  <Text key={mName} style={{ color: theme.textMuted, fontSize: 11 }}>
                                    <Text style={{ color: theme.accent, fontWeight: "600" }}>{opt.name}: </Text>
                                    {opt.description}
                                  </Text>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {asiSelectedFeat && asiSelectedFeat.name.toLowerCase() === "eldritch adept" && (() => {
                      const tempChar: Character = {
                        ...character,
                        asiSelections: [
                          ...(character.asiSelections || []),
                          { type: "feat", featName: "Eldritch Adept", level: 1 },
                        ],
                      };
                      const eaChoice = warlockInvocationChoices(tempChar, activeBooks).find((c) => c.id === ELDRITCH_ADEPT_CHOICE_ID);
                      const options = eaChoice?.options ?? [];
                      return (
                        <View
                          style={{
                            gap: 6,
                            padding: 8,
                            backgroundColor: theme.surfaceHighlight,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                            Choose Eldritch Invocation (Eldritch Adept):
                          </Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {options.map((opt) => {
                              const isPicked = asiSelectedInvocation === opt.name;
                              return (
                                <TouchableOpacity
                                  key={opt.name}
                                  onPress={() => setAsiSelectedInvocation(isPicked ? null : opt.name)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={[
                                    styles.choiceChip,
                                    {
                                      backgroundColor: isPicked ? theme.accentGlow : theme.surfaceHighlight,
                                      borderColor: isPicked ? theme.accent : theme.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      color: isPicked ? theme.accent : theme.textSecondary,
                                      fontWeight: isPicked ? "700" : "500",
                                      fontSize: 12,
                                    }}
                                  >
                                    {opt.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {asiSelectedInvocation && (() => {
                            const selectedOpt = options.find((o) => o.name === asiSelectedInvocation);
                            if (!selectedOpt?.description) return null;
                            return (
                              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                                <Text style={{ color: theme.accent, fontWeight: "600" }}>{selectedOpt.name}: </Text>
                                {selectedOpt.description}
                              </Text>
                            );
                          })()}
                        </View>
                      );
                    })()}

                    <Button
                      title={asiSelectedFeat ? `Save Feat: ${asiSelectedFeat.name}` : "Select a Feat"}
                      variant="primary"
                      size="sm"
                      disabled={
                        !asiSelectedFeat ||
                        (getFeatAbilityBonusOptions(asiSelectedFeat.name, asiSelectedFeat).type === "choice" &&
                          !asiSelectedFeatAbility) ||
                        (asiSelectedFeat.name.toLowerCase() === "fighting initiate" && !asiSelectedFightingStyle) ||
                        (asiSelectedFeat.name.toLowerCase() === "martial adept" && asiSelectedManeuvers.length < 2) ||
                        (asiSelectedFeat.name.toLowerCase() === "eldritch adept" && !asiSelectedInvocation)
                      }
                      onPress={() => handleSaveAsi(slot.className, slot.classLevel)}
                    />
                  </View>
                )}
              </View>
            )}
          </Card>
        );
      })}

      {/* Selected ASI / Feat choices */}
      {existingAsis.length > 0 && (
        <Card style={{ gap: 10 }}>
          <Text style={[styles.heading, { color: theme.text }]}>Selected Ability Improvements & Feats:</Text>
          {existingAsis.map((sel, idx) => {
            const clsName = sel.className || primaryClass || "Class";
            const lvl = sel.classLevel ?? sel.level;
            const slotKey = `${clsName}_${lvl}`;
            const isAsi = sel.type === "asi";
            const featAbilityStr = sel.featAbility
              ? ` • +1 ${sel.featAbility.toUpperCase()}`
              : sel.asi && Object.keys(sel.asi).length > 0
              ? ` • +1 ${Object.keys(sel.asi)[0].toUpperCase()}`
              : "";
            const summary = isAsi
              ? Object.entries(sel.asi || {})
                  .map(([k, v]) => `${k.toUpperCase()} +${v}`)
                  .join(", ")
              : `Feat: ${sel.featName} (${sel.featSource || "PHB"})${featAbilityStr}`;

            return (
              <View
                key={`${slotKey}_${idx}`}
                style={[styles.featureRow, { borderColor: theme.border, flexDirection: "column", alignItems: "stretch", gap: 8 }]}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <View style={{ flexGrow: 1, flexShrink: 1, maxWidth: "100%" }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <Badge label={`${clsName} Lvl ${lvl}`} variant="accent" size="sm" />
                      <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13, flexShrink: 1, maxWidth: "100%" }}>
                        {isAsi ? "Ability Score Improvement" : sel.featName}
                      </Text>
                    </View>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{summary}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {!isAsi && (
                      <Button
                        title="Info"
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          const f = findHeldRecord(allFeats, sel.featName ? { name: sel.featName, source: sel.featSource } : undefined, activeBooks);
                          if (f) {
                            onViewDetail({ title: f.name, source: f.source, description: f.description });
                          }
                        }}
                      />
                    )}
                    <Button
                      title="Change"
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        onUpdate((current) => removeAsiSelection(current, clsName, lvl, currentCompendium(), activeBooks));
                        setActiveAsiSlot(slotKey);
                      }}
                    />
                    <Button
                      title="Remove"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        onUpdate((current) => removeAsiSelection(current, clsName, lvl, currentCompendium(), activeBooks));
                      }}
                    />
                  </View>
                </View>

                {sel.featName?.toLowerCase() === "fighting initiate" && (() => {
                  const fsChoice = fightingStyleRuleChoices(character, activeBooks).find((c) => c.id === FIGHTING_INITIATE_CHOICE_ID);
                  const currentPick = character.ruleChoices?.find((rc) => rc.id === FIGHTING_INITIATE_CHOICE_ID)?.picked?.[0];
                  if (!fsChoice) return null;
                  return (
                    <View style={{ marginTop: 4, gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        Fighting Style: {currentPick ? <Text style={{ color: theme.accent, fontWeight: "700" }}>{currentPick}</Text> : <Text style={{ color: theme.warning }}>(None selected)</Text>}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                        {fsChoice.options.map((opt) => {
                          const isSelected = currentPick === opt.name;
                          return (
                            <TouchableOpacity
                              key={opt.name}
                              onPress={() => onUpdate((cur) => pickRuleChoice(cur, fsChoice, opt.name, currentCompendium(), activeBooks))}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={[
                                styles.choiceChip,
                                {
                                  backgroundColor: isSelected ? theme.accentGlow : theme.surfaceHighlight,
                                  borderColor: isSelected ? theme.accent : theme.border,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: isSelected ? theme.accent : theme.textSecondary,
                                  fontSize: 11,
                                  fontWeight: isSelected ? "700" : "500",
                                }}
                              >
                                {opt.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {currentPick && (() => {
                        const opt = fsChoice.options.find((o) => o.name === currentPick);
                        if (!opt?.description) return null;
                        return (
                          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                            <Text style={{ color: theme.accent, fontWeight: "600" }}>{opt.name}: </Text>
                            {opt.description}
                          </Text>
                        );
                      })()}
                    </View>
                  );
                })()}

                {!isAsi && sel.featName && (
                  <GrantedSpellPicks
                    character={character}
                    choices={featSpellChoicesOf(character, { name: sel.featName, source: sel.featSource || "PHB" }, currentCompendium(), activeBooks)}
                    onUpdate={onUpdate}
                    activeBooks={activeBooks}
                    theme={theme}
                  />
                )}

                {sel.featName?.toLowerCase() === "martial adept" && (() => {
                  const maChoice = battleMasterManeuverChoices(character, activeBooks).find((c) => c.id === MARTIAL_ADEPT_CHOICE_ID);
                  const currentPicks = character.ruleChoices?.find((rc) => rc.id === MARTIAL_ADEPT_CHOICE_ID)?.picked || [];
                  if (!maChoice) return null;
                  return (
                    <View style={{ marginTop: 4, gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        Maneuvers: {currentPicks.length > 0 ? (
                          <Text style={{ color: theme.accent, fontWeight: "700" }}>{currentPicks.join(", ")}</Text>
                        ) : (
                          <Text style={{ color: theme.warning }}>(None selected - choose 2)</Text>
                        )}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                        {maChoice.options.map((opt) => {
                          const isSelected = currentPicks.includes(opt.name);
                          return (
                            <TouchableOpacity
                              key={opt.name}
                              onPress={() => onUpdate((cur) => pickRuleChoice(cur, maChoice, opt.name, currentCompendium(), activeBooks))}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={[
                                styles.choiceChip,
                                {
                                  backgroundColor: isSelected ? theme.accentGlow : theme.surfaceHighlight,
                                  borderColor: isSelected ? theme.accent : theme.border,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: isSelected ? theme.accent : theme.textSecondary,
                                  fontSize: 11,
                                  fontWeight: isSelected ? "700" : "500",
                                }}
                              >
                                {opt.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {currentPicks.length > 0 && (
                        <View style={{ gap: 2, marginTop: 2 }}>
                          {currentPicks.map((mName) => {
                            const opt = maChoice.options.find((o) => o.name === mName);
                            if (!opt?.description) return null;
                            return (
                              <Text key={mName} style={{ color: theme.textMuted, fontSize: 11 }}>
                                <Text style={{ color: theme.accent, fontWeight: "600" }}>{opt.name}: </Text>
                                {opt.description}
                              </Text>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })()}

                {sel.featName?.toLowerCase() === "eldritch adept" && (() => {
                  const eaChoice = warlockInvocationChoices(character, activeBooks).find((c) => c.id === ELDRITCH_ADEPT_CHOICE_ID);
                  const currentPick = character.ruleChoices?.find((rc) => rc.id === ELDRITCH_ADEPT_CHOICE_ID)?.picked?.[0];
                  if (!eaChoice) return null;
                  return (
                    <View style={{ marginTop: 4, gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        Invocation: {currentPick ? <Text style={{ color: theme.accent, fontWeight: "700" }}>{currentPick}</Text> : <Text style={{ color: theme.warning }}>(None selected)</Text>}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                        {eaChoice.options.map((opt) => {
                          const isSelected = currentPick === opt.name;
                          return (
                            <TouchableOpacity
                              key={opt.name}
                              onPress={() => onUpdate((cur) => pickRuleChoice(cur, eaChoice, opt.name, currentCompendium(), activeBooks))}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={[
                                styles.choiceChip,
                                {
                                  backgroundColor: isSelected ? theme.accentGlow : theme.surfaceHighlight,
                                  borderColor: isSelected ? theme.accent : theme.border,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: isSelected ? theme.accent : theme.textSecondary,
                                  fontSize: 11,
                                  fontWeight: isSelected ? "700" : "500",
                                }}
                              >
                                {opt.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {currentPick && (() => {
                        const opt = eaChoice.options.find((o) => o.name === currentPick);
                        if (!opt?.description) return null;
                        return (
                          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                            <Text style={{ color: theme.accent, fontWeight: "600" }}>{opt.name}: </Text>
                            {opt.description}
                          </Text>
                        );
                      })()}
                    </View>
                  );
                })()}
              </View>
            );
          })}
        </Card>
      )}
    </>
  );
};
