import React, { useState } from "react";
import { Text, View } from "react-native";
import { confirmLevelUp, validateMulticlass } from "../../rules/builderTransitions";
import { findClassData } from "../../rules/catalogs";
import { isCreationFinished } from "../../rules/creationFlow";
import type { AbilityKey, Character, CreationStepId } from "../../types/character";
import type { ClassData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchBar } from "../ui/SearchBar";
import { builderStyles as styles } from "./builderStyles";

export interface ClassListSectionProps {
  character: Character;
  onUpdate: (
    patchOrUpdater: Partial<Character> | ((prev: Character) => Character),
  ) => void;
  fullHealOnLevelUp: boolean;
  allClasses: ClassData[];
  effectiveScores: Record<AbilityKey, number>;
  /** The Creation Step this part is hosted on. Unset in the free-form builder. */
  step?: CreationStepId;
  onViewDetail: (item: {
    title: string;
    subtitle?: string;
    source?: string;
    description?: string;
    tags?: string[];
  }) => void;
  theme: any;
}

/** The Choose or Change Class list: each catalog class with its Info and its Add or +1 Lvl control. */
export const ClassListSection: React.FC<ClassListSectionProps> = ({
  character,
  onUpdate,
  fullHealOnLevelUp,
  allClasses,
  effectiveScores,
  step,
  onViewDetail,
  theme,
}) => {
  const [classSearch, setClassSearch] = useState("");
  const hasAnyClass = (character.classes || []).length > 0;
  // Two listed classes can share a name (the same class from two sources). Only then is a source shown.
  const sharedClassNames = new Set(
    allClasses
      .map((cl) => cl.name)
      .filter((name, index, names) => names.indexOf(name) !== index),
  );

  const handleAddClassLevel = (className: string, source: string) => {
    onUpdate((current) =>
      confirmLevelUp(current, className, source, fullHealOnLevelUp),
    );
  };

  // In the Creation Flow the class list is the Class step's picker: it shows while no class is held and
  // for a draft (which can still change its one class). Edit Build offers no add-class control, so the
  // list stays hidden there.
  const showClassList =
    step === undefined ||
    (step === "class" && (!hasAnyClass || !isCreationFinished(character)));
  if (!showClassList) return null;

  return (
    <>
    <Text style={[styles.heading, { color: theme.text }]}>
      {hasAnyClass ? "Change Class:" : "Choose Your Class:"}
    </Text>
    <SearchBar
      value={classSearch}
      onChangeText={setClassSearch}
      placeholder="Search classes…"
    />
    <View style={{ gap: 8 }}>
      {allClasses
        .filter((cl) =>
          cl.name.toLowerCase().includes(classSearch.toLowerCase()),
        )
        .map((cl) => {
          // A character holds one entry per class name. The held entry belongs to this card when it resolves
          // to this catalog class; when it resolves to the other source of the name, this card is taken.
          const held = character.classes.find(
            (c) => c.className.toLowerCase() === cl.name.toLowerCase(),
          );
          const heldClass = held
            ? findClassData(allClasses, held)
            : undefined;
          const takenFrom =
            heldClass && heldClass.source !== cl.source
              ? heldClass.source
              : undefined;
          const existing = Boolean(held) && !takenFrom;
          const prereq = takenFrom
            ? { ok: false, reason: `Already held from ${takenFrom}` }
            : existing || !hasAnyClass || !isCreationFinished(character)
              ? { ok: true }
              : validateMulticlass(character, cl.name, effectiveScores);

          return (
            <Card key={`${cl.name}__${cl.source}`}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={[styles.itemTitle, { color: theme.text }]}>
                      {cl.name}
                    </Text>
                    {sharedClassNames.has(cl.name) && (
                      <Badge label={cl.source} size="sm" />
                    )}
                    <Badge label={cl.hitDie} size="sm" />
                    {existing && (
                      <Badge label="Active" variant="accent" size="sm" />
                    )}
                  </View>
                  {!prereq.ok ? (
                    <Text
                      style={{
                        color: theme.warning,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      ⚠️ {prereq.reason}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        color: theme.textMuted,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {cl.primaryAbility.join("/")} • Saves:{" "}
                      {cl.savingThrows.join(", ")}
                    </Text>
                  )}
                </View>
                <Button
                  title="Info"
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    onViewDetail({
                      title: cl.name,
                      source: cl.source,
                      description: cl.description,
                      tags: [cl.hitDie, ...cl.savingThrows],
                    })
                  }
                />
                <Button
                  title={existing ? "+1 Lvl" : "Add"}
                  size="sm"
                  disabled={!prereq.ok}
                  onPress={() => handleAddClassLevel(cl.name, cl.source)}
                />
              </View>
            </Card>
          );
        })}
    </View>
    </>
  );
};
