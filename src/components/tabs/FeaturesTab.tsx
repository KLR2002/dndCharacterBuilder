import React, { useMemo, useState } from "react";
import {
  Modal as RNModal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  findRace,
  getBackgrounds,
  getClasses,
  getFeats,
  getRaces,
  getOptionsAndFeatures,
} from "../../services/dataService";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { setOptionalFeatureEnabled } from "../../rules/builderTransitions";
import { currentCompendium } from "../../services/compendium";
import { findClassData } from "../../rules/catalogs";
import {
  getAvailableOptionalFeatures,
  getReplacedBaseFeatures,
} from "../../rules/optionalFeatures";
import { adoptWildShape, getWildShapeLimits } from "../../rules/wildShape";
import { describeClassFeature } from "../../rules/featureOptions";
import { ResourceCounter } from "../../types/character";
import type { BeastData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { WildShapeModal } from "../WildShapeModal";
import { ActiveWildShapeCard } from "../ActiveWildShapeCard";
import { applyRuleChoice, findArtificerInfusion, getChosenInvocations, getKnownInfusions, replacedTraitNames, ruleChoiceId } from "../../rules/ruleChoices";
import { ActiveInfusionsSection } from "../ActiveInfusionsSection";

interface FeatureDisplay {
  id: string;
  name: string;
  origin: "Race" | "Background" | "Class" | "Subclass" | "Feat";
  source?: string;
  description: string;
  /** The Rule Choice option this trait resolves to, when one is chosen. */
  chosenOption?: string;
  badge?: string;
}

function makeCounterId(): string {
  return `counter_${Date.now()}`;
}

export const FeaturesTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks, setActiveBooks } = useCharacters();
  const { theme } = useAppTheme();
  useResponsiveLayout();

  const [customCounterModal, setCustomCounterModal] = useState(false);
  const [newCounterName, setNewCounterName] = useState("");
  const [newCounterMax, setNewCounterMax] = useState("3");
  const [newCounterReset, setNewCounterReset] = useState<"short" | "long">("long");

  const [wildShapeModalVisible, setWildShapeModalVisible] = useState(false);

  const isMmActive = useMemo(
    () => (activeBooks || []).some((b) => b.toUpperCase() === "MM"),
    [activeBooks]
  );

  const handleEnableMonsterManual = () => {
    if (isMmActive) return;
    const current = activeBooks || [];
    setActiveBooks([...current, "MM"]);
  };

  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  const wildShapeLimits = useMemo(() => {
    if (!currentCharacter) return null;
    return getWildShapeLimits(currentCharacter);
  }, [currentCharacter]);

  const evaluated = useMemo(() => {
    if (!currentCharacter) return null;
    return evaluateCharacter(currentCharacter, { compendium: currentCompendium(), activeBooks });
  }, [currentCharacter, activeBooks]);

  // Unified Resource Counters from evaluated model
  const allCounters = useMemo(() => {
    return evaluated?.featureCounters ?? {};
  }, [evaluated]);

  // Compile Features by Origin
  const originFeatures = useMemo(() => {
    if (!currentCharacter) return [];
    const list: FeatureDisplay[] = [];

    // 1. Race / Lineage Features
    if (currentCharacter.lineageReplacement) {
      const lineageData = findRace(currentCharacter.lineageReplacement);
      if (lineageData?.traits) {
        for (const trait of lineageData.traits) {
          list.push({
            id: `lineage_${trait.name}`,
            name: `${trait.name} (${lineageData.name})`,
            origin: "Race",
            source: lineageData.name,
            description: trait.description || "Lineage trait.",
          });
        }
      }
    } else if (currentCharacter.race) {
      const raceData = findRace(currentCharacter.race.name, currentCharacter.race.source);
      // A trait a recorded choice replaced must not appear at all, and the
      // Features tab builds its own list rather than going through
      // grantedFeatures, so suppression is applied here too.
      const suppressed = replacedTraitNames(currentCharacter, getRaces(activeBooks));
      const raceChoiceId = (trait: string) =>
        ruleChoiceId({ source: raceData?.source ?? currentCharacter.race!.source, race: currentCharacter.race!.name, subrace: null, trait });
      if (raceData?.traits) {
        for (const trait of raceData.traits) {
          if (suppressed.has(trait.name)) continue;
          const resolved = applyRuleChoice(currentCharacter, { ...trait, description: trait.description || "Racial trait." }, trait.choice, raceChoiceId(trait.name));
          list.push({
            id: `race_${trait.name}`,
            name: trait.name,
            origin: "Race",
            source: raceData.name,
            description: resolved.description,
            chosenOption: resolved.chosenOption,
          });
        }
      }
      if (currentCharacter.race.subraceName && raceData?.subraces) {
        const subraceData = raceData.subraces.find(
          (s) =>
            s.name === currentCharacter.race?.subraceName &&
            (!currentCharacter.race?.subraceSource || s.source === currentCharacter.race.subraceSource)
        );
        if (subraceData?.traits) {
          const subraceChoiceId = (trait: string) =>
            ruleChoiceId({
              source: subraceData.source,
              race: currentCharacter.race!.name,
              subrace: { name: subraceData.name },
              trait,
            });
          for (const trait of subraceData.traits) {
            if (suppressed.has(trait.name)) continue;
            const resolved = applyRuleChoice(
              currentCharacter,
              { ...trait, description: trait.description || "Subrace trait." },
              trait.choice,
              subraceChoiceId(trait.name)
            );
            list.push({
              id: `subrace_${trait.name}`,
              name: `${trait.name} (${subraceData.name})`,
              origin: "Race",
              source: `${subraceData.name} ${raceData.name}`,
              description: resolved.description,
              chosenOption: resolved.chosenOption,
            });
          }
        }
      }
    }

    // 2. Background Features
    if (currentCharacter.background) {
      if (currentCharacter.background.isCustom) {
        list.push({
          id: "bg_custom",
          name: currentCharacter.background.customFeatureName || "Custom Background Feature",
          origin: "Background",
          description: currentCharacter.background.customFeatureDesc || "Custom feature description.",
        });
      } else {
        const bgs = getBackgrounds(activeBooks);
        const bgData = bgs.find((b) => b.name === currentCharacter.background?.name);
        if (bgData?.feature) {
          list.push({
            id: `bg_${bgData.feature.name}`,
            name: bgData.feature.name,
            origin: "Background",
            source: bgData.source,
            description: bgData.feature.description || "Background feature.",
          });
        }
      }
    }

    const replacedBaseFeatures = getReplacedBaseFeatures(currentCharacter.optionalFeatureReplacements);

    // 3. Class Features
    for (const c of currentCharacter.classes || []) {
      const classData = findClassData(currentCompendium().for().classes(), c);
      if (classData?.features) {
        for (const cf of classData.features) {
          if (cf.level <= c.level) {
            const isOptEnabled = Boolean(currentCharacter.optionalFeatureReplacements?.[cf.name]);
            if (cf.isOptional) {
              if (!isOptEnabled) continue;
            } else {
              if (replacedBaseFeatures.has(cf.name)) continue;
            }
            const description = describeClassFeature(
              cf,
              classData.source,
              activeBooks,
              `A ${c.className} feature gained at level ${cf.level}.`
            );
            list.push({
              id: `class_${c.className}_${cf.name}_${cf.level}`,
              name: `${cf.name} (Lvl ${cf.level})`,
              origin: "Class",
              source: c.className,
              description,
            });
          }
        }
      }

      // 3b. Eldritch Invocations
      if (c.className === "Warlock") {
        const chosenInvocations = getChosenInvocations(currentCharacter);
        if (chosenInvocations.length > 0) {
          const allOptions = getOptionsAndFeatures(activeBooks);
          for (const invName of chosenInvocations) {
            const invData = allOptions.find(
              (o) =>
                o.name.toLowerCase().trim() === invName.toLowerCase().trim() &&
                ((o.category && o.category.includes("Invocation")) || (o.featureType && o.featureType.includes("EI")))
            );
            const prereqLabel = invData?.prerequisite ? `Prereq: ${invData.prerequisite}` : undefined;
            list.push({
              id: `invocation_${invName}`,
              name: `Invocation: ${invName}`,
              origin: "Class",
              source: "Warlock",
              description: invData?.description || "Eldritch Invocation.",
              badge: prereqLabel,
              chosenOption: prereqLabel,
            });
          }
        }
      }

      // 3c. Artificer Infusions
      if (c.className === "Artificer" && c.level >= 2) {
        const knownInfusions = getKnownInfusions(currentCharacter);
        const activeInfusions = currentCharacter.activeInfusions || [];
        for (const infName of knownInfusions) {
          const activeEntry = activeInfusions.find(
            (a) => a.infusionName.toLowerCase() === infName.toLowerCase()
          );
          const def = findArtificerInfusion(infName);
          const badge = activeEntry
            ? activeEntry.targetItemName
              ? `Active (Infused: ${activeEntry.targetItemName})`
              : "Active"
            : undefined;

          list.push({
            id: `infusion_${infName}`,
            name: `Infusion: ${infName}`,
            origin: "Class",
            source: "Artificer",
            description: def?.description || "Artificer Infusion.",
            badge,
            chosenOption: badge,
          });
        }
      }

      // 4. Subclass Features
      if (c.subclassName && classData?.subclasses) {
        const sc = classData.subclasses.find((s) => s.name === c.subclassName);
        if (sc?.features) {
          for (const sf of sc.features) {
            if (sf.level <= c.level) {
              const isOptEnabled = Boolean(currentCharacter.optionalFeatureReplacements?.[sf.name]);
              if (sf.isOptional) {
                if (!isOptEnabled) continue;
              } else {
                if (replacedBaseFeatures.has(sf.name)) continue;
              }
              list.push({
                id: `sc_${c.subclassName}_${sf.name}_${sf.level}`,
                name: `${sf.name} (Lvl ${sf.level})`,
                origin: "Subclass",
                source: c.subclassName,
                description: describeClassFeature(
                  sf,
                  sc.source,
                  activeBooks,
                  `A ${c.subclassName} archetype feature gained at level ${sf.level}.`
                ),
              });
            }
          }
        }
      }
    }

    // 5. Feats
    if (currentCharacter.asiSelections) {
      const allFeats = getFeats(activeBooks);
      for (const asi of currentCharacter.asiSelections) {
        if (asi.type === "feat" && asi.featName) {
          const fData = allFeats.find((f) => f.name === asi.featName);
          list.push({
            id: `feat_${asi.featName}_${asi.level}`,
            name: `${asi.featName} (Feat, Lvl ${asi.level})`,
            origin: "Feat",
            source: asi.featSource || "PHB",
            description: fData?.description || "Feat benefits.",
          });
        }
      }
    }

    return list;
  }, [currentCharacter, activeBooks]);

  const availableOptional = useMemo(() => {
    if (!currentCharacter) return [];
    const allClasses = getClasses(activeBooks);
    return getAvailableOptionalFeatures(currentCharacter, allClasses);
  }, [currentCharacter, activeBooks]);

  const groupedByOrigin = useMemo(() => {
    const origins: ("Class" | "Subclass" | "Race" | "Background" | "Feat")[] = [
      "Class",
      "Subclass",
      "Race",
      "Background",
      "Feat",
    ];
    return origins.map((org) => ({
      origin: org,
      items: originFeatures.filter((f) => f.origin === org),
    }));
  }, [originFeatures]);

  if (!currentCharacter) return null;

  const updateCounterValue = (id: string, delta: number) => {
    const c = allCounters[id];
    if (!c) return;
    const next = Math.min(c.max, Math.max(0, c.current + delta));
    updateCharacter(currentCharacter.id, {
      resourceCounters: {
        ...allCounters,
        [id]: { ...c, current: next },
      },
    });
  };

  const addCustomCounter = () => {
    if (!newCounterName.trim()) return;
    const max = parseInt(newCounterMax, 10) || 1;
    const id = makeCounterId();
    const newCounter: ResourceCounter = {
      id,
      name: newCounterName.trim(),
      current: max,
      max,
      resetOn: newCounterReset,
    };
    updateCharacter(currentCharacter.id, {
      resourceCounters: {
        ...allCounters,
        [id]: newCounter,
      },
    });
    setNewCounterName("");
    setNewCounterMax("3");
    setCustomCounterModal(false);
  };

  const handleAdoptShape = (beast: BeastData) => {
    if (!currentCharacter) return;
    const patch = adoptWildShape(currentCharacter, beast);
    if (!patch) return;
    updateCharacter(currentCharacter.id, patch);
  };

  const handleToggleFavoriteBeast = (beastKey: string) => {
    if (!currentCharacter) return;
    const existing = new Set(currentCharacter.favoriteWildShapes || []);
    if (existing.has(beastKey)) {
      existing.delete(beastKey);
    } else {
      existing.add(beastKey);
    }
    updateCharacter(currentCharacter.id, {
      favoriteWildShapes: Array.from(existing),
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Interactive Resource Counters Card */}
      <Card style={styles.countersCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>RESOURCE TRACKERS</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Charges reset on Short / Long Rest
            </Text>
          </View>
          <Button
            title="Custom"
            icon="add"
            size="sm"
            variant="outline"
            onPress={() => setCustomCounterModal(true)}
          />
        </View>

        <View style={{ gap: 8 }}>
          {Object.values(allCounters).length === 0 ? (
            <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 8 }}>
              No active resource charges. Add a custom tracker above.
            </Text>
          ) : (
            Object.values(allCounters).map((c) => {
              const isUnlimited =
                (c.id === "rage" &&
                  (c.max >= 999 ||
                    (currentCharacter.classes || []).some(
                      (cl) => cl.className === "Barbarian" && cl.level >= 20
                    ))) ||
                (c.id === "wild_shape" &&
                  (c.max >= 999 ||
                    (currentCharacter.classes || []).some(
                      (cl) => cl.className === "Druid" && cl.level >= 20
                    )));

              return (
                <View
                  key={c.id}
                  style={[styles.counterRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.counterName, { color: theme.text }]}>{c.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Badge label={`Resets on ${c.resetOn} rest`} size="sm" variant="secondary" />
                    </View>
                  </View>

                  {/* Stepper Controls */}
                  <View style={styles.counterStepper}>
                    <TouchableOpacity
                      onPress={() => updateCounterValue(c.id, -1)}
                      disabled={isUnlimited || c.current <= 0}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}>
                      <Ionicons
                        name="remove"
                        size={16}
                        color={isUnlimited || c.current <= 0 ? theme.textMuted : theme.text}
                      />
                    </TouchableOpacity>

                    <View style={styles.counterCountBox}>
                      <Text style={[styles.counterCurrent, { color: c.current > 0 ? theme.accent : theme.danger }]}>
                        {isUnlimited ? "∞" : c.current}
                      </Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {" "}
                        / {isUnlimited ? "∞" : c.max}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => updateCounterValue(c.id, 1)}
                      disabled={isUnlimited || c.current >= c.max}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}>
                      <Ionicons
                        name="add"
                        size={16}
                        color={isUnlimited || c.current >= c.max ? theme.textMuted : theme.text}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Card>

      {/* Wild Shape Section (Druid Level >= 2) */}
      {wildShapeLimits?.hasWildShape && (
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 2 }]}>
                WILD SHAPE
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                {wildShapeLimits.isMoonDruid ? "Circle of the Moon (Circle Forms)" : "Beast Shapes"}
              </Text>
            </View>
            <Button
              title="Browse Beast Shapes"
              variant="primary"
              size="sm"
              onPress={() => setWildShapeModalVisible(true)}
            />
          </View>

          {/* Limits Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: currentCharacter.activeWildShape ? 12 : 0 }}>
            <Badge label={`Max CR: ${wildShapeLimits.maxCrDisplay}`} variant="accent" size="sm" />
            <Badge
              label={
                wildShapeLimits.canFly
                  ? "Swim & Fly Allowed"
                  : wildShapeLimits.canSwim
                  ? "Swim Allowed • No Fly"
                  : "No Swim • No Fly"
              }
              variant="secondary"
              size="sm"
            />
            <Badge label={`${wildShapeLimits.maxDurationHours}h duration`} variant="secondary" size="sm" />
            {wildShapeLimits.canElemental && (
              <Badge label="Elemental Wild Shape (2 Uses)" variant="warning" size="sm" />
            )}
          </View>

          {/* Monster Manual Inactive Warning (Integrated Catalog only; the SRD Baseline carries its own beasts) */}
          {currentCompendium().integrated && !isMmActive && (
            <Card
              style={{
                padding: 10,
                marginTop: 8,
                backgroundColor: theme.warning + "15",
                borderColor: theme.warning + "60",
                borderWidth: 1,
              }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="warning-outline" size={18} color={theme.warning} />
                  <Text style={{ color: theme.text, fontSize: 12, flex: 1 }}>
                    Monster Manual is not active in Active Books. Most beast shapes will not appear.
                  </Text>
                </View>
                <Button
                  title="Enable MM"
                  size="sm"
                  variant="outline"
                  onPress={handleEnableMonsterManual}
                />
              </View>
            </Card>
          )}

          <ActiveWildShapeCard character={currentCharacter} />
        </Card>
      )}

      {/* Active Infusions Section (Artificer) */}
      <ActiveInfusionsSection />

      {/* Optional & Replacement Features Section */}
      {availableOptional.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ marginBottom: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>OPTIONAL & REPLACEMENT FEATURES</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Enable Tasha&apos;s Cauldron of Everything and variant feature replacements
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {availableOptional.map((opt) => {
              const isActive = Boolean(currentCharacter.optionalFeatureReplacements?.[opt.name]);
              return (
                <Card key={opt.id} style={{ padding: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>{opt.name}</Text>
                        <Badge label={`Lvl ${opt.level} ${opt.className}`} variant="secondary" size="sm" />
                        {opt.isReplacement ? (
                          <Badge label={`Replaces: ${opt.replacesFeatureName}`} variant="warning" size="sm" />
                        ) : (
                          <Badge label="Optional" variant="accent" size="sm" />
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Button
                        title="Info"
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          setDetailModal({
                            visible: true,
                            title: opt.name,
                            subtitle: opt.isReplacement ? `Replaces: ${opt.replacesFeatureName}` : "Optional Feature",
                            content: opt.description,
                          })
                        }
                      />
                      <Button
                        title={isActive ? "Enabled" : "Disabled"}
                        variant={isActive ? "primary" : "outline"}
                        size="sm"
                        onPress={() => {
                          updateCharacter(currentCharacter.id, (c) =>
                            setOptionalFeatureEnabled(c, opt.name, !isActive, currentCompendium(), { activeBooks }),
                          );
                        }}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      )}

      {/* Origin Grouped Features */}
      {groupedByOrigin.map(({ origin, items }) => {
        if (items.length === 0) return null;

        return (
          <View key={origin} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Badge label={origin} variant="accent" size="sm" />
              <Text style={[styles.originHeaderTitle, { color: theme.textSecondary }]}>
                {origin.toUpperCase()} FEATURES ({items.length})
              </Text>
            </View>

            <Card style={{ padding: 4 }}>
              {items.map((feat, idx) => (
                <TouchableOpacity
                  key={feat.id}
                  onPress={() =>
                    setDetailModal({
                      visible: true,
                      title: feat.name,
                      subtitle: `${feat.origin} • ${feat.source || ""}${feat.badge ? ` • ${feat.badge}` : ""}`,
                      content: feat.description,
                    })
                  }
                  style={[
                    styles.featureItemRow,
                    {
                      borderBottomColor: theme.border,
                      borderBottomWidth: idx === items.length - 1 ? 0 : 1,
                    },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={[styles.featureTitle, { color: theme.text }]}>{feat.name}</Text>
                      {feat.badge ? (
                        <Badge label={feat.badge} variant="outline" size="sm" />
                      ) : feat.chosenOption ? (
                        <Badge label={feat.chosenOption} variant="success" size="sm" />
                      ) : null}
                    </View>
                    <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={2}>
                      {feat.description.replace(/\n/g, " ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        );
      })}

      {/* Custom Counter Modal */}
      <RNModal visible={customCounterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>
              Add Resource Counter
            </Text>

            <Text style={styles.fieldLabel}>Counter Name *</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={newCounterName}
              onChangeText={setNewCounterName}
              placeholder="e.g. Superiority Dice, Favored Foe"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Maximum Uses *</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={newCounterMax}
              onChangeText={setNewCounterMax}
              keyboardType="number-pad"
              placeholder="4"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Recharges On</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => setNewCounterReset("short")}
                style={[
                  styles.resetOptionBtn,
                  {
                    backgroundColor: newCounterReset === "short" ? theme.accent : theme.surfaceHighlight,
                    borderColor: theme.border,
                  },
                ]}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Short Rest</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setNewCounterReset("long")}
                style={[
                  styles.resetOptionBtn,
                  {
                    backgroundColor: newCounterReset === "long" ? theme.accent : theme.surfaceHighlight,
                    borderColor: theme.border,
                  },
                ]}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Long Rest</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="secondary" size="sm" onPress={() => setCustomCounterModal(false)} />
              <Button title="Save Counter" variant="primary" size="sm" onPress={addCustomCounter} />
            </View>
          </Card>
        </View>
      </RNModal>

      {/* Detail Modal */}
      <DetailModal
        visible={detailModal.visible}
        title={detailModal.title}
        subtitle={detailModal.subtitle}
        content={detailModal.content}
        onClose={() => setDetailModal({ visible: false, title: "", content: "" })}
      />

      {/* Wild Shape Browser Modal */}
      <WildShapeModal
        visible={wildShapeModalVisible}
        onClose={() => setWildShapeModalVisible(false)}
        character={currentCharacter}
        onAdoptShape={handleAdoptShape}
        onToggleFavorite={handleToggleFavoriteBeast}
        activeBooks={activeBooks}
        onEnableMonsterManual={handleEnableMonsterManual}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  countersCard: {
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  counterName: {
    fontSize: 14,
    fontWeight: "600",
  },
  counterStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  counterCountBox: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 50,
    justifyContent: "center",
  },
  counterCurrent: {
    fontSize: 18,
    fontWeight: "bold",
  },
  originHeaderTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  featureItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 4,
  },
  input: {
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  resetOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
});
