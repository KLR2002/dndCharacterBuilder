import type { ActiveBooks } from "../../constants/books";
import { setOptionalFeatureEnabled } from "../../rules/builderTransitions";
import { reconcile } from "../../rules/characterReconciler";
import { toggleExpertiseChoice } from "../../rules/expertise";
import { clearProficiencyPick } from "../../rules/proficiencyPools";
import { pickRuleChoice, type AvailableRuleChoice } from "../../rules/ruleChoices";
import { currentCompendium } from "../../services/compendium";
import type { Character } from "../../types/character";

type CharacterUpdate = (
  patchOrUpdater: Partial<Character> | ((prev: Character) => Character),
) => void;

/**
 * The Class tab's transitions for the Class Choices part: the picks the ClassChoiceCards report, written with the
 * same transitions the Class tab always used. The Level-Up Flow wires its own plan callbacks instead.
 */
export function classChoiceTransitions(onUpdate: CharacterUpdate, activeBooks: ActiveBooks) {
  return {
    onToggleRuleChoice: (choice: AvailableRuleChoice, option: string) => {
      onUpdate((cur) => pickRuleChoice(cur, choice, option, currentCompendium(), activeBooks));
    },
    onClearChoice: (choice: AvailableRuleChoice) => {
      onUpdate((cur) => {
        const next: Character =
          choice.pick === "proficiency"
            ? clearProficiencyPick(cur, choice.id)
            : {
                ...cur,
                ruleChoices: (cur.ruleChoices || []).filter((rc) => rc.id !== choice.id),
              };
        return reconcile(next, currentCompendium(), { activeBooks });
      });
    },
    onToggleExpertise: (item: string) => {
      onUpdate((cur) => toggleExpertiseChoice(cur, item, { compendium: currentCompendium(), activeBooks }));
    },
    onPruneInvalidExpertise: () => {
      onUpdate((cur) => reconcile(cur, currentCompendium(), { activeBooks }));
    },
    onToggleOptionalFeature: (featureName: string) => {
      onUpdate((cur) =>
        setOptionalFeatureEnabled(
          cur,
          featureName,
          !cur.optionalFeatureReplacements?.[featureName],
          currentCompendium(),
          { activeBooks },
        ),
      );
    },
  };
}
