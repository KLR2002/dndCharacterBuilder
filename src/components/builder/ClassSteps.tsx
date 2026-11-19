import type { ActiveBooks } from "../../constants/books";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { applySoleSubclasses } from "../../rules/builderTransitions";
import type { AvailableRuleChoice } from "../../rules/ruleChoices";
import type { ClassChoicesStepView } from "../../rules/classChoices";
import type { StartingEquipmentAddress, StartingEquipmentCard } from "../../rules/startingEquipment";
import { currentCompendium } from "../../services/compendium";
import type { AbilityKey, Character, CreationStepId } from "../../types/character";
import { ClassData, FeatData } from "../../types/dnd5e";
import { AsiFeatSection, PendingAsiSlot } from "./AsiFeatSection";
import { ClassChoiceCards } from "./ClassChoiceCards";
import { ClassEquipmentSection } from "./ClassEquipmentSection";
import { ClassLevelsSection } from "./ClassLevelsSection";
import { ClassListSection } from "./ClassListSection";
import { OptionalFeatureCard } from "./OptionalFeatureCard";
import { SubclassSection } from "./SubclassSection";
import { builderStyles as styles } from "./builderStyles";

export interface ClassStepsProps {
  character: Character;
  onUpdate: (
    patchOrUpdater: Partial<Character> | ((prev: Character) => Character),
  ) => void;
  fullHealOnLevelUp: boolean;
  allClasses: ClassData[];
  allFeats: FeatData[];
  totalLevel: number;
  effectiveScores: Record<AbilityKey, number>;
  /** The Class Choices step's view: its skill picks, choice cards, Expertise and optional features. */
  classChoices: ClassChoicesStepView;
  onToggleRuleChoice: (choice: AvailableRuleChoice, option: string) => void;
  onClearChoice: (choice: AvailableRuleChoice) => void;
  onToggleExpertise: (item: string) => void;
  onPruneInvalidExpertise: () => void;
  onToggleOptionalFeature: (featureName: string) => void;
  /** The fixed tools the first class starts with. */
  classTools: string[];
  pendingAsiSlots: PendingAsiSlot[];
  primaryClass?: string;
  /** The first class's equipment slots with the picks made in them. */
  startingCard: StartingEquipmentCard;
  onPickOption: (slot: number, letter: string) => void;
  onPickItems: (address: StartingEquipmentAddress, names: string[]) => void;
  onClaimGold: () => void;
  onClaimEquipment: () => void;
  onClaimAgain: () => void;
  onViewDetail: (item: {
    title: string;
    subtitle?: string;
    source?: string;
    description?: string;
    tags?: string[];
  }) => void;
  theme: any;
  activeBooks: ActiveBooks;
  /**
   * The Creation Step this section is hosted on in the Creation Flow: only that step's parts render. Unset in
   * the free-form builder, where every part renders in order.
   */
  step?: CreationStepId;
}

/**
 * The Class tab's parts in on-screen order: the levels, the subclass prompts, the Class Choices cards and Expertise,
 * the ASI and feat slots, the equipment, the optional features, and the class list. Subclass change state is shared
 * between the levels and the subclass prompts, and the sole-subclass sync runs for as long as this host is mounted.
 */
export const ClassSteps: React.FC<ClassStepsProps> = ({
  character,
  onUpdate,
  fullHealOnLevelUp,
  allClasses,
  allFeats,
  totalLevel,
  effectiveScores,
  classChoices,
  onToggleRuleChoice,
  onClearChoice,
  onToggleExpertise,
  onPruneInvalidExpertise,
  onToggleOptionalFeature,
  classTools,
  pendingAsiSlots,
  primaryClass,
  startingCard,
  onPickOption,
  onPickItems,
  onClaimGold,
  onClaimEquipment,
  onClaimAgain,
  onViewDetail,
  theme,
  activeBooks,
  step,
}) => {
  const [changingSubclassFor, setChangingSubclassFor] = useState<string | null>(null);
  const hasAnyClass = (character.classes || []).length > 0;
  // SRD mode has exactly one subclass per class, so there is no choice to offer: it is applied instead.
  const isSrd = !currentCompendium().integrated;

  // Re-runs on a compendium mode switch too (isSrd), since the sole subclass depends on the compendium.
  useEffect(() => {
    const next = applySoleSubclasses(character, currentCompendium(), activeBooks);
    if (next !== character) {
      onUpdate((current) => applySoleSubclasses(current, currentCompendium(), activeBooks));
    }
  }, [character, isSrd, onUpdate, activeBooks]);

  const picks = {
    ruleChoices: character.ruleChoices,
    proficiencyPicks: character.proficiencyPicks,
  };

  return (
    <View style={styles.section}>
      {(!step || step === "class") && (
        <ClassLevelsSection
          character={character}
          onUpdate={onUpdate}
          fullHealOnLevelUp={fullHealOnLevelUp}
          totalLevel={totalLevel}
          activeBooks={activeBooks}
          step={step}
          changingSubclassFor={changingSubclassFor}
          setChangingSubclassFor={setChangingSubclassFor}
          theme={theme}
        />
      )}

      {(!step || step === "subclass") && (
        <SubclassSection
          character={character}
          onUpdate={onUpdate}
          activeBooks={activeBooks}
          changingSubclassFor={changingSubclassFor}
          setChangingSubclassFor={setChangingSubclassFor}
          theme={theme}
        />
      )}

      {(!step || step === "classChoices") && (
        <ClassChoiceCards
          view={classChoices}
          picks={picks}
          onToggleRuleChoice={onToggleRuleChoice}
          onClearChoice={onClearChoice}
          onToggleExpertise={onToggleExpertise}
          onPruneInvalidExpertise={onPruneInvalidExpertise}
          theme={theme}
        />
      )}

      {(!step || step === "asiFeats") && (
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
      )}

      {(!step || step === "equipment") && (
        <ClassEquipmentSection
          character={character}
          onUpdate={onUpdate}
          primaryClass={primaryClass}
          startingCard={startingCard}
          classTools={classTools}
          onPickOption={onPickOption}
          onPickItems={onPickItems}
          onClaimGold={onClaimGold}
          onClaimEquipment={onClaimEquipment}
          onClaimAgain={onClaimAgain}
          theme={theme}
        />
      )}

      {(!step || step === "classChoices") && hasAnyClass && (
        <OptionalFeatureCard
          options={classChoices.optionalFeatures}
          replacements={character.optionalFeatureReplacements}
          onToggle={onToggleOptionalFeature}
          onViewDetail={onViewDetail}
          theme={theme}
        />
      )}

      {(!step || step === "class") && (
        <ClassListSection
          character={character}
          onUpdate={onUpdate}
          fullHealOnLevelUp={fullHealOnLevelUp}
          allClasses={allClasses}
          effectiveScores={effectiveScores}
          step={step}
          onViewDetail={onViewDetail}
          theme={theme}
        />
      )}
    </View>
  );
};
