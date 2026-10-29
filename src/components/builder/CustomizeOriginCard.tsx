import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ActiveBooks } from "../../constants/books";
import { ABILITY_NAMES } from "../../rules/abilities";
import { setOriginAbilitySwap } from "../../rules/builderTransitions";
import { originCustomizationView } from "../../rules/originCustomization";
import { useAppTheme } from "../../context/ThemeContext";
import type { Character } from "../../types/character";
import { CollapsibleCard } from "../ui/CollapsibleCard";
import { ABILITY_KEYS, ABILITY_LABELS, builderStyles as styles } from "./builderStyles";

interface CustomizeOriginCardProps {
  character: Character;
  activeBooks: ActiveBooks;
  onUpdate: (updater: (prev: Character) => Character) => void;
}

/** The Origin Customization card in the Ancestry section. Renders nothing when the rule is not available. */
export const CustomizeOriginCard: React.FC<CustomizeOriginCardProps> = ({ character, activeBooks, onUpdate }) => {
  const { theme } = useAppTheme();
  const view = useMemo(() => originCustomizationView(character, { activeBooks }), [character, activeBooks]);
  if (!view) return null;

  return (
    <CollapsibleCard title="Customize origin" defaultExpanded={false}>
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
    </CollapsibleCard>
  );
};
