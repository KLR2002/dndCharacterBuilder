import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { POINT_BUY_COST } from "../../constants/rules";
import { proficiencySheet, ruleGrantedSkills, skillChoiceOffers, sourceGrants } from "../../rules/proficiencySheet";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { getFeats } from "../../services/dataService";
import { currentCompendium } from "../../services/compendium";
import { calculateTotalLevel } from "../../services/dndRules";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { catalogListings, type CharacterCatalogs } from "../../rules/catalogs";
import {
  applyStartingGrants,
  reclaimStartingGrants,
  setStandardArrayPick,
  STARTING_GOLD_BY_CLASS,
} from "../../rules/builderTransitions";
import {
  setStartingEquipmentItems,
  setStartingEquipmentOption,
  startingEquipmentCard,
  type StartingEquipmentAddress,
} from "../../rules/startingEquipment";
import { reconcile } from "../../rules/characterReconciler";
import { proficiencyChoiceOffers } from "../../rules/proficiencyChoiceOffers";
import { getPendingLevelChoices } from "../../rules/leveling";
import { normalizeSkillName } from "../../rules/skills";
import { getAvailableOptionalFeatures } from "../../rules/optionalFeatures";
import { AbilityKey, Character, SkillChoiceEntry } from "../../types/character";
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
  const { currentCharacter, updateCharacter: contextUpdate, activeBooks, fullHealOnLevelUp } = useCharacters();

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
  const startingGoldFor = (className: string) => STARTING_GOLD_BY_CLASS[className] ?? 100;

  // The equipment slots of the first class with the player's picks, shown on the claim card.
  const startingCard = startingEquipmentCard(character, catalogs);

  const handlePickOption = (slot: number, letter: string) => {
    onUpdate((current) => setStartingEquipmentOption(current, slot, letter, catalogs));
  };

  const handlePickItems = (address: StartingEquipmentAddress, names: string[]) => {
    onUpdate((current) => setStartingEquipmentItems(current, address, names, catalogs));
  };

  const handleClaimGold = () => {
    if (!primaryClass) return;
    const goldAmount = startingGoldFor(primaryClass);
    onUpdate((current) => applyStartingGrants(current, "gold", { goldAmount }));
  };

  const handleClaimEquipment = () => {
    if (!primaryClass) return;
    onUpdate((current) => applyStartingGrants(current, "equipment", { catalogs }));
  };

  const handleClaimAgain = () => {
    if (!primaryClass) return;
    const mode = character.startingOption;
    const options = mode === "gold" ? { goldAmount: startingGoldFor(primaryClass) } : { catalogs };
    onUpdate((current) => reclaimStartingGrants(current, mode, options));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SKILLS, LANGUAGES & TOOLS
  // ─────────────────────────────────────────────────────────────────────────
  const autoGrantedBase = ruleGrantedSkills(character, catalogs);

  // The class's skill choice is the only skill choice on this path. Race, subrace and background skill picks are
  // Proficiency Choices, offered below.
  type SkillChoice = { source: string; choose: number; from: string[] };
  const skillChoices: SkillChoice[] = skillChoiceOffers(character, catalogs);

  const getPickedSkillsForSource = (source: string): string[] => {
    const entry = (character.skillChoices || []).find((sc) => sc.id === source);
    if (entry) return entry.picked;
    const sc = skillChoices.find((c) => c.source === source);
    if (!sc) return [];
    const normFrom = sc.from.map(normalizeSkillName);
    const available = (character.chosenSkills || [])
      .map(normalizeSkillName)
      .filter((s) => !autoGrantedBase.includes(s));
    return available.filter((s) => normFrom.includes(s)).slice(0, sc.choose);
  };

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

    const updatedSkillChoices: SkillChoiceEntry[] = [];
    let updatedTarget = false;

    for (const sc of skillChoices) {
      if (sc.source === targetSource) {
        updatedSkillChoices.push({
          id: sc.source,
          origin: "class",
          choose: sc.choose,
          from: sc.from,
          picked: nextPicks,
        });
        updatedTarget = true;
      } else {
        updatedSkillChoices.push({
          id: sc.source,
          origin: "class",
          choose: sc.choose,
          from: sc.from,
          picked: getPickedSkillsForSource(sc.source),
        });
      }
    }

    if (!updatedTarget) {
      updatedSkillChoices.push({
        id: targetSource,
        origin: "class",
        choose: maxChoose,
        from: targetSc ? targetSc.from : [norm],
        picked: nextPicks,
      });
    }

    // The old skill bucket keeps every skill no class choice holds, so a name saved there is never dropped.
    const previousClassPicks = new Set(
      (character.skillChoices || [])
        .filter((sc) => sc.origin === "class")
        .flatMap((sc) => sc.picked.map(normalizeSkillName))
    );
    const classPicks = updatedSkillChoices.flatMap((sc) => sc.picked.map(normalizeSkillName));
    const allPicked = Array.from(
      new Set([
        ...(character.chosenSkills || []).map(normalizeSkillName).filter((s) => !previousClassPicks.has(s)),
        ...classPicks,
      ])
    );

    onUpdate((cur) =>
      reconcile(
        {
          ...cur,
          chosenSkills: allPicked,
          // A legacy race or background entry is kept as saved: it holds only the picks no choice took.
          skillChoices: [...updatedSkillChoices, ...(cur.skillChoices || []).filter((sc) => sc.origin !== "class")],
        },
        currentCompendium(),
        { activeBooks }
      )
    );
  };

  const { race: raceGranted, background: backgroundGranted, classTools } = sourceGrants(character, catalogs);
  const proficiencyOffers = proficiencyChoiceOffers(character, { activeBooks });
  const raceProficiencyChoices = proficiencyOffers.filter((choice) => choice.origin === "race");
  const backgroundProficiencyChoices = proficiencyOffers.filter((choice) => choice.origin === "background");

  // The Proficiency Sheet is the one source for the language and tool lists the Builder shows.
  const sheet = proficiencySheet(character, catalogs);
  const resolvedLanguages = sheet.languages.map((l) => l.name);
  const resolvedTools = sheet.tools.map((t) => t.name);

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
          raceGranted={raceGranted}
          proficiencyChoices={raceProficiencyChoices}
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
          bgGranted={backgroundGranted}
          proficiencyChoices={backgroundProficiencyChoices}
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
          fullHealOnLevelUp={fullHealOnLevelUp}
          allClasses={allClasses}
          allFeats={allFeats}
          totalLevel={totalLevel}
          effectiveScores={effectiveScores}
          skillChoices={skillChoices}
          autoGranted={autoGrantedBase}
          toggleSkill={toggleSkill}
          classTools={classTools}
          availableOptionalFeatures={availableOptionalFeatures}
          pendingAsiSlots={pendingAsi}
          primaryClass={primaryClass}
          startingCard={startingCard}
          onPickOption={handlePickOption}
          onPickItems={handlePickItems}
          onClaimGold={handleClaimGold}
          onClaimEquipment={handleClaimEquipment}
          onClaimAgain={handleClaimAgain}
          onViewDetail={onViewDetail}
          theme={theme}
          activeBooks={activeBooks}
        />
      )}

      <DetailModal item={localDetail} onClose={() => setLocalDetail(null)} />
    </ScrollView>
  );
};
