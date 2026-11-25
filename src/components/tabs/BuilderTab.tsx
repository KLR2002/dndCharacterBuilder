import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { UNSET_ABILITY_SCORE, unsetAbilityScores } from "../../constants/rules";
import { POINT_BUY_BUDGET, canSetPointBuyScore, pointBuySpent } from "../../rules/pointBuy";
import { proficiencySheet, sourceGrants } from "../../rules/proficiencySheet";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { currentCompendium } from "../../services/compendium";
import { totalLevel } from "../../rules/proficiencies";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { catalogListings, type CharacterCatalogs } from "../../rules/catalogs";
import {
  applyStartingGrants,
  clearRolledAbilityPicks,
  reclaimStartingGrants,
  rollRolledAbilities,
  setRolledAbilityPick,
  setStandardArrayPick,
  STARTING_GOLD_BY_CLASS,
} from "../../rules/builderTransitions";
import { appRandom } from "../../rules/dice";
import {
  setStartingEquipmentItems,
  setStartingEquipmentOption,
  startingEquipmentCard,
  type StartingEquipmentAddress,
} from "../../rules/startingEquipment";
import { SIDEKICK_CLASSES } from "../../rules/levelUpFlow";
import { proficiencyChoiceOffers } from "../../rules/proficiencyChoiceOffers";
import { getPendingLevelChoices } from "../../rules/leveling";
import { classChoicesStepView } from "../../rules/classChoices";
import { AbilityKey, Character, CreationStepId } from "../../types/character";
import { DetailModal } from "../DetailModal";
import { useFlowStepScrollContentPadding } from "../creationFlow/FlowShell";
import { AbilityScoresSection } from "../builder/AbilityScoresSection";
import { AncestrySection } from "../builder/AncestrySection";
import { BackgroundSection } from "../builder/BackgroundSection";
import { builderStyles as styles } from "../builder/builderStyles";
import { classChoiceTransitions } from "../builder/classChoiceWiring";
import { ClassSteps } from "../builder/ClassSteps";


interface BuilderTabProps {
  character?: Character;
  onUpdate?: (updates: Partial<Character> | ((character: Character) => Character)) => void;
  onViewDetail?: (item: any) => void;
  /**
   * The Creation Step this tab is hosted on in the Creation Flow: only that step's section renders and the
   * section nav is hidden. Unset in the free-form builder, where the nav switches sections.
   */
  step?: CreationStepId;
  /** Opens the Subclass step from the Class tab's archetype line. Unset where there is no Creation Flow. */
  onOpenSubclassStep?: () => void;
}

/** Which builder section hosts each Creation Step (spells, details and review are hosted by the flow itself). */
const STEP_SECTION: Partial<Record<CreationStepId, "abilities" | "race" | "background" | "class">> = {
  abilities: "abilities",
  race: "race",
  subrace: "race",
  background: "background",
  class: "class",
  subclass: "class",
  classChoices: "class",
  asiFeats: "class",
  equipment: "class",
};

export const BuilderTab: React.FC<BuilderTabProps> = ({
  character: propChar,
  onUpdate: propUpdate,
  onViewDetail: propViewDetail,
  step,
  onOpenSubclassStep,
}) => {
  const { theme } = useAppTheme();
  const { currentCharacter, updateCharacter: contextUpdate, activeBooks, fullHealOnLevelUp } = useCharacters();

  const [localDetail, setLocalDetail] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<"abilities" | "race" | "background" | "class">("abilities");
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  const [pendingRoll, setPendingRoll] = useState<number | null>(null);

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
  // In the Creation Flow the scroll content pads its bottom on phones so the floating dice button never
  // covers the last rows.
  const flowScrollPad = useFlowStepScrollContentPadding();

  if (!character) return null;

  // ── Data ──────────────────────────────────────────────────────────────────
  const catalogs: CharacterCatalogs = { compendium: currentCompendium(), activeBooks };
  const listings = catalogListings(catalogs);
  const allRaces = listings.races();
  const allClasses = listings.classes().filter((cl) => !SIDEKICK_CLASSES.has(cl.name));
  const allBackgrounds = listings.backgrounds();
  const allFeats = currentCompendium().for(activeBooks).feats();

  const { scores: effectiveScores, modifiers } = evaluateCharacter(character, catalogs).effectiveScores;
  const level = totalLevel(character);
  const primaryClass = character.classes[0]?.className;

  const { pendingAsi } = getPendingLevelChoices(character, allClasses);
  const classChoices = classChoicesStepView(character, { compendium: currentCompendium(), activeBooks });

  // ─────────────────────────────────────────────────────────────────────────
  // ABILITY SCORES
  // ─────────────────────────────────────────────────────────────────────────
  const pointBuyRemaining = POINT_BUY_BUDGET - pointBuySpent(character.baseAbilityScores ?? {});

  const updateBaseScore = (key: AbilityKey, delta: number) => {
    const current = character.baseAbilityScores?.[key] ?? UNSET_ABILITY_SCORE;
    const next = current + delta;
    if (character.abilityMethod === "pointBuy" && !canSetPointBuyScore(character.baseAbilityScores ?? {}, key, next)) {
      return;
    }
    onUpdate({
      baseAbilityScores: {
        ...(character.baseAbilityScores || unsetAbilityScores()),
        [key]: Math.max(1, next),
      },
    });
  };

  const setManualScore = (key: AbilityKey, text: string) => {
    const val = parseInt(text, 10);
    onUpdate({
      baseAbilityScores: {
        ...character.baseAbilityScores,
        [key]: isNaN(val) ? UNSET_ABILITY_SCORE : Math.max(1, Math.min(30, val)),
      },
    });
  };

  const assignedValues = Object.values(saAssignments).filter((v): v is number => v != null);

  const resetSA = () => {
    setPendingValue(null);
    onUpdate((current) => ({
      ...current,
      standardArrayPicks: {},
      baseAbilityScores: unsetAbilityScores(),
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

  const rolledResults = character.rolledAbilities ?? [];
  const rolledPicks = character.rolledAbilityPicks ?? {};

  const handleRoll = () => {
    setPendingRoll(null);
    onUpdate((current) => rollRolledAbilities(current, appRandom));
  };

  const handleRollPoolTap = (index: number) => {
    setPendingRoll(pendingRoll === index ? null : index);
  };

  const handleRollSlotTap = (key: AbilityKey) => {
    onUpdate((current) => setRolledAbilityPick(current, key, pendingRoll));
    setPendingRoll(null);
  };

  const unassignRollSlot = (key: AbilityKey) => {
    onUpdate((current) => setRolledAbilityPick(current, key, null));
  };

  const resetRolled = () => {
    setPendingRoll(null);
    onUpdate((current) => clearRolledAbilityPicks(current));
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
    onUpdate((current) => applyStartingGrants(current, "gold", { goldAmount, catalogs }));
  };

  const handleClaimEquipment = () => {
    if (!primaryClass) return;
    onUpdate((current) => applyStartingGrants(current, "equipment", { catalogs }));
  };

  const handleClaimAgain = () => {
    if (!primaryClass) return;
    const mode = character.startingOption;
    const options = { goldAmount: mode === "gold" ? startingGoldFor(primaryClass) : undefined, catalogs };
    onUpdate((current) => reclaimStartingGrants(current, mode, options));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SKILLS, LANGUAGES & TOOLS
  // ─────────────────────────────────────────────────────────────────────────
  const classChoiceActions = classChoiceTransitions(onUpdate, activeBooks);

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

  // Hosted on one Creation Step, the matching section renders alone; the nav is hidden.
  const hostedSection = step ? STEP_SECTION[step] : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, flowScrollPad]}>
      {/* ── Section Tab Nav ── */}
      {!step && (
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
                  borderColor: active ? theme.accentHover : "transparent",
                },
              ]}
            >
              <Ionicons name={icon} size={15} color={active ? theme.accentHover : theme.textSecondary} />
              <Text style={[styles.tabText, { color: active ? theme.accentHover : theme.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      )}

      {(hostedSection ?? activeSection) === "abilities" && (
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
          rolledResults={rolledResults}
          rolledPicks={rolledPicks}
          pendingRoll={pendingRoll}
          onRoll={handleRoll}
          onRollPoolTap={handleRollPoolTap}
          onRollSlotTap={handleRollSlotTap}
          onUnassignRollSlot={unassignRollSlot}
          onResetRolled={resetRolled}
          theme={theme}
        />
      )}

      {(hostedSection ?? activeSection) === "race" && (
        <AncestrySection
          character={character}
          onUpdate={onUpdate}
          allRaces={allRaces}
          raceGranted={raceGranted}
          proficiencyChoices={raceProficiencyChoices}
          onViewDetail={onViewDetail}
          theme={theme}
          step={step === "subrace" ? "subrace" : step === "race" ? "race" : undefined}
        />
      )}

      {(hostedSection ?? activeSection) === "background" && (
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

      {(hostedSection ?? activeSection) === "class" && (
        <ClassSteps
          character={character}
          onUpdate={onUpdate}
          step={step}
          onOpenSubclassStep={onOpenSubclassStep}
          fullHealOnLevelUp={fullHealOnLevelUp}
          allClasses={allClasses}
          allFeats={allFeats}
          totalLevel={level}
          effectiveScores={effectiveScores}
          classChoices={classChoices}
          onToggleRuleChoice={classChoiceActions.onToggleRuleChoice}
          onClearChoice={classChoiceActions.onClearChoice}
          onToggleExpertise={classChoiceActions.onToggleExpertise}
          onPruneInvalidExpertise={classChoiceActions.onPruneInvalidExpertise}
          onToggleOptionalFeature={classChoiceActions.onToggleOptionalFeature}
          classTools={classTools}
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
