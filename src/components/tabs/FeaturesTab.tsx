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
  findClass,
  findRace,
  getBackgrounds,
  getClasses,
  getFeats,
} from "../../services/dataService";
import { calculateEffectiveAbilityScores } from "../../services/dndRules";
import {
  getAvailableOptionalFeatures,
  getReplacedBaseFeatures,
} from "../../rules/optionalFeatures";
import { ResourceCounter } from "../../types/character";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { applyRuleChoice, ruleChoiceId } from "../../rules/ruleChoices";

interface FeatureDisplay {
  id: string;
  name: string;
  origin: "Race" | "Background" | "Class" | "Subclass" | "Feat";
  source?: string;
  description: string;
  /** The Rule Choice option this trait resolves to, when one is chosen. */
  chosenOption?: string;
}

function makeCounterId(): string {
  return `counter_${Date.now()}`;
}

export const FeaturesTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  useResponsiveLayout();

  const [customCounterModal, setCustomCounterModal] = useState(false);
  const [newCounterName, setNewCounterName] = useState("");
  const [newCounterMax, setNewCounterMax] = useState("3");
  const [newCounterReset, setNewCounterReset] = useState<"short" | "long">("long");

  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  // Build Default Auto Resource Counters if not already initialized
  const autoCounters: Record<string, ResourceCounter> = useMemo(() => {
    if (!currentCharacter) return {};
    const res: Record<string, ResourceCounter> = {};
    const { modifiers } = calculateEffectiveAbilityScores(currentCharacter);

    for (const c of currentCharacter.classes || []) {
      const lvl = c.level;
      if (c.className === "Barbarian") {
        const maxRage = lvl >= 20 ? 999 : lvl >= 17 ? 6 : lvl >= 12 ? 5 : lvl >= 6 ? 4 : lvl >= 3 ? 3 : 2;
        res["rage"] = { id: "rage", name: "Rage", current: maxRage, max: maxRage, resetOn: "long" };
      }
      if (c.className === "Druid" && lvl >= 2) {
        res["wild_shape"] = { id: "wild_shape", name: "Wild Shape", current: 2, max: 2, resetOn: "short" };
      }
      if (c.className === "Monk" && lvl >= 2) {
        res["ki"] = { id: "ki", name: "Ki Points", current: lvl, max: lvl, resetOn: "short" };
      }
      if (c.className === "Bard") {
        const maxInsp = Math.max(1, modifiers.cha);
        const resetOn = lvl >= 5 ? "short" : "long";
        res["bardic_inspiration"] = { id: "bardic_inspiration", name: "Bardic Inspiration", current: maxInsp, max: maxInsp, resetOn };
      }
      if (c.className === "Fighter") {
        res["second_wind"] = { id: "second_wind", name: "Second Wind", current: 1, max: 1, resetOn: "short" };
        if (lvl >= 2) {
          const maxSurge = lvl >= 17 ? 2 : 1;
          res["action_surge"] = { id: "action_surge", name: "Action Surge", current: maxSurge, max: maxSurge, resetOn: "short" };
        }
      }
      if (c.className === "Paladin") {
        res["lay_on_hands"] = { id: "lay_on_hands", name: "Lay on Hands (HP Pool)", current: lvl * 5, max: lvl * 5, resetOn: "long" };
      }
    }

    // Unified Channel Divinity: Cleric 2: 1, Cleric 6: 2, Cleric 18: 3; Paladin 3: 1. Max uses = max(clericUses, paladinUses).
    const cleric = (currentCharacter.classes || []).find((c) => c.className === "Cleric");
    const paladin = (currentCharacter.classes || []).find((c) => c.className === "Paladin");
    const clericUses = cleric ? (cleric.level >= 18 ? 3 : cleric.level >= 6 ? 2 : cleric.level >= 2 ? 1 : 0) : 0;
    const paladinUses = paladin && paladin.level >= 3 ? 1 : 0;
    const maxCd = Math.max(clericUses, paladinUses);
    if (maxCd > 0) {
      res["channel_divinity"] = {
        id: "channel_divinity",
        name: "Channel Divinity",
        current: maxCd,
        max: maxCd,
        resetOn: "short",
      };
    }

    return res;
  }, [currentCharacter]);

  // Merge auto counters into character state if missing
  const allCounters = useMemo(() => {
    if (!currentCharacter) return {};
    const existing = { ...(currentCharacter.resourceCounters || {}) };
    delete existing["channel_divinity_pal"];
    delete existing["channel_divinity_cle"];
    return { ...autoCounters, ...existing };
  }, [autoCounters, currentCharacter]);

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
      const raceChoiceId = (trait: string) =>
        ruleChoiceId({ source: raceData?.source ?? currentCharacter.race!.source, race: currentCharacter.race!.name, subrace: null, trait });
      if (raceData?.traits) {
        for (const trait of raceData.traits) {
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
      const classData = findClass(c.className, c.source);
      if (classData?.features) {
        for (const cf of classData.features) {
          if (cf.level <= c.level) {
            const isOptEnabled = Boolean(currentCharacter.optionalFeatureReplacements?.[cf.name]);
            if (cf.isOptional) {
              if (!isOptEnabled) continue;
            } else {
              if (replacedBaseFeatures.has(cf.name)) continue;
            }
            list.push({
              id: `class_${c.className}_${cf.name}_${cf.level}`,
              name: `${cf.name} (Lvl ${cf.level})`,
              origin: "Class",
              source: c.className,
              description: cf.description || `A ${c.className} feature gained at level ${cf.level}.`,
            });
          }
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
                description: sf.description || `A ${c.subclassName} archetype feature gained at level ${sf.level}.`,
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Interactive Resource Counters Card */}
      <Card style={styles.countersCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View>
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
              const isBarb20Rage =
                c.id === "rage" &&
                (c.max >= 999 ||
                  (currentCharacter.classes || []).some(
                    (cl) => cl.className === "Barbarian" && cl.level >= 20
                  ));

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
                      disabled={isBarb20Rage || c.current <= 0}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}>
                      <Ionicons
                        name="remove"
                        size={16}
                        color={isBarb20Rage || c.current <= 0 ? theme.textMuted : theme.text}
                      />
                    </TouchableOpacity>

                    <View style={styles.counterCountBox}>
                      <Text style={[styles.counterCurrent, { color: c.current > 0 ? theme.accent : theme.danger }]}>
                        {isBarb20Rage ? "∞" : c.current}
                      </Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {" "}
                        / {isBarb20Rage ? "∞" : c.max}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => updateCounterValue(c.id, 1)}
                      disabled={isBarb20Rage || c.current >= c.max}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}>
                      <Ionicons
                        name="add"
                        size={16}
                        color={isBarb20Rage || c.current >= c.max ? theme.textMuted : theme.text}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Card>

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
                          const updated = {
                            ...(currentCharacter.optionalFeatureReplacements || {}),
                            [opt.name]: !isActive,
                          };
                          updateCharacter(currentCharacter.id, {
                            optionalFeatureReplacements: updated,
                          });
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
                      subtitle: `${feat.origin} • ${feat.source || ""}`,
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
                      {feat.chosenOption ? (
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
