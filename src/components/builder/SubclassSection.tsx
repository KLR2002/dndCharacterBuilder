import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ActiveBooks } from "../../constants/books";
import { changeSubclass } from "../../rules/builderTransitions";
import { catalogListings, findClassData } from "../../rules/catalogs";
import { subclassLevel } from "../../rules/leveling";
import { getOrphanedSubclassSpells } from "../../rules/subclassSpells";
import { currentCompendium } from "../../services/compendium";
import type { Character } from "../../types/character";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { builderStyles as styles } from "./builderStyles";

export interface SubclassSectionProps {
  character: Character;
  onUpdate: (
    patchOrUpdater: Partial<Character> | ((prev: Character) => Character),
  ) => void;
  activeBooks: ActiveBooks;
  theme: any;
}

/** Each class that has reached its subclass level, with its subclass list, and the warning for spells a switch orphans. */
export const SubclassSection: React.FC<SubclassSectionProps> = ({
  character,
  onUpdate,
  activeBooks,
  theme,
}) => {
  const [orphanWarning, setOrphanWarning] = useState<{
    visible: boolean;
    className: string;
    newSubclass: string;
    newSource: string;
    orphaned: string[];
  } | null>(null);
  // SRD mode has exactly one subclass per class, so there is no choice to offer: it is applied instead.
  const isSrd = !currentCompendium().integrated;

  const selectSubclass = (
    className: string,
    subclassName: string,
    subclassSource: string,
  ) => {
    const existing = character.classes.find((c) => c.className === className);
    const oldSubclass = existing?.subclassName || existing?.subclass;

    if (oldSubclass && oldSubclass !== subclassName) {
      const orphaned = getOrphanedSubclassSpells(
        character,
        className,
        oldSubclass,
        subclassName,
        activeBooks,
      );
      if (orphaned.length > 0) {
        setOrphanWarning({
          visible: true,
          className,
          newSubclass: subclassName,
          newSource: subclassSource,
          orphaned,
        });
        return;
      }
    }

    applySubclassChange(className, subclassName, subclassSource);
  };

  const applySubclassChange = (
    className: string,
    newSubclassName: string,
    subclassSource: string,
    unlearnOrphaned?: string[],
  ) => {
    onUpdate(
      changeSubclass(
        character,
        className,
        newSubclassName,
        subclassSource,
        unlearnOrphaned,
        currentCompendium(),
        activeBooks,
      ),
    );
    setOrphanWarning(null);
  };

  const { admits } = catalogListings({ activeBooks });
  return (
    <>
      {character.classes.map((c) => {
        const cd = findClassData(currentCompendium().for().classes(), c);
        const req = subclassLevel(c.className);
        const needsChoice = !c.subclassName;
        if (!isSrd && c.level >= req && cd?.subclasses?.length) {
          return (
            <Card
              key={`sub_${c.className}`}
              style={{
                gap: 8,
                borderColor: needsChoice ? theme.warning : theme.border,
              }}
            >
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
                  style={{
                    color: needsChoice ? theme.warning : theme.text,
                    fontWeight: "700",
                    fontSize: 14,
                    flexShrink: 1,
                  }}
                >
                  {needsChoice ? "⚠️ " : ""}Choose Subclass for {c.className}{" "}
                  (Level {c.level})
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {cd.subclasses
                  .filter((sub: any) => admits(sub.source))
                  .map((sub: any) => {
                    const isCurrent = c.subclassName === sub.name;
                    return (
                      <TouchableOpacity
                        key={sub.name}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isCurrent }}
                        aria-selected={isCurrent}
                        onPress={() => {
                          if (!isCurrent) selectSubclass(c.className, sub.name, sub.source);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[
                          styles.subclassChip,
                          {
                            backgroundColor: isCurrent
                              ? theme.accentGlow
                              : theme.surfaceHighlight,
                            borderColor: isCurrent
                              ? theme.accentHover
                              : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isCurrent ? theme.accentHover : theme.text,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {sub.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </Card>
          );
        }
        return null;
      })}

      {/* Orphaned Expanded List Spells Warning Modal */}
      {orphanWarning && (
        <Modal
          visible={orphanWarning.visible}
          onClose={() => setOrphanWarning(null)}
          title="Expanded List Warning"
          subtitle={`Switching to ${orphanWarning.newSubclass}`}
          footer={
            <View style={{ gap: 8, width: "100%" }}>
              <Button
                title="Unlearn Illegal Spells & Switch"
                variant="primary"
                onPress={() =>
                  applySubclassChange(
                    orphanWarning.className,
                    orphanWarning.newSubclass,
                    orphanWarning.newSource,
                    orphanWarning.orphaned,
                  )
                }
              />
              <Button
                title="Keep for Now (Review Manually)"
                variant="outline"
                onPress={() =>
                  applySubclassChange(
                    orphanWarning.className,
                    orphanWarning.newSubclass,
                    orphanWarning.newSource,
                  )
                }
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setOrphanWarning(null)}
              />
            </View>
          }
        >
          <View style={{ gap: 12 }}>
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              Switching patron to{" "}
              <Text style={{ fontWeight: "700", color: theme.text }}>
                {orphanWarning.newSubclass}
              </Text>{" "}
              makes the following known spells illegal under the new
              patron&apos;s expanded spell list:
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {orphanWarning.orphaned.map((s) => (
                <Badge key={s} label={s} variant="danger" size="md" />
              ))}
            </View>
            <Text
              style={{ color: theme.textMuted, fontSize: 12, lineHeight: 16 }}
            >
              You can choose to automatically unlearn these spells now, or keep
              them to review manually.
            </Text>
          </View>
        </Modal>
      )}
    </>
  );
};
