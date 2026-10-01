import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey, Character } from "../../types/character";
import { FeatData } from "../../types/dnd5e";
import { applyAsiSelection, getFeatAbilityBonusOptions, removeAsiSelection } from "../../rules/leveling";
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
}

export const AsiFeatSection: React.FC<AsiFeatSectionProps> = ({
  character,
  onUpdate,
  pendingAsiSlots,
  allFeats,
  primaryClass,
  onViewDetail,
  theme,
}) => {
  const [activeAsiSlot, setActiveAsiSlot] = useState<string | null>(null);
  const [asiTab, setAsiTab] = useState<"asi" | "feat">("asi");
  const [asiMode, setAsiMode] = useState<"plus2" | "plus1plus1">("plus2");
  const [asiPlus2Pick, setAsiPlus2Pick] = useState<AbilityKey | null>(null);
  const [asiPlus1Picks, setAsiPlus1Picks] = useState<AbilityKey[]>([]);
  const [asiSelectedFeat, setAsiSelectedFeat] = useState<FeatData | null>(null);
  const [asiSelectedFeatAbility, setAsiSelectedFeatAbility] = useState<AbilityKey | null>(null);
  const [asiFeatSearch, setAsiFeatSearch] = useState("");

  const existingAsis = character.asiSelections || [];

  const handleSaveAsi = (className: string, classLevel: number) => {
    if (asiTab === "asi") {
      if (asiMode === "plus2") {
        if (!asiPlus2Pick) return;
        onUpdate((current) =>
          applyAsiSelection(current, {
            className,
            classLevel,
            level: classLevel,
            type: "asi",
            asi: { [asiPlus2Pick]: 2 },
          })
        );
        setAsiPlus2Pick(null);
      } else {
        if (asiPlus1Picks.length !== 2) return;
        onUpdate((current) =>
          applyAsiSelection(current, {
            className,
            classLevel,
            level: classLevel,
            type: "asi",
            asi: { [asiPlus1Picks[0]]: 1, [asiPlus1Picks[1]]: 1 },
          })
        );
        setAsiPlus1Picks([]);
      }
    } else {
      if (!asiSelectedFeat) return;
      const opts = getFeatAbilityBonusOptions(asiSelectedFeat.name, asiSelectedFeat);
      if (opts.type === "choice" && !asiSelectedFeatAbility) return;
      const featAbility = opts.type === "fixed" ? opts.abilities[0] : asiSelectedFeatAbility || undefined;
      onUpdate((current) =>
        applyAsiSelection(current, {
          className,
          classLevel,
          level: classLevel,
          type: "feat",
          featName: asiSelectedFeat.name,
          featSource: asiSelectedFeat.source,
          featAbility,
          asi: featAbility ? { [featAbility]: 1 } : undefined,
        })
      );
      setAsiSelectedFeat(null);
      setAsiSelectedFeatAbility(null);
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
                          return (
                            <TouchableOpacity
                              key={`${f.name}_${f.source}`}
                              onPress={() => {
                                setAsiSelectedFeat(f);
                                const opts = getFeatAbilityBonusOptions(f.name, f);
                                setAsiSelectedFeatAbility(opts.type === "fixed" ? opts.abilities[0] : null);
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
                                <Text
                                  style={{
                                    color: isSelected ? theme.accent : theme.text,
                                    fontWeight: "700",
                                    fontSize: 13,
                                  }}
                                >
                                  {f.name}
                                </Text>
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
                                      style={[
                                        styles.optionChip,
                                        {
                                          backgroundColor: isPicked ? theme.accent : theme.surface,
                                          borderColor: isPicked ? theme.accent : theme.border,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={{
                                          color: isPicked ? "#fff" : theme.text,
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

                    <Button
                      title={asiSelectedFeat ? `Save Feat: ${asiSelectedFeat.name}` : "Select a Feat"}
                      variant="primary"
                      size="sm"
                      disabled={
                        !asiSelectedFeat ||
                        (getFeatAbilityBonusOptions(asiSelectedFeat.name, asiSelectedFeat).type === "choice" &&
                          !asiSelectedFeatAbility)
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
                style={[styles.featureRow, { borderColor: theme.border, justifyContent: "space-between" }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Badge label={`${clsName} Lvl ${lvl}`} variant="accent" size="sm" />
                    <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                      {isAsi ? "Ability Score Improvement" : sel.featName}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{summary}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  {!isAsi && (
                    <Button
                      title="Info"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        const f = allFeats.find((feat) => feat.name.toLowerCase() === sel.featName?.toLowerCase());
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
                      onUpdate((current) => removeAsiSelection(current, clsName, lvl));
                      setActiveAsiSlot(slotKey);
                    }}
                  />
                  <Button
                    title="Remove"
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      onUpdate((current) => removeAsiSelection(current, clsName, lvl));
                    }}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </>
  );
};
