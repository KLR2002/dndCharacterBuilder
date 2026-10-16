import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Character } from "../../types/character";
import { BackgroundData } from "../../types/dnd5e";
import { DND_SKILLS } from "../../constants/rules";
import {
  applyBackgroundGrants,
  clearBackground,
  parseBackgroundEquipment,
  reclaimBackgroundGrants,
  setCustomBackground,
} from "../../rules/builderTransitions";
import { ALL_LANGUAGE_NAMES, resolveCharacterLanguages, ToolGrant } from "../../rules/proficienciesAndLanguages";
import type { CharacterCatalogs } from "../../rules/catalogs";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchBar } from "../ui/SearchBar";
import { builderStyles as styles, pkStyles, RuleChoicePicker } from "./builderStyles";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { applyOriginFeat, getBackgroundFeatGrant, removeOriginFeat } from "../../rules/feats";
import { getFeatAbilityBonusOptions } from "../../rules/leveling";

export interface BackgroundSectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  allBackgrounds: BackgroundData[];
  catalogs: CharacterCatalogs;
  bgLanguageGrant: { label: string; fixed: string[]; choiceCount: number };
  toggleBgLanguage: (lang: string) => void;
  bgToolGrant: ToolGrant;
  toggleBgTool: (tool: string) => void;
  raceLanguageGrant: { label: string; fixed: string[]; choiceCount: number };
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
  bgLanguageGrant,
  toggleBgLanguage,
  bgToolGrant,
  toggleBgTool,
  raceLanguageGrant,
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

  const handleApplyCustomBackground = () => {
    const trimmed = customBgName.trim();
    if (!trimmed || customBgSkills.length !== 2) return;
    onUpdate((current) => setCustomBackground(current, trimmed, customBgSkills));
    setIsCustomBg(false);
    setCustomBgName("");
    setCustomBgSkills([]);
  };

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

          {/* Custom background skills */}
          {character.background.source === "Custom" && (
            <Card style={{ gap: 6 }}>
              <Text style={[styles.heading, { color: theme.text }]}>Custom Background Skill Proficiencies:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {(
                  character.skillChoices?.find((sc) => sc.origin === "background")?.picked ||
                  character.chosenSkills ||
                  []
                ).map((s) => (
                  <Badge key={s} label={s} variant="accent" size="sm" />
                ))}
              </View>
            </Card>
          )}

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
                  {bgToolGrant.fixed.length > 0 && (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>
                        Granted Tool Proficiencies:
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {bgToolGrant.fixed.map((t) => (
                          <Badge key={t} label={t} variant="surface" size="sm" />
                        ))}
                      </View>
                    </View>
                  )}
                  {bgLanguageGrant.fixed.length > 0 && (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Granted Languages:</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {bgLanguageGrant.fixed.map((l) => (
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
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                            <Text style={{ color: theme.success, fontSize: 12, fontWeight: "600" }}>
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
                    const bgOriginFeat = (character.originFeats || []).find(
                      (f) => f.featName?.toLowerCase() === bgFeatGrant.featName.toLowerCase()
                    );

                    return (
                      <View style={{ gap: 8, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "700" }}>
                              Background Feat: {bgFeatGrant.featName}
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                              Granted by your background
                            </Text>
                          </View>
                        </View>

                        {bgOriginFeat ? (
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                                <Text style={{ color: theme.success, fontSize: 12, fontWeight: "600" }}>
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
                          </View>
                        ) : (
                          <Button
                            title={`Claim Feat (${bgFeatGrant.featName})`}
                            variant="secondary"
                            size="sm"
                            icon="ribbon-outline"
                            onPress={() => {
                              const bonusOptions = getFeatAbilityBonusOptions(bgFeatGrant.featName);
                              const initialAbility =
                                bonusOptions.abilities.length === 1 ? bonusOptions.abilities[0] : undefined;
                              onUpdate((cur) =>
                                applyOriginFeat(cur, {
                                  level: 1,
                                  type: "feat",
                                  featName: bgFeatGrant.featName,
                                  featSource: "Background",
                                  featAbility: initialAbility,
                                })
                              );
                            }}
                          />
                        )}
                      </View>
                    );
                  })()}
                </Card>
              );
            })()}

          {/* Background Language Choices */}
          {character.background && character.background.source !== "Custom" && bgLanguageGrant.choiceCount > 0 && (
            <Card style={{ gap: 8 }}>
              <RuleChoicePicker
                label={bgLanguageGrant.label}
                choose={bgLanguageGrant.choiceCount}
                from={ALL_LANGUAGE_NAMES}
                chosen={character.chosenLanguages?.background || []}
                autoGranted={[
                  ...raceLanguageGrant.fixed,
                  ...(character.chosenLanguages?.race || []),
                  ...bgLanguageGrant.fixed,
                ]}
                onToggle={toggleBgLanguage}
                theme={theme}
              />
            </Card>
          )}

          {/* Background Tool Choices */}
          {character.background && character.background.source !== "Custom" && bgToolGrant.choices.length > 0 && (
            <Card style={{ gap: 10 }}>
              {bgToolGrant.choices.map((ch) => (
                <RuleChoicePicker
                  key={ch.key}
                  label={ch.label}
                  choose={ch.count}
                  from={ch.options}
                  chosen={character.chosenTools?.background || []}
                  autoGranted={bgToolGrant.fixed}
                  onToggle={toggleBgTool}
                  theme={theme}
                />
              ))}
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Custom Background creator card */}
          <Card style={{ gap: 10, borderColor: isCustomBg ? theme.accent : theme.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>Custom Background</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  Create your own background with a custom name and 2 skill proficiencies.
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                    Select 2 Skill Proficiencies:
                  </Text>
                  <Text
                    style={{
                      color: customBgSkills.length === 2 ? theme.accent : theme.warning,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {customBgSkills.length}/2
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {DND_SKILLS.map((s) => {
                    const isPicked = customBgSkills.includes(s.name);
                    const canPick = !isPicked && customBgSkills.length < 2;
                    return (
                      <TouchableOpacity
                        key={s.name}
                        onPress={() => {
                          if (isPicked) {
                            setCustomBgSkills(customBgSkills.filter((sk) => sk !== s.name));
                          } else if (canPick) {
                            setCustomBgSkills([...customBgSkills, s.name]);
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
                        <Text
                          style={{
                            color: isPicked ? theme.accent : theme.textSecondary,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {s.name}
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
                    disabled={!customBgName.trim() || customBgSkills.length !== 2}
                    onPress={handleApplyCustomBackground}
                    style={isCompact ? { width: "100%" } : undefined}
                  />
                </View>
              </View>
            )}
          </Card>

          <SearchBar value={bgSearch} onChangeText={setBgSearch} placeholder="Search backgrounds…" />
          <View style={{ gap: 10 }}>
            {allBackgrounds
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
                        const nextChosenLanguages = { ...character.chosenLanguages, background: [] };
                        const nextChosenTools = { ...character.chosenTools, background: [] };
                        const temp = {
                          ...character,
                          background: { name: b.name, source: b.source },
                          chosenLanguages: nextChosenLanguages,
                          chosenTools: nextChosenTools,
                        };
                        const resolved = resolveCharacterLanguages(temp, catalogs);
                        onUpdate({
                          background: { name: b.name, source: b.source },
                          chosenLanguages: nextChosenLanguages,
                          chosenTools: nextChosenTools,
                          languages: resolved,
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
