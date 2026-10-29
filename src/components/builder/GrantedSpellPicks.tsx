import type { ActiveBooks } from "../../constants/books";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Character } from "../../types/character";
import { pickRuleChoice, type AvailableRuleChoice } from "../../rules/ruleChoices";
import { currentCompendium } from "../../services/compendium";
import { builderStyles as styles } from "./builderStyles";

export interface GrantedSpellPicksProps {
  character: Character;
  /** The picks to show: a feat's (featSpellChoicesOf) or a race's (raceSpellRuleChoices). */
  choices: AvailableRuleChoice[];
  onUpdate: (updater: (cur: Character) => Character) => void;
  theme: any;
  activeBooks: ActiveBooks;
}

/**
 * The spell picks a granted spell source asks for: a feat's spell list when it offers several, then the spells of the list the
 * player chose, and a casting ability the player chooses. Each tap saves the pick as a rule choice. Renders nothing without picks.
 */
export const GrantedSpellPicks: React.FC<GrantedSpellPicksProps> = ({ character, choices, onUpdate, theme, activeBooks }) => {
  if (choices.length === 0) return null;

  return (
    <View style={{ marginTop: 4, gap: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
      {choices.map((choice) => {
        const picked = character.ruleChoices?.find((rc) => rc.id === choice.id)?.picked ?? [];
        return (
          <View key={choice.id} style={{ gap: 6 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
              {choice.traitName} (choose {choice.choose})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {choice.options.map((opt) => {
                const isSelected = picked.includes(opt.name);
                return (
                  <TouchableOpacity
                    key={opt.name}
                    onPress={() => onUpdate((cur) => pickRuleChoice(cur, choice, opt.name, currentCompendium(), activeBooks))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? theme.accentGlow : theme.surfaceHighlight,
                        borderColor: isSelected ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isSelected ? theme.accent : theme.textSecondary,
                        fontSize: 11,
                        fontWeight: isSelected ? "700" : "500",
                        flexShrink: 1,
                      }}
                    >
                      {opt.label ?? opt.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};
