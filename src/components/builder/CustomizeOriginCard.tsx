import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ActiveBooks } from "../../constants/books";
import { ABILITY_NAMES } from "../../rules/abilities";
import { resetOriginSwaps, setLanguageSwap, setOriginAbilitySwap, setProficiencySwap } from "../../rules/builderTransitions";
import { originCustomizationView } from "../../rules/originCustomization";
import { languageSwapViews, proficiencySwapViews } from "../../rules/proficiencySheet";
import { useAppTheme } from "../../context/ThemeContext";
import type { Character } from "../../types/character";
import { Button } from "../ui/Button";
import { CollapsibleCard } from "../ui/CollapsibleCard";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles, RuleChoicePicker } from "./builderStyles";

interface CustomizeOriginCardProps {
  character: Character;
  activeBooks: ActiveBooks;
  onUpdate: (updater: (prev: Character) => Character) => void;
}

/** A proficiency row with at most this many names shows its chips inline; longer lists open the picker. */
const INLINE_OPTION_LIMIT = 6;

/** The Origin Customization card in the Ancestry section. Renders nothing when the rule is not available. */
export const CustomizeOriginCard: React.FC<CustomizeOriginCardProps> = ({ character, activeBooks, onUpdate }) => {
  const { theme } = useAppTheme();
  const view = useMemo(() => originCustomizationView(character, { activeBooks }), [character, activeBooks]);
  const languageRows = useMemo(() => languageSwapViews(character, { activeBooks }), [character, activeBooks]);
  const proficiencyRows = useMemo(() => proficiencySwapViews(character, { activeBooks }), [character, activeBooks]);
  if (!view) return null;

  const swapped =
    view.abilitySlots.some((slot) => slot.target !== slot.defaultAbility) ||
    languageRows.some((row) => row.replacement !== undefined) ||
    proficiencyRows.some((row) => row.replacement !== undefined);

  return (
    <CollapsibleCard title="Customize origin" defaultExpanded={false}>
      {languageRows.map((row) => (
        <View key={row.id} style={{ gap: 6 }}>
          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>{row.original}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[row.original, ...row.options].map((name) => {
              const selected = name === row.original ? row.replacement === undefined : row.replacement === name;
              return (
                <TouchableOpacity
                  key={name}
                  accessibilityState={{ selected }}
                  onPress={() => onUpdate((prev) => setLanguageSwap(prev, row.id, name, { activeBooks }))}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? theme.accent : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {proficiencyRows.map((row) => {
        const from = [row.original, ...row.options];
        const chosen = row.replacement ?? row.original;
        const choose = (name: string) => onUpdate((prev) => setProficiencySwap(prev, row.id, name, { activeBooks }));
        if (row.options.length > INLINE_OPTION_LIMIT) {
          return (
            <RuleChoicePicker
              key={row.id}
              label={row.original}
              choose={1}
              from={from}
              chosen={[chosen]}
              onToggle={choose}
              theme={theme}
            />
          );
        }
        return (
          <View key={row.id} style={{ gap: 6 }}>
            <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>{row.original}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {from.map((name) => {
                const selected = name === chosen;
                return (
                  <TouchableOpacity
                    key={name}
                    accessibilityState={{ selected }}
                    onPress={() => choose(name)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                        borderColor: selected ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? theme.accent : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
      {view.abilitySlots.map((slot) => (
        <View key={slot.id} style={{ gap: 6 }}>
          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
            {`${ABILITY_NAMES[slot.defaultAbility]} +${slot.amount}`}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ABILITY_KEYS.map((key) => {
              const selected = slot.target === key;
              const blocked = !selected && slot.blocked.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  disabled={blocked}
                  accessibilityState={{ selected, disabled: blocked }}
                  onPress={() => onUpdate((prev) => setOriginAbilitySwap(prev, slot.id, key, { activeBooks }))}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                      borderColor: selected ? theme.accent : theme.border,
                      opacity: blocked ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? theme.accent : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>
                    {ABILITY_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {swapped && (
        <Button
          title="Reset"
          variant="outline"
          size="sm"
          onPress={() => onUpdate((prev) => resetOriginSwaps(prev, { activeBooks }))}
        />
      )}
    </CollapsibleCard>
  );
};
