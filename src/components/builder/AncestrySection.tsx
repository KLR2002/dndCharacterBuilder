import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey, Character } from "../../types/character";
import type { RaceData } from "../../types/dnd5e";
import { featSpellChoicesOf, raceSpellRuleChoices, type AvailableRuleChoice } from "../../rules/ruleChoices";
import { changeLineage, changeRace, setChoiceRacialBonus, setSizeChoice, toggleRacialPick, type LineageChoice } from "../../rules/builderTransitions";
import { increasePoolOf, type IncreaseChoiceOffer } from "../../rules/originCustomization";
import { currentCompendium, srdBaselineRaces } from "../../services/compendium";
import { findHeldRace } from "../../rules/raceLookup";
import {
  resolveAncestryState,
  applyAncestrySelection,
  applyAncestryChoice,
  offersPlainRaceForm,
} from "../../rules/ancestryEngine";
import { heldIncreaseChoices, increaseSummary } from "../../rules/ancestryIncreases";
import type { SourceFixedGrants } from "../../rules/proficiencySheet";
import { picksOnlyLanguages } from "../../rules/proficiencyChoiceOffers";
import { ProficiencyChoicePicker } from "./ProficiencyChoicePicker";
import { CustomizeOriginCard } from "./CustomizeOriginCard";
import { GrantedSpellPicks } from "./GrantedSpellPicks";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CollapsibleCard } from "../ui/CollapsibleCard";
import { Modal } from "../ui/Modal";
import { SearchBar } from "../ui/SearchBar";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles, RuleChoicePicker } from "./builderStyles";
import { useCharacters } from "../../context/CharacterContext";
import { getFeats } from "../../services/dataService";
import { validateFeatPrerequisites, applyOriginFeat, removeOriginFeat } from "../../rules/feats";
import { getFeatAbilityBonusOptions } from "../../rules/leveling";
import { BACKGROUND_FEAT_SOURCE } from "../../constants/rules";

export interface AncestrySectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  allRaces: RaceData[];
  /** The fixed languages and tools the race and subrace grant. */
  raceGranted: SourceFixedGrants;
  /** The race's Proficiency Choices: its tool and language picks. */
  proficiencyChoices: AvailableRuleChoice[];
  onViewDetail: (item: { title: string; subtitle?: string; source?: string; description?: string }) => void;
  theme: any;
  /**
   * The Creation Step this section is hosted on: "race" shows the race and its cards, "subrace" shows only the
   * subrace picker for the held race. Unset in the free-form builder, where everything renders at once.
   */
  step?: "race" | "subrace";
}

export const AncestrySection: React.FC<AncestrySectionProps> = ({
  character,
  onUpdate,
  allRaces,
  raceGranted,
  proficiencyChoices,
  onViewDetail,
  theme,
  step,
}) => {
  const [raceSearch, setRaceSearch] = useState("");
  const flexiblePicks = useMemo(
    () => (character.racialChoiceBonus || []).filter((b) => b.choiceId === undefined),
    [character.racialChoiceBonus],
  );

  const choiceASI: Partial<Record<AbilityKey, number>> = useMemo(() => {
    const map: Partial<Record<AbilityKey, number>> = {};
    for (const b of flexiblePicks) {
      map[b.key] = b.amount;
    }
    return map;
  }, [flexiblePicks]);

  const detectedMode = useMemo<"2_1" | "1_1_1" | null>(() => {
    const bonuses = flexiblePicks;
    if (bonuses.some((b) => b.amount === 2)) return "2_1";
    if (bonuses.length >= 2 && bonuses.every((b) => b.amount === 1)) return "1_1_1";
    if (bonuses.length === 3) return "1_1_1";
    return null;
  }, [flexiblePicks]);

  const [userSelectedMode, setUserSelectedMode] = useState<"2_1" | "1_1_1" | null>(null);
  const flexibleMode = userSelectedMode ?? detectedMode ?? "2_1";

  const [featModalVisible, setFeatModalVisible] = useState(false);
  const [featSearch, setFeatSearch] = useState("");

  const { activeBooks, isIntegrated } = useCharacters();

  const flexibleLimit = flexibleMode === "2_1" ? 2 : 3;
  const flexibleAmount = flexibleMode === "2_1" && !flexiblePicks.some((b) => b.amount === 2) ? 2 : 1;
  const flexiblePool = useMemo(
    () => increasePoolOf(character, { activeBooks }, undefined, flexibleAmount),
    [character, activeBooks, flexibleAmount],
  );

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
  const raceSpellChoices = useMemo(() => {
    return character.race ? raceSpellRuleChoices(character, currentCompendium(), activeBooks) : [];
  }, [character, activeBooks]);

  const ancestryState = useMemo(() => {
    return resolveAncestryState(character, { activeBooks });
  }, [character, activeBooks]);

  const {
    increaseChoices,
    hasFlexibleIncreases,
    hasOriginFeat,
    originFeatTitle,
    currentOriginFeat,
  } = ancestryState;

  const handleFlexibleTap = (key: AbilityKey) => {
    onUpdate((cur) => toggleRacialPick(cur, { key, amount: flexibleAmount }, { activeBooks }));
  };

  const handleChoiceTap = (choice: IncreaseChoiceOffer, key: AbilityKey) => {
    onUpdate((cur) => toggleRacialPick(cur, { choiceId: choice.id, key, amount: choice.amount }, { activeBooks }));
  };

  const selectRace = (r: RaceData, subraceIdx?: number) => {
    const sr = subraceIdx !== undefined ? r.subraces?.[subraceIdx] : undefined;
    setUserSelectedMode(null);
    onUpdate((cur) =>
      applyAncestrySelection(cur, r, sr, { activeBooks })
    );
  };

  const renderRaceFormRow = (
    key: string,
    label: string,
    summary: string,
    onPress: () => void
  ) => {
    return (
      <TouchableOpacity
        key={key}
        onPress={onPress}
        style={[
          styles.subraceRow,
          { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>{label}</Text>
          {summary ? (
            <Text style={{ color: theme.accentHover, fontSize: 11, fontWeight: "600" }}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.accentHover} />
      </TouchableOpacity>
    );
  };

  // The Subrace step of the Creation Flow shows only the subrace picker for the held race.
  if (step === "subrace") {
    const { race: heldRace } = findHeldRace(allRaces, character.race, activeBooks);
    const subraces = heldRace?.subraces ?? [];
    return (
      <View style={styles.section}>
        {character.race ? (
          <Card highlight style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>
                {character.race.name}
                {character.race.subraceName ? ` — ${character.race.subraceName}` : ""}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Size {ancestryState.size}
                {ancestryState.darkvision > 0 ? ` • Darkvision ${ancestryState.darkvision} ft` : ""}
                {" • "}{character.race.source}
              </Text>
            </View>
          </Card>
        ) : null}
        {heldRace && subraces.length > 1 && (
          <Card style={{ gap: 8 }}>
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>Subrace</Text>
            <View style={{ gap: 8 }}>
              {offersPlainRaceForm(heldRace, srdBaselineRaces()) ? (
                renderRaceFormRow("plain", heldRace.name, increaseSummary(heldRace), () => selectRace(heldRace))
              ) : null}
              {subraces.map((sr, idx) =>
                renderRaceFormRow(
                  `${sr.name || "base"}_${idx}`,
                  sr.name || (heldRace.name === "Human" ? "Standard Human" : heldRace.name),
                  increaseSummary(heldRace, sr),
                  () => selectRace(heldRace, idx),
                ),
              )}
            </View>
          </Card>
        )}
      </View>
    );
  }

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
              Size {ancestryState.size}
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
              onUpdate((cur) => changeRace(cur, currentCompendium(), activeBooks));
            }}
          />
        </Card>
      ) : null}

      {/* Size Choice: one of the sizes the held race or lineage lists */}
      {ancestryState.sizeOptions.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>Size</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ancestryState.sizeOptions.map((size) => {
              const selected = ancestryState.size === size;
              return (
                <TouchableOpacity
                  key={size}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onUpdate((cur) => setSizeChoice(cur, size, { activeBooks }))}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: selected ? theme.accentHover : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? theme.accentHover : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>
                    {size}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      )}

      {character.race && increaseChoices.map((choice) => (
        <Card key={choice.id} style={{ gap: 8, borderColor: theme.accentHover }}>
          <Text style={{ color: theme.accentHover, fontWeight: "700", fontSize: 13 }}>
            {`Choose +${choice.amount} to ${choice.count} ability score${choice.count > 1 ? "s" : ""} (${choice.picked.length}/${choice.count} chosen)`}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ABILITY_KEYS.filter((k) => choice.pool.includes(k) || choice.picked.includes(k)).map((k) => {
              const chosen = choice.picked.includes(k);
              const canPick = chosen || choice.picked.length < choice.count;

              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => (canPick ? handleChoiceTap(choice, k) : undefined)}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: chosen ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: chosen ? theme.accentHover : theme.border,
                      opacity: canPick ? 1 : 0.35,
                    },
                  ]}
                >
                  <Text style={{ color: chosen ? theme.accentHover : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>
                    {ABILITY_LABELS[k]}
                    {chosen ? ` +${choice.amount}` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      ))}

      {/* Flexible Increases picker */}
      {character.race && hasFlexibleIncreases && (
        <Card style={{ gap: 8, borderColor: theme.accentHover }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.accentHover, fontWeight: "700", fontSize: 13 }}>
              {flexibleMode === "2_1"
                ? `Choose +2 and +1 to abilities (${flexiblePicks.length}/2 chosen)`
                : `Choose +1 to 3 abilities (${flexiblePicks.length}/3 chosen)`}
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
                  borderColor: flexibleMode === "2_1" ? theme.accentHover : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: flexibleMode === "2_1" ? theme.accentHover : theme.textSecondary,
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
                  borderColor: flexibleMode === "1_1_1" ? theme.accentHover : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: flexibleMode === "1_1_1" ? theme.accentHover : theme.textSecondary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                +1 / +1 / +1
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ABILITY_KEYS.filter((k) => flexiblePool.includes(k) || choiceASI[k] != null).map((k) => {
              const chosenAmount = choiceASI[k];
              const chosen = chosenAmount != null;
              const canPick = chosen || (flexiblePicks.length < flexibleLimit && flexiblePool.includes(k));

              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => (canPick ? handleFlexibleTap(k) : undefined)}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: chosen ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: chosen ? theme.accentHover : theme.border,
                      opacity: canPick ? 1 : 0.35,
                    },
                  ]}
                >
                  <Text style={{ color: chosen ? theme.accentHover : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>
                    {ABILITY_LABELS[k]}
                    {chosen ? ` +${chosenAmount}` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      )}

      {character.race && <CustomizeOriginCard character={character} activeBooks={activeBooks} onUpdate={onUpdate} />}

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
                    applyAncestryChoice(cur, choice.id, option, { activeBooks })
                  )
                }
                theme={theme}
              />
            );
          })}
        </Card>
      )}

      {/* Race languages and tools: the fixed grants, then the Proficiency Choices the race offers */}
      {character.race && (raceGranted.languages.length > 0 || raceGranted.tools.length > 0 || proficiencyChoices.length > 0) && (
        <CollapsibleCard title={raceGranted.tools.length === 0 && picksOnlyLanguages(proficiencyChoices) ? "Languages" : "Languages & Proficiencies"}>
          {raceGranted.languages.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>Granted Languages:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {raceGranted.languages.map((lang) => (
                  <Badge key={lang} label={lang} variant="accent" size="sm" />
                ))}
              </View>
            </View>
          )}
          {raceGranted.tools.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                Granted Tool Proficiencies:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {raceGranted.tools.map((tool) => (
                  <Badge key={tool} label={tool} variant="surface" size="sm" />
                ))}
              </View>
            </View>
          )}
          {proficiencyChoices.map((choice) => (
            <ProficiencyChoicePicker key={choice.id} choice={choice} character={character} onUpdate={onUpdate} theme={theme} activeBooks={activeBooks} />
          ))}
        </CollapsibleCard>
      )}

      {/* The race's spell picks: its casting ability when the race lets the player choose one, then its cantrip or spell picks */}
      {character.race && raceSpellChoices.length > 0 && (
        <Card style={{ gap: 10 }}>
          <Text style={[styles.heading, { color: theme.text }]}>Racial Spells</Text>
          <GrantedSpellPicks character={character} choices={raceSpellChoices} onUpdate={onUpdate} theme={theme} activeBooks={activeBooks} />
        </Card>
      )}

      {/* Origin Feat for Variant Human and Custom Lineage */}
      {character.race && hasOriginFeat && (
        <Card style={{ gap: 10, borderColor: theme.accentHover }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heading, { color: theme.accentHover }]}>
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
                      onUpdate((cur) => removeOriginFeat(cur, currentOriginFeat, currentCompendium(), activeBooks));
                    }
                  }}
                />
              </View>

              {(() => {
                const bonusOptions = getFeatAbilityBonusOptions(currentOriginFeat.featName || "");
                if (bonusOptions.abilities.length <= 1) return null;
                return (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <Text style={{ color: theme.accentHover, fontSize: 12, fontWeight: "600" }}>
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
                                  currentOriginFeat,
                                  currentCompendium(),
                                  activeBooks
                                )
                              );
                            }}
                            style={[
                              styles.choiceChip,
                              {
                                backgroundColor: isSelected ? theme.accent : theme.surfaceHighlight,
                                borderColor: isSelected ? theme.accentHover : theme.border,
                              },
                            ]}>
                            <Text
                              style={{
                                color: isSelected ? theme.accentText : theme.text,
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

              <GrantedSpellPicks
                character={character}
                choices={featSpellChoicesOf(character, { name: currentOriginFeat.featName || "", source: currentOriginFeat.featSource || "PHB" }, currentCompendium(), activeBooks)}
                onUpdate={onUpdate}
                theme={theme}
                activeBooks={activeBooks}
              />
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

      {/* Race / Lineage Traits */}
      {character.race && ancestryState.traits.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Text style={[styles.heading, { color: character.lineageReplacement ? theme.accentHover : theme.text }]}>
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
                    const choice: LineageChoice =
                      opt === "None" ? { kind: "none" } : opt === "Custom Lineage" ? { kind: "custom" } : { kind: "lineage", name: opt };
                    onUpdate((prev) => changeLineage(prev, choice, currentCompendium(), activeBooks));
                  }}
                  style={[
                    styles.lineageChip,
                    {
                      backgroundColor: active ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: active ? theme.accentHover : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.accentHover : theme.textSecondary, fontSize: 13, fontWeight: "600" }}>
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
                const cardSubrace = r.subraces.length === 1 ? r.subraces[0] : undefined;
                const asiStr = increaseSummary(r, cardSubrace);
                const isLineage = r.name === "Dhampir" || r.name === "Hexblood" || r.name === "Reborn";
                const hasIncreaseChoice = heldIncreaseChoices(r, cardSubrace).length > 0;
                const singleSubrace =
                  r.subraces.length === 1 && r.subraces[0]?.name?.trim()
                    ? r.subraces[0]
                    : undefined;
                const displayTraits = singleSubrace
                  ? [...r.traits, ...(singleSubrace.traits || [])]
                  : r.traits;
                const showPlainRow = offersPlainRaceForm(r, srdBaselineRaces());
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
                          {hasIncreaseChoice ? <Badge label="Choice ASI" variant="secondary" size="sm" /> : null}
                        </View>
                        {asiStr ? (
                          <Text style={{ color: theme.accentHover, fontSize: 12, marginTop: 1, fontWeight: "600" }}>
                            {asiStr}
                          </Text>
                        ) : (
                          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }}>No fixed ASI</Text>
                        )}
                        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                          {r.size.join("/")} • {r.source}
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
                        {showPlainRow
                          ? renderRaceFormRow("plain", r.name, increaseSummary(r), () => selectRace(r))
                          : null}
                        {r.subraces.map((sr, idx) =>
                          renderRaceFormRow(
                            `${sr.name || "base"}_${idx}`,
                            sr.name || (r.name === "Human" ? "Standard Human" : r.name),
                            increaseSummary(r, sr),
                            () => selectRace(r, idx)
                          )
                        )}
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
        <ScrollView style={{ marginTop: 10, maxHeight: 450 }} nestedScrollEnabled>
          <View style={{ gap: 8 }}>
            {allFeats
              .filter((f) => f.name.toLowerCase().includes(featSearch.toLowerCase()))
              .map((f) => {
                const prereqCheck = validateFeatPrerequisites(character, f, { catalogs: { compendium: currentCompendium(), activeBooks } });
                const bonusOptions = getFeatAbilityBonusOptions(f.name);
                const isSelected = currentOriginFeat?.featName?.toLowerCase() === f.name.toLowerCase();
                // A feat the background already gives is held once, so the race cannot take it (applyOriginFeat).
                const heldByBackground = (character.originFeats ?? []).some(
                  (entry) => entry.featSource === BACKGROUND_FEAT_SOURCE && entry.featName?.toLowerCase() === f.name.toLowerCase()
                );

                return (
                  <TouchableOpacity
                    key={`${f.name}__${f.source}`}
                    activeOpacity={0.7}
                    disabled={heldByBackground}
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
                          currentOriginFeat,
                          currentCompendium(),
                          activeBooks
                        )
                      );
                      setFeatModalVisible(false);
                    }}
                    style={[
                      styles.featureRow,
                      {
                        borderColor: isSelected ? theme.accentHover : theme.border,
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
                        <Text style={{ color: theme.accentHover, fontSize: 11, fontWeight: "600" }}>
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
                      disabled={isSelected || heldByBackground}
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
                            currentOriginFeat,
                            currentCompendium(),
                            activeBooks
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

    </View>
  );
};
