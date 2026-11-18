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
 * The feat list of a Feat Slot with the picked feat's increase and Rule Choices. `offered` carries each feat's
 * prerequisite result, so an unmet feat is shown with its reason and the picker holds no rule state of its own.
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
}) {
  const { theme } = useAppTheme();
  const [search, setSearch] = useState("");

  return (
    <View style={{ gap: 8 }}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search feats..." />
      <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled contentContainerStyle={{ gap: 6 }}>
        {offered
          .filter((offer) => offer.feat.name.toLowerCase().includes(search.toLowerCase()))
          .map(({ feat: f, prerequisite }) => {
            const isSelected =
              selectedFeatName !== null && f.name.trim().toLowerCase() === selectedFeatName.trim().toLowerCase();
            return (
              <TouchableOpacity
                key={`${f.name}_${f.source}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Feat ${f.name}`}
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
              </TouchableOpacity>
            );
          })}
      </ScrollView>
      {selectedFeatName !== null &&
        (() => {
          if (increase.type === "none") return null;
          return (
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
          );
        })()}
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
          </View>
        );
      })}
    </View>
  );
}
