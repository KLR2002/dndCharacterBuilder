import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import type { AbilityKey, AsiSelection, Character } from "../../types/character";
import type { FeatData } from "../../types/dnd5e";
import { getFeatAbilityBonusOptions } from "../../rules/leveling";
import { validateFeatPrerequisites } from "../../rules/feats";
import { currentCompendium } from "../../services/compendium";
import { useAppTheme } from "../../context/ThemeContext";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles } from "../builder/builderStyles";
import { Badge } from "../ui/Badge";
import { SearchBar } from "../ui/SearchBar";
import { asiFeatStepView, type LevelUpPlan } from "../../rules/levelUpFlow";

/**
 * The ASI/Feat step: the level's Ability Score Improvement or Feat, held in the plan. The same choice
 * structure as the builder's ASI/Feat section (ASI +2 to one ability or +1 to two, a feat with its
 * ability increase, and the feat's own rule choices such as a fighting style, maneuvers or an
 * invocation), but every selection writes the plan's picks instead of the Character. The step stays
 * incomplete until they are all made. The step only renders while it is open, so it remounts when the
 * player leaves it and returns: the whole selection (picked feat, its ability, its sub-choices, the
 * ASI picks, the open tab) is derived from `plan.picks.asi` through `asiFeatStepView`, and only
 * genuinely transient UI (the open tab, the ASI sub-mode, the search text) is local state.
 */
export function AsiFeatStep({
  plan,
  character,
  allFeats,
  activeBooks,
  onPick,
  onFeatPick,
}: {
  plan: LevelUpPlan;
  character: Character;
  allFeats: FeatData[];
  activeBooks: string[];
  onPick: (asi: AsiSelection) => void;
  onFeatPick: (choiceId: string, option: string, choose: number) => void;
}) {
  const { theme } = useAppTheme();
  const view = asiFeatStepView(plan, character, allFeats, { activeBooks });
  const [tab, setTab] = useState<"asi" | "feat">(view.tab);
  const [asiMode, setAsiMode] = useState<"plus2" | "plus1plus1">(view.asiMode);
  const [search, setSearch] = useState("");

  const slot: AsiSelection = {
    level: plan.toLevel,
    className: plan.className,
    classLevel: plan.toLevel,
    type: "asi",
    asi: {},
  };

  const pickAsi = (asi: Partial<Record<AbilityKey, number>>) => {
    onPick({ ...slot, type: "asi", asi });
  };

  const handlePlus2 = (ability: AbilityKey) => {
    pickAsi({ [ability]: 2 });
  };

  const handlePlus1 = (ability: AbilityKey) => {
    const current = view.plus1Picks;
    const next = current.includes(ability)
      ? current.filter((p) => p !== ability)
      : current.length < 2
        ? [...current, ability]
        : [current[1], ability];
    // Every tap writes the plan, half-finished picks included: starting an ASI pick replaces a feat
    // in the plan at once, so the plan and the visible selection never disagree.
    pickAsi(Object.fromEntries(next.map((key) => [key, 1])));
  };

  const handleFeat = (feat: FeatData) => {
    const opts = getFeatAbilityBonusOptions(feat.name, feat);
    const ability = opts.type === "fixed" ? opts.abilities[0] : null;
    // Selecting a feat replaces the plan's pick at once. A feat offering +1 to one of several abilities
    // stays pending (no featAbility) until one is chosen below, and the step rejects it until then.
    onPick({
      ...slot,
      type: "feat",
      featName: feat.name,
      featSource: feat.source,
      featAbility: ability ?? undefined,
      asi: ability ? { [ability]: 1 } : undefined,
    });
  };

  const handleFeatAbility = (ability: AbilityKey) => {
    const asi = plan.picks.asi;
    if (asi?.type !== "feat" || !asi.featName) return;
    onPick({
      ...slot,
      type: "feat",
      featName: asi.featName,
      featSource: asi.featSource,
      featAbility: ability,
      asi: { [ability]: 1 },
    });
  };

  const current = plan.picks.asi;
  const currentSummary = current
    ? current.type === "feat"
      ? `Feat: ${current.featName ?? ""} (${current.featSource ?? "PHB"})`
      : Object.entries(current.asi ?? {})
          .map(([k, v]) => `${k.toUpperCase()} +${v}`)
          .join(", ")
    : null;

  const tabStyle = (active: boolean): StyleProp<ViewStyle> => [
    styles.methodBtn,
    {
      backgroundColor: active ? theme.accentGlow : theme.surface,
      borderColor: active ? theme.accentHover : theme.border,
    },
  ];
  const tabText = (active: boolean): StyleProp<TextStyle> => [
    styles.methodText,
    {
      color: active ? theme.accentHover : theme.textSecondary,
      fontWeight: active ? ("700" as const) : ("500" as const),
    },
  ];
  const chipStyle = (active: boolean): StyleProp<ViewStyle> => [
    styles.choiceChip,
    // 48dp touch target, like the level-up Subclass chips.
    { minHeight: 48 },
    {
      backgroundColor: active ? theme.accentGlow : theme.surfaceHighlight,
      borderColor: active ? theme.accentHover : theme.border,
    },
  ];
  const chipText = (active: boolean): StyleProp<TextStyle> => [
    {
      color: active ? theme.accentHover : theme.textSecondary,
      fontWeight: "700" as const,
      fontSize: 13,
    },
  ];

  return (
    <View style={{ gap: 10 }}>
      {currentSummary ? (
        <View style={[styles.featureRow, { borderColor: theme.accentHover, padding: 8, borderRadius: 6 }]}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>{currentSummary}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: tab === "asi" }}
          accessibilityLabel="Ability score improvement"
          onPress={() => setTab("asi")}
          style={tabStyle(tab === "asi")}
        >
          <Text style={tabText(tab === "asi")}>Ability Scores (+2 or +1/+1)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: tab === "feat" }}
          accessibilityLabel="Feat"
          onPress={() => setTab("feat")}
          style={tabStyle(tab === "feat")}
        >
          <Text style={tabText(tab === "feat")}>Feat</Text>
        </TouchableOpacity>
      </View>

      {tab === "asi" ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: asiMode === "plus2" }}
              onPress={() => setAsiMode("plus2")}
              style={tabStyle(asiMode === "plus2")}
            >
              <Text style={tabText(asiMode === "plus2")}>+2 to One Ability</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: asiMode === "plus1plus1" }}
              onPress={() => setAsiMode("plus1plus1")}
              style={tabStyle(asiMode === "plus1plus1")}
            >
              <Text style={tabText(asiMode === "plus1plus1")}>+1 to Two Abilities</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ABILITY_KEYS.map((key) => {
              const selected = asiMode === "plus2" ? view.plus2Pick === key : view.plus1Picks.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${ABILITY_LABELS[key]} (+${asiMode === "plus2" ? 2 : 1})`}
                  onPress={() => (asiMode === "plus2" ? handlePlus2(key) : handlePlus1(key))}
                  style={chipStyle(selected)}
                >
                  <Text style={chipText(selected)}>
                    {ABILITY_LABELS[key]} (+{asiMode === "plus2" ? 2 : 1})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search feats..." />
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled contentContainerStyle={{ gap: 6 }}>
            {allFeats
              .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
              .map((f) => {
                const isSelected = view.featName !== null && f.name.trim().toLowerCase() === view.featName.trim().toLowerCase();
                const prereq = validateFeatPrerequisites(character, f, {
                  catalogs: { compendium: currentCompendium(), activeBooks },
                });
                return (
                  <TouchableOpacity
                    key={`${f.name}_${f.source}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Feat ${f.name}`}
                    onPress={() => handleFeat(f)}
                    style={[
                      styles.featureRow,
                      {
                        padding: 8,
                        borderRadius: 6,
                        backgroundColor: isSelected ? theme.accentGlow : theme.surfaceHighlight,
                        borderColor: isSelected ? theme.accentHover : theme.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ color: isSelected ? theme.accentHover : theme.text, fontWeight: "700", fontSize: 13 }}>
                          {f.name}
                        </Text>
                        {!prereq.met && <Badge label={`⚠️ ${prereq.reason}`} variant="danger" size="sm" />}
                      </View>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                        {f.source}
                        {f.prerequisite ? ` • Prereq: ${f.prerequisite}` : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
          {view.featName !== null &&
            (() => {
              const opts = view.featAbilityOptions;
              if (opts.type === "none") return null;
              return (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                    {opts.type === "fixed"
                      ? `Ability Score Increase: +1 ${opts.abilities[0].toUpperCase()}`
                      : "Choose Ability Score to Increase (+1):"}
                  </Text>
                  {opts.type === "choice" && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {opts.abilities.map((ability) => {
                        const isPicked = view.featAbility === ability;
                        return (
                          <TouchableOpacity
                            key={ability}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isPicked }}
                            accessibilityLabel={`${ability.toUpperCase()} +1`}
                            onPress={() => handleFeatAbility(ability)}
                            style={chipStyle(isPicked)}
                          >
                            <Text style={chipText(isPicked)}>{ability.toUpperCase()} +1</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}
          {view.subChoices.map((choice) => {
              const picked = plan.picks.featPicks?.[choice.id] ?? [];
              return (
                <View key={choice.id} style={{ gap: 6 }}>
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                    {choice.traitName} ({picked.length}/{choice.choose}):
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {choice.options.map((opt) => {
                      const isPicked = picked.some((p) => p.toLowerCase() === opt.name.toLowerCase());
                      // At the cap a new option is disabled; the picked ones stay deselectable.
                      const atCap = picked.length >= choice.choose && !isPicked;
                      return (
                        <TouchableOpacity
                          key={opt.name}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isPicked, disabled: atCap }}
                          accessibilityLabel={`${choice.traitName} ${opt.name}`}
                          disabled={atCap}
                          onPress={() => onFeatPick(choice.id, opt.name, choice.choose)}
                          style={[chipStyle(isPicked), atCap ? { opacity: 0.45 } : null]}
                        >
                          <Text style={chipText(isPicked)}>{opt.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
}
