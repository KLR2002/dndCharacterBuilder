import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey, Character } from "../../types/character";
import { ClassData, FeatData } from "../../types/dnd5e";
import {
  applySoleSubclasses,
  changeSubclass,
  confirmLevelUp,
  removeClassLevel as removeClassLevelTransition,
  validateMulticlass,
} from "../../rules/builderTransitions";
import { reconcile } from "../../rules/characterReconciler";
import { subclassLevel } from "../../rules/leveling";
import { currentCompendium } from "../../services/compendium";
import type { ToolGrant } from "../../rules/proficiencySheet";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { SearchBar } from "../ui/SearchBar";
import { AsiFeatSection, PendingAsiSlot } from "./AsiFeatSection";
import { builderStyles as styles, RuleChoicePicker, SkillPicker } from "./builderStyles";
import { normalizeSkillName } from "../../rules/skills";
import { findClassData, type CharacterCatalogs } from "../../rules/catalogs";
import { StartingGrantsSection } from "./StartingGrantsSection";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  offeredRuleChoices,
  pickRuleChoice,
  isManeuverChoiceId,
  isInvocationChoiceId,
  isInfusionChoiceId,
  pickedOptionNames,
  AvailableRuleChoice,
} from "../../rules/ruleChoices";
import { getOrphanedSubclassSpells } from "../../rules/subclassSpells";
import { proficiencyChoiceOffers } from "../../rules/proficiencyChoiceOffers";
import { clearProficiencyPick } from "../../rules/proficiencyPools";
import {
  getAvailableExpertiseMilestones,
  getMilestonePicks,
  toggleExpertiseChoice,
} from "../../rules/expertise";

export interface ClassProgressionSectionProps {
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  fullHealOnLevelUp: boolean;
  allClasses: ClassData[];
  allFeats: FeatData[];
  totalLevel: number;
  effectiveScores: Record<AbilityKey, number>;
  skillChoices: { source: string; choose: number; from: string[] }[];
  autoGranted: string[];
  toggleSkill: (skill: string, source?: string) => void;
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
  onClaimAgain: () => void;
  onViewDetail: (item: { title: string; subtitle?: string; source?: string; description?: string; tags?: string[] }) => void;
  theme: any;
  activeBooks?: string[];
}

export const ClassProgressionSection: React.FC<ClassProgressionSectionProps> = ({
  character,
  onUpdate,
  fullHealOnLevelUp,
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
  onClaimAgain,
  onViewDetail,
  theme,
  activeBooks,
}) => {
  const { isPhone } = useResponsiveLayout();
  const [classSearch, setClassSearch] = useState("");
  const [changingSubclassFor, setChangingSubclassFor] = useState<string | null>(null);
  const [orphanWarning, setOrphanWarning] = useState<{
    visible: boolean;
    className: string;
    newSubclass: string;
    newSource: string;
    orphaned: string[];
  } | null>(null);
  const hasAnyClass = (character.classes || []).length > 0;
  // Two listed classes can share a name (the same class from two sources). Only then is a source shown.
  const sharedClassNames = new Set(
    allClasses.map((cl) => cl.name).filter((name, index, names) => names.indexOf(name) !== index)
  );
  // SRD mode has exactly one subclass per class, so there is no choice to offer: it is applied instead.
  const isSrd = !currentCompendium().integrated;

  // Re-runs on a compendium mode switch too (isSrd), since the sole subclass depends on the compendium.
  useEffect(() => {
    const next = applySoleSubclasses(character, currentCompendium());
    if (next !== character) {
      onUpdate((current) => applySoleSubclasses(current, currentCompendium()));
    }
  }, [character, isSrd, onUpdate]);

  const handleAddClassLevel = (className: string, source: string) => {
    onUpdate((current) => confirmLevelUp(current, className, source, fullHealOnLevelUp));
  };

  const removeClassLevel = (className: string) => {
    onUpdate(removeClassLevelTransition(character, className, currentCompendium()));
  };

  const selectSubclass = (className: string, subclassName: string, subclassSource: string) => {
    const existing = character.classes.find((c) => c.className === className);
    const oldSubclass = existing?.subclassName || existing?.subclass;

    if (oldSubclass && oldSubclass !== subclassName) {
      const orphaned = getOrphanedSubclassSpells(
        character,
        className,
        oldSubclass,
        subclassName,
        activeBooks
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
    unlearnOrphaned?: string[]
  ) => {
    onUpdate(
      changeSubclass(character, className, newSubclassName, subclassSource, unlearnOrphaned, currentCompendium())
    );
    setChangingSubclassFor(null);
    setOrphanWarning(null);
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text style={[styles.bannerTitle, { color: theme.text, flexShrink: 1 }]}>
            Total Level: <Text style={{ color: theme.accent }}>{totalLevel}</Text>
          </Text>
          <Badge label={`Prof +${Math.floor((totalLevel - 1) / 4) + 2}`} variant="accent" />
        </View>
        {character.classes.map((c) => {
          const cd = findClassData(currentCompendium().for().classes(), c);
          const subReq = subclassLevel(c.className);
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
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}
                    >
                      <Ionicons name="remove" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.levelNum, { color: theme.text }]}>{c.level}</Text>
                    <TouchableOpacity
                      onPress={() => handleAddClassLevel(c.className, c.source)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}
                    >
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={{ flex: isPhone ? undefined : 1 }}>
                {c.subclassName ? (
                  isSrd ? (
                    <Text style={{ color: theme.accent, fontSize: 12, flexWrap: "wrap", fontWeight: "600", marginTop: isPhone ? 0 : 2 }}>
                      Archetype: {c.subclassName}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() =>
                        setChangingSubclassFor(
                          changingSubclassFor === c.className ? null : c.className
                        )
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: isPhone ? 0 : 2 }}
                    >
                      <Text style={{ color: theme.accent, fontSize: 12, flexWrap: "wrap", fontWeight: "600" }}>
                        Archetype: {c.subclassName}
                      </Text>
                      <Ionicons name="pencil-outline" size={13} color={theme.accent} />
                    </TouchableOpacity>
                  )
                ) : (
                  <Text style={{ color: theme.accent, fontSize: 12, marginTop: isPhone ? 0 : 2, flexWrap: "wrap" }}>
                    Subclass at Lvl {subReq}
                  </Text>
                )}
              </View>

              {!isPhone && (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    onPress={() => removeClassLevel(c.className)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}
                  >
                    <Ionicons name="remove" size={20} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.levelNum, { color: theme.text }]}>{c.level}</Text>
                  <TouchableOpacity
                    onPress={() => handleAddClassLevel(c.className, c.source)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

      {/* Subclass prompts & Change pickers */}
      {character.classes.map((c) => {
        const cd = findClassData(currentCompendium().for().classes(), c);
        const req = subclassLevel(c.className);
        const isChanging = changingSubclassFor === c.className;
        const needsChoice = !c.subclassName;
        if (!isSrd && c.level >= req && (needsChoice || isChanging) && cd?.subclasses?.length) {
          return (
            <Card key={`sub_${c.className}`} style={{ gap: 8, borderColor: isChanging ? theme.accent : theme.warning }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ color: isChanging ? theme.accent : theme.warning, fontWeight: "700", fontSize: 14, flexShrink: 1 }}>
                  {needsChoice ? "⚠️ " : ""}Choose Subclass for {c.className} (Level {c.level})
                </Text>
                {isChanging && (
                  <TouchableOpacity
                    onPress={() => setChangingSubclassFor(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {cd.subclasses
                  .filter((sub: any) => {
                    if (!activeBooks || activeBooks.length === 0) return true;
                    if (!sub.source) return true;
                    return activeBooks.map((b) => b.toUpperCase()).includes(sub.source.toUpperCase());
                  })
                  .map((sub: any) => {
                  const isCurrent = c.subclassName === sub.name;
                  return (
                    <TouchableOpacity
                      key={sub.name}
                      onPress={() => selectSubclass(c.className, sub.name, sub.source)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.subclassChip,
                        {
                          backgroundColor: isCurrent ? theme.accentGlow : theme.surfaceHighlight,
                          borderColor: isCurrent ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isCurrent ? theme.accent : theme.text,
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

      {/* Modular Progression & Class/Subclass Rule Choices */}
      {(() => {
        const allSubclassChoices = [
          ...offeredRuleChoices(character, { activeBooks, origins: ["class", "subclass"] }),
          ...proficiencyChoiceOffers(character, { activeBooks }),
        ];
        if (allSubclassChoices.length === 0) return null;

        const isFightingStyle = (id: string) =>
          id.includes("Fighting Style") ||
          id.includes("Blessed Warrior") ||
          id.includes("Druidic Warrior");

        const isManeuver = (id: string) =>
          isManeuverChoiceId(id) ||
          id.includes("Maneuver") ||
          id.includes("Superior Technique");

        const isWarlockModular = (id: string) =>
          id.includes("Pact Boon") ||
          id.includes("Pact of the Tome") ||
          id.includes("Ancient Secrets") ||
          id.includes("Mystic Arcanum") ||
          isInvocationChoiceId(id);

        const isInfusion = (id: string) =>
          isInfusionChoiceId(id);

        const fightingStyleChoices = allSubclassChoices.filter((c) => isFightingStyle(c.id));
        const maneuverChoices = allSubclassChoices.filter((c) => isManeuver(c.id));
        const warlockChoices = allSubclassChoices.filter((c) => isWarlockModular(c.id));
        const infusionChoices = allSubclassChoices.filter((c) => isInfusion(c.id));
        const otherChoices = allSubclassChoices.filter(
          (c) =>
            !isFightingStyle(c.id) &&
            !isManeuver(c.id) &&
            !isWarlockModular(c.id) &&
            !isInfusion(c.id)
        );

        const handleClearChoice = (choice: AvailableRuleChoice) => {
          onUpdate((cur) => {
            const next: Character =
              choice.pick === "proficiency"
                ? clearProficiencyPick(cur, choice.id)
                : { ...cur, ruleChoices: (cur.ruleChoices || []).filter((rc) => rc.id !== choice.id) };
            return reconcile(next, currentCompendium(), { activeBooks });
          });
        };

        const renderChoiceCard = (
          key: string,
          title: string,
          subtitle: string,
          choices: AvailableRuleChoice[],
          badge?: string
        ) => {
          if (choices.length === 0) return null;
          return (
            <Card key={key} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heading, { color: theme.text }]}>{title}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                    {subtitle}
                  </Text>
                </View>
                {badge && <Badge label={badge} variant="accent" size="sm" />}
              </View>
              {choices.map((choice) => {
                const saved =
                  choice.pick === "proficiency"
                    ? (character.proficiencyPicks?.[choice.id] ?? [])
                    : (character.ruleChoices?.find((rc) => rc.id === choice.id)?.picked ?? []);
                const chosen = pickedOptionNames(saved, choice.options.map((o) => o.name));
                return (
                  <View key={choice.id} style={{ gap: 4 }}>
                    <RuleChoicePicker
                      label={choice.traitName}
                      choose={choice.choose}
                      from={choice.options.map((o) => o.name)}
                      chosen={chosen}
                      onToggle={(option) =>
                        onUpdate((cur) => pickRuleChoice(cur, choice, option))
                      }
                      onClear={() => handleClearChoice(choice)}
                      theme={theme}
                    />
                    {chosen.length > 0 && (
                      <View style={{ gap: 2, marginTop: 2 }}>
                        {chosen.map((cName) => {
                          const opt = choice.options.find((o) => o.name === cName);
                          if (!opt?.description) return null;
                          return (
                            <Text key={cName} style={{ color: theme.textMuted, fontSize: 11 }}>
                              <Text style={{ color: theme.accent, fontWeight: "600" }}>{opt.name}: </Text>
                              {opt.description}
                            </Text>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          );
        };

        return (
          <>
            {renderChoiceCard(
              "prog_fighting_styles",
              "Fighting Styles",
              "Martial specialization granting passive combat bonuses or additional cantrips.",
              fightingStyleChoices,
              "Fighting Style"
            )}
            {renderChoiceCard(
              "prog_maneuvers",
              "Battle Master Maneuvers",
              "Tactical combat maneuvers fueled by your Superiority Dice pool.",
              maneuverChoices,
              "Maneuvers"
            )}
            {renderChoiceCard(
              "prog_warlock",
              "Pact Boon & Eldritch Invocations",
              "Otherworldly gifts and secret eldritch lore granted by your patron.",
              warlockChoices,
              "Warlock"
            )}
            {renderChoiceCard(
              "prog_infusions",
              "Infusions Known",
              "Magical blueprints and item enhancements you know how to produce.",
              infusionChoices,
              "Artificer"
            )}
            {renderChoiceCard(
              "prog_other",
              "Class & Subclass Choices",
              "Specializations, archetypes, and progression grants.",
              otherChoices
            )}
          </>
        );
      })()}

      {/* Expertise Choices (Rogue, Bard, Knowledge Cleric, Ranger Deft Explorer, Feats) */}
      {(() => {
        const catalogs: CharacterCatalogs = { compendium: currentCompendium(), activeBooks };
        const milestones = getAvailableExpertiseMilestones(character, catalogs);
        if (milestones.length === 0) return null;
        const picks = getMilestonePicks(milestones, character.chosenExpertise);
        const allAllowed = new Set(milestones.flatMap((m) => m.options.map((o) => o.toLowerCase())));
        const invalidPicks = (character.chosenExpertise || []).filter(
          (e) => !allAllowed.has(e.toLowerCase())
        );

        return (
          <Card style={{ gap: 12 }}>
            <View>
              <Text style={[styles.heading, { color: theme.text }]}>Expertise</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                Doubled proficiency bonus (2× PB) on chosen proficient skills and tools.
              </Text>
            </View>
            {invalidPicks.length > 0 && (
              <View
                style={{
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: theme.warning,
                  borderWidth: 1,
                  borderRadius: 6,
                  padding: 8,
                  gap: 4,
                }}
              >
                <Text style={{ color: theme.warning, fontSize: 12, fontWeight: "600" }}>
                  ⚠️ Invalid Expertise Warning
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                  The following choices are no longer proficient: {invalidPicks.join(", ")}.
                </Text>
                <TouchableOpacity
                  onPress={() => onUpdate((cur) => reconcile(cur, currentCompendium(), { activeBooks }))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ alignSelf: "flex-start", marginTop: 2 }}
                >
                  <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "700" }}>
                    Prune Invalid Choices
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {picks.map(({ milestone, chosen, from }) => (
              <View key={milestone.id} style={{ gap: 4 }}>
                <RuleChoicePicker
                  label={milestone.label}
                  choose={milestone.count}
                  from={from}
                  chosen={chosen}
                  onToggle={(item) =>
                    onUpdate((cur) => toggleExpertiseChoice(cur, item, catalogs))
                  }
                  theme={theme}
                />
              </View>
            ))}
          </Card>
        );
      })()}

      {/* ASI / Feat Section */}
      <AsiFeatSection
        character={character}
        onUpdate={onUpdate}
        fullHealOnLevelUp={fullHealOnLevelUp}
        pendingAsiSlots={pendingAsiSlots}
        allFeats={allFeats}
        primaryClass={primaryClass}
        onViewDetail={onViewDetail}
        theme={theme}
        activeBooks={activeBooks}
      />

      {/* Starting Grants Section */}
      <StartingGrantsSection
        character={character}
        primaryClass={primaryClass}
        onClaimGold={onClaimGold}
        onClaimEquipment={onClaimEquipment}
        onClaimAgain={onClaimAgain}
        onUpdateOption={(opt) => onUpdate({ startingOption: opt })}
        theme={theme}
      />

      {/* Class skill choices */}
      {skillChoices.filter((sc) => sc.source.startsWith("Class:")).length > 0 && (
        <Card style={{ gap: 10 }}>
          {skillChoices
            .filter((sc) => sc.source.startsWith("Class:"))
            .map((sc) => {
              const choiceEntry = character.skillChoices?.find((c) => c.id === sc.source);
              const normFrom = sc.from.map(normalizeSkillName);
              const normAuto = autoGranted.map(normalizeSkillName);
              const chosen = choiceEntry
                ? choiceEntry.picked
                : (character.chosenSkills || []).filter(
                    (s) => normFrom.includes(normalizeSkillName(s)) && !normAuto.includes(normalizeSkillName(s))
                  );
              return (
                <SkillPicker
                  key={sc.source}
                  label={sc.source}
                  choose={sc.choose}
                  from={sc.from}
                  chosen={chosen}
                  autoGranted={autoGranted}
                  onToggle={(skill) => toggleSkill(skill, sc.source)}
                  theme={theme}
                />
              );
            })}
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
            // A character holds one entry per class name. The held entry belongs to this card when it resolves
            // to this catalog class; when it resolves to the other source of the name, this card is taken.
            const held = character.classes.find((c) => c.className.toLowerCase() === cl.name.toLowerCase());
            const heldClass = held ? findClassData(allClasses, held) : undefined;
            const takenFrom = heldClass && heldClass.source !== cl.source ? heldClass.source : undefined;
            const existing = Boolean(held) && !takenFrom;
            const prereq = takenFrom
              ? { ok: false, reason: `Already held from ${takenFrom}` }
              : existing || !hasAnyClass
                ? { ok: true }
                : validateMulticlass(character, cl.name, effectiveScores);

            return (
              <Card key={`${cl.name}__${cl.source}`}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{cl.name}</Text>
                      {sharedClassNames.has(cl.name) && <Badge label={cl.source} size="sm" />}
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
                    orphanWarning.orphaned
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
                    orphanWarning.newSource
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
            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
              Switching patron to <Text style={{ fontWeight: "700", color: theme.text }}>{orphanWarning.newSubclass}</Text> makes the following known spells illegal under the new patron&apos;s expanded spell list:
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {orphanWarning.orphaned.map((s) => (
                <Badge key={s} label={s} variant="danger" size="md" />
              ))}
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 16 }}>
              You can choose to automatically unlearn these spells now, or keep them to review manually.
            </Text>
          </View>
        </Modal>
      )}
    </View>
  );
};
