import type { ActiveBooks } from "../../constants/books";
import React from "react";
import type { Character } from "../../types/character";
import type { AvailableRuleChoice } from "../../rules/ruleChoices";
import { pickRuleChoice } from "../../rules/ruleChoices";
import { pickedOptionNames } from "../../rules/choices/types";
import { clearProficiencyPick } from "../../rules/proficiencyPools";
import { RuleChoicePicker } from "./builderStyles";

/** One Proficiency Choice of a race or background, picked into the character's proficiency picks. */
export const ProficiencyChoicePicker: React.FC<{
  choice: AvailableRuleChoice;
  character: Character;
  onUpdate: (patchOrUpdater: Partial<Character> | ((prev: Character) => Character)) => void;
  theme: any;
  activeBooks: ActiveBooks;
}> = ({ choice, character, onUpdate, theme, activeBooks }) => {
  const options = choice.options.map((option) => option.name);
  return (
    <RuleChoicePicker
      label={choice.traitName}
      choose={choice.choose}
      from={options}
      chosen={pickedOptionNames(character.proficiencyPicks?.[choice.id] ?? [], options)}
      onToggle={(option) => onUpdate((cur) => pickRuleChoice(cur, choice, option, undefined, activeBooks))}
      onClear={() => onUpdate((cur) => clearProficiencyPick(cur, choice.id))}
      theme={theme}
    />
  );
};
