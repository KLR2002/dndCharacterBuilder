import React, { useMemo } from "react";
import { useAppTheme } from "../../context/ThemeContext";
import type { ActiveBooks } from "../../constants/books";
import { ClassChoiceCards, type ClassChoicePicks } from "../builder/ClassChoiceCards";
import type { AvailableRuleChoice } from "../../rules/choices/types";
import { levelUpClassChoicesView, type LevelUpPlan } from "../../rules/levelUpFlow";
import type { Character, RuleChoiceEntry } from "../../types/character";

/** The plan's picks in the shape the choice cards read: rule choices by entry, Proficiency Choices by id. */
function classChoicePicksOf(plan: LevelUpPlan): ClassChoicePicks {
  const ruleChoices: RuleChoiceEntry[] = [];
  const proficiencyPicks: Record<string, string[]> = {};
  for (const choice of plan.classChoices ?? []) {
    const picked = plan.picks.classChoicePicks?.[choice.id] ?? [];
    if (choice.pick === "proficiency") {
      proficiencyPicks[choice.id] = picked;
    } else {
      ruleChoices.push({
        id: choice.id,
        trait: choice.traitName,
        origin: choice.origin,
        choose: choice.choose,
        from: choice.options.map((o) => o.name),
        picked,
      });
    }
  }
  return { ruleChoices, proficiencyPicks, skillChoices: [], chosenSkills: [] };
}

/**
 * The Class Choices step: the cards the new level brings, read from the Class Choices view of the plan's level. Picks
 * are held in the plan's `classChoicePicks`; nothing is written to the Character before Review.
 */
export function ClassChoicesStep({
  plan,
  character,
  activeBooks,
  onToggle,
  onClear,
}: {
  plan: LevelUpPlan;
  character: Character;
  activeBooks: ActiveBooks;
  onToggle: (choiceId: string, option: string, choose: number) => void;
  onClear: (choiceId: string) => void;
}) {
  const { theme } = useAppTheme();
  const view = useMemo(() => levelUpClassChoicesView(character, plan, { activeBooks }), [character, plan, activeBooks]);
  const picks = useMemo(() => classChoicePicksOf(plan), [plan]);
  if (!view.applies) return null;
  return (
    <ClassChoiceCards
      view={view}
      picks={picks}
      autoGranted={[]}
      primaryClass={plan.className}
      onToggleRuleChoice={(choice: AvailableRuleChoice, option: string) => onToggle(choice.id, option, choice.choose)}
      onClearChoice={(choice: AvailableRuleChoice) => onClear(choice.id)}
      onToggleStartingSkill={() => {}}
      onToggleExpertise={() => {}}
      onPruneInvalidExpertise={() => {}}
      theme={theme}
    />
  );
}
