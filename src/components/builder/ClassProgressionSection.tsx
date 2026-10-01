import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey, Character, CharacterClass } from "../../types/character";
import { ClassData, FeatData } from "../../types/dnd5e";
import { addMulticlassLevel, validateMulticlass } from "../../rules/builderTransitions";
import { ToolGrant } from "../../rules/proficienciesAndLanguages";
import { findClass } from "../../services/dataService";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchBar } from "../ui/SearchBar";
import { AsiFeatSection, PendingAsiSlot } from "./AsiFeatSection";
import { builderStyles as styles, RuleChoicePicker, SkillPicker } from "./builderStyles";
import { StartingGrantsSection } from "./StartingGrantsSection";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

export interface ClassProgressionSectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  allClasses: ClassData[];
  allFeats: FeatData[];
  totalLevel: number;
  effectiveScores: Record<AbilityKey, number>;
  skillChoices: { source: string; choose: number; from: string[] }[];
  autoGranted: string[];
  toggleSkill: (skill: string) => void;
  classToolGrant: ToolGrant;
  toggleClassTool: (tool: string) => void;
  availableOptionalFeatures: {
    name: string;
    level: number;
    className: string;
    description: string;
    replacesFeatureName?: string;
  }[];
  pendingAsiSlots: PendingAsiSlot[];
  primaryClass?: string;
  onClaimGold: () => void;
  onClaimEquipment: () => void;
  onViewDetail: (item: { title: string; subtitle?: string; source?: string; description?: string; tags?: string[] }) => void;
  theme: any;
}

export const ClassProgressionSection: React.FC<ClassProgressionSectionProps> = ({
  character,
  onUpdate,
  allClasses,
  allFeats,
  totalLevel,
  effectiveScores,
  skillChoices,
  autoGranted,
  toggleSkill,
  classToolGrant,
  toggleClassTool,
  availableOptionalFeatures,
  pendingAsiSlots,
  primaryClass,
  onClaimGold,
  onClaimEquipment,
  onViewDetail,
  theme,
}) => {
  const { isPhone } = useResponsiveLayout();
  const [classSearch, setClassSearch] = useState("");
  const hasAnyClass = (character.classes || []).length > 0;

  const handleAddClassLevel = (className: string, source: string) => {
    onUpdate((current) => addMulticlassLevel(current, className, source));
  };

  const removeClassLevel = (className: string) => {
    const existing = character.classes.find((c) => c.className === className);
    if (!existing) return;
    const updated: CharacterClass[] =
      existing.level <= 1
        ? character.classes.filter((c) => c.className !== className)
        : character.classes.map((c) => (c.className === className ? { ...c, level: c.level - 1 } : c));
    onUpdate({ classes: updated });
  };

  const selectSubclass = (className: string, subclassName: string, subclassSource: string) => {
    onUpdate({
      classes: character.classes.map((c) =>
        c.className === className ? { ...c, subclassName, subclassSource } : c
      ),
    });
  };

  const toggleOptionalFeature = (featureName: string) => {
    const current = character.optionalFeatureReplacements || {};
    onUpdate({
      optionalFeatureReplacements: {
        ...current,
        [featureName]: !current[featureName],
      },
    });
  };

  return (
    <View style={styles.section}>
      {/* Total level card */}
      <Card highlight style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.bannerTitle, { color: theme.text }]}>
            Total Level: <Text style={{ color: theme.accent }}>{totalLevel}</Text>
          </Text>
          <Badge label={`Prof +${Math.floor((totalLevel - 1) / 4) + 2}`} variant="accent" />
        </View>
        {character.classes.map((c) => {
          const cd = findClass(c.className, c.source);
          const subReq = ["Cleric", "Sorcerer", "Warlock"].includes(c.className)
            ? 1
            : ["Druid", "Wizard"].includes(c.className)
            ? 2
            : 3;
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
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flex: isPhone ? undefined : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
                  <Text style={[styles.className, { color: theme.text }]}>{c.className}</Text>
                  <Badge label={cd?.hitDie || "1d8"} size="sm" />
                </View>
                {isPhone && (
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      onPress={() => removeClassLevel(c.className)}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}
                    >
                      <Ionicons name="remove" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.levelNum, { color: theme.text }]}>{c.level}</Text>
                    <TouchableOpacity
                      onPress={() => handleAddClassLevel(c.className, c.source)}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}
                    >
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={{ flex: isPhone ? undefined : 1 }}>
                <Text style={{ color: theme.accent, fontSize: 12, marginTop: isPhone ? 0 : 2, flexWrap: "wrap" }}>
                  {c.subclassName ? `Archetype: ${c.subclassName}` : `Subclass at Lvl ${subReq}`}
                </Text>
              </View>

              {!isPhone && (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    onPress={() => removeClassLevel(c.className)}
                    style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}
                  >
                    <Ionicons name="remove" size={20} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.levelNum, { color: theme.text }]}>{c.level}</Text>
                  <TouchableOpacity
                    onPress={() => handleAddClassLevel(c.className, c.source)}
                    style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}
                  >
                    <Ionicons name="add" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {/* Subclass prompts */}
      {character.classes.map((c) => {
        const cd = findClass(c.className, c.source);
        const req = ["Cleric", "Sorcerer", "Warlock"].includes(c.className)
          ? 1
          : ["Druid", "Wizard"].includes(c.className)
          ? 2
          : 3;
        if (c.level >= req && !c.subclassName && cd?.subclasses?.length) {
          return (
            <Card key={`sub_${c.className}`} style={{ gap: 8, borderColor: theme.warning }}>
              <Text style={{ color: theme.warning, fontWeight: "700", fontSize: 14 }}>
                ⚠️ Choose Subclass for {c.className} (Level {c.level})
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {cd.subclasses.map((sub: any) => (
                  <TouchableOpacity
                    key={sub.name}
                    onPress={() => selectSubclass(c.className, sub.name, sub.source)}
                    style={[styles.subclassChip, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>{sub.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          );
        }
        return null;
      })}

      {/* ASI / Feat Section */}
      <AsiFeatSection
        character={character}
        onUpdate={onUpdate}
        pendingAsiSlots={pendingAsiSlots}
        allFeats={allFeats}
        primaryClass={primaryClass}
        onViewDetail={onViewDetail}
        theme={theme}
      />

      {/* Starting Grants Section */}
      <StartingGrantsSection
        character={character}
        primaryClass={primaryClass}
        onClaimGold={onClaimGold}
        onClaimEquipment={onClaimEquipment}
        onUpdateOption={(opt) => onUpdate({ startingOption: opt })}
        theme={theme}
      />

      {/* Class skill choices */}
      {skillChoices.filter((sc) => sc.source.startsWith("Class:")).length > 0 && (
        <Card style={{ gap: 10 }}>
          {skillChoices
            .filter((sc) => sc.source.startsWith("Class:"))
            .map((sc) => (
              <SkillPicker
                key={sc.source}
                label={sc.source}
                choose={sc.choose}
                from={sc.from}
                chosen={character.chosenSkills}
                autoGranted={autoGranted}
                onToggle={toggleSkill}
                theme={theme}
              />
            ))}
        </Card>
      )}

      {/* Class tool choices & fixed grants */}
      {hasAnyClass && (classToolGrant.fixed.length > 0 || classToolGrant.choices.length > 0) && (
        <Card style={{ gap: 10 }}>
          {classToolGrant.fixed.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                Granted Class Tools:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {classToolGrant.fixed.map((tool) => (
                  <Badge key={tool} label={tool} variant="surface" size="sm" />
                ))}
              </View>
            </View>
          )}
          {classToolGrant.choices.map((ch) => (
            <RuleChoicePicker
              key={ch.key}
              label={ch.label}
              choose={ch.count}
              from={ch.options}
              chosen={character.chosenTools?.class || []}
              autoGranted={classToolGrant.fixed}
              onToggle={toggleClassTool}
              theme={theme}
            />
          ))}
        </Card>
      )}

      {/* Optional & Replacement Class Features (Tasha's) */}
      {hasAnyClass && availableOptionalFeatures.length > 0 && (
        <Card style={{ gap: 10 }}>
          <View>
            <Text style={[styles.heading, { color: theme.text }]}>Optional &amp; Replacement Class Features:</Text>
            <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
              Tasha&apos;s Cauldron optional features and replacements for your classes.
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {availableOptionalFeatures.map((opt) => {
              const isEnabled = Boolean(character.optionalFeatureReplacements?.[opt.name]);
              return (
                <View
                  key={`${opt.className}_${opt.name}`}
                  style={[
                    styles.classRow,
                    {
                      backgroundColor: theme.surfaceHighlight,
                      borderColor: isEnabled ? theme.accent : theme.border,
                      gap: 8,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>{opt.name}</Text>
                      <Badge label={`Lvl ${opt.level}`} size="sm" variant="surface" />
                      <Badge label={opt.className} size="sm" variant="muted" />
                    </View>
                    {opt.replacesFeatureName ? (
                      <Text style={{ color: theme.warning, fontSize: 11, marginTop: 2, fontWeight: "600" }}>
                        Replaces: {opt.replacesFeatureName}
                      </Text>
                    ) : (
                      <Text style={{ color: theme.accent, fontSize: 11, marginTop: 2, fontWeight: "600" }}>
                        Additional Feature
                      </Text>
                    )}
                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={2}>
                      {opt.description}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Button
                      title="Info"
                      variant="ghost"
                      size="sm"
                      onPress={() =>
                        onViewDetail({
                          title: opt.name,
                          subtitle: `${opt.className} Lvl ${opt.level} • ${
                            opt.replacesFeatureName ? `Replaces ${opt.replacesFeatureName}` : "Additional Feature"
                          }`,
                          description: opt.description,
                        })
                      }
                    />
                    <Button
                      title={isEnabled ? "Enabled" : "Enable"}
                      variant={isEnabled ? "primary" : "outline"}
                      size="sm"
                      onPress={() => toggleOptionalFeature(opt.name)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Multiclassing note */}
      {character.classes.length > 1 && (
        <Card style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: theme.accent }}>Multiclassing Rules:</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            • <Text style={{ fontWeight: "bold", color: theme.text }}>Channel Divinity:</Text> Extra classes grant options, not extra uses.
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            • <Text style={{ fontWeight: "bold", color: theme.text }}>Extra Attack:</Text> Does not stack across classes.
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            • <Text style={{ fontWeight: "bold", color: theme.text }}>Unarmored Defense:</Text> Only gained from first class.
          </Text>
        </Card>
      )}

      {/* Class list */}
      <Text style={[styles.heading, { color: theme.text }]}>
        {hasAnyClass ? "Add Class / Multiclass:" : "Choose Your Class:"}
      </Text>
      <SearchBar value={classSearch} onChangeText={setClassSearch} placeholder="Search classes…" />
      <View style={{ gap: 8 }}>
        {allClasses
          .filter((cl) => cl.name.toLowerCase().includes(classSearch.toLowerCase()))
          .map((cl) => {
            const existing = character.classes.some(
              (c) => c.className.toLowerCase() === cl.name.toLowerCase()
            );
            const prereq =
              existing || !hasAnyClass ? { ok: true } : validateMulticlass(character, cl.name, effectiveScores);

            return (
              <Card key={`${cl.name}__${cl.source}`}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{cl.name}</Text>
                      <Badge label={cl.hitDie} size="sm" />
                      {existing && <Badge label="Active" variant="accent" size="sm" />}
                    </View>
                    {!prereq.ok ? (
                      <Text style={{ color: theme.warning, fontSize: 11, marginTop: 2 }}>
                        ⚠️ {prereq.reason}
                      </Text>
                    ) : (
                      <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                        {cl.primaryAbility.join("/")} • Saves: {cl.savingThrows.join(", ")}
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
    </View>
  );
};
