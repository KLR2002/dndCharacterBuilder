import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ActiveBooks } from "../../constants/books";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  confirmLevelUp,
  removeClassLevel as removeClassLevelTransition,
} from "../../rules/builderTransitions";
import { findClassData } from "../../rules/catalogs";
import { classStepMinLevel, classStepOffer, isCreationFinished } from "../../rules/creationFlow";
import { currentCompendium } from "../../services/compendium";
import type { Character, CreationStepId } from "../../types/character";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { builderStyles as styles } from "./builderStyles";

export interface ClassLevelsSectionProps {
  character: Character;
  onUpdate: (
    patchOrUpdater: Partial<Character> | ((prev: Character) => Character),
  ) => void;
  fullHealOnLevelUp: boolean;
  totalLevel: number;
  activeBooks: ActiveBooks;
  /** The Creation Step this part is hosted on. Unset in the free-form builder. */
  step?: CreationStepId;
  /** The class whose subclass change picker is open. */
  changingSubclassFor: string | null;
  setChangingSubclassFor: (className: string | null) => void;
  theme: any;
}

/** The Total Level card and one row per held class: its level stepper and its subclass. */
export const ClassLevelsSection: React.FC<ClassLevelsSectionProps> = ({
  character,
  onUpdate,
  fullHealOnLevelUp,
  totalLevel,
  activeBooks,
  step,
  changingSubclassFor,
  setChangingSubclassFor,
  theme,
}) => {
  const { isPhone } = useResponsiveLayout();
  // SRD mode has exactly one subclass per class, so there is no choice to change: it is shown as text.
  const isSrd = !currentCompendium().integrated;

  const handleAddClassLevel = (className: string, source: string) => {
    onUpdate((current) =>
      confirmLevelUp(current, className, source, fullHealOnLevelUp),
    );
  };

  const removeClassLevel = (className: string) => {
    onUpdate(
      removeClassLevelTransition(character, className, currentCompendium(), activeBooks),
    );
  };

  // What the Class step offers here: Edit Build on a finished character lowers a held class's level but
  // offers no raise or add-class control (a level up enters through the Level-Up Flow); a draft or the
  // free-form builder keeps the full controls.
  const editBuild = step !== undefined && isCreationFinished(character);
  const canRaiseLevel = step === undefined || !isCreationFinished(character);
  // The lowest level each held class can be lowered to; lowering below 1 removes the class.
  const canLowerTo = (level: number, classIndex: number) => level > classStepMinLevel(editBuild ? "edit" : undefined, classIndex);
  const maxLevel = classStepOffer().startingLevel.max;

  return (
    <Card highlight style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text
          style={[styles.bannerTitle, { color: theme.text, flexShrink: 1 }]}
        >
          Total Level:{" "}
          <Text style={{ color: theme.accentHover }}>{totalLevel}</Text>
        </Text>
        <Badge
          label={`Prof +${Math.floor((totalLevel - 1) / 4) + 2}`}
          variant="accent"
        />
      </View>
      {character.classes.map((c, classIndex) => {
        const cd = findClassData(currentCompendium().for().classes(), c);
        return (
          <View
            key={c.className}
            style={[
              styles.classRow,
              {
                backgroundColor: theme.surfaceHighlight,
                borderColor: theme.border,
                flexDirection: isPhone ? "column" : "row",
                alignItems: isPhone ? "stretch" : "center",
                gap: isPhone ? 8 : 0,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flex: isPhone ? undefined : 1,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                  flex: 1,
                }}
              >
                <Text style={[styles.className, { color: theme.text }]}>
                  {c.className}
                </Text>
                <Badge label={cd?.hitDie || "1d8"} size="sm" />
              </View>
              {isPhone && (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    onPress={() => removeClassLevel(c.className)}
                    disabled={!canLowerTo(c.level, classIndex)}
                    accessibilityRole="button"
                    accessibilityLabel={`Lower ${c.className} level`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: theme.surfaceRaised, opacity: !canLowerTo(c.level, classIndex) ? 0.4 : 1 },
                    ]}
                  >
                    <Ionicons name="remove" size={20} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.levelNum, { color: theme.text }]}>
                    {c.level}
                  </Text>
                  {canRaiseLevel ? (
                    <TouchableOpacity
                      onPress={() => handleAddClassLevel(c.className, c.source)}
                      disabled={c.level >= maxLevel}
                      accessibilityRole="button"
                      accessibilityLabel={`Raise ${c.className} level`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.stepperBtn,
                        { backgroundColor: theme.surfaceRaised, opacity: c.level >= maxLevel ? 0.4 : 1 },
                      ]}
                    >
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>

            <View style={{ flex: isPhone ? undefined : 1 }}>
              {c.subclassName ? (
                isSrd ? (
                  <Text
                    style={{
                      color: theme.accentHover,
                      fontSize: 12,
                      flexWrap: "wrap",
                      fontWeight: "600",
                      marginTop: isPhone ? 0 : 2,
                    }}
                  >
                    Archetype: {c.subclassName}
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={() =>
                      setChangingSubclassFor(
                        changingSubclassFor === c.className
                          ? null
                          : c.className,
                      )
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginTop: isPhone ? 0 : 2,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.accentHover,
                        fontSize: 12,
                        flexWrap: "wrap",
                        fontWeight: "600",
                      }}
                    >
                      Archetype: {c.subclassName}
                    </Text>
                    <Ionicons
                      name="pencil-outline"
                      size={13}
                      color={theme.accentHover}
                    />
                  </TouchableOpacity>
                )
              ) : null}
            </View>

            {!isPhone && (
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => removeClassLevel(c.className)}
                  disabled={!canLowerTo(c.level, classIndex)}
                  accessibilityRole="button"
                  accessibilityLabel={`Lower ${c.className} level`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.stepperBtn,
                    { backgroundColor: theme.surfaceRaised, opacity: !canLowerTo(c.level, classIndex) ? 0.4 : 1 },
                  ]}
                >
                  <Ionicons name="remove" size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.levelNum, { color: theme.text }]}>
                  {c.level}
                </Text>
                {canRaiseLevel ? (
                  <TouchableOpacity
                    onPress={() => handleAddClassLevel(c.className, c.source)}
                    disabled={c.level >= maxLevel}
                    accessibilityRole="button"
                    accessibilityLabel={`Raise ${c.className} level`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: theme.surfaceRaised, opacity: c.level >= maxLevel ? 0.4 : 1 },
                    ]}
                  >
                    <Ionicons name="add" size={20} color={theme.text} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </Card>
  );
};
