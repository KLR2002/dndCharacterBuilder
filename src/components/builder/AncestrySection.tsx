import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey, Character } from "../../types/character";
import type { BackgroundData, RaceData } from "../../types/dnd5e";
import { type AvailableRuleChoice } from "../../rules/ruleChoices";
import { reconcileCharacter, setChoiceRacialBonus } from "../../rules/builderTransitions";
import {
  resolveAncestryState,
  applyAncestrySelection,
  applyAncestryChoice,
  setRacialCantrip,
  collectFixedBonuses,
} from "../../rules/ancestryEngine";
import { ALL_LANGUAGE_NAMES, ToolGrant } from "../../rules/proficienciesAndLanguages";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { SearchBar } from "../ui/SearchBar";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles, RuleChoicePicker, SkillPicker } from "./builderStyles";
import { normalizeSkillName } from "../../rules/skills";
import { useCharacters } from "../../context/CharacterContext";
import { getFeats, getSpells } from "../../services/dataService";
import { validateFeatPrerequisites, applyOriginFeat, removeOriginFeat } from "../../rules/feats";
import { getFeatAbilityBonusOptions } from "../../rules/leveling";
import { isSpellAvailableForClass } from "../../rules/spellcasting";

function formatRaceASI(abilityScoreIncrease: Record<string, number>[]): string {
  const totals: Record<string, number> = {};
  for (const item of abilityScoreIncrease || []) {
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") totals[k] = (totals[k] || 0) + v;
    }
  }
  return Object.entries(totals)
    .map(([k, v]) => `${k.toUpperCase()} +${v}`)
    .join(", ");
}

export interface AncestrySectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  allRaces: RaceData[];
  allBackgrounds: BackgroundData[];
  skillChoices: { source: string; choose: number; from: string[] }[];
  autoGranted: string[];
  toggleSkill: (skill: string, source?: string) => void;
  raceLanguageGrant: { label: string; fixed: string[]; choiceCount: number };
  toggleRaceLanguage: (lang: string) => void;
  raceToolGrant: ToolGrant;
  toggleRaceTool: (tool: string) => void;
  ruleChoices?: AvailableRuleChoice[];
  onViewDetail: (item: { title: string; subtitle?: string; source?: string; description?: string }) => void;
  theme: any;
}

export const AncestrySection: React.FC<AncestrySectionProps> = ({
  character,
  onUpdate,
  allRaces,
  allBackgrounds,
  skillChoices,
  autoGranted,
  toggleSkill,
  raceLanguageGrant,
  toggleRaceLanguage,
  raceToolGrant,
  toggleRaceTool,
  onViewDetail,
  theme,
}) => {
  const [raceSearch, setRaceSearch] = useState("");
  const choiceASI: Partial<Record<AbilityKey, number>> = useMemo(() => {
    const map: Partial<Record<AbilityKey, number>> = {};
    for (const b of character.racialChoiceBonus || []) {
      map[b.key] = b.amount;
    }
    return map;
  }, [character.racialChoiceBonus]);

  const detectedMode = useMemo<"2_1" | "1_1_1" | null>(() => {
    const bonuses = character.racialChoiceBonus || [];
    if (bonuses.some((b) => b.amount === 2)) return "2_1";
    if (bonuses.length >= 2 && bonuses.every((b) => b.amount === 1)) return "1_1_1";
    if (bonuses.length === 3) return "1_1_1";
    return null;
  }, [character.racialChoiceBonus]);

  const [userSelectedMode, setUserSelectedMode] = useState<"2_1" | "1_1_1" | null>(null);
  const flexibleMode = userSelectedMode ?? detectedMode ?? "2_1";

  const [featModalVisible, setFeatModalVisible] = useState(false);
  const [featSearch, setFeatSearch] = useState("");
  const [cantripModalVisible, setCantripModalVisible] = useState(false);
  const [cantripSearch, setCantripSearch] = useState("");

  const { activeBooks, isIntegrated } = useCharacters();

  const availableLineages = useMemo(() => {
    if (!isIntegrated) return [];
    const list: ("None" | "Dhampir" | "Hexblood" | "Reborn" | "Custom Lineage")[] = ["None"];
    if (activeBooks.includes("VRGR")) {
      list.push("Dhampir", "Hexblood", "Reborn");
    }
    if (activeBooks.includes("TCE")) {
      list.push("Custom Lineage");
    }
    return list.length > 1 ? list : [];
  }, [isIntegrated, activeBooks]);

  const lineageHeading = useMemo(() => {
    const hasVRGR = activeBooks.includes("VRGR");
    const hasTCE = activeBooks.includes("TCE");
    if (hasVRGR && hasTCE) return "Lineage Replacement (VRGtR) & Custom Lineage (TCoE)";
    if (hasVRGR) return "Lineage Replacement (VRGtR)";
    return "Custom Lineage (TCoE)";
  }, [activeBooks]);
  const allFeats = useMemo(() => getFeats(activeBooks), [activeBooks]);
  const wizardCantrips = useMemo(() => {
    return getSpells(activeBooks).filter(
      (s) => s.level === 0 && isSpellAvailableForClass(s, "Wizard", activeBooks)
    );
  }, [activeBooks]);

  const ancestryState = useMemo(() => {
    return resolveAncestryState(character, {
      races: allRaces,
      backgrounds: allBackgrounds,
      activeBooks,
    });
  }, [character, allRaces, allBackgrounds, activeBooks]);

  const {
    isChoiceASIRace,
    isFlexibleMPMM,
    choiceASIConfig,
    hasOriginFeat,
    originFeatTitle,
    currentOriginFeat,
    hasRacialCantrip,
    racialCantripTitle,
    currentRacialCantrip,
  } = ancestryState;

  const handleChoiceASITap = (key: AbilityKey) => {
    const current = { ...choiceASI };

    if (isFlexibleMPMM) {
      if (flexibleMode === "2_1") {
        if (current[key] != null) {
          delete current[key];
        } else {
          const vals = Object.values(current);
          if (!vals.includes(2)) current[key] = 2;
          else if (!vals.includes(1)) current[key] = 1;
        }
      } else {
        if (current[key] != null) {
          delete current[key];
        } else if (Object.keys(current).length < 3) {
          current[key] = 1;
        }
      }
    } else {
      if (current[key] != null) {
        delete current[key];
      } else if (Object.keys(current).length < choiceASIConfig.count) {
        current[key] = choiceASIConfig.amount;
      }
    }

    const picks = Object.entries(current).map(([k, amount]) => ({
      key: k as AbilityKey,
      amount: amount as number,
    }));
    onUpdate((cur) => setChoiceRacialBonus(cur, picks));
  };

  const selectRace = (r: RaceData, subraceIdx?: number) => {
    const sr = subraceIdx !== undefined ? r.subraces?.[subraceIdx] : undefined;
    setUserSelectedMode(null);
    onUpdate((cur) =>
      applyAncestrySelection(cur, r, sr, { races: allRaces, backgrounds: allBackgrounds })
    );
  };

  return (
    <View style={styles.section}>
      {/* Selected race banner */}
      {character.race ? (
        <Card highlight style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: theme.text }]}>
              {character.race.name}
              {character.race.subraceName ? ` — ${character.race.subraceName}` : ""}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              Speed {ancestryState.speed} ft • Size {ancestryState.size}
              {ancestryState.darkvision > 0 ? ` • Darkvision ${ancestryState.darkvision} ft` : ""}
              {" • "}{character.race.source}
            </Text>
          </View>
          <Button
            title="Change"
            variant="outline"
            size="sm"
            onPress={() => {
              setUserSelectedMode(null);
              onUpdate((cur) => {
                const oldRaceChoices = (cur.skillChoices || []).filter((sc) => sc.origin === "race");
                const oldRacePicks = new Set(oldRaceChoices.flatMap((sc) => sc.picked.map(normalizeSkillName)));
                return reconcileCharacter({
                  ...cur,
                  race: null,
                  racialAbilityBonuses: {},
                  racialChoiceBonus: [],
                  ruleChoices: (cur.ruleChoices || []).filter((rc) => rc.origin !== "race"),
                  skillChoices: (cur.skillChoices || []).filter((sc) => sc.origin !== "race"),
                  chosenSkills: (cur.chosenSkills || []).filter((s) => !oldRacePicks.has(normalizeSkillName(s))),
                });
              });
            }}
          />
        </Card>
      ) : null}

      {/* Choice ASI picker */}
      {character.race && isChoiceASIRace && (
        <Card style={{ gap: 8, borderColor: theme.accent }}>
          {isFlexibleMPMM ? (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
                  {flexibleMode === "2_1"
                    ? `Choose +2 and +1 to abilities (${Object.keys(choiceASI).length}/2 chosen)`
                    : `Choose +1 to 3 abilities (${Object.keys(choiceASI).length}/3 chosen)`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginVertical: 2 }}>
                <TouchableOpacity
                  onPress={() => {
                    setUserSelectedMode("2_1");
                    onUpdate((cur) => setChoiceRacialBonus(cur, []));
                  }}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: flexibleMode === "2_1" ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: flexibleMode === "2_1" ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: flexibleMode === "2_1" ? theme.accent : theme.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    +2 / +1
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setUserSelectedMode("1_1_1");
                    onUpdate((cur) => setChoiceRacialBonus(cur, []));
                  }}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: flexibleMode === "1_1_1" ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: flexibleMode === "1_1_1" ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: flexibleMode === "1_1_1" ? theme.accent : theme.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    +1 / +1 / +1
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
              Choose +{choiceASIConfig.amount} to {choiceASIConfig.count} ability score
              {choiceASIConfig.count > 1 ? "s" : ""}
              {"  "}({Object.keys(choiceASI).length}/{choiceASIConfig.count} chosen)
            </Text>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ABILITY_KEYS.map((k) => {
              const chosenAmount = choiceASI[k];
              const chosen = chosenAmount != null;
              const canPick = isFlexibleMPMM
                ? flexibleMode === "2_1"
                  ? !chosen && (!Object.values(choiceASI).includes(2) || !Object.values(choiceASI).includes(1))
                  : !chosen && Object.keys(choiceASI).length < 3
                : !chosen && Object.keys(choiceASI).length < choiceASIConfig.count;

              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => (chosen || canPick ? handleChoiceASITap(k) : undefined)}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: chosen ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: chosen ? theme.accent : theme.border,
                      opacity: !chosen && !canPick ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: chosen ? theme.accent : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>
                    {ABILITY_LABELS[k]}
                    {chosen ? ` +${chosenAmount ?? choiceASIConfig.amount}` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      )}

      {/* Race skill choices */}
      {character.race &&
        skillChoices.filter((sc) => sc.source.startsWith("Race:") || sc.source.startsWith("Variant")).length > 0 && (
          <Card style={{ gap: 10 }}>
            {skillChoices
              .filter((sc) => sc.source.startsWith("Race:") || sc.source.startsWith("Variant"))
              .map((sc) => {
                const choiceEntry = character.skillChoices?.find((c) => c.id === sc.source);
                const normFrom = sc.from.map(normalizeSkillName);
                const normAuto = autoGranted.map(normalizeSkillName);
                const chosen = choiceEntry
                  ? choiceEntry.picked
                  : (character.chosenSkills || []).filter(
                      (s) => normFrom.includes(normalizeSkillName(s)) && !normAuto.includes(normalizeSkillName(s))
                    );
                return (
                  <SkillPicker
                    key={sc.source}
                    label={sc.source}
                    choose={sc.choose}
                    from={sc.from}
                    chosen={chosen}
                    autoGranted={autoGranted}
                    onToggle={(skill) => toggleSkill(skill, sc.source)}
                    theme={theme}
                  />
                );
              })}
          </Card>
        )}

      {/* Ancestry Rule Choices: one pick from a fixed set, gated by level */}
      {(character.race || character.lineageReplacement) && ancestryState.availableRuleChoices.length > 0 && (
        <Card style={{ gap: 10 }}>
          {ancestryState.availableRuleChoices.map((choice) => {
            const entry = (character.ruleChoices ?? []).find((rc) => rc.id === choice.id);
            return (
              <RuleChoicePicker
                key={choice.id}
                label={choice.traitName}
                choose={choice.choose}
                from={choice.options.map((o) => o.name)}
                chosen={entry?.picked ?? []}
                onToggle={(option) =>
                  onUpdate((cur) =>
                    applyAncestryChoice(cur, choice.id, option, {
                      races: allRaces,
                      backgrounds: allBackgrounds,
                      activeBooks,
                    })
                  )
                }
                theme={theme}
              />
            );
          })}
        </Card>
      )}

      {/* Race language choices and granted languages */}
      {character.race && (raceLanguageGrant.fixed.length > 0 || raceLanguageGrant.choiceCount > 0) && (
        <Card style={{ gap: 10 }}>
          {raceLanguageGrant.fixed.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>Granted Languages:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {raceLanguageGrant.fixed.map((lang) => (
                  <Badge key={lang} label={lang} variant="accent" size="sm" />
                ))}
              </View>
            </View>
          )}
          {raceLanguageGrant.choiceCount > 0 && (
            <RuleChoicePicker
              label={raceLanguageGrant.label}
              choose={raceLanguageGrant.choiceCount}
              from={ALL_LANGUAGE_NAMES}
              chosen={character.chosenLanguages?.race || []}
              autoGranted={raceLanguageGrant.fixed}
              onToggle={toggleRaceLanguage}
              theme={theme}
            />
          )}
        </Card>
      )}

      {/* Race tool choices and granted tools */}
      {character.race && (raceToolGrant.fixed.length > 0 || raceToolGrant.choices.length > 0) && (
        <Card style={{ gap: 10 }}>
          {raceToolGrant.fixed.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                Granted Tool Proficiencies:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {raceToolGrant.fixed.map((tool) => (
                  <Badge key={tool} label={tool} variant="surface" size="sm" />
                ))}
              </View>
            </View>
          )}
          {raceToolGrant.choices.map((ch) => (
            <RuleChoicePicker
              key={ch.key}
              label={ch.label}
              choose={ch.count}
              from={ch.options}
              chosen={character.chosenTools?.race || []}
              autoGranted={raceToolGrant.fixed}
              onToggle={toggleRaceTool}
              theme={theme}
            />
          ))}
        </Card>
      )}

      {/* Origin Feat for Variant Human and Custom Lineage */}
      {character.race && hasOriginFeat && (
        <Card style={{ gap: 10, borderColor: theme.accent }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heading, { color: theme.accent }]}>
                {originFeatTitle}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                1st-level bonus origin feat from your ancestry
              </Text>
            </View>
            {currentOriginFeat && (
              <Button
                title="Change"
                variant="outline"
                size="sm"
                onPress={() => setFeatModalVisible(true)}
              />
            )}
          </View>

          {currentOriginFeat ? (
            <View style={{ gap: 8 }}>
              <View style={[styles.featureRow, { borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>
                    {currentOriginFeat.featName}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                    Source: {currentOriginFeat.featSource || "PHB"}
                  </Text>
                </View>
                <Button
                  title="Remove"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    if (currentOriginFeat.featName) {
                      onUpdate((cur) => removeOriginFeat(cur, currentOriginFeat.featName!));
                    }
                  }}
                />
              </View>

              {(() => {
                const bonusOptions = getFeatAbilityBonusOptions(currentOriginFeat.featName || "");
                if (bonusOptions.abilities.length <= 1) return null;
                return (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "600" }}>
                      Choose +{bonusOptions.amount} Ability Score Increase:
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {bonusOptions.abilities.map((ab) => {
                        const isSelected = currentOriginFeat.featAbility === ab;
                        return (
                          <TouchableOpacity
                            key={ab}
                            onPress={() => {
                              onUpdate((cur) =>
                                applyOriginFeat(
                                  cur,
                                  { ...currentOriginFeat, featAbility: ab },
                                  currentOriginFeat.featName
                                )
                              );
                            }}
                            style={[
                              styles.choiceChip,
                              {
                                backgroundColor: isSelected ? theme.accent : theme.surfaceHighlight,
                                borderColor: isSelected ? theme.accent : theme.border,
                              },
                            ]}>
                            <Text
                              style={{
                                color: isSelected ? "#fff" : theme.text,
                                fontSize: 12,
                                fontWeight: isSelected ? "700" : "500",
                              }}>
                              +{bonusOptions.amount} {ab.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
            </View>
          ) : (
            <Button
              title="Select Origin Feat"
              icon="add-circle-outline"
              variant="primary"
              size="sm"
              onPress={() => setFeatModalVisible(true)}
            />
          )}
        </Card>
      )}

      {/* High Elf / Half-Elf Descent Wizard Cantrip Choice */}
      {character.race && hasRacialCantrip && (
        <Card style={{ gap: 10, borderColor: theme.accent }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heading, { color: theme.accent }]}>
                {racialCantripTitle}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                You know one cantrip of your choice from the wizard spell list (INT)
              </Text>
            </View>
            {currentRacialCantrip && (
              <Button
                title="Change"
                variant="outline"
                size="sm"
                onPress={() => setCantripModalVisible(true)}
              />
            )}
          </View>

          {currentRacialCantrip ? (
            <View style={[styles.featureRow, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>
                  {currentRacialCantrip}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  Wizard Cantrip • Uses Intelligence
                </Text>
              </View>
            </View>
          ) : (
            <Button
              title="Choose Wizard Cantrip"
              icon="sparkles-outline"
              variant="primary"
              size="sm"
              onPress={() => setCantripModalVisible(true)}
            />
          )}
        </Card>
      )}

      {/* Race / Lineage Traits */}
      {character.race && ancestryState.traits.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Text style={[styles.heading, { color: character.lineageReplacement ? theme.accent : theme.text }]}>
            {character.lineageReplacement ? `${character.lineageReplacement} Features (Lineage):` : `${character.race.name} Traits:`}
          </Text>
          {ancestryState.traits.map((t) => (
            <TouchableOpacity
              key={t.name}
              onPress={() => onViewDetail({ title: t.name, description: t.description, source: t.source })}
              style={[styles.featureRow, { borderColor: theme.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>{t.name}</Text>
                {t.description ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={2}>
                    {t.description}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {/* Lineage replacement toggle */}
      {availableLineages.length > 0 && (
        <Card style={{ gap: 10 }}>
          <Text style={[styles.heading, { color: theme.text }]}>{lineageHeading}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {availableLineages.map((opt) => {
              const active =
                opt === "None"
                  ? !character.lineageReplacement && !character.customLineage
                  : opt === "Custom Lineage"
                  ? character.customLineage
                  : character.lineageReplacement === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    if (opt === "None") {
                      onUpdate({ lineageReplacement: null, customLineage: false });
                    } else if (opt === "Custom Lineage") {
                      onUpdate({
                        customLineage: true,
                        lineageReplacement: null,
                        race: { name: "Custom Lineage", source: "TCE" },
                      });
                    } else {
                      onUpdate({ lineageReplacement: opt, customLineage: false });
                    }
                  }}
                  style={[
                    styles.lineageChip,
                    {
                      backgroundColor: active ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.accent : theme.textSecondary, fontSize: 13, fontWeight: "600" }}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      )}

      {/* Race search + list (when no race selected) */}
      {!character.race && (
        <>
          <SearchBar value={raceSearch} onChangeText={setRaceSearch} placeholder="Search races…" />
          <View style={{ gap: 10 }}>
            {allRaces
              .filter((r) => r.name.toLowerCase().includes(raceSearch.toLowerCase()))
              .map((r) => {
                const combinedFixed = r.subraces.length === 1
                  ? collectFixedBonuses(r.abilityScoreIncrease, r.subraces[0].abilityScoreIncrease)
                  : collectFixedBonuses(r.abilityScoreIncrease);
                const asiStr = formatRaceASI(Object.entries(combinedFixed).map(([k, v]) => ({ [k]: v })));
                const isLineage = r.name === "Dhampir" || r.name === "Hexblood" || r.name === "Reborn";
                const isChoice = r.name === "Half-Elf" || r.name === "Custom Lineage";
                const singleSubrace =
                  r.subraces.length === 1 && r.subraces[0]?.name?.trim()
                    ? r.subraces[0]
                    : undefined;
                const displayTraits = singleSubrace
                  ? [...r.traits, ...(singleSubrace.traits || [])]
                  : r.traits;
                return (
                  <Card key={`${r.name}__${r.source}`}>
                    {/* Header */}
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>{r.name}</Text>
                          {singleSubrace?.name ? (
                            <Badge label={singleSubrace.name} variant="accent" size="sm" />
                          ) : null}
                          {isLineage ? <Badge label="Lineage" variant="warning" size="sm" /> : null}
                          {isChoice ? <Badge label="Choice ASI" variant="secondary" size="sm" /> : null}
                        </View>
                        {asiStr ? (
                          <Text style={{ color: theme.accent, fontSize: 12, marginTop: 1, fontWeight: "600" }}>
                            {asiStr}
                          </Text>
                        ) : isChoice ? (
                          <Text style={{ color: theme.accent, fontSize: 12, marginTop: 1, fontWeight: "600" }}>
                            {r.name === "Custom Lineage" ? "+2 any one ability" : "+1 to any two abilities"}
                          </Text>
                        ) : (
                          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }}>No fixed ASI</Text>
                        )}
                        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                          Speed {r.speed.walk} ft • {r.size.join("/")} • {r.source}
                        </Text>
                      </View>
                      <Button
                        title="Info"
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          const detailDesc = singleSubrace?.description
                            ? `${r.description}\n\n### Subrace: ${singleSubrace.name}\n\n${singleSubrace.description}`
                            : r.description;
                          onViewDetail({ title: r.name, source: r.source, description: detailDesc });
                        }}
                      />
                      {r.subraces.length <= 1 ? (
                        <Button
                          title="Select"
                          size="sm"
                          onPress={() => selectRace(r, singleSubrace ? 0 : undefined)}
                        />
                      ) : null}
                    </View>

                    {/* Subraces */}
                    {r.subraces.length > 1 ? (
                      <View style={styles.subracesBox}>
                        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Subraces / Variants:</Text>
                        {r.subraces.map((sr, idx) => {
                          const combined = collectFixedBonuses(r.abilityScoreIncrease, sr.abilityScoreIncrease);
                          const combinedStr = formatRaceASI(Object.entries(combined).map(([k, v]) => ({ [k]: v })));
                          const srIsChoice =
                            (!sr.name && !combinedStr) ||
                            sr.name === "Variant" ||
                            sr.name === "Custom Lineage" ||
                            r.name === "Half-Elf";
                          return (
                            <TouchableOpacity
                              key={`${sr.name || "base"}_${idx}`}
                              onPress={() => selectRace(r, idx)}
                              style={[
                                styles.subraceRow,
                                { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                                  {sr.name || (r.name === "Human" ? "Standard Human" : r.name)}
                                </Text>
                                {Boolean(combinedStr) && !srIsChoice ? (
                                  <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "600" }}>
                                    {combinedStr}
                                  </Text>
                                ) : srIsChoice ? (
                                  <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "600" }}>Choice ASI</Text>
                                ) : null}
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={theme.accent} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}

                    {/* Trait chips */}
                    {displayTraits.length > 0 ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {displayTraits.slice(0, 5).map((t) => (
                          <Badge key={t.name} label={t.name} variant="muted" size="sm" />
                        ))}
                        {displayTraits.length > 5 ? (
                          <Badge label={`+${displayTraits.length - 5} more`} variant="muted" size="sm" />
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
          </View>
        </>
      )}

      {/* Origin Feat Picker Modal */}
      <Modal
        visible={featModalVisible}
        onClose={() => setFeatModalVisible(false)}
        title="Choose Origin Feat"
        subtitle="Select a 1st-level origin feat from your sourcebooks"
        maxHeightPercent={90}>
        <SearchBar
          value={featSearch}
          onChangeText={setFeatSearch}
          placeholder="Search feats..."
        />
        <ScrollView style={{ marginTop: 10, maxHeight: 450 }}>
          <View style={{ gap: 8 }}>
            {allFeats
              .filter((f) => f.name.toLowerCase().includes(featSearch.toLowerCase()))
              .map((f) => {
                const prereqCheck = validateFeatPrerequisites(character, f);
                const bonusOptions = getFeatAbilityBonusOptions(f.name);
                const isSelected = currentOriginFeat?.featName?.toLowerCase() === f.name.toLowerCase();

                return (
                  <TouchableOpacity
                    key={`${f.name}__${f.source}`}
                    activeOpacity={0.7}
                    onPress={() => {
                      const initialAbility =
                        bonusOptions.abilities.length === 1 ? bonusOptions.abilities[0] : undefined;
                      onUpdate((cur) =>
                        applyOriginFeat(
                          cur,
                          {
                            level: 1,
                            type: "feat",
                            featName: f.name,
                            featSource: f.source,
                            featAbility: initialAbility,
                          },
                          currentOriginFeat?.featName
                        )
                      );
                      setFeatModalVisible(false);
                    }}
                    style={[
                      styles.featureRow,
                      {
                        borderColor: isSelected ? theme.accent : theme.border,
                        backgroundColor: isSelected ? theme.surfaceHighlight : theme.surface,
                        padding: 10,
                        borderRadius: 8,
                      },
                    ]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }}>{f.name}</Text>
                        <Badge label={f.source} variant="surface" size="sm" />
                        {!prereqCheck.met && (
                          <Badge label={`⚠️ ${prereqCheck.reason}`} variant="danger" size="sm" />
                        )}
                      </View>
                      {bonusOptions.abilities.length > 0 && (
                        <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "600" }}>
                          Half-Feat (+1 to {bonusOptions.abilities.map((a) => a.toUpperCase()).join("/")})
                        </Text>
                      )}
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={2}>
                        {f.description.replace(/\*\*/g, "").slice(0, 140)}...
                      </Text>
                    </View>
                    <Button
                      title={isSelected ? "Selected" : "Select"}
                      variant={isSelected ? "secondary" : "primary"}
                      size="sm"
                      disabled={isSelected}
                      onPress={() => {
                        const initialAbility =
                          bonusOptions.abilities.length === 1 ? bonusOptions.abilities[0] : undefined;
                        onUpdate((cur) =>
                          applyOriginFeat(
                            cur,
                            {
                              level: 1,
                              type: "feat",
                              featName: f.name,
                              featSource: f.source,
                              featAbility: initialAbility,
                            },
                            currentOriginFeat?.featName
                          )
                        );
                        setFeatModalVisible(false);
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
          </View>
        </ScrollView>
      </Modal>

      {/* Racial Wizard Cantrip Modal */}
      <Modal
        visible={cantripModalVisible}
        onClose={() => setCantripModalVisible(false)}
        title="Choose Wizard Cantrip"
        subtitle={racialCantripTitle || "Racial Trait (Uses Intelligence)"}
        maxHeightPercent={90}>
        <SearchBar
          value={cantripSearch}
          onChangeText={setCantripSearch}
          placeholder="Search wizard cantrips..."
        />
        <ScrollView style={{ marginTop: 10, maxHeight: 450 }}>
          <View style={{ gap: 8 }}>
            {wizardCantrips
              .filter((s) => s.name.toLowerCase().includes(cantripSearch.toLowerCase()))
              .map((s) => {
                const isSelected = currentRacialCantrip?.toLowerCase() === s.name.toLowerCase();

                return (
                  <TouchableOpacity
                    key={`${s.name}__${s.source}`}
                    activeOpacity={0.7}
                    onPress={() => {
                      onUpdate((cur) => setRacialCantrip(cur, s.name));
                      setCantripModalVisible(false);
                    }}
                    style={[
                      styles.featureRow,
                      {
                        borderColor: isSelected ? theme.accent : theme.border,
                        backgroundColor: isSelected ? theme.surfaceHighlight : theme.surface,
                        padding: 10,
                        borderRadius: 8,
                      },
                    ]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }}>{s.name}</Text>
                        <Badge label={s.school || "Evocation"} variant="surface" size="sm" />
                      </View>
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={2}>
                        {s.description?.slice(0, 120)}...
                      </Text>
                    </View>
                    <Button
                      title={isSelected ? "Selected" : "Select"}
                      variant={isSelected ? "secondary" : "primary"}
                      size="sm"
                      disabled={isSelected}
                      onPress={() => {
                        onUpdate((cur) => setRacialCantrip(cur, s.name));
                        setCantripModalVisible(false);
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
};
