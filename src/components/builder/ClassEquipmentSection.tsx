import React from "react";
import { Text, View } from "react-native";
import type {
  StartingEquipmentAddress,
  StartingEquipmentCard,
} from "../../rules/startingEquipment";
import type { Character } from "../../types/character";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { StartingGrantsSection } from "./StartingGrantsSection";

export interface ClassEquipmentSectionProps {
  character: Character;
  onUpdate: (
    patchOrUpdater: Partial<Character> | ((prev: Character) => Character),
  ) => void;
  primaryClass?: string;
  /** The first class's equipment slots with the picks made in them. */
  startingCard: StartingEquipmentCard;
  /** The fixed tools the first class starts with. */
  classTools: string[];
  onPickOption: (slot: number, letter: string) => void;
  onPickItems: (address: StartingEquipmentAddress, names: string[]) => void;
  onClaimGold: () => void;
  onClaimEquipment: () => void;
  onClaimAgain: () => void;
  theme: any;
}

/** The Equipment part: the starting grants, then the tools the first class grants. */
export const ClassEquipmentSection: React.FC<ClassEquipmentSectionProps> = ({
  character,
  onUpdate,
  primaryClass,
  startingCard,
  classTools,
  onPickOption,
  onPickItems,
  onClaimGold,
  onClaimEquipment,
  onClaimAgain,
  theme,
}) => {
  const hasAnyClass = (character.classes || []).length > 0;
  return (
    <>
      <StartingGrantsSection
        character={character}
        primaryClass={primaryClass}
        startingCard={startingCard}
        onPickOption={onPickOption}
        onPickItems={onPickItems}
        onClaimGold={onClaimGold}
        onClaimEquipment={onClaimEquipment}
        onClaimAgain={onClaimAgain}
        onUpdateOption={(opt) => onUpdate({ startingOption: opt })}
        theme={theme}
      />

      {/* Starting tools the first class grants. Its tool choice is a Proficiency Choice in the choices below. */}
      {hasAnyClass && classTools.length > 0 && (
        <Card style={{ gap: 10 }}>
          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              Granted Class Tools:
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {classTools.map((tool) => (
                <Badge key={tool} label={tool} variant="surface" size="sm" />
              ))}
            </View>
          </View>
        </Card>
      )}
    </>
  );
};
