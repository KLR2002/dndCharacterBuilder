import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DND_SKILLS, POINT_BUY_COST } from "../../constants/rules";
import {
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
import { findClass, findItem, getFeats } from "../../services/dataService";
import { currentCompendium } from "../../services/compendium";
import { calculateTotalLevel } from "../../services/dndRules";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { catalogListings, type CharacterCatalogs } from "../../rules/catalogs";
import {
  applyStartingGrants,
  CLASS_STARTING_EQUIPMENT,
  setStandardArrayPick,
  STARTING_GOLD_BY_CLASS,
} from "../../rules/builderTransitions";
import { reconcile } from "../../rules/characterReconciler";
import { ancestryRuleChoices, availableRuleChoices } from "../../rules/ruleChoices";
import { getPendingLevelChoices } from "../../rules/leveling";
import {
  getAutoGrantedSkills,
  getRacialSkillChoices,
  normalizeSkillName,
} from "../../rules/skills";
import { getAvailableOptionalFeatures } from "../../rules/optionalFeatures";
import { AbilityKey, Character, InventoryItem, SkillChoiceEntry } from "../../types/character";
import { DetailModal } from "../DetailModal";
import { AbilityScoresSection } from "../builder/AbilityScoresSection";
import { AncestrySection } from "../builder/AncestrySection";
import { BackgroundSection } from "../builder/BackgroundSection";
import { builderStyles as styles } from "../builder/builderStyles";
import { ClassProgressionSection } from "../builder/ClassProgressionSection";

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SIDEKICK_CLASSES = new Set(["Expert Sidekick", "Spellcaster Sidekick", "Warrior Sidekick"]);

interface BuilderTabProps {
  character?: Character;
  onUpdate?: (updates: Partial<Character> | ((character: Character) => Character)) => void;
  onViewDetail?: (item: any) => void;
}

export const BuilderTab: React.FC<BuilderTabProps> = ({
  character: propChar,
  onUpdate: propUpdate,
  onViewDetail: propViewDetail,
}) => {
  const { theme } = useAppTheme();
  const { currentCharacter, updateCharacter: contextUpdate, activeBooks } = useCharacters();

  const [localDetail, setLocalDetail] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<"abilities" | "race" | "background" | "class">("abilities");
  const [pendingValue, setPendingValue] = useState<number | null>(null);

  const character = propChar || currentCharacter;
  const onUpdate =
    propUpdate ||
    ((updates: Partial<Character> | ((current: Character) => Character)) => {
      if (character) {
        contextUpdate(character.id, (current) =>
          typeof updates === "function" ? updates(current) : { ...current, ...updates }
        );
      }
    });

  const saAssignments = character?.standardArrayPicks ?? {};
  const onViewDetail = propViewDetail || ((item: any) => setLocalDetail(item));

  if (!character) return null;

  // ── Data ──────────────────────────────────────────────────────────────────
  const catalogs: CharacterCatalogs = { compendium: currentCompendium(), activeBooks };
  const listings = catalogListings(catalogs);
  const allRaces = listings.races();
  const allClasses = listings.classes().filter((cl) => !SIDEKICK_CLASSES.has(cl.name));
  const allBackgrounds = listings.backgrounds();
  const allFeats = getFeats(activeBooks);

  const { scores: effectiveScores, modifiers } = evaluateCharacter(character).effectiveScores;
  const totalLevel = calculateTotalLevel(character);
  const primaryClass = character.classes[0]?.className;

  const { pendingAsi } = getPendingLevelChoices(character, allClasses);
  const availableOptionalFeatures = getAvailableOptionalFeatures(character, allClasses);

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

  const assignedValues = Object.values(saAssignments).filter((v): v is number => v != null);

  const resetSA = () => {
    setPendingValue(null);
    onUpdate((current) => ({
      ...current,
      standardArrayPicks: {},
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    }));
  };

  const handlePoolTap = (v: number) => {
    setPendingValue(pendingValue === v ? null : v);
  };

  const handleSlotTap = (key: AbilityKey) => {
    onUpdate((current) => setStandardArrayPick(current, key, pendingValue));
    setPendingValue(null);
  };

  const unassignSlot = (key: AbilityKey) => {
    onUpdate((current) => setStandardArrayPick(current, key, null));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STARTING GRANTS HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const handleClaimGold = () => {
    if (!primaryClass) return;
    const goldAmount = STARTING_GOLD_BY_CLASS[primaryClass] ?? 100;
    onUpdate((current) => applyStartingGrants(current, "gold", { goldAmount }));
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
        cost: itemData?.cost ?? null,
        damage: itemData?.damage || null,
        damageType: itemData?.damageType || null,
        range: itemData?.range || null,
        ac: itemData?.ac ?? null,
        description: itemData?.description || "",
      };
    });
    onUpdate((current) => applyStartingGrants(current, "equipment", { equipmentItems }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SKILLS, LANGUAGES & TOOLS
  // ─────────────────────────────────────────────────────────────────────────
  const autoGrantedBase = getAutoGrantedSkills(character, {
    races: allRaces,
    backgrounds: allBackgrounds,
  });

  const chosenAncestryOption = (c: typeof character, catalog: typeof allRaces): string | undefined => {
    const entry = (c.ruleChoices ?? [])[0];
    if (!entry) return undefined;
    const match = ancestryRuleChoices(c, catalog).find((choice) => choice.id === entry.id);
    return match?.options.some((o) => o.name === entry.picked[0]) ? entry.picked[0] : undefined;
  };

  type SkillChoice = { source: string; choose: number; from: string[] };
  const skillChoices: SkillChoice[] = [];

  if (character.race) {
    const racialChoices = getRacialSkillChoices(
      character.race.name,
      character.race.subraceName,
      allRaces,
      character.race.source,
      chosenAncestryOption(character, allRaces)
    );
    for (const rc of racialChoices) {
      skillChoices.push({
        source: rc.source,
        choose: rc.choose,
        from: rc.from.map(normalizeSkillName),
      });
    }
  }

  if (character.classes.length > 0) {
    const classData = findClass(character.classes[0].className, character.classes[0].source);
    if (classData?.skillProficiencies) {
      const { choose, from } = classData.skillProficiencies;
      const fromList =
        from && from.length > 0 ? from.map(normalizeSkillName) : DND_SKILLS.map((s) => normalizeSkillName(s.name));
      if (choose > 0) {
        skillChoices.push({
          source: `Class: ${character.classes[0].className}`,
          choose,
          from: fromList,
        });
      }
    }
  }

  const raceChoices = skillChoices.filter(
    (sc) => sc.source.startsWith("Race:") || sc.source.startsWith("Variant")
  );
  const classChoices = skillChoices.filter((sc) => sc.source.startsWith("Class:"));

  const getPickedSkillsForSource = (source: string): string[] => {
    const entry = (character.skillChoices || []).find((sc) => sc.id === source);
    if (entry) return entry.picked;
    const sc = skillChoices.find((c) => c.source === source);
    if (!sc) return [];
    const normFrom = sc.from.map(normalizeSkillName);
    const available = (character.chosenSkills || [])
      .map(normalizeSkillName)
      .filter((s) => !autoGrantedBase.includes(s));
    if (source.startsWith("Race:") || source.startsWith("Variant")) {
      return available.filter((s) => normFrom.includes(s)).slice(0, sc.choose);
    }
    const racePicks = new Set(
      raceChoices.flatMap((rc) =>
        available.filter((s) => rc.from.map(normalizeSkillName).includes(s)).slice(0, rc.choose)
      )
    );
    return available.filter((s) => !racePicks.has(s) && normFrom.includes(s)).slice(0, sc.choose);
  };

  const racePickedSkills = raceChoices.flatMap((rc) => getPickedSkillsForSource(rc.source));
  const classPickedSkills = classChoices.flatMap((cc) => getPickedSkillsForSource(cc.source));

  const raceAutoGranted = Array.from(new Set([...autoGrantedBase, ...classPickedSkills]));
  const classAutoGranted = Array.from(new Set([...autoGrantedBase, ...racePickedSkills]));

  const toggleSkill = (s: string, source?: string) => {
    const norm = normalizeSkillName(s);
    const targetSource =
      source ||
      skillChoices.find((sc) => sc.from.map(normalizeSkillName).includes(norm))?.source ||
      "custom";
    const targetSc = skillChoices.find((sc) => sc.source === targetSource);
    const maxChoose = targetSc?.choose ?? 1;

    const currentPicks = getPickedSkillsForSource(targetSource);
    const normPicks = currentPicks.map(normalizeSkillName);
    let nextPicks: string[];
    if (normPicks.includes(norm)) {
      nextPicks = currentPicks.filter((x) => normalizeSkillName(x) !== norm);
    } else {
      if (currentPicks.length < maxChoose) {
        nextPicks = [...currentPicks, norm];
      } else {
        return;
      }
    }

    const origin: "race" | "class" | "background" =
      targetSource.startsWith("Race:") || targetSource.startsWith("Variant")
        ? "race"
        : targetSource.startsWith("Class:")
        ? "class"
        : "background";

    const updatedSkillChoices: SkillChoiceEntry[] = [];
    let updatedTarget = false;

    for (const sc of skillChoices) {
      if (sc.source === targetSource) {
        updatedSkillChoices.push({
          id: sc.source,
          origin,
          choose: sc.choose,
          from: sc.from,
          picked: nextPicks,
        });
        updatedTarget = true;
      } else {
        const scOrigin: "race" | "class" = sc.source.startsWith("Class:") ? "class" : "race";
        updatedSkillChoices.push({
          id: sc.source,
          origin: scOrigin,
          choose: sc.choose,
          from: sc.from,
          picked: getPickedSkillsForSource(sc.source),
        });
      }
    }

    if (!updatedTarget) {
      updatedSkillChoices.push({
        id: targetSource,
        origin,
        choose: maxChoose,
        from: targetSc ? targetSc.from : [norm],
        picked: nextPicks,
      });
    }

    for (const existing of character.skillChoices || []) {
      if (existing.origin === "background" && !updatedSkillChoices.some((u) => u.id === existing.id)) {
        updatedSkillChoices.push(existing);
      }
    }

    const allPicked = Array.from(new Set(updatedSkillChoices.flatMap((sc) => sc.picked.map(normalizeSkillName))));

    onUpdate((cur) =>
      reconcile(
        {
          ...cur,
          chosenSkills: allPicked,
          skillChoices: updatedSkillChoices,
        },
        currentCompendium()
      )
    );
  };

  const raceLanguageGrant = getRaceLanguageGrant(
    character.race?.name,
    character.race?.subraceName,
    allRaces,
    character.race?.source,
    character.race?.subraceSource
  );
  const raceToolGrant = getRaceToolGrant(character.race?.name, character.race?.subraceName, allRaces);
  const ruleChoices = availableRuleChoices(character, allRaces, totalLevel, activeBooks);
  const bgLanguageGrant = getBackgroundLanguageGrant(character.background?.name, allBackgrounds);
  const bgToolGrant = getBackgroundToolGrant(character.background?.name, allBackgrounds);
  const classToolGrant = getClassToolGrant(primaryClass, allClasses);

  const resolvedLanguages = resolveCharacterLanguages(character, catalogs);
  const resolvedTools = resolveCharacterTools(character, catalogs);

  const toggleRaceLanguage = (lang: string) => {
    const cur = character.chosenLanguages?.race || [];
    const next = cur.includes(lang) ? cur.filter((x) => x !== lang) : [...cur, lang];
    const nextChosen = { ...character.chosenLanguages, race: next };
    const temp = { ...character, chosenLanguages: nextChosen };
    const resolved = resolveCharacterLanguages(temp, catalogs);
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
    const resolved = resolveCharacterLanguages(temp, catalogs);
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

  const sectionTabs = [
    { key: "abilities" as const, label: "Abilities", icon: "body-outline" as const },
    { key: "race" as const, label: "Race", icon: "leaf-outline" as const },
    { key: "background" as const, label: "Background", icon: "book-outline" as const },
    { key: "class" as const, label: "Class", icon: "shield-outline" as const },
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
              <Text style={[styles.tabText, { color: active ? theme.accent : theme.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeSection === "abilities" && (
        <AbilityScoresSection
          character={character}
          onUpdate={onUpdate}
          effectiveScores={effectiveScores}
          modifiers={modifiers}
          pointBuyRemaining={pointBuyRemaining}
          saAssignments={saAssignments}
          assignedValues={assignedValues}
          pendingValue={pendingValue}
          onPoolTap={handlePoolTap}
          onSlotTap={handleSlotTap}
          onUnassignSlot={unassignSlot}
          onResetSA={resetSA}
          onUpdateBaseScore={updateBaseScore}
          onSetManualScore={setManualScore}
          theme={theme}
        />
      )}

      {activeSection === "race" && (
        <AncestrySection
          character={character}
          onUpdate={onUpdate}
          allRaces={allRaces}
          skillChoices={skillChoices}
          autoGranted={raceAutoGranted}
          toggleSkill={toggleSkill}
          raceLanguageGrant={raceLanguageGrant}
          toggleRaceLanguage={toggleRaceLanguage}
          raceToolGrant={raceToolGrant}
          toggleRaceTool={toggleRaceTool}
          ruleChoices={ruleChoices}
          onViewDetail={onViewDetail}
          theme={theme}
        />
      )}

      {activeSection === "background" && (
        <BackgroundSection
          character={character}
          onUpdate={onUpdate}
          allBackgrounds={allBackgrounds}
          catalogs={catalogs}
          bgLanguageGrant={bgLanguageGrant}
          toggleBgLanguage={toggleBgLanguage}
          bgToolGrant={bgToolGrant}
          toggleBgTool={toggleBgTool}
          raceLanguageGrant={raceLanguageGrant}
          resolvedLanguages={resolvedLanguages}
          resolvedTools={resolvedTools}
          onViewDetail={onViewDetail}
          theme={theme}
        />
      )}

      {activeSection === "class" && (
        <ClassProgressionSection
          character={character}
          onUpdate={onUpdate}
          allClasses={allClasses}
          allFeats={allFeats}
          totalLevel={totalLevel}
          effectiveScores={effectiveScores}
          skillChoices={skillChoices}
          autoGranted={classAutoGranted}
          toggleSkill={toggleSkill}
          classToolGrant={classToolGrant}
          toggleClassTool={toggleClassTool}
          availableOptionalFeatures={availableOptionalFeatures}
          pendingAsiSlots={pendingAsi}
          primaryClass={primaryClass}
          onClaimGold={handleClaimGold}
          onClaimEquipment={handleClaimEquipment}
          onViewDetail={onViewDetail}
          theme={theme}
          activeBooks={activeBooks}
        />
      )}

      <DetailModal item={localDetail} onClose={() => setLocalDetail(null)} />
    </ScrollView>
  );
};
