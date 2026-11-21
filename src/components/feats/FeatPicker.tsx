import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import type { AbilityKey } from "../../types/character";
import type { FeatData } from "../../types/dnd5e";
import type { FeatSlotOffer } from "../../rules/featSlot";
import type { FeatAbilityBonusOptions } from "../../rules/featIncrease";
import type { AvailableRuleChoice } from "../../rules/choices/types";
import { useAppTheme } from "../../context/ThemeContext";
import type { AppTheme } from "../../constants/theme";
import { builderStyles as styles } from "../builder/builderStyles";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SearchBar } from "../ui/SearchBar";

export const chipStyle = (theme: AppTheme, active: boolean): StyleProp<ViewStyle> => [
  styles.choiceChip,
  // 48dp touch target, like the level-up Subclass chips.
  { minHeight: 48 },
  {
    backgroundColor: active ? theme.accentGlow : theme.surfaceHighlight,
    borderColor: active ? theme.accentHover : theme.border,
  },
];

export const chipText = (theme: AppTheme, active: boolean): StyleProp<TextStyle> => [
  {
    color: active ? theme.accentHover : theme.textSecondary,
    fontWeight: "700" as const,
    fontSize: 13,
  },
];

/**
 * The searchable feat rows of a Feat Slot. `offered` carries each feat's prerequisite result, so an unmet feat is shown
 * with its reason and the list holds no rule state of its own. `isDisabled` keeps a row from being picked.
 */
export function FeatList({
  offered,
  selectedFeatName,
  onSelectFeat,
  onViewDetail,
  isDisabled,
  maxHeight = 260,
}: {
  offered: FeatSlotOffer[];
  selectedFeatName: string | null;
  onSelectFeat: (feat: FeatData) => void;
  /** When given, each feat row shows an Info button that opens the feat's detail. */
  onViewDetail?: (feat: FeatData) => void;
  isDisabled?: (offer: FeatSlotOffer) => boolean;
  /** The list's scroll height; a modal gives it more room than an inline step. */
  maxHeight?: number;
}) {
  const { theme } = useAppTheme();
  const [search, setSearch] = useState("");

  return (
    <View style={{ gap: 8 }}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search feats..." />
      <ScrollView style={{ maxHeight }} nestedScrollEnabled contentContainerStyle={{ gap: 6 }}>
        {offered
          .filter((offer) => offer.feat.name.toLowerCase().includes(search.toLowerCase()))
          .map((offer) => {
            const { feat: f, prerequisite } = offer;
            const isSelected =
              selectedFeatName !== null && f.name.trim().toLowerCase() === selectedFeatName.trim().toLowerCase();
            const disabled = isDisabled?.(offer) ?? false;
            return (
              <TouchableOpacity
                key={`${f.name}_${f.source}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={`Feat ${f.name}`}
                disabled={disabled}
                onPress={() => onSelectFeat(f)}
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
                    {!prerequisite.met && <Badge label={`⚠️ ${prerequisite.reason}`} variant="danger" size="sm" />}
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                    {f.source}
                    {f.prerequisite ? ` • Prereq: ${f.prerequisite}` : ""}
                  </Text>
                </View>
                {onViewDetail && (
                  <Button
                    title="Info"
                    variant="ghost"
                    size="sm"
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onViewDetail(f);
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

/**
 * The picked feat's Increase Choice and the Rule Choices it opens, with the descriptions of the options picked.
 * Renders nothing for a feat with no increase and no Rule Choice.
 */
export function FeatPickDetails({
  increase,
  featAbility,
  subChoices,
  subChoicePicks,
  onSelectAbility,
  onToggleSubChoice,
}: {
  increase: FeatAbilityBonusOptions;
  featAbility: AbilityKey | null;
  subChoices: AvailableRuleChoice[];
  subChoicePicks: Record<string, string[]>;
  onSelectAbility: (ability: AbilityKey) => void;
  onToggleSubChoice: (choice: AvailableRuleChoice, option: string) => void;
}) {
  const { theme } = useAppTheme();

  return (
    <>
      {increase.type !== "none" && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
            {increase.type === "fixed"
              ? `Ability Score Increase: +1 ${increase.abilities[0].toUpperCase()}`
              : "Choose Ability Score to Increase (+1):"}
          </Text>
          {increase.type === "choice" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {increase.abilities.map((ability) => {
                const isPicked = featAbility === ability;
                return (
                  <TouchableOpacity
                    key={ability}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isPicked }}
                    accessibilityLabel={`${ability.toUpperCase()} +1`}
                    onPress={() => onSelectAbility(ability)}
                    style={chipStyle(theme, isPicked)}
                  >
                    <Text style={chipText(theme, isPicked)}>{ability.toUpperCase()} +1</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
      {subChoices.map((choice) => {
        const picked = subChoicePicks[choice.id] ?? [];
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
                    onPress={() => onToggleSubChoice(choice, opt.name)}
                    style={[chipStyle(theme, isPicked), atCap ? { opacity: 0.45 } : null]}
                  >
                    <Text style={chipText(theme, isPicked)}>{opt.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {choice.options
              .filter((opt) => opt.description && picked.some((p) => p.toLowerCase() === opt.name.toLowerCase()))
              .map((opt) => (
                <Text key={opt.name} style={{ color: theme.textMuted, fontSize: 11 }}>
                  <Text style={{ color: theme.accentHover, fontWeight: "600" }}>{opt.name}: </Text>
                  {opt.description}
                </Text>
              ))}
          </View>
        );
      })}
    </>
  );
}

/**
 * The feat list of a Feat Slot with the picked feat's increase and Rule Choices: {@link FeatList} and, once a feat is
 * picked, {@link FeatPickDetails}.
 */
export function FeatPicker({
  offered,
  selectedFeatName,
  increase,
  featAbility,
  subChoices,
  subChoicePicks,
  onSelectFeat,
  onSelectAbility,
  onToggleSubChoice,
  onViewDetail,
}: {
  offered: FeatSlotOffer[];
  selectedFeatName: string | null;
  increase: FeatAbilityBonusOptions;
  featAbility: AbilityKey | null;
  subChoices: AvailableRuleChoice[];
  subChoicePicks: Record<string, string[]>;
  onSelectFeat: (feat: FeatData) => void;
  onSelectAbility: (ability: AbilityKey) => void;
  onToggleSubChoice: (choice: AvailableRuleChoice, option: string) => void;
  /** When given, each feat row shows an Info button that opens the feat's detail. */
  onViewDetail?: (feat: FeatData) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <FeatList
        offered={offered}
        selectedFeatName={selectedFeatName}
        onSelectFeat={onSelectFeat}
        onViewDetail={onViewDetail}
      />
      {selectedFeatName !== null && (
        <FeatPickDetails
          increase={increase}
          featAbility={featAbility}
          subChoices={subChoices}
          subChoicePicks={subChoicePicks}
          onSelectAbility={onSelectAbility}
          onToggleSubChoice={onToggleSubChoice}
        />
      )}
    </View>
  );
}
