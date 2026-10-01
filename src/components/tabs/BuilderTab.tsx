import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  DND_SKILLS,
  POINT_BUY_COST,
  STANDARD_ARRAY,
} from "../../constants/rules";
import {
  ALL_LANGUAGE_NAMES,
  getBackgroundLanguageGrant,
  getBackgroundToolGrant,
  getClassToolGrant,
  getRaceLanguageGrant,
  getRaceToolGrant,
  resolveCharacterLanguages,
  resolveCharacterTools,
} from "../../rules/proficienciesAndLanguages";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import {
  findClass,
  findItem,
  getBackgrounds,
  getClasses,
  getFeats,
  getRaces,
} from "../../services/dataService";
import {
  calculateEffectiveAbilityScores,
  calculateTotalLevel,
} from "../../services/dndRules";
import {
  addMulticlassLevel,
  applyBackgroundGrants,
  applyStartingGrants,
  CLASS_STARTING_EQUIPMENT,
  parseBackgroundEquipment,
  setChoiceRacialBonus,
  setCustomBackground,
  setStandardArrayPick,
  STARTING_GOLD_BY_CLASS,
  validateMulticlass,
} from "../../rules/builderTransitions";
import {
  applyAsiSelection,
  getPendingLevelChoices,
  removeAsiSelection,
} from "../../rules/leveling";
import {
  normalizeSkillName,
} from "../../rules/skills";
import {
  getAvailableOptionalFeatures,
} from "../../rules/optionalFeatures";
import { AbilityKey, Character, CharacterClass, InventoryItem } from "../../types/character";
import { FeatData, RaceData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { SearchBar } from "../ui/SearchBar";

// ─── Constants ────────────────────────────────────────────────────────────────

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

/** Races whose ASI is player-chosen (not fixed). */
const CHOICE_ASI_RACES = new Set(["Half-Elf", "Custom Lineage"]);
/** VRGtR lineage replacement races. */
const LINEAGE_RACES = new Set(["Dhampir", "Hexblood", "Reborn"]);
/** Sidekick classes to exclude from class list. */
const SIDEKICK_CLASSES = new Set(["Expert Sidekick", "Spellcaster Sidekick", "Warrior Sidekick"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────


/** Format ASI bonuses as "DEX +2, CHA +1" etc. */
function formatRaceASI(abilityScoreIncrease: Record<string, number>[]): string {
  const totals: Record<string, number> = {};
  for (const item of abilityScoreIncrease || []) {
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") totals[k] = (totals[k] || 0) + v;
    }
  }
  return Object.entries(totals)
    .map(([k, v]) => `${k.toUpperCase()} +${v}`)
    .join(", ");
}

/** Collect fixed ASI bonuses from race + optional subrace. */
function collectFixedBonuses(
  raceASI?: Record<string, number>[],
  subraceASI?: Record<string, number>[]
): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const item of [...(raceASI || []), ...(subraceASI || [])]) {
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") bonuses[k] = (bonuses[k] || 0) + v;
    }
  }
  return bonuses;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BuilderTabProps {
  character?: Character;
  onUpdate?: (updates: Partial<Character> | ((character: Character) => Character)) => void;
  onViewDetail?: (item: any) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const BuilderTab: React.FC<BuilderTabProps> = ({
  character: propChar,
  onUpdate: propUpdate,
  onViewDetail: propViewDetail,
}) => {
  const { theme } = useAppTheme();
  const { currentCharacter, updateCharacter: contextUpdate, activeBooks } = useCharacters();

  // All hooks before any early return (Rules of Hooks)
  const [localDetail, setLocalDetail] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<"abilities" | "race" | "background" | "class">("abilities");
  const [raceSearch, setRaceSearch] = useState("");
  const [bgSearch, setBgSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  // The pool value the user tapped and is "holding"
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  // Choice ASI per-ability selections for races like Half-Elf / Variant Human
  const [choiceASI, setChoiceASI] = useState<Partial<Record<AbilityKey, number>>>({});

  // Custom Background state
  const [isCustomBg, setIsCustomBg] = useState(false);
  const [customBgName, setCustomBgName] = useState("");
  const [customBgSkills, setCustomBgSkills] = useState<string[]>([]);

  // ASI / Feat selection state
  const [activeAsiSlot, setActiveAsiSlot] = useState<string | null>(null);
  const [asiTab, setAsiTab] = useState<"asi" | "feat">("asi");
  const [asiMode, setAsiMode] = useState<"plus2" | "plus1plus1">("plus2");
  const [asiPlus2Pick, setAsiPlus2Pick] = useState<AbilityKey | null>(null);
  const [asiPlus1Picks, setAsiPlus1Picks] = useState<AbilityKey[]>([]);
  const [asiSelectedFeat, setAsiSelectedFeat] = useState<FeatData | null>(null);
  const [asiFeatSearch, setAsiFeatSearch] = useState("");

  // Flexible ASI mode for races without fixed ASI (e.g. MPMM)
  const [flexibleMode, setFlexibleMode] = useState<"2_1" | "1_1_1">("2_1");

  const character = propChar || currentCharacter;
  const onUpdate = propUpdate || ((updates: Partial<Character> | ((current: Character) => Character)) => {
    if (character) contextUpdate(character.id, current =>
      typeof updates === "function" ? updates(current) : { ...current, ...updates });
  });
  const saAssignments = character?.standardArrayPicks ?? {}; 
  const onViewDetail = propViewDetail || ((item: any) => setLocalDetail(item));

  if (!character) return null;

  // ── Data ──────────────────────────────────────────────────────────────────
  const allRaces = getRaces(activeBooks);
  const allClasses = getClasses(activeBooks).filter((cl) => !SIDEKICK_CLASSES.has(cl.name));
  const allBackgrounds = getBackgrounds(activeBooks);
  const allFeats = getFeats(activeBooks);

  const { scores: effectiveScores, modifiers } = calculateEffectiveAbilityScores(character);
  const totalLevel = calculateTotalLevel(character);
  const hasAnyClass = character.classes.length > 0;
  const primaryClass = character.classes[0]?.className;

  const { pendingAsi } = getPendingLevelChoices(character, allClasses);
  const existingAsis = character.asiSelections || [];

  const availableOptionalFeatures = getAvailableOptionalFeatures(character, allClasses);

  const toggleOptionalFeature = (featName: string) => {
    const current = { ...(character.optionalFeatureReplacements || {}) };
    if (current[featName]) {
      delete current[featName];
    } else {
      current[featName] = true;
    }
    onUpdate({ optionalFeatureReplacements: current });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ABILITY SCORES
  // ─────────────────────────────────────────────────────────────────────────

  let pointBuySpent = 0;
  for (const k of ABILITY_KEYS) {
    const score = character.baseAbilityScores?.[k] ?? (character.abilityMethod === "pointBuy" ? 8 : 10);
    pointBuySpent += POINT_BUY_COST[score] ?? 0;
  }
  const pointBuyRemaining = 27 - pointBuySpent;

  const updateBaseScore = (key: AbilityKey, delta: number) => {
    const current = character.baseAbilityScores?.[key] ?? (character.abilityMethod === "pointBuy" ? 8 : 10);
    const next = current + delta;
    if (character.abilityMethod === "pointBuy") {
      if (next < 8 || next > 15) return;
      const diff = (POINT_BUY_COST[next] ?? 0) - (POINT_BUY_COST[current] ?? 0);
      if (pointBuySpent + diff > 27) return;
    }
    onUpdate({
      baseAbilityScores: {
        ...(character.baseAbilityScores || { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }),
        [key]: Math.max(1, next),
      },
    });
  };

  const setManualScore = (key: AbilityKey, text: string) => {
    const val = parseInt(text, 10);
    onUpdate({
      baseAbilityScores: {
        ...character.baseAbilityScores,
        [key]: isNaN(val) ? 10 : Math.max(1, Math.min(30, val)),
      },
    });
  };

  // Standard Array helpers
  const assignedValues = Object.values(saAssignments).filter((v): v is number => v != null);

  const resetSA = () => {
    setPendingValue(null);
    onUpdate(current => ({ ...current, standardArrayPicks: {},
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }));
  };

  const handlePoolTap = (v: number) => {
    setPendingValue(pendingValue === v ? null : v);
  };

  const handleSlotTap = (key: AbilityKey) => {
    onUpdate(current => setStandardArrayPick(current, key, pendingValue));
    setPendingValue(null);
  };

  const unassignSlot = (key: AbilityKey) => {
    onUpdate(current => setStandardArrayPick(current, key, null));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RACE helpers
  // ─────────────────────────────────────────────────────────────────────────

  const selectedRaceData = character.race ? allRaces.find((r) => r.name === character.race?.name) : undefined;
  const selectedSubraceData = selectedRaceData?.subraces?.find(
    (sr) => sr.name === character.race?.subraceName
  );
  const fixedBonuses = character.race
    ? collectFixedBonuses(selectedRaceData?.abilityScoreIncrease, selectedSubraceData?.abilityScoreIncrease)
    : {};
  const hasFixedASI = Object.keys(fixedBonuses).length > 0;

  const isChoiceASIRace =
    character.race != null &&
    (!hasFixedASI ||
      CHOICE_ASI_RACES.has(character.race.name) ||
      character.race.subraceName === "Variant" ||
      character.race.subraceName === "Custom Lineage");

  const isFlexibleMPMM =
    character.race != null &&
    !hasFixedASI &&
    character.race.name !== "Custom Lineage" &&
    character.race.subraceName !== "Variant";

  const choiceASIConfig: { count: number; amount: number } = (() => {
    if (!character.race) return { count: 2, amount: 1 };
    const name = character.race.subraceName || character.race.name;
    if (name === "Custom Lineage") return { count: 1, amount: 2 };
    return { count: 2, amount: 1 }; // Half-Elf, Variant Human
  })();

  const handleChoiceASITap = (key: AbilityKey) => {
    const current = { ...choiceASI };

    if (isFlexibleMPMM) {
      if (flexibleMode === "2_1") {
        if (current[key] != null) {
          delete current[key];
        } else {
          const hasTwo = Object.values(current).includes(2);
          const hasOne = Object.values(current).includes(1);
          if (!hasTwo) {
            current[key] = 2;
          } else if (!hasOne) {
            current[key] = 1;
          }
        }
      } else {
        // "1_1_1" mode
        if (current[key] != null) {
          delete current[key];
        } else if (Object.keys(current).length < 3) {
          current[key] = 1;
        }
      }
    } else {
      if (current[key] != null) {
        delete current[key];
      } else if (Object.keys(current).length < choiceASIConfig.count) {
        current[key] = choiceASIConfig.amount;
      }
    }

    setChoiceASI(current);
    const picks = Object.entries(current).map(([k, amount]) => ({
      key: k as AbilityKey,
      amount: amount as number,
    }));
    onUpdate((cur) => setChoiceRacialBonus(cur, picks));
  };

  const selectRace = (r: RaceData, subraceIdx?: number) => {
    const sr = subraceIdx !== undefined ? r.subraces?.[subraceIdx] : undefined;
    const fixed = collectFixedBonuses(r.abilityScoreIncrease, sr?.abilityScoreIncrease);
    const hasFixed = Object.keys(fixed).length > 0;
    const isChoice = !hasFixed || CHOICE_ASI_RACES.has(r.name) || sr?.name === "Variant" || sr?.name === "Custom Lineage";
    const bonuses = isChoice ? {} : fixed;
    setChoiceASI({});
    const updatedRace = {
      name: r.name,
      source: r.source,
      subraceName: sr?.name,
      subraceSource: sr?.source,
    };
    const nextChosenLanguages = { ...character.chosenLanguages, race: [] };
    const nextChosenTools = { ...character.chosenTools, race: [] };
    const temp = {
      ...character,
      race: updatedRace,
      chosenLanguages: nextChosenLanguages,
      chosenTools: nextChosenTools,
      racialAbilityBonuses: bonuses,
      racialChoiceBonus: [],
    };
    const resolvedLangs = resolveCharacterLanguages(temp, { races: allRaces, backgrounds: allBackgrounds });
    onUpdate({
      race: updatedRace,
      racialAbilityBonuses: bonuses,
      racialChoiceBonus: [],
      chosenLanguages: nextChosenLanguages,
      chosenTools: nextChosenTools,
      languages: resolvedLangs,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CLASS helpers
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddClassLevel = (className: string, source: string) => {
    onUpdate(current => addMulticlassLevel(current, className, source));
  };

  const removeClassLevel = (className: string) => {
    const existing = character.classes.find((c) => c.className === className);
    if (!existing) return;
    const updated: CharacterClass[] =
      existing.level <= 1
        ? character.classes.filter((c) => c.className !== className)
        : character.classes.map((c) => c.className === className ? { ...c, level: c.level - 1 } : c);
    onUpdate({ classes: updated });
  };

  const selectSubclass = (className: string, subclassName: string, subclassSource: string) => {
    onUpdate({
      classes: character.classes.map((c) =>
        c.className === className ? { ...c, subclassName, subclassSource } : c
      ),
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOM BACKGROUND & STARTING GEAR & ASI helpers
  // ─────────────────────────────────────────────────────────────────────────

  const handleApplyCustomBackground = () => {
    const trimmed = customBgName.trim();
    if (!trimmed || customBgSkills.length !== 2) return;
    onUpdate(current => setCustomBackground(current, trimmed, customBgSkills));
    setIsCustomBg(false);
    setCustomBgName("");
    setCustomBgSkills([]);
  };

  const handleClaimGold = () => {
    if (!primaryClass) return;
    const goldAmount = STARTING_GOLD_BY_CLASS[primaryClass] ?? 100;
    onUpdate(current => applyStartingGrants(current, "gold", { goldAmount }));
  };

  const handleClaimEquipment = () => {
    if (!primaryClass) return;
    const defs = CLASS_STARTING_EQUIPMENT[primaryClass] || [
      { name: "Dagger", quantity: 1, isEquipped: true, section: "equipped" as const },
      { name: "Explorer's Pack", quantity: 1, isEquipped: false, section: "carried" as const },
    ];
    const equipmentItems: InventoryItem[] = defs.map((def, idx) => {
      const itemData = findItem(def.name);
      return {
        id: `start_${primaryClass.toLowerCase()}_${idx}_${def.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        name: def.name,
        source: itemData?.source || "PHB",
        quantity: def.quantity,
        isEquipped: def.isEquipped,
        section: def.section,
        weight: itemData?.weight ?? null,
        cost: itemData?.cost || null,
        damage: itemData?.damage || null,
        damageType: itemData?.damageType || null,
        range: itemData?.range || null,
        ac: itemData?.ac ?? null,
        description: itemData?.description || "",
      };
    });
    onUpdate(current => applyStartingGrants(current, "equipment", { equipmentItems }));
  };

  const handleSaveAsi = (className: string, classLevel: number) => {
    if (asiTab === "asi") {
      if (asiMode === "plus2") {
        if (!asiPlus2Pick) return;
        onUpdate(current =>
          applyAsiSelection(current, {
            className,
            classLevel,
            level: classLevel,
            type: "asi",
            asi: { [asiPlus2Pick]: 2 },
          })
        );
        setAsiPlus2Pick(null);
      } else {
        if (asiPlus1Picks.length !== 2) return;
        onUpdate(current =>
          applyAsiSelection(current, {
            className,
            classLevel,
            level: classLevel,
            type: "asi",
            asi: { [asiPlus1Picks[0]]: 1, [asiPlus1Picks[1]]: 1 },
          })
        );
        setAsiPlus1Picks([]);
      }
    } else {
      if (!asiSelectedFeat) return;
      onUpdate(current =>
        applyAsiSelection(current, {
          className,
          classLevel,
          level: classLevel,
          type: "feat",
          featName: asiSelectedFeat.name,
          featSource: asiSelectedFeat.source,
        })
      );
      setAsiSelectedFeat(null);
    }
    setActiveAsiSlot(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SKILLS – contextual collection
  // ─────────────────────────────────────────────────────────────────────────

  /** Skills auto-granted (no choice needed). */
  const autoGranted: string[] = [];
  if (character.background) {
    const bgData = allBackgrounds.find((b) => b.name === character.background!.name);
    if (bgData) autoGranted.push(...bgData.skillProficiencies);
  }

  /** Skills the player must choose from per-source. */
  type SkillChoice = { source: string; choose: number; from: string[] };
  const skillChoices: SkillChoice[] = [];

  if (character.race) {
    const raceData = allRaces.find((r) => r.name === character.race!.name);
    if (raceData) {
      if (raceData.traits.some((t) => t.name === "Skill Versatility")) {
        skillChoices.push({
          source: `Race: ${character.race.name}`,
          choose: 2,
          from: DND_SKILLS.map((s) => normalizeSkillName(s.name)),
        });
      }
      if (character.race.subraceName === "Variant") {
        skillChoices.push({
          source: "Variant Human: Skills",
          choose: 1,
          from: DND_SKILLS.map((s) => normalizeSkillName(s.name)),
        });
      }
    }
  }

  if (character.classes.length > 0) {
    const classData = findClass(character.classes[0].className, character.classes[0].source);
    if (classData?.skillProficiencies) {
      const { choose, from } = classData.skillProficiencies;
      const fromList =
        from && from.length > 0
          ? from.map(normalizeSkillName)
          : DND_SKILLS.map((s) => normalizeSkillName(s.name));
      if (choose > 0) {
        skillChoices.push({
          source: `Class: ${character.classes[0].className}`,
          choose,
          from: fromList,
        });
      }
    }
  }

  const toggleSkill = (s: string) => {
    const norm = normalizeSkillName(s);
    const current = (character.chosenSkills || []).map(normalizeSkillName);
    onUpdate({
      chosenSkills: current.includes(norm) ? current.filter((x) => x !== norm) : [...current, norm],
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RULE-GOVERNED LANGUAGES & TOOLS
  // ─────────────────────────────────────────────────────────────────────────
  const raceLanguageGrant = getRaceLanguageGrant(character.race?.name, character.race?.subraceName, allRaces);
  const raceToolGrant = getRaceToolGrant(character.race?.name, character.race?.subraceName, allRaces);
  const bgLanguageGrant = getBackgroundLanguageGrant(character.background?.name, allBackgrounds);
  const bgToolGrant = getBackgroundToolGrant(character.background?.name, allBackgrounds);
  const classToolGrant = getClassToolGrant(primaryClass, allClasses);

  const resolvedLanguages = resolveCharacterLanguages(character, { races: allRaces, backgrounds: allBackgrounds });
  const resolvedTools = resolveCharacterTools(character, { races: allRaces, backgrounds: allBackgrounds, classes: allClasses });

  const toggleRaceLanguage = (lang: string) => {
    const cur = character.chosenLanguages?.race || [];
    const next = cur.includes(lang) ? cur.filter((x) => x !== lang) : [...cur, lang];
    const nextChosen = { ...character.chosenLanguages, race: next };
    const temp = { ...character, chosenLanguages: nextChosen };
    const resolved = resolveCharacterLanguages(temp, { races: allRaces, backgrounds: allBackgrounds });
    onUpdate({ chosenLanguages: nextChosen, languages: resolved });
  };

  const toggleRaceTool = (tool: string) => {
    const cur = character.chosenTools?.race || [];
    const next = cur.includes(tool) ? cur.filter((x) => x !== tool) : [...cur, tool];
    onUpdate({ chosenTools: { ...character.chosenTools, race: next } });
  };

  const toggleBgLanguage = (lang: string) => {
    const cur = character.chosenLanguages?.background || [];
    const next = cur.includes(lang) ? cur.filter((x) => x !== lang) : [...cur, lang];
    const nextChosen = { ...character.chosenLanguages, background: next };
    const temp = { ...character, chosenLanguages: nextChosen };
    const resolved = resolveCharacterLanguages(temp, { races: allRaces, backgrounds: allBackgrounds });
    onUpdate({ chosenLanguages: nextChosen, languages: resolved });
  };

  const toggleBgTool = (tool: string) => {
    const cur = character.chosenTools?.background || [];
    const next = cur.includes(tool) ? cur.filter((x) => x !== tool) : [...cur, tool];
    onUpdate({ chosenTools: { ...character.chosenTools, background: next } });
  };

  const toggleClassTool = (tool: string) => {
    const cur = character.chosenTools?.class || [];
    const next = cur.includes(tool) ? cur.filter((x) => x !== tool) : [...cur, tool];
    onUpdate({ chosenTools: { ...character.chosenTools, class: next } });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const sectionTabs = [
    { key: "abilities" as const, label: "Abilities", icon: "body-outline" as const },
    { key: "race" as const,      label: "Race",      icon: "leaf-outline" as const },
    { key: "background" as const,label: "Background",icon: "book-outline" as const },
    { key: "class" as const,     label: "Class",     icon: "shield-outline" as const },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Section Tab Nav ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsScroll, { borderColor: theme.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        {sectionTabs.map(({ key, label, icon }) => {
          const active = activeSection === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveSection(key)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: active ? theme.accentGlow : "transparent",
                  borderColor: active ? theme.accent : "transparent",
                },
              ]}
            >
              <Ionicons name={icon} size={15} color={active ? theme.accent : theme.textSecondary} />
              <Text style={[styles.tabText, { color: active ? theme.accent : theme.textSecondary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ════════════════════════════════════════════
          1. ABILITY SCORES
      ════════════════════════════════════════════ */}
      {activeSection === "abilities" && (
        <View style={styles.section}>

          {/* Method selector */}
          <View style={styles.methodRow}>
            {(["pointBuy", "standardArray", "manual"] as const).map((m) => {
              const active = character.abilityMethod === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    if (m === "pointBuy") {
                      const cur = character.baseAbilityScores || { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
                      const newScores: Record<AbilityKey, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
                      for (const k of ABILITY_KEYS) {
                        const val = cur[k];
                        if (typeof val === "number" && val >= 8 && val <= 15) {
                          newScores[k] = val;
                        }
                      }
                      onUpdate({ abilityMethod: m, baseAbilityScores: newScores });
                    } else {
                      onUpdate({ abilityMethod: m });
                    }
                    if (m === "standardArray") resetSA();
                  }}
                  style={[
                    styles.methodBtn,
                    { backgroundColor: active ? theme.accentGlow : theme.surface,
                      borderColor: active ? theme.accent : theme.border },
                  ]}
                >
                  <Text style={[styles.methodText, { color: active ? theme.accent : theme.textSecondary, fontWeight: active ? "700" : "400" }]}>
                    {m === "pointBuy" ? "Point Buy" : m === "standardArray" ? "Std Array" : "Manual"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Point Buy counter */}
          {character.abilityMethod === "pointBuy" && (
            <View style={[styles.banner, { backgroundColor: theme.surfaceHighlight, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                Points remaining:{" "}
                <Text style={{ color: pointBuyRemaining >= 0 ? theme.accent : theme.danger, fontWeight: "800", fontSize: 16 }}>
                  {pointBuyRemaining}
                </Text>
                {" / 27"}
              </Text>
              <TouchableOpacity
                onPress={() => onUpdate({ baseAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } })}
                style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "600" }}>Reset (8s)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Standard Array pool */}
          {character.abilityMethod === "standardArray" && (
            <Card style={{ gap: 10 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                1. Tap a value from the pool below{"\n"}2. Tap an ability slot to assign it
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                {STANDARD_ARRAY.map((v, idx) => {
                  const timesInArray = STANDARD_ARRAY.filter((x) => x === v).length;
                  const timesUsed = assignedValues.filter((x) => x === v).length;
                  const available = timesUsed < timesInArray;
                  const isPending = pendingValue === v;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => available || isPending ? handlePoolTap(v) : undefined}
                      style={[
                        styles.poolChip,
                        {
                          backgroundColor: isPending ? theme.accent : available ? theme.surfaceRaised : theme.surfaceHighlight,
                          borderColor: isPending ? theme.accent : theme.border,
                          opacity: !available && !isPending ? 0.35 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: isPending ? theme.background : available ? theme.text : theme.textMuted, fontWeight: "800", fontSize: 20 }}>
                        {v}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {pendingValue != null && (
                <Text style={{ color: theme.accent, fontSize: 12, textAlign: "center", fontWeight: "700" }}>
                  → Now tap an ability slot to assign {pendingValue}
                </Text>
              )}
              <Button title="Reset" variant="outline" size="sm" onPress={resetSA} />
            </Card>
          )}

          {/* Scores grid */}
          <View style={styles.scoresGrid}>
            {ABILITY_KEYS.map((key) => {
              const base = character.baseAbilityScores?.[key] ?? (character.abilityMethod === "pointBuy" ? 8 : 10);
              const racialBonus = character.racialAbilityBonuses[key] || 0;
              const total = effectiveScores[key];
              const mod = modifiers[key];
              const isAssigned = saAssignments[key] != null;
              const isSA = character.abilityMethod === "standardArray";

              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => isSA ? handleSlotTap(key) : undefined}
                  activeOpacity={isSA ? 0.7 : 1}
                  style={[
                    styles.scoreCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: (isSA && pendingValue != null)
                        ? theme.accent
                        : isAssigned ? theme.accentGlow
                        : theme.border,
                      borderWidth: (isSA && pendingValue != null) ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.abilityLabel, { color: theme.textSecondary }]}>{ABILITY_LABELS[key]}</Text>
                  <Text style={[styles.abilityMod, { color: theme.accent }]}>
                    {mod >= 0 ? `+${mod}` : mod}
                  </Text>

                  {character.abilityMethod === "manual" ? (
                    <TextInput
                      style={[styles.scoreInput, { backgroundColor: theme.surfaceHighlight, color: theme.text, borderColor: theme.border }]}
                      keyboardType="number-pad"
                      value={String(base)}
                      onChangeText={(t) => setManualScore(key, t)}
                    />
                  ) : isSA ? (
                    <View style={[styles.saSlot, { backgroundColor: isAssigned ? theme.accentGlow : theme.surfaceHighlight, borderColor: isAssigned ? theme.accent : theme.border }]}>
                      <Text style={{ color: isAssigned ? theme.accent : theme.textMuted, fontWeight: "800", fontSize: 20 }}>
                        {isAssigned ? base : "—"}
                      </Text>
                      {isAssigned && (
                        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); unassignSlot(key); }} style={styles.saX}>
                          <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.stepperRow}>
                      <TouchableOpacity onPress={() => updateBaseScore(key, -1)} style={[styles.stepperBtn, { backgroundColor: theme.surfaceHighlight }]}>
                        <Ionicons name="remove" size={20} color={theme.text} />
                      </TouchableOpacity>
                      <Text style={[styles.baseNum, { color: theme.text }]}>{base}</Text>
                      <TouchableOpacity onPress={() => updateBaseScore(key, 1)} style={[styles.stepperBtn, { backgroundColor: theme.surfaceHighlight }]}>
                        <Ionicons name="add" size={20} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 4, textAlign: "center" }}>
                    {racialBonus ? `${base}+${racialBonus}=${total}` : `= ${total}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ════════════════════════════════════════════
          2. RACE & LINEAGE
      ════════════════════════════════════════════ */}
      {activeSection === "race" && (
        <View style={styles.section}>

          {/* Selected race banner */}
          {character.race ? (
            <Card highlight style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerTitle, { color: theme.text }]}>
                  {character.race.name}{character.race.subraceName ? ` — ${character.race.subraceName}` : ""}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>{character.race.source}</Text>
              </View>
              <Button title="Change" variant="outline" size="sm"
                onPress={() => { onUpdate({ race: null, racialAbilityBonuses: {} }); setChoiceASI({}); }} />
            </Card>
          ) : null}

          {/* Choice ASI picker */}
          {character.race && isChoiceASIRace && (
            <Card style={{ gap: 8, borderColor: theme.accent }}>
              {isFlexibleMPMM ? (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
                      {flexibleMode === "2_1"
                        ? `Choose +2 and +1 to abilities (${Object.keys(choiceASI).length}/2 chosen)`
                        : `Choose +1 to 3 abilities (${Object.keys(choiceASI).length}/3 chosen)`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginVertical: 2 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setFlexibleMode("2_1");
                        setChoiceASI({});
                        onUpdate((cur) => setChoiceRacialBonus(cur, []));
                      }}
                      style={[
                        styles.modeBtn,
                        {
                          backgroundColor: flexibleMode === "2_1" ? theme.accentGlow : theme.surfaceHighlight,
                          borderColor: flexibleMode === "2_1" ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: flexibleMode === "2_1" ? theme.accent : theme.textSecondary,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        +2 / +1
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setFlexibleMode("1_1_1");
                        setChoiceASI({});
                        onUpdate((cur) => setChoiceRacialBonus(cur, []));
                      }}
                      style={[
                        styles.modeBtn,
                        {
                          backgroundColor: flexibleMode === "1_1_1" ? theme.accentGlow : theme.surfaceHighlight,
                          borderColor: flexibleMode === "1_1_1" ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: flexibleMode === "1_1_1" ? theme.accent : theme.textSecondary,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        +1 / +1 / +1
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
                  Choose +{choiceASIConfig.amount} to {choiceASIConfig.count} ability score{choiceASIConfig.count > 1 ? "s" : ""}
                  {"  "}({Object.keys(choiceASI).length}/{choiceASIConfig.count} chosen)
                </Text>
              )}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {ABILITY_KEYS.map((k) => {
                  const chosenAmount = choiceASI[k];
                  const chosen = chosenAmount != null;
                  const canPick = isFlexibleMPMM
                    ? flexibleMode === "2_1"
                      ? !chosen && (!Object.values(choiceASI).includes(2) || !Object.values(choiceASI).includes(1))
                      : !chosen && Object.keys(choiceASI).length < 3
                    : !chosen && Object.keys(choiceASI).length < choiceASIConfig.count;

                  return (
                    <TouchableOpacity
                      key={k}
                      onPress={() => (chosen || canPick ? handleChoiceASITap(k) : undefined)}
                      style={[
                        styles.choiceChip,
                        {
                          backgroundColor: chosen ? theme.accentGlow : theme.surfaceHighlight,
                          borderColor: chosen ? theme.accent : theme.border,
                          opacity: !chosen && !canPick ? 0.35 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: chosen ? theme.accent : theme.textSecondary, fontWeight: "700", fontSize: 13 }}>
                        {ABILITY_LABELS[k]}
                        {chosen ? ` +${chosenAmount ?? choiceASIConfig.amount}` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          )}

          {/* Race skill choices */}
          {character.race && skillChoices.filter((sc) => sc.source.startsWith("Race:") || sc.source.startsWith("Variant")).length > 0 && (
            <Card style={{ gap: 10 }}>
              {skillChoices
                .filter((sc) => sc.source.startsWith("Race:") || sc.source.startsWith("Variant"))
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

          {/* Race language choices and granted languages */}
          {character.race && (raceLanguageGrant.fixed.length > 0 || raceLanguageGrant.choiceCount > 0) && (
            <Card style={{ gap: 10 }}>
              {raceLanguageGrant.fixed.length > 0 && (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                    Granted Languages:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {raceLanguageGrant.fixed.map((lang) => (
                      <Badge key={lang} label={lang} variant="accent" size="sm" />
                    ))}
                  </View>
                </View>
              )}
              {raceLanguageGrant.choiceCount > 0 && (
                <RuleChoicePicker
                  label={raceLanguageGrant.label}
                  choose={raceLanguageGrant.choiceCount}
                  from={ALL_LANGUAGE_NAMES}
                  chosen={character.chosenLanguages?.race || []}
                  autoGranted={raceLanguageGrant.fixed}
                  onToggle={toggleRaceLanguage}
                  theme={theme}
                />
              )}
            </Card>
          )}

          {/* Race tool choices and granted tools */}
          {character.race && (raceToolGrant.fixed.length > 0 || raceToolGrant.choices.length > 0) && (
            <Card style={{ gap: 10 }}>
              {raceToolGrant.fixed.length > 0 && (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                    Granted Tool Proficiencies:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {raceToolGrant.fixed.map((tool) => (
                      <Badge key={tool} label={tool} variant="surface" size="sm" />
                    ))}
                  </View>
                </View>
              )}
              {raceToolGrant.choices.map((ch) => (
                <RuleChoicePicker
                  key={ch.key}
                  label={ch.label}
                  choose={ch.count}
                  from={ch.options}
                  chosen={character.chosenTools?.race || []}
                  autoGranted={raceToolGrant.fixed}
                  onToggle={toggleRaceTool}
                  theme={theme}
                />
              ))}
            </Card>
          )}

          {/* Race traits (when selected) */}
          {character.race && !character.lineageReplacement && (() => {
            const rd = allRaces.find((r) => r.name === character.race!.name);
            if (!rd || rd.traits.length === 0) return null;
            return (
              <Card style={{ gap: 8 }}>
                <Text style={[styles.heading, { color: theme.text }]}>{character.race.name} Traits:</Text>
                {rd.traits.map((t) => (
                  <TouchableOpacity
                    key={t.name}
                    onPress={() => onViewDetail({ title: t.name, description: t.description, source: rd.source })}
                    style={[styles.featureRow, { borderColor: theme.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>{t.name}</Text>
                      {t.description ? (
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={2}>{t.description}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                ))}
              </Card>
            );
          })()}

          {/* Lineage features */}
          {character.lineageReplacement && (() => {
            const lr = allRaces.find((r) => r.name === character.lineageReplacement);
            if (!lr) return null;
            return (
              <Card style={{ gap: 8 }}>
                <Text style={[styles.heading, { color: theme.accent }]}>{lr.name} Features (Lineage):</Text>
                {lr.traits.map((t) => (
                  <TouchableOpacity
                    key={t.name}
                    onPress={() => onViewDetail({ title: t.name, description: t.description, source: lr.source })}
                    style={[styles.featureRow, { borderColor: theme.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>{t.name}</Text>
                      {t.description ? (
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={2}>{t.description}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                ))}
              </Card>
            );
          })()}

          {/* Lineage replacement toggle */}
          <Card style={{ gap: 10 }}>
            <Text style={[styles.heading, { color: theme.text }]}>
              Lineage Replacement (VRGtR) & Custom Lineage (TCoE)
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["None", "Dhampir", "Hexblood", "Reborn", "Custom Lineage"] as const).map((opt) => {
                const active =
                  opt === "None"
                    ? !character.lineageReplacement && !character.customLineage
                    : opt === "Custom Lineage"
                    ? character.customLineage
                    : character.lineageReplacement === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      if (opt === "None") {
                        onUpdate({ lineageReplacement: null, customLineage: false });
                      } else if (opt === "Custom Lineage") {
                        onUpdate({ customLineage: true, lineageReplacement: null,
                          race: { name: "Custom Lineage", source: "TCE" } });
                      } else {
                        onUpdate({ lineageReplacement: opt, customLineage: false });
                      }
                    }}
                    style={[
                      styles.lineageChip,
                      {
                        backgroundColor: active ? theme.accentGlow : theme.surfaceHighlight,
                        borderColor: active ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? theme.accent : theme.textSecondary, fontSize: 13, fontWeight: "600" }}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Race search + list (when no race selected) */}
          {!character.race && (
            <>
              <SearchBar value={raceSearch} onChangeText={setRaceSearch} placeholder="Search races…" />
              <View style={{ gap: 10 }}>
                {allRaces
                  .filter((r) => r.name.toLowerCase().includes(raceSearch.toLowerCase()))
                  .map((r) => {
                    const asiStr = formatRaceASI(r.abilityScoreIncrease);
                    const isChoice = CHOICE_ASI_RACES.has(r.name);
                    const isLineage = LINEAGE_RACES.has(r.name);
                    return (
                      <Card key={`${r.name}__${r.source}`}>
                        {/* Header */}
                        <View style={styles.row}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Text style={[styles.itemTitle, { color: theme.text }]}>{r.name}</Text>
                              {isLineage && <Badge label="Lineage" variant="warning" size="sm" />}
                              {isChoice && <Badge label="Choice ASI" variant="secondary" size="sm" />}
                            </View>
                            {asiStr ? (
                              <Text style={{ color: theme.accent, fontSize: 12, marginTop: 1, fontWeight: "600" }}>{asiStr}</Text>
                            ) : isChoice ? (
                              <Text style={{ color: theme.accent, fontSize: 12, marginTop: 1, fontWeight: "600" }}>
                                {r.name === "Custom Lineage" ? "+2 any one ability" : "+1 to any two abilities"}
                              </Text>
                            ) : (
                              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }}>No fixed ASI</Text>
                            )}
                            <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                              Speed {r.speed.walk} ft • {r.size.join("/")} • {r.source}
                            </Text>
                          </View>
                          <Button title="Info" variant="ghost" size="sm"
                            onPress={() => onViewDetail({ title: r.name, source: r.source, description: r.description })} />
                          {r.subraces.length <= 1 && (
                            <Button
                              title="Select"
                              size="sm"
                              onPress={() => selectRace(r, r.subraces.length === 1 ? 0 : undefined)}
                            />
                          )}
                        </View>

                        {/* Subraces */}
                        {r.subraces.length > 1 && (
                          <View style={styles.subracesBox}>
                            <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                              Subraces / Variants:
                            </Text>
                            {r.subraces.map((sr, idx) => {
                              const combined = collectFixedBonuses(r.abilityScoreIncrease, sr.abilityScoreIncrease);
                              const combinedStr = formatRaceASI(
                                Object.entries(combined).map(([k, v]) => ({ [k]: v }))
                              );
                              const srIsChoice = !sr.name || CHOICE_ASI_RACES.has(sr.name) || sr.name === "Variant";
                              return (
                                <TouchableOpacity
                                  key={`${sr.name || "base"}_${idx}`}
                                  onPress={() => selectRace(r, idx)}
                                  style={[styles.subraceRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                                      {sr.name || r.name}
                                    </Text>
                                    {combinedStr && !srIsChoice ? (
                                       <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "600" }}>{combinedStr}</Text>
                                    ) : srIsChoice ? (
                                      <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "600" }}>Choice ASI</Text>
                                    ) : null}
                                  </View>
                                  <Ionicons name="chevron-forward" size={16} color={theme.accent} />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {/* Trait chips */}
                        {r.traits.length > 0 && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                            {r.traits.slice(0, 5).map((t) => (
                              <Badge key={t.name} label={t.name} variant="muted" size="sm" />
                            ))}
                            {r.traits.length > 5 && (
                              <Badge label={`+${r.traits.length - 5} more`} variant="muted" size="sm" />
                            )}
                          </View>
                        )}
                      </Card>
                    );
                  })}
              </View>
            </>
          )}
        </View>
      )}

      {/* ════════════════════════════════════════════
          3. BACKGROUND
      ════════════════════════════════════════════ */}
      {activeSection === "background" && (
        <View style={styles.section}>

          {/* Selected background */}
          {character.background ? (
            <>
              <Card highlight style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerTitle, { color: theme.text }]}>{character.background.name}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                    {character.background.source === "Custom" ? "Custom Background" : character.background.source}
                  </Text>
                </View>
                <Button title="Change" variant="outline" size="sm"
                  onPress={() => onUpdate({ background: null })} />
              </Card>

              {/* Custom background skills */}
              {character.background.source === "Custom" && (
                <Card style={{ gap: 6 }}>
                  <Text style={[styles.heading, { color: theme.text }]}>Custom Background Skill Proficiencies:</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {(
                      character.skillChoices?.find((sc) => sc.origin === "background")?.picked ||
                      character.chosenSkills ||
                      []
                    ).map((s) => (
                      <Badge key={s} label={s} variant="accent" size="sm" />
                    ))}
                  </View>
                </Card>
              )}

              {/* Auto-granted background skills & equipment (official) */}
              {character.background.source !== "Custom" && (() => {
                const bgData = allBackgrounds.find((b) => b.name === character.background!.name);
                if (!bgData) return null;
                const startingEq = parseBackgroundEquipment(bgData.startingEquipment || []);
                return (
                  <Card style={{ gap: 8 }}>
                    <Text style={[styles.heading, { color: theme.text }]}>Background Benefits:</Text>
                    {bgData.skillProficiencies.length > 0 && (
                      <View style={{ gap: 4 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Skill Proficiencies:</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {bgData.skillProficiencies.map((s) => (
                            <Badge key={s} label={s} variant="accent" size="sm" />
                          ))}
                        </View>
                      </View>
                    )}
                    {bgToolGrant.fixed.length > 0 && (
                      <View style={{ gap: 4 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Granted Tool Proficiencies:</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {bgToolGrant.fixed.map((t) => (
                            <Badge key={t} label={t} variant="surface" size="sm" />
                          ))}
                        </View>
                      </View>
                    )}
                    {bgLanguageGrant.fixed.length > 0 && (
                      <View style={{ gap: 4 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Granted Languages:</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {bgLanguageGrant.fixed.map((l) => (
                            <Badge key={l} label={l} variant="accent" size="sm" />
                          ))}
                        </View>
                      </View>
                    )}
                    {startingEq && (startingEq.items.length > 0 || (startingEq.coins?.gp ?? 0) > 0 || (startingEq.coins?.sp ?? 0) > 0) && (
                      <View style={{ gap: 6, marginTop: 4 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Starting Equipment & Money:</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                          {(startingEq.coins?.gp ?? 0) > 0 && (
                            <Badge label={`💰 ${startingEq.coins.gp} gp`} variant="accent" size="sm" />
                          )}
                          {startingEq.items.map((it) => (
                            <Badge key={it.name} label={`${it.name}${it.quantity > 1 ? ` (×${it.quantity})` : ""}`} variant="surface" size="sm" />
                          ))}
                        </View>
                        {character.backgroundGrantsApplied ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                            <Text style={{ color: theme.success, fontSize: 12, fontWeight: "600" }}>
                              Background Equipment & Funds Claimed
                            </Text>
                          </View>
                        ) : (
                          <Button
                            title="Claim Background Equipment & Funds"
                            variant="secondary"
                            size="sm"
                            icon="bag-add-outline"
                            onPress={() => onUpdate((cur) => applyBackgroundGrants(cur, bgData))}
                          />
                        )}
                      </View>
                    )}
                    {bgData.feature && (
                      <TouchableOpacity
                        onPress={() => onViewDetail({ title: bgData.feature!.name, description: bgData.feature!.description })}
                        style={[styles.featureRow, { borderColor: theme.border, marginTop: 4 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                            Feature: {bgData.feature.name}
                          </Text>
                          <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={2}>
                            {bgData.feature.description}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                      </TouchableOpacity>
                    )}
                  </Card>
                );
              })()}

              {/* Background Language Choices */}
              {character.background && character.background.source !== "Custom" && bgLanguageGrant.choiceCount > 0 && (
                <Card style={{ gap: 8 }}>
                  <RuleChoicePicker
                    label={bgLanguageGrant.label}
                    choose={bgLanguageGrant.choiceCount}
                    from={ALL_LANGUAGE_NAMES}
                    chosen={character.chosenLanguages?.background || []}
                    autoGranted={[...raceLanguageGrant.fixed, ...(character.chosenLanguages?.race || []), ...bgLanguageGrant.fixed]}
                    onToggle={toggleBgLanguage}
                    theme={theme}
                  />
                </Card>
              )}

              {/* Background Tool Choices */}
              {character.background && character.background.source !== "Custom" && bgToolGrant.choices.length > 0 && (
                <Card style={{ gap: 10 }}>
                  {bgToolGrant.choices.map((ch) => (
                    <RuleChoicePicker
                      key={ch.key}
                      label={ch.label}
                      choose={ch.count}
                      from={ch.options}
                      chosen={character.chosenTools?.background || []}
                      autoGranted={bgToolGrant.fixed}
                      onToggle={toggleBgTool}
                      theme={theme}
                    />
                  ))}
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Custom Background creator card */}
              <Card style={{ gap: 10, borderColor: isCustomBg ? theme.accent : theme.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>Custom Background</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                      Create your own background with a custom name and 2 skill proficiencies.
                    </Text>
                  </View>
                  <Button
                    title={isCustomBg ? "Cancel" : "Create Custom"}
                    variant={isCustomBg ? "ghost" : "outline"}
                    size="sm"
                    onPress={() => setIsCustomBg(!isCustomBg)}
                  />
                </View>

                {isCustomBg && (
                  <View style={{ gap: 10, marginTop: 4 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                      Background Name:
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                      ]}
                      placeholder="e.g. Bounty Hunter, Village Hero..."
                      placeholderTextColor={theme.textMuted}
                      value={customBgName}
                      onChangeText={setCustomBgName}
                    />
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        Select 2 Skill Proficiencies:
                      </Text>
                      <Text
                        style={{
                          color: customBgSkills.length === 2 ? theme.accent : theme.warning,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {customBgSkills.length}/2
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {DND_SKILLS.map((s) => {
                        const isPicked = customBgSkills.includes(s.name);
                        const canPick = !isPicked && customBgSkills.length < 2;
                        return (
                          <TouchableOpacity
                            key={s.name}
                            onPress={() => {
                              if (isPicked) {
                                setCustomBgSkills(customBgSkills.filter((sk) => sk !== s.name));
                              } else if (canPick) {
                                setCustomBgSkills([...customBgSkills, s.name]);
                              }
                            }}
                            style={[
                              pkStyles.chip,
                              {
                                backgroundColor: isPicked ? theme.accentGlow : theme.surfaceHighlight,
                                borderColor: isPicked ? theme.accent : theme.border,
                                opacity: !isPicked && !canPick ? 0.4 : 1,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: isPicked ? theme.accent : theme.textSecondary,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              {s.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Button
                      title="Apply Custom Background"
                      variant="primary"
                      size="sm"
                      disabled={!customBgName.trim() || customBgSkills.length !== 2}
                      onPress={handleApplyCustomBackground}
                    />
                  </View>
                )}
              </Card>

              <SearchBar value={bgSearch} onChangeText={setBgSearch} placeholder="Search backgrounds…" />
              <View style={{ gap: 10 }}>
                {allBackgrounds
                  .filter((b) => b.name.toLowerCase().includes(bgSearch.toLowerCase()))
                  .map((b) => (
                    <Card key={`${b.name}__${b.source}`}>
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>{b.name}</Text>
                          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "600" }}>
                            {b.skillProficiencies.join(", ") || "—"}
                          </Text>
                          <Text style={{ color: theme.textMuted, fontSize: 11 }}>{b.source}</Text>
                        </View>
                        <Button title="Info" variant="ghost" size="sm"
                          onPress={() => onViewDetail({ title: b.name, source: b.source,
                            description: b.description, tags: b.skillProficiencies })} />
                        <Button title="Select" size="sm"
                          onPress={() => {
                            const nextChosenLanguages = { ...character.chosenLanguages, background: [] };
                            const nextChosenTools = { ...character.chosenTools, background: [] };
                            const temp = {
                              ...character,
                              background: { name: b.name, source: b.source },
                              chosenLanguages: nextChosenLanguages,
                              chosenTools: nextChosenTools,
                            };
                            const resolved = resolveCharacterLanguages(temp, { races: allRaces, backgrounds: allBackgrounds });
                            onUpdate({
                              background: { name: b.name, source: b.source },
                              chosenLanguages: nextChosenLanguages,
                              chosenTools: nextChosenTools,
                              languages: resolved,
                            });
                          }} />
                      </View>
                    </Card>
                  ))}
              </View>
            </>
          )}

          {/* Known Languages Card */}
          <Card style={{ gap: 8 }}>
            <View>
              <Text style={[styles.heading, { color: theme.text }]}>Known Languages:</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>Granted and chosen from race, background, and features</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {resolvedLanguages.map((lang) => (
                <Badge key={lang} label={lang} variant="accent" size="sm" />
              ))}
            </View>
          </Card>

          {/* Tool Proficiencies Card */}
          <Card style={{ gap: 8 }}>
            <View>
              <Text style={[styles.heading, { color: theme.text }]}>Tool Proficiencies:</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>Granted and chosen from race, background, and class</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {resolvedTools.length > 0 ? (
                resolvedTools.map((tool) => (
                  <Badge key={tool} label={tool} variant="surface" size="sm" />
                ))
              ) : (
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>None</Text>
              )}
            </View>
          </Card>
        </View>
      )}

      {/* ════════════════════════════════════════════
          4. CLASS & LEVEL
      ════════════════════════════════════════════ */}
      {activeSection === "class" && (
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
                ? 1 : ["Druid", "Wizard"].includes(c.className) ? 2 : 3;
              return (
                <View key={c.className} style={[styles.classRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.className, { color: theme.text }]}>{c.className}</Text>
                      <Badge label={cd?.hitDie || "1d8"} size="sm" />
                    </View>
                    <Text style={{ color: theme.accent, fontSize: 12, marginTop: 2 }}>
                      {c.subclassName ? `Archetype: ${c.subclassName}` : `Subclass at Lvl ${subReq}`}
                    </Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity onPress={() => removeClassLevel(c.className)}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}>
                      <Ionicons name="remove" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.levelNum, { color: theme.text }]}>{c.level}</Text>
                    <TouchableOpacity onPress={() => handleAddClassLevel(c.className, c.source)}
                      style={[styles.stepperBtn, { backgroundColor: theme.surfaceRaised }]}>
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </Card>

          {/* Subclass prompts */}
          {character.classes.map((c) => {
            const cd = findClass(c.className, c.source);
            const req = ["Cleric", "Sorcerer", "Warlock"].includes(c.className)
              ? 1 : ["Druid", "Wizard"].includes(c.className) ? 2 : 3;
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

          {/* Pending ASI / Feat prompts */}
          {pendingAsi.map((slot) => {
            const slotKey = `${slot.className}_${slot.classLevel}`;
            const isExpanded = activeAsiSlot === null || activeAsiSlot === slotKey;

            return (
              <Card key={slotKey} style={{ gap: 10, borderColor: theme.warning }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.warning, fontWeight: "700", fontSize: 14 }}>
                      ⚠️ Level-up Choice: {slot.className} Level {slot.classLevel}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                      Choose an Ability Score Improvement or a Feat.
                    </Text>
                  </View>
                  {!isExpanded && (
                    <Button
                      title="Configure"
                      variant="outline"
                      size="sm"
                      onPress={() => setActiveAsiSlot(slotKey)}
                    />
                  )}
                </View>

                {isExpanded && (
                  <View style={{ gap: 12, marginTop: 4 }}>
                    {/* ASI vs Feat toggle */}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setAsiTab("asi")}
                        style={[
                          styles.methodBtn,
                          {
                            backgroundColor: asiTab === "asi" ? theme.accentGlow : theme.surface,
                            borderColor: asiTab === "asi" ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.methodText,
                            {
                              color: asiTab === "asi" ? theme.accent : theme.textSecondary,
                              fontWeight: asiTab === "asi" ? "700" : "500",
                            },
                          ]}
                        >
                          Ability Scores (+2 or +1/+1)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setAsiTab("feat")}
                        style={[
                          styles.methodBtn,
                          {
                            backgroundColor: asiTab === "feat" ? theme.accentGlow : theme.surface,
                            borderColor: asiTab === "feat" ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.methodText,
                            {
                              color: asiTab === "feat" ? theme.accent : theme.textSecondary,
                              fontWeight: asiTab === "feat" ? "700" : "500",
                            },
                          ]}
                        >
                          Feat
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* ASI Options */}
                    {asiTab === "asi" && (
                      <View style={{ gap: 10 }}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => setAsiMode("plus2")}
                            style={[
                              styles.lineageChip,
                              {
                                backgroundColor: asiMode === "plus2" ? theme.accentGlow : theme.surfaceHighlight,
                                borderColor: asiMode === "plus2" ? theme.accent : theme.border,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: asiMode === "plus2" ? theme.accent : theme.textSecondary,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              +2 to One Ability
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setAsiMode("plus1plus1")}
                            style={[
                              styles.lineageChip,
                              {
                                backgroundColor: asiMode === "plus1plus1" ? theme.accentGlow : theme.surfaceHighlight,
                                borderColor: asiMode === "plus1plus1" ? theme.accent : theme.border,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: asiMode === "plus1plus1" ? theme.accent : theme.textSecondary,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              +1 to Two Abilities
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {asiMode === "plus2" ? (
                          <View style={{ gap: 6 }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                              Select 1 ability score for +2:
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {ABILITY_KEYS.map((k) => {
                                const selected = asiPlus2Pick === k;
                                return (
                                  <TouchableOpacity
                                    key={k}
                                    onPress={() => setAsiPlus2Pick(selected ? null : k)}
                                    style={[
                                      styles.choiceChip,
                                      {
                                        backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                                        borderColor: selected ? theme.accent : theme.border,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={{
                                        color: selected ? theme.accent : theme.textSecondary,
                                        fontWeight: "700",
                                        fontSize: 13,
                                      }}
                                    >
                                      {ABILITY_LABELS[k]} (+2)
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        ) : (
                          <View style={{ gap: 6 }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                              Select 2 abilities for +1 each ({asiPlus1Picks.length}/2):
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {ABILITY_KEYS.map((k) => {
                                const selected = asiPlus1Picks.includes(k);
                                const canPick = !selected && asiPlus1Picks.length < 2;
                                return (
                                  <TouchableOpacity
                                    key={k}
                                    onPress={() => {
                                      if (selected) {
                                        setAsiPlus1Picks(asiPlus1Picks.filter((p) => p !== k));
                                      } else if (canPick) {
                                        setAsiPlus1Picks([...asiPlus1Picks, k]);
                                      }
                                    }}
                                    style={[
                                      styles.choiceChip,
                                      {
                                        backgroundColor: selected ? theme.accentGlow : theme.surfaceHighlight,
                                        borderColor: selected ? theme.accent : theme.border,
                                        opacity: !selected && !canPick ? 0.4 : 1,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={{
                                        color: selected ? theme.accent : theme.textSecondary,
                                        fontWeight: "700",
                                        fontSize: 13,
                                      }}
                                    >
                                      {ABILITY_LABELS[k]} (+1)
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        <Button
                          title={
                            asiMode === "plus2"
                              ? `Save ASI (+2 ${asiPlus2Pick ? asiPlus2Pick.toUpperCase() : ""})`
                              : `Save ASI (+1 ${asiPlus1Picks.map((p) => p.toUpperCase()).join(", ")})`
                          }
                          variant="primary"
                          size="sm"
                          disabled={asiMode === "plus2" ? !asiPlus2Pick : asiPlus1Picks.length !== 2}
                          onPress={() => handleSaveAsi(slot.className, slot.classLevel)}
                        />
                      </View>
                    )}

                    {/* Feat Options */}
                    {asiTab === "feat" && (
                      <View style={{ gap: 8 }}>
                        <SearchBar
                          value={asiFeatSearch}
                          onChangeText={setAsiFeatSearch}
                          placeholder="Search feats..."
                        />
                        <ScrollView
                          style={{ maxHeight: 220 }}
                          nestedScrollEnabled
                          contentContainerStyle={{ gap: 6 }}
                        >
                          {allFeats
                            .filter((f) => f.name.toLowerCase().includes(asiFeatSearch.toLowerCase()))
                            .map((f) => {
                              const isSelected = asiSelectedFeat?.name === f.name;
                              return (
                                <TouchableOpacity
                                  key={`${f.name}_${f.source}`}
                                  onPress={() => setAsiSelectedFeat(f)}
                                  style={[
                                    styles.featureRow,
                                    {
                                      backgroundColor: isSelected ? theme.accentGlow : theme.surfaceHighlight,
                                      borderColor: isSelected ? theme.accent : theme.border,
                                      padding: 8,
                                      borderRadius: 6,
                                    },
                                  ]}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={{
                                        color: isSelected ? theme.accent : theme.text,
                                        fontWeight: "700",
                                        fontSize: 13,
                                      }}
                                    >
                                      {f.name}
                                    </Text>
                                    <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                                      {f.source}
                                      {f.prerequisite ? ` • Prereq: ${f.prerequisite}` : ""}
                                    </Text>
                                  </View>
                                  <Button
                                    title="Info"
                                    variant="ghost"
                                    size="sm"
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      onViewDetail({
                                        title: f.name,
                                        source: f.source,
                                        description: f.description,
                                        tags: f.prerequisite ? [`Prereq: ${f.prerequisite}`] : [],
                                      });
                                    }}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                        </ScrollView>

                        {asiSelectedFeat && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              padding: 8,
                              backgroundColor: theme.surfaceHighlight,
                              borderRadius: 6,
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                            <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>
                              Selected: {asiSelectedFeat.name} ({asiSelectedFeat.source})
                            </Text>
                          </View>
                        )}

                        <Button
                          title={asiSelectedFeat ? `Save Feat: ${asiSelectedFeat.name}` : "Select a Feat"}
                          variant="primary"
                          size="sm"
                          disabled={!asiSelectedFeat}
                          onPress={() => handleSaveAsi(slot.className, slot.classLevel)}
                        />
                      </View>
                    )}
                  </View>
                )}
              </Card>
            );
          })}

          {/* Selected ASI / Feat choices */}
          {existingAsis.length > 0 && (
            <Card style={{ gap: 10 }}>
              <Text style={[styles.heading, { color: theme.text }]}>
                Selected Ability Improvements & Feats:
              </Text>
              {existingAsis.map((sel, idx) => {
                const clsName = sel.className || primaryClass || "Class";
                const lvl = sel.classLevel ?? sel.level;
                const slotKey = `${clsName}_${lvl}`;
                const isAsi = sel.type === "asi";
                const summary = isAsi
                  ? Object.entries(sel.asi || {})
                      .map(([k, v]) => `${k.toUpperCase()} +${v}`)
                      .join(", ")
                  : `Feat: ${sel.featName} (${sel.featSource || "PHB"})`;

                return (
                  <View
                    key={`${slotKey}_${idx}`}
                    style={[styles.featureRow, { borderColor: theme.border, justifyContent: "space-between" }]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Badge label={`${clsName} Lvl ${lvl}`} variant="accent" size="sm" />
                        <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                          {isAsi ? "Ability Score Improvement" : sel.featName}
                        </Text>
                      </View>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {summary}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {!isAsi && (
                        <Button
                          title="Info"
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            const f = allFeats.find((feat) => feat.name.toLowerCase() === sel.featName?.toLowerCase());
                            if (f) {
                              onViewDetail({ title: f.name, source: f.source, description: f.description });
                            }
                          }}
                        />
                      )}
                      <Button
                        title="Change"
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          onUpdate((current) => removeAsiSelection(current, clsName, lvl));
                          setActiveAsiSlot(slotKey);
                        }}
                      />
                      <Button
                        title="Remove"
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          onUpdate((current) => removeAsiSelection(current, clsName, lvl));
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          {/* Starting Equipment / Gold (only after first class) */}
          {hasAnyClass && (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.heading, { color: theme.text }]}>Starting Equipment & Gold:</Text>
                {character.startingGrantsApplied && (
                  <Badge label="Claimed" variant="success" size="sm" />
                )}
              </View>

              {character.startingGrantsApplied ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    backgroundColor: theme.surfaceHighlight,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>
                      Starting Grants Claimed ({character.startingOption === "gold" ? "Starting Gold" : "Starting Equipment"})
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {character.startingOption === "gold"
                        ? "Starting gold has been added to your currency pouch."
                        : "Standard class starting equipment has been added to your inventory."}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {(["equipment", "gold"] as const).map((opt) => {
                      const active = character.startingOption === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => onUpdate({ startingOption: opt })}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: active ? theme.accentGlow : theme.surface,
                              borderColor: active ? theme.accent : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? theme.accent : theme.textSecondary,
                              fontWeight: "600",
                              fontSize: 13,
                            }}
                          >
                            {opt === "equipment" ? "🎒 Equipment" : "💰 Gold"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {character.startingOption === "gold" ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        Average starting gold for {primaryClass || "Class"}:{" "}
                        <Text style={{ color: theme.accent, fontWeight: "700" }}>
                          {STARTING_GOLD_BY_CLASS[primaryClass || "Fighter"] ?? 100} gp
                        </Text>
                      </Text>
                      <Button
                        title={`Claim Starting Gold (${STARTING_GOLD_BY_CLASS[primaryClass || "Fighter"] ?? 100} gp)`}
                        variant="primary"
                        size="sm"
                        icon="cash-outline"
                        onPress={handleClaimGold}
                      />
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        Standard equipment pack for {primaryClass || "Class"}:
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                        {(CLASS_STARTING_EQUIPMENT[primaryClass || "Fighter"] || []).map((eq) => (
                          <Badge
                            key={eq.name}
                            label={`${eq.name}${eq.quantity > 1 ? ` (×${eq.quantity})` : ""}`}
                            variant="surface"
                            size="sm"
                          />
                        ))}
                      </View>
                      <Button
                        title="Claim Starting Equipment"
                        variant="primary"
                        size="sm"
                        icon="bag-add-outline"
                        onPress={handleClaimEquipment}
                      />
                    </View>
                  )}
                </>
              )}
            </Card>
          )}

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
                <Text style={[styles.heading, { color: theme.text }]}>
                  Optional &amp; Replacement Class Features:
                </Text>
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
                          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>
                            {opt.name}
                          </Text>
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
                              subtitle: `${opt.className} Lvl ${opt.level} • ${opt.replacesFeatureName ? `Replaces ${opt.replacesFeatureName}` : "Additional Feature"}`,
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
                const prereq = existing || !hasAnyClass
                  ? { ok: true }
                  : validateMulticlass(character, cl.name, effectiveScores);

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
                      <Button title="Info" variant="ghost" size="sm"
                        onPress={() => onViewDetail({ title: cl.name, source: cl.source,
                          description: cl.description, tags: [cl.hitDie, ...cl.savingThrows] })} />
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
      )}

      <DetailModal item={localDetail} onClose={() => setLocalDetail(null)} />
    </ScrollView>
  );
};

// ─── SkillPicker sub-component ────────────────────────────────────────────────

interface SkillPickerProps {
  label: string;
  choose: number;
  from: string[];
  chosen: string[];
  autoGranted: string[];
  onToggle: (s: string) => void;
  theme: any;
}

const SkillPicker: React.FC<SkillPickerProps> = ({
  label, choose, from, chosen, autoGranted, onToggle, theme,
}) => {
  const normFrom = from.map(normalizeSkillName);
  const normChosen = chosen.map(normalizeSkillName);
  const normAuto = autoGranted.map(normalizeSkillName);
  const pickerChosen = normChosen.filter((s) => normFrom.includes(s) && !normAuto.includes(s));
  const remaining = choose - pickerChosen.length;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
        <Text style={{ color: remaining === 0 ? theme.accent : theme.warning, fontSize: 12, fontWeight: "600" }}>
          {pickerChosen.length}/{choose}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {normFrom.map((s) => {
          const granted = normAuto.includes(s);
          const isChosen = normChosen.includes(s);
          const canPick = !granted && !isChosen && remaining > 0;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => !granted && (isChosen || canPick) ? onToggle(s) : undefined}
              style={[
                pkStyles.chip,
                {
                  backgroundColor: isChosen ? theme.accentGlow : theme.surfaceHighlight,
                  borderColor: isChosen ? theme.accent : theme.border,
                  opacity: !granted && !isChosen && !canPick ? 0.4 : 1,
                },
              ]}
            >
              {granted && <Ionicons name="lock-closed" size={10} color={theme.textMuted} style={{ marginRight: 3 }} />}
              <Text style={{ color: granted ? theme.textMuted : isChosen ? theme.accent : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── RuleChoicePicker sub-component ──────────────────────────────────────────

interface RuleChoicePickerProps {
  label: string;
  choose: number;
  from: string[];
  chosen: string[];
  autoGranted?: string[];
  onToggle: (item: string) => void;
  theme: any;
}

const RuleChoicePicker: React.FC<RuleChoicePickerProps> = ({
  label,
  choose,
  from,
  chosen,
  autoGranted = [],
  onToggle,
  theme,
}) => {
  const normFrom = from;
  const pickerChosen = chosen.filter((s) => normFrom.includes(s) && !autoGranted.includes(s));
  const remaining = choose - pickerChosen.length;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
        <Text style={{ color: remaining === 0 ? theme.accent : theme.warning, fontSize: 12, fontWeight: "600" }}>
          {pickerChosen.length}/{choose}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {normFrom.map((item) => {
          const granted = autoGranted.includes(item);
          const isChosen = chosen.includes(item);
          const canPick = !granted && !isChosen && remaining > 0;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => (!granted && (isChosen || canPick) ? onToggle(item) : undefined)}
              style={[
                pkStyles.chip,
                {
                  backgroundColor: isChosen ? theme.accentGlow : theme.surfaceHighlight,
                  borderColor: isChosen ? theme.accent : theme.border,
                  opacity: !granted && !isChosen && !canPick ? 0.4 : 1,
                },
              ]}
            >
              {granted && <Ionicons name="lock-closed" size={10} color={theme.textMuted} style={{ marginRight: 3 }} />}
              <Text
                style={{
                  color: granted ? theme.textMuted : isChosen ? theme.accent : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const pkStyles = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 6, borderWidth: 1,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  tabsScroll: { borderRadius: 10, borderWidth: 1 },
  tabsContent: { flexDirection: "row", gap: 2, padding: 4 },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 7, borderWidth: 1, minHeight: 44,
  },
  tabText: { fontSize: 13, fontWeight: "700" },

  section: { gap: 14 },
  banner: { padding: 10, borderRadius: 8, alignItems: "center" },

  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  methodText: { fontSize: 11 },

  poolChip: {
    width: 54, height: 54, borderRadius: 10, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },

  scoresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scoreCard: {
    width: "48%", alignItems: "center", padding: 12,
    borderRadius: 10, borderWidth: 1,
  },
  abilityLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  abilityMod: { fontSize: 26, fontWeight: "800", marginVertical: 2 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperBtn: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  baseNum: { fontSize: 18, fontWeight: "700", minWidth: 26, textAlign: "center" },
  scoreInput: { width: 60, height: 44, borderRadius: 8, borderWidth: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  saSlot: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  saX: { padding: 2 },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  bannerTitle: { fontSize: 16, fontWeight: "700" },
  heading: { fontSize: 14, fontWeight: "700" },
  itemTitle: { fontSize: 15, fontWeight: "700" },

  subracesBox: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", gap: 6 },
  subLabel: { fontSize: 12, fontWeight: "600" },
  subraceRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, minHeight: 44,
  },

  featureRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, borderBottomWidth: 1,
  },

  lineageChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, minHeight: 40, justifyContent: "center" },
  choiceChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, minHeight: 40, justifyContent: "center" },
  optionChip: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, alignItems: "center" },

  classRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 8, borderWidth: 1 },
  className: { fontSize: 16, fontWeight: "700" },
  levelNum: { fontSize: 18, fontWeight: "800", minWidth: 28, textAlign: "center" },

  subclassChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, minHeight: 40, justifyContent: "center" },
  input: { height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  modeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
});
