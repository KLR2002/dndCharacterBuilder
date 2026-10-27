import React, { useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Character } from "../../types/character";
import { BackgroundData } from "../../types/dnd5e";
import { BACKGROUND_FEAT_SOURCE, DND_SKILLS } from "../../constants/rules";
import {
  applyBackgroundGrants,
  clearBackground,
  parseBackgroundEquipment,
  reclaimBackgroundGrants,
  setCustomBackground,
} from "../../rules/builderTransitions";
import type { SourceFixedGrants } from "../../rules/proficiencySheet";
import {
  borrowableFeatures,
  CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT,
  withoutCatalogCustomBackground,
  type BorrowableFeature,
} from "../../rules/customBackground";
import { heldByOtherSources, picksOnlyLanguages } from "../../rules/proficiencyChoiceOffers";
import { poolNames } from "../../rules/proficiencyPools";
import { featSpellChoicesOf, type AvailableRuleChoice } from "../../rules/ruleChoices";
import { currentCompendium } from "../../services/compendium";
import { catalogListings, type CharacterCatalogs } from "../../rules/catalogs";
import { featOfSelection } from "../../rules/choices/featSpells";
import { GrantedSpellPicks } from "./GrantedSpellPicks";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CollapsibleCard } from "../ui/CollapsibleCard";
import { SearchBar } from "../ui/SearchBar";
import { builderStyles as styles, pkStyles } from "./builderStyles";
import { ProficiencyChoicePicker } from "./ProficiencyChoicePicker";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { applyOriginFeat, getBackgroundFeatGrant, grantBackgroundFeat, removeOriginFeat } from "../../rules/feats";
import { getFeatAbilityBonusOptions } from "../../rules/leveling";

export interface BackgroundSectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  allBackgrounds: BackgroundData[];
  catalogs: CharacterCatalogs;
  /** The fixed languages and tools the background grants. */
  bgGranted: SourceFixedGrants;
  /** The background's Proficiency Choices: its tool and language picks. */
  proficiencyChoices: AvailableRuleChoice[];
  resolvedLanguages: string[];
  resolvedTools: string[];
  onViewDetail: (item: { title: string; subtitle?: string; source?: string; description?: string; tags?: string[] }) => void;
  theme: any;
}

export const BackgroundSection: React.FC<BackgroundSectionProps> = ({
  character,
  onUpdate,
  allBackgrounds,
  catalogs,
  bgGranted,
  proficiencyChoices,
  resolvedLanguages,
  resolvedTools,
  onViewDetail,
  theme,
}) => {
  const { isCompact } = useResponsiveLayout();
  const [bgSearch, setBgSearch] = useState("");
  const [isCustomBg, setIsCustomBg] = useState(false);
  const [customBgName, setCustomBgName] = useState("");
  const [customBgSkills, setCustomBgSkills] = useState<string[]>([]);
  const [customBgTools, setCustomBgTools] = useState<string[]>([]);
  const [customBgFeature, setCustomBgFeature] = useState<BorrowableFeature | null>(null);
  const [featureSearch, setFeatureSearch] = useState("");

  const selectableBackgrounds = useMemo(() => withoutCatalogCustomBackground(allBackgrounds), [allBackgrounds]);
  const borrowable = useMemo(() => borrowableFeatures(allBackgrounds), [allBackgrounds]);
  // The tool and language names the rest of the character does not already hold: the choice's pool less those.
  const toolOrLanguageOptions = useMemo(() => {
    const isHeld = heldByOtherSources(character, CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT, {
      compendium: catalogs.compendium,
      activeBooks: catalogs.activeBooks,
    });
    return poolNames(CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT).filter((name) => !isHeld(name));
  }, [character, catalogs.compendium, catalogs.activeBooks]);
  const featureQuery = featureSearch.trim().toLowerCase();
  const featureRows = borrowable.filter((row) => row.label.toLowerCase().includes(featureQuery));

  const handleApplyCustomBackground = () => {
    const trimmed = customBgName.trim();
    if (!trimmed || customBgSkills.length !== 2 || customBgTools.length !== 2) return;
    onUpdate((current) =>
      setCustomBackground(current, trimmed, customBgSkills, {
        toolsOrLanguages: customBgTools,
        feature: customBgFeature ? { name: customBgFeature.name, description: customBgFeature.description } : undefined,
      })
    );
    setIsCustomBg(false);
    setCustomBgName("");
    setCustomBgSkills([]);
    setCustomBgTools([]);
    setCustomBgFeature(null);
    setFeatureSearch("");
  };

  // A row of two picks: the counter turns accent once both are made.
  const pickCounter = (label: string, count: number) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>{label}</Text>
      <Text style={{ color: count === 2 ? theme.accent : theme.warning, fontSize: 12, fontWeight: "700" }}>{count}/2</Text>
    </View>
  );

  // Toggle chips for a two-pick choice: a picked chip is deselected, and no third pick is taken.
  const pickChips = (options: string[], picked: string[], setPicked: (next: string[]) => void) =>
    options.map((name) => {
      const isPicked = picked.includes(name);
      const canPick = !isPicked && picked.length < 2;
      return (
        <TouchableOpacity
          key={name}
          onPress={() => {
            if (isPicked) {
              setPicked(picked.filter((pick) => pick !== name));
            } else if (canPick) {
              setPicked([...picked, name]);
            }
          }}
          style={[
            pkStyles.chip,
            {
              backgroundColor: isPicked ? theme.accentGlow : theme.surfaceHighlight,
              borderColor: isPicked ? theme.accent : theme.border,
              opacity: !isPicked && !canPick ? 0.4 : 1,
            },
          ]}
        >
          <Text style={{ color: isPicked ? theme.accent : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
            {name}
          </Text>
        </TouchableOpacity>
      );
    });

  return (
    <View style={styles.section}>
      {/* Selected background */}
      {character.background ? (
        <>
          <Card highlight style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>{character.background.name}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {character.background.source === "Custom" ? "Custom Background" : character.background.source}
              </Text>
            </View>
            <Button title="Change" variant="outline" size="sm" onPress={() => onUpdate((cur) => clearBackground(cur, catalogs))} />
          </Card>

          {/* Auto-granted background skills & equipment (official) */}
          {character.background.source !== "Custom" &&
            (() => {
              const bgData = allBackgrounds.find((b) => b.name === character.background!.name);
              if (!bgData) return null;
              const startingEq = parseBackgroundEquipment(bgData.startingEquipment || []);
              return (
                <Card style={{ gap: 8 }}>
                  <Text style={[styles.heading, { color: theme.text }]}>Background Benefits:</Text>
                  {bgData.skillProficiencies.length > 0 && (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Skill Proficiencies:</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {bgData.skillProficiencies.map((s) => (
                          <Badge key={s} label={s} variant="accent" size="sm" />
                        ))}
                      </View>
                    </View>
                  )}
                  {bgGranted.tools.length > 0 && (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>
                        Granted Tool Proficiencies:
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {bgGranted.tools.map((t) => (
                          <Badge key={t} label={t} variant="surface" size="sm" />
                        ))}
                      </View>
                    </View>
                  )}
                  {bgGranted.languages.length > 0 && (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Granted Languages:</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {bgGranted.languages.map((l) => (
                          <Badge key={l} label={l} variant="accent" size="sm" />
                        ))}
                      </View>
                    </View>
                  )}
                  {startingEq &&
                    (startingEq.items.length > 0 ||
                      (startingEq.coins?.gp ?? 0) > 0 ||
                      (startingEq.coins?.sp ?? 0) > 0) && (
                      <View style={{ gap: 6, marginTop: 4 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>
                          Starting Equipment & Money:
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                          {(startingEq.coins?.gp ?? 0) > 0 && (
                            <Badge label={`💰 ${startingEq.coins.gp} gp`} variant="accent" size="sm" />
                          )}
                          {startingEq.items.map((it) => (
                            <Badge
                              key={it.name}
                              label={`${it.name}${it.quantity > 1 ? ` (×${it.quantity})` : ""}`}
                              variant="surface"
                              size="sm"
                            />
                          ))}
                        </View>
                        {character.backgroundGrantsApplied ? (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                            <Text style={{ color: theme.success, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>
                              Background Equipment & Funds Claimed
                            </Text>
                            <Button
                              title="Claim again"
                              variant="outline"
                              size="sm"
                              onPress={() => onUpdate((cur) => reclaimBackgroundGrants(cur, bgData))}
                            />
                          </View>
                        ) : (
                          <View style={{ flexDirection: isCompact ? "column" : "row" }}>
                            <Button
                              title="Claim Background Equipment & Funds"
                              variant="secondary"
                              size="sm"
                              icon="bag-add-outline"
                              onPress={() => onUpdate((cur) => applyBackgroundGrants(cur, bgData))}
                              style={isCompact ? { width: "100%" } : undefined}
                            />
                          </View>
                        )}
                      </View>
                    )}
                  {bgData.feature && (
                    <TouchableOpacity
                      onPress={() =>
                        onViewDetail({ title: bgData.feature!.name, description: bgData.feature!.description })
                      }
                      style={[styles.featureRow, { borderColor: theme.border, marginTop: 4 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                          Feature: {bgData.feature.name}
                        </Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={2}>
                          {bgData.feature.description}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}

                  {/* Feat Grant from Background (e.g. Giant Foundling, Rune Carver) */}
                  {(() => {
                    const bgFeatGrant = getBackgroundFeatGrant(character.background!.name, bgData.feature?.description);
                    if (!bgFeatGrant) return null;
                    // A choice of feats (Rewarded) offers each of its options; the feat claimed is the background's one.
                    const offeredFeats = bgFeatGrant.isChoice ? bgFeatGrant.choiceOptions ?? [bgFeatGrant.featName] : [bgFeatGrant.featName];
                    const bgOriginFeat = (character.originFeats || []).find((f) => f.featSource === BACKGROUND_FEAT_SOURCE);
                    const bgFeatRecord = bgOriginFeat ? featOfSelection(bgOriginFeat, catalogListings(catalogs).feats()) : undefined;

                    return (
                      <View style={{ gap: 8, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "700" }}>
                              Background Feat: {bgOriginFeat ? bgOriginFeat.featName : bgFeatGrant.isChoice ? "choose one" : bgFeatGrant.featName}
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                              Granted by your background
                            </Text>
                          </View>
                        </View>

                        {bgOriginFeat ? (
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                                <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                                <Text style={{ color: theme.success, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>
                                  Feat Added to Character
                                </Text>
                              </View>
                              <Button
                                title="Remove"
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                  onUpdate((cur) => removeOriginFeat(cur, bgOriginFeat.featName || ""));
                                }}
                              />
                            </View>

                            {/* Half-feat picker if applicable */}
                            {(() => {
                              const bonusOptions = getFeatAbilityBonusOptions(bgOriginFeat.featName || "");
                              if (bonusOptions.abilities.length === 0) return null;
                              return (
                                <View style={{ gap: 4 }}>
                                  <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "600" }}>
                                    Choose +{bonusOptions.amount} Ability Score Increase:
                                  </Text>
                                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                    {bonusOptions.abilities.map((ab) => {
                                      const isSelected = bgOriginFeat.featAbility === ab;
                                      return (
                                        <TouchableOpacity
                                          key={ab}
                                          onPress={() => {
                                            onUpdate((cur) =>
                                              applyOriginFeat(cur, { ...bgOriginFeat, featAbility: ab })
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

                            <GrantedSpellPicks
                              character={character}
                              choices={featSpellChoicesOf(
                                character,
                                {
                                  name: bgFeatRecord?.name ?? bgOriginFeat.featName ?? "",
                                  source: bgFeatRecord?.source ?? BACKGROUND_FEAT_SOURCE,
                                },
                                currentCompendium(),
                                catalogs.activeBooks
                              )}
                              onUpdate={onUpdate}
                              theme={theme}
                            />
                          </View>
                        ) : (
                          <View style={{ gap: 6 }}>
                            {offeredFeats.map((featName) => (
                              <Button
                                key={featName}
                                title={`Claim Feat (${featName})`}
                                variant="secondary"
                                size="sm"
                                icon="ribbon-outline"
                                onPress={() => {
                                  const bonusOptions = getFeatAbilityBonusOptions(featName);
                                  const initialAbility =
                                    bonusOptions.abilities.length === 1 ? bonusOptions.abilities[0] : undefined;
                                  onUpdate((cur) => grantBackgroundFeat(cur, featName, initialAbility));
                                }}
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </Card>
              );
            })()}

          {/* Background Proficiency Choices: its skill, tool and language picks, custom backgrounds included */}
          {proficiencyChoices.length > 0 && (
            <CollapsibleCard title={picksOnlyLanguages(proficiencyChoices) ? "Languages" : "Languages & Proficiencies"}>
              {proficiencyChoices.map((choice) => (
                <ProficiencyChoicePicker key={choice.id} choice={choice} character={character} onUpdate={onUpdate} theme={theme} />
              ))}
            </CollapsibleCard>
          )}
        </>
      ) : (
        <>
          {/* Custom Background creator card */}
          <Card style={{ gap: 10, borderColor: isCustomBg ? theme.accent : theme.border }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 180 }}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>Custom Background</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  Create your own background with a custom name, 2 skill proficiencies and 2 tool or language
                  proficiencies.
                </Text>
              </View>
              <Button
                title={isCustomBg ? "Cancel" : "Create Custom"}
                variant={isCustomBg ? "ghost" : "outline"}
                size="sm"
                onPress={() => setIsCustomBg(!isCustomBg)}
              />
            </View>

            {isCustomBg && (
              <View style={{ gap: 10, marginTop: 4 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>Background Name:</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                  ]}
                  placeholder="e.g. Bounty Hunter, Village Hero..."
                  placeholderTextColor={theme.textMuted}
                  value={customBgName}
                  onChangeText={setCustomBgName}
                />
                {pickCounter("Select 2 Skill Proficiencies:", customBgSkills.length)}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {pickChips(
                    DND_SKILLS.map((s) => s.name),
                    customBgSkills,
                    setCustomBgSkills
                  )}
                </View>
                {pickCounter("Select 2 Tool or Language Proficiencies:", customBgTools.length)}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {pickChips(toolOrLanguageOptions, customBgTools, setCustomBgTools)}
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                  Feature from Another Background (optional):
                </Text>
                {customBgFeature && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>
                      {customBgFeature.label}
                    </Text>
                    <Button title="Clear" variant="ghost" size="sm" onPress={() => setCustomBgFeature(null)} />
                  </View>
                )}
                <SearchBar value={featureSearch} onChangeText={setFeatureSearch} placeholder="Search features…" />
                <View style={{ gap: 6 }}>
                  {featureRows.map((row) => {
                    const isPicked = customBgFeature?.key === row.key;
                    return (
                      <TouchableOpacity
                        key={row.key}
                        onPress={() => setCustomBgFeature(isPicked ? null : row)}
                        style={[
                          pkStyles.chip,
                          {
                            backgroundColor: isPicked ? theme.accentGlow : theme.surfaceHighlight,
                            borderColor: isPicked ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isPicked ? theme.accent : theme.textSecondary,
                            fontSize: 12,
                            fontWeight: "600",
                            flexShrink: 1,
                          }}
                        >
                          {row.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ flexDirection: isCompact ? "column" : "row" }}>
                  <Button
                    title="Apply Custom Background"
                    variant="primary"
                    size="sm"
                    disabled={!customBgName.trim() || customBgSkills.length !== 2 || customBgTools.length !== 2}
                    onPress={handleApplyCustomBackground}
                    style={isCompact ? { width: "100%" } : undefined}
                  />
                </View>
              </View>
            )}
          </Card>

          <SearchBar value={bgSearch} onChangeText={setBgSearch} placeholder="Search backgrounds…" />
          <View style={{ gap: 10 }}>
            {selectableBackgrounds
              .filter((b) => b.name.toLowerCase().includes(bgSearch.toLowerCase()))
              .map((b) => (
                <Card key={`${b.name}__${b.source}`}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{b.name}</Text>
                      <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "600" }}>
                        {b.skillProficiencies.join(", ") || "—"}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>{b.source}</Text>
                    </View>
                    <Button
                      title="Info"
                      variant="ghost"
                      size="sm"
                      onPress={() =>
                        onViewDetail({
                          title: b.name,
                          source: b.source,
                          description: b.description,
                          tags: b.skillProficiencies,
                        })
                      }
                    />
                    <Button
                      title="Select"
                      size="sm"
                      onPress={() => {
                        onUpdate({
                          background: { name: b.name, source: b.source },
                          chosenLanguages: { ...character.chosenLanguages, background: [] },
                          chosenTools: { ...character.chosenTools, background: [] },
                        });
                      }}
                    />
                  </View>
                </Card>
              ))}
          </View>
        </>
      )}

      {/* Known Languages Card */}
      <Card style={{ gap: 8 }}>
        <View>
          <Text style={[styles.heading, { color: theme.text }]}>Known Languages:</Text>
          <Text style={{ color: theme.textMuted, fontSize: 11 }}>
            Granted and chosen from race, background, and features
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {resolvedLanguages.map((lang) => (
            <Badge key={lang} label={lang} variant="accent" size="sm" />
          ))}
        </View>
      </Card>

      {/* Tool Proficiencies Card */}
      <Card style={{ gap: 8 }}>
        <View>
          <Text style={[styles.heading, { color: theme.text }]}>Tool Proficiencies:</Text>
          <Text style={{ color: theme.textMuted, fontSize: 11 }}>Granted and chosen from race, background, and class</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {resolvedTools.length > 0 ? (
            resolvedTools.map((tool) => <Badge key={tool} label={tool} variant="surface" size="sm" />)
          ) : (
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>None</Text>
          )}
        </View>
      </Card>
    </View>
  );
};
