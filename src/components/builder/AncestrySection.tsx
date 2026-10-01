import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey, Character } from "../../types/character";
import { BackgroundData, RaceData } from "../../types/dnd5e";
import { availableRuleChoices, type AvailableRuleChoice } from "../../rules/ruleChoices";
import { clearRuleChoices, setChoiceRacialBonus, setRuleChoicePick } from "../../rules/builderTransitions";
import { ALL_LANGUAGE_NAMES, resolveCharacterLanguages, ToolGrant } from "../../rules/proficienciesAndLanguages";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchBar } from "../ui/SearchBar";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles, RuleChoicePicker, SkillPicker } from "./builderStyles";

const CHOICE_ASI_RACES = new Set(["Half-Elf", "Custom Lineage"]);
const LINEAGE_RACES = new Set(["Dhampir", "Hexblood", "Reborn"]);

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

function collectFixedBonuses(
  raceASI?: Record<string, number>[],
  subraceASI?: Record<string, number>[]
): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const item of [...(raceASI || []), ...(subraceASI || [])]) {
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") bonuses[k] = (bonuses[k] || 0) + v;
    }
  }
  return bonuses;
}

export interface AncestrySectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  allRaces: RaceData[];
  allBackgrounds: BackgroundData[];
  skillChoices: { source: string; choose: number; from: string[] }[];
  autoGranted: string[];
  toggleSkill: (skill: string) => void;
  raceLanguageGrant: { label: string; fixed: string[]; choiceCount: number };
  toggleRaceLanguage: (lang: string) => void;
  raceToolGrant: ToolGrant;
  toggleRaceTool: (tool: string) => void;
  ruleChoices: AvailableRuleChoice[];
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
  ruleChoices,
  onViewDetail,
  theme,
}) => {
  const [raceSearch, setRaceSearch] = useState("");
  const [choiceASI, setChoiceASI] = useState<Partial<Record<AbilityKey, number>>>({});
  const [flexibleMode, setFlexibleMode] = useState<"2_1" | "1_1_1">("2_1");

  const selectedRaceData = character.race ? allRaces.find((r) => r.name === character.race?.name) : undefined;
  const selectedSubraceData = selectedRaceData?.subraces?.find(
    (sr) => sr.name === character.race?.subraceName
  );
  const fixedBonuses = character.race
    ? collectFixedBonuses(selectedRaceData?.abilityScoreIncrease, selectedSubraceData?.abilityScoreIncrease)
    : {};
  const hasFixedASI = Object.keys(fixedBonuses).length > 0;

  const isChoiceASIRace =
    character.race != null &&
    (!hasFixedASI ||
      CHOICE_ASI_RACES.has(character.race.name) ||
      character.race.subraceName === "Variant" ||
      character.race.subraceName === "Custom Lineage");

  const isFlexibleMPMM =
    character.race != null &&
    !hasFixedASI &&
    character.race.name !== "Custom Lineage" &&
    character.race.subraceName !== "Variant";

  const choiceASIConfig: { count: number; amount: number } = (() => {
    if (!character.race) return { count: 2, amount: 1 };
    const name = character.race.subraceName || character.race.name;
    if (name === "Custom Lineage") return { count: 1, amount: 2 };
    return { count: 2, amount: 1 };
  })();

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

    setChoiceASI(current);
    const picks = Object.entries(current).map(([k, amount]) => ({
      key: k as AbilityKey,
      amount: amount as number,
    }));
    onUpdate((cur) => setChoiceRacialBonus(cur, picks));
  };

  const selectRace = (r: RaceData, subraceIdx?: number) => {
    const sr = subraceIdx !== undefined ? r.subraces?.[subraceIdx] : undefined;
    const fixed = collectFixedBonuses(r.abilityScoreIncrease, sr?.abilityScoreIncrease);
    const hasFixed = Object.keys(fixed).length > 0;
    const isChoice = !hasFixed || CHOICE_ASI_RACES.has(r.name) || sr?.name === "Variant" || sr?.name === "Custom Lineage";
    const bonuses = isChoice ? {} : fixed;
    setChoiceASI({});
    const updatedRace = {
      name: r.name,
      source: r.source,
      subraceName: sr?.name,
      subraceSource: sr?.source,
    };
    const nextChosenLanguages = { ...character.chosenLanguages, race: [] };
    const nextChosenTools = { ...character.chosenTools, race: [] };
    const temp = {
      ...character,
      race: updatedRace,
      chosenLanguages: nextChosenLanguages,
      chosenTools: nextChosenTools,
      racialAbilityBonuses: bonuses,
      racialChoiceBonus: [],
    };
    const resolvedLangs = resolveCharacterLanguages(temp, { races: allRaces, backgrounds: allBackgrounds });
    onUpdate({
      race: updatedRace,
      racialAbilityBonuses: bonuses,
      racialChoiceBonus: [],
      chosenLanguages: nextChosenLanguages,
      chosenTools: nextChosenTools,
      languages: resolvedLangs,
      // Rule choices belong to an ancestry; a new one invalidates the old picks.
      ruleChoices: clearRuleChoices(character).ruleChoices,
    });
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
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>{character.race.source}</Text>
          </View>
          <Button
            title="Change"
            variant="outline"
            size="sm"
            onPress={() => {
              onUpdate({ race: null, racialAbilityBonuses: {}, ruleChoices: [] });
              setChoiceASI({});
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
                    setFlexibleMode("2_1");
                    setChoiceASI({});
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
                    setFlexibleMode("1_1_1");
                    setChoiceASI({});
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
              .map((sc) => (
                <SkillPicker
                  key={sc.source}
                  label={sc.source}
                  choose={sc.choose}
                  from={sc.from}
                  chosen={character.chosenSkills}
                  autoGranted={autoGranted}
                  onToggle={toggleSkill}
                  theme={theme}
                />
              ))}
          </Card>
        )}

      {/* Ancestry Rule Choices: one pick from a fixed set, gated by level */}
      {character.race && ruleChoices.length > 0 && (
        <Card style={{ gap: 10 }}>
          {ruleChoices.map((choice) => {
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
                    setRuleChoicePick(cur, choice.id, option, choice.options.map((o) => o.name), choice.choose)
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

      {/* Race traits (when selected) */}
      {character.race &&
        !character.lineageReplacement &&
        (() => {
          const rd = allRaces.find((r) => r.name === character.race!.name);
          if (!rd || rd.traits.length === 0) return null;
          return (
            <Card style={{ gap: 8 }}>
              <Text style={[styles.heading, { color: theme.text }]}>{character.race.name} Traits:</Text>
              {rd.traits.map((t) => (
                <TouchableOpacity
                  key={t.name}
                  onPress={() => onViewDetail({ title: t.name, description: t.description, source: rd.source })}
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
          );
        })()}

      {/* Lineage features */}
      {character.lineageReplacement &&
        (() => {
          const lr = allRaces.find((r) => r.name === character.lineageReplacement);
          if (!lr) return null;
          return (
            <Card style={{ gap: 8 }}>
              <Text style={[styles.heading, { color: theme.accent }]}>{lr.name} Features (Lineage):</Text>
              {lr.traits.map((t) => (
                <TouchableOpacity
                  key={t.name}
                  onPress={() => onViewDetail({ title: t.name, description: t.description, source: lr.source })}
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
          );
        })()}

      {/* Lineage replacement toggle */}
      <Card style={{ gap: 10 }}>
        <Text style={[styles.heading, { color: theme.text }]}>Lineage Replacement (VRGtR) & Custom Lineage (TCoE)</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["None", "Dhampir", "Hexblood", "Reborn", "Custom Lineage"] as const).map((opt) => {
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

      {/* Race search + list (when no race selected) */}
      {!character.race && (
        <>
          <SearchBar value={raceSearch} onChangeText={setRaceSearch} placeholder="Search races…" />
          <View style={{ gap: 10 }}>
            {allRaces
              .filter((r) => r.name.toLowerCase().includes(raceSearch.toLowerCase()))
              .map((r) => {
                const asiStr = formatRaceASI(r.abilityScoreIncrease);
                const isChoice = CHOICE_ASI_RACES.has(r.name);
                const isLineage = LINEAGE_RACES.has(r.name);
                return (
                  <Card key={`${r.name}__${r.source}`}>
                    {/* Header */}
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>{r.name}</Text>
                          {isLineage && <Badge label="Lineage" variant="warning" size="sm" />}
                          {isChoice && <Badge label="Choice ASI" variant="secondary" size="sm" />}
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
                        onPress={() => onViewDetail({ title: r.name, source: r.source, description: r.description })}
                      />
                      {r.subraces.length <= 1 && (
                        <Button
                          title="Select"
                          size="sm"
                          onPress={() => selectRace(r, r.subraces.length === 1 ? 0 : undefined)}
                        />
                      )}
                    </View>

                    {/* Subraces */}
                    {r.subraces.length > 1 && (
                      <View style={styles.subracesBox}>
                        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Subraces / Variants:</Text>
                        {r.subraces.map((sr, idx) => {
                          const combined = collectFixedBonuses(r.abilityScoreIncrease, sr.abilityScoreIncrease);
                          const combinedStr = formatRaceASI(Object.entries(combined).map(([k, v]) => ({ [k]: v })));
                          const srIsChoice = !sr.name || CHOICE_ASI_RACES.has(sr.name) || sr.name === "Variant";
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
                                  {sr.name || r.name}
                                </Text>
                                {combinedStr && !srIsChoice ? (
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
                    )}

                    {/* Trait chips */}
                    {r.traits.length > 0 && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {r.traits.slice(0, 5).map((t) => (
                          <Badge key={t.name} label={t.name} variant="muted" size="sm" />
                        ))}
                        {r.traits.length > 5 && (
                          <Badge label={`+${r.traits.length - 5} more`} variant="muted" size="sm" />
                        )}
                      </View>
                    )}
                  </Card>
                );
              })}
          </View>
        </>
      )}
    </View>
  );
};
