import React, { useMemo, useState } from "react";
import { useAppTheme } from "../../context/ThemeContext";
import type { ActiveBooks } from "../../constants/books";
import { ClassChoiceCards, type ClassChoicePicks } from "../builder/ClassChoiceCards";
import { OptionalFeatureCard } from "../builder/OptionalFeatureCard";
import { DetailModal } from "../DetailModal";
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
  return { ruleChoices, proficiencyPicks };
}

/**
 * The Class Choices step: the cards the new level brings, read from the Class Choices view of the plan's level. Picks
 * are held in the plan (`classChoicePicks`, `expertisePicks`, `optionalFeatures`); nothing is written to the Character
 * before Review.
 */
export function ClassChoicesStep({
  plan,
  character,
  activeBooks,
  onToggle,
  onClear,
  onToggleExpertise,
  onToggleOptionalFeature,
}: {
  plan: LevelUpPlan;
  character: Character;
  activeBooks: ActiveBooks;
  onToggle: (choiceId: string, option: string, choose: number) => void;
  onClear: (choiceId: string) => void;
  onToggleExpertise: (item: string) => void;
  onToggleOptionalFeature: (featureName: string, enabled: boolean) => void;
}) {
  const { theme } = useAppTheme();
  const [detail, setDetail] = useState<{ title: string; subtitle?: string; description?: string } | null>(null);
  const view = useMemo(
    () => levelUpClassChoicesView(character, plan, { activeBooks }),
    [character, plan, activeBooks],
  );
  const picks = useMemo(() => classChoicePicksOf(plan), [plan]);
  if (!view.applies) return null;
  return (
    <>
      <ClassChoiceCards
        view={view}
        picks={picks}
        onToggleRuleChoice={(choice: AvailableRuleChoice, option: string) => onToggle(choice.id, option, choice.choose)}
        onClearChoice={(choice: AvailableRuleChoice) => onClear(choice.id)}
        onToggleExpertise={onToggleExpertise}
        onPruneInvalidExpertise={() => {}}
        theme={theme}
      />
      <OptionalFeatureCard
        options={view.optionalFeatures}
        replacements={plan.picks.optionalFeatures}
        onToggle={(name) => onToggleOptionalFeature(name, !plan.picks.optionalFeatures?.[name])}
        onViewDetail={setDetail}
        theme={theme}
      />
      <DetailModal item={detail} onClose={() => setDetail(null)} />
    </>
  );
}
