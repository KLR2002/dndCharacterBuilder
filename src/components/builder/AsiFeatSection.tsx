import type { ActiveBooks } from "../../constants/books";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AbilityKey, Character } from "../../types/character";
import { FeatData } from "../../types/dnd5e";
import { removeAsiSelection } from "../../rules/leveling";
import { applyFeatSlotPick, featSlotView, findFeat, takenFeatRuleChoices, type FeatSlotPick } from "../../rules/featSlot";
import type { AvailableRuleChoice } from "../../rules/choices/types";
import { applyAsiWithHitPoints } from "../../rules/builderTransitions";
import { findHeldRecord } from "../../rules/raceLookup";
import { featSpellChoicesOf, pickedOptionNames, pickRuleChoice } from "../../rules/ruleChoices";
import { currentCompendium } from "../../services/compendium";
import { GrantedSpellPicks } from "./GrantedSpellPicks";
import { FeatPicker } from "../feats/FeatPicker";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles, RuleChoicePicker } from "./builderStyles";

/** The feat pick before a feat is chosen: its slot is set when the feat is. */
const NO_FEAT_PICK: FeatSlotPick = { slot: { kind: "asi", className: "", classLevel: 0 }, featName: null };

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
  const [featPick, setFeatPick] = useState<FeatSlotPick | null>(null);

  const existingAsis = character.asiSelections || [];

  const toggleSubChoice = (choice: AvailableRuleChoice, option: string) => {
    setFeatPick((prev) => {
      if (!prev) return prev;
      const picked = prev.subChoicePicks?.[choice.id] ?? [];
      const isPicked = picked.some((p) => p.toLowerCase() === option.toLowerCase());
      let next: string[];
      if (isPicked) next = picked.filter((p) => p.toLowerCase() !== option.toLowerCase());
      else if (picked.length < choice.choose) next = [...picked, option];
      else if (choice.choose === 1) next = [option];
      else return prev;
      return { ...prev, subChoicePicks: { ...prev.subChoicePicks, [choice.id]: next } };
    });
  };

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
      if (!featPick?.featName) return;
      const pick: FeatSlotPick = { ...featPick, slot: { kind: "asi", className, classLevel } };
      if (!featSlotView(character, pick, { activeBooks }).complete) return;
      onUpdate((current) =>
        applyFeatSlotPick(current, pick, { compendium: currentCompendium(), activeBooks, fullHealOnLevelUp })
      );
      setFeatPick(null);
    }
    setActiveAsiSlot(null);
  };

  if (pendingAsiSlots.length === 0 && existingAsis.length === 0) return null;

  const featView = featSlotView(character, featPick ?? NO_FEAT_PICK, { activeBooks });

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
                        borderColor: asiTab === "asi" ? theme.accentHover : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        {
                          color: asiTab === "asi" ? theme.accentHover : theme.textSecondary,
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
                        borderColor: asiTab === "feat" ? theme.accentHover : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        {
                          color: asiTab === "feat" ? theme.accentHover : theme.textSecondary,
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
                            borderColor: asiMode === "plus2" ? theme.accentHover : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: asiMode === "plus2" ? theme.accentHover : theme.textSecondary,
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
                            borderColor: asiMode === "plus1plus1" ? theme.accentHover : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: asiMode === "plus1plus1" ? theme.accentHover : theme.textSecondary,
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
                                    borderColor: selected ? theme.accentHover : theme.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: selected ? theme.accentHover : theme.textSecondary,
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
                                    borderColor: selected ? theme.accentHover : theme.border,
                                    opacity: !selected && !canPick ? 0.4 : 1,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: selected ? theme.accentHover : theme.textSecondary,
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
                    <FeatPicker
                      offered={featView.offered}
                      selectedFeatName={featView.picked?.name ?? null}
                      increase={featView.increase}
                      featAbility={
                        featView.increase.type === "fixed" ? featView.increase.abilities[0] : (featPick?.featAbility ?? null)
                      }
                      subChoices={featView.subChoices}
                      subChoicePicks={featPick?.subChoicePicks ?? {}}
                      onSelectFeat={(feat) =>
                        setFeatPick({
                          slot: { kind: "asi", className: slot.className, classLevel: slot.classLevel },
                          featName: feat.name,
                          featSource: feat.source,
                        })
                      }
                      onSelectAbility={(ability) => setFeatPick((prev) => (prev ? { ...prev, featAbility: ability } : prev))}
                      onToggleSubChoice={toggleSubChoice}
                      onViewDetail={(feat) =>
                        onViewDetail({
                          title: feat.name,
                          source: feat.source,
                          description: feat.description,
                          tags: feat.prerequisite ? [`Prereq: ${feat.prerequisite}`] : [],
                        })
                      }
                    />
                    <Button
                      title={featView.picked ? `Save Feat: ${featView.picked.name}` : "Select a Feat"}
                      variant="primary"
                      size="sm"
                      disabled={!featView.complete}
                      onPress={() => handleSaveAsi(slot.className, slot.classLevel)}
                    />
                  </View>
                )}
              </View>
            )}
          </Card>
        );
      })}

      {/* Saved ASI and feat picks */}
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
            const savedFeatSource = isAsi
              ? undefined
              : findFeat(sel.featName ?? "", sel.featSource, currentCompendium(), activeBooks)?.source ?? sel.featSource;
            const summary = isAsi
              ? Object.entries(sel.asi || {})
                  .map(([k, v]) => `${k.toUpperCase()} +${v}`)
                  .join(", ")
              : `Feat: ${sel.featName}${savedFeatSource ? ` (${savedFeatSource})` : ""}${featAbilityStr}`;

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

                {!isAsi &&
                  takenFeatRuleChoices(character, sel, activeBooks, currentCompendium()).map((choice) => {
                    const saved = character.ruleChoices?.find((rc) => rc.id === choice.id)?.picked ?? [];
                    const chosen = pickedOptionNames(
                      saved,
                      choice.options.map((o) => o.name)
                    );
                    return (
                      <View key={choice.id} style={{ marginTop: 4, gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
                        <RuleChoicePicker
                          label={choice.traitName}
                          choose={choice.choose}
                          from={choice.options.map((o) => o.name)}
                          chosen={chosen}
                          onToggle={(option) =>
                            onUpdate((cur) => pickRuleChoice(cur, choice, option, currentCompendium(), activeBooks))
                          }
                          theme={theme}
                        />
                        {chosen.map((cName) => {
                          const opt = choice.options.find((o) => o.name === cName);
                          if (!opt?.description) return null;
                          return (
                            <Text key={cName} style={{ color: theme.textMuted, fontSize: 11 }}>
                              <Text style={{ color: theme.accentHover, fontWeight: "600" }}>{opt.name}: </Text>
                              {opt.description}
                            </Text>
                          );
                        })}
                      </View>
                    );
                  })}

                {!isAsi && sel.featName && (
                  <GrantedSpellPicks
                    character={character}
                    choices={featSpellChoicesOf(
                      character,
                      { name: sel.featName, source: findFeat(sel.featName, sel.featSource, currentCompendium(), activeBooks)?.source ?? sel.featSource ?? "" },
                      currentCompendium(),
                      activeBooks
                    )}
                    onUpdate={onUpdate}
                    activeBooks={activeBooks}
                    theme={theme}
                  />
                )}
              </View>
            );
          })}
        </Card>
      )}
    </>
  );
};
