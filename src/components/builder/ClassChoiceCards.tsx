import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ClassChoicesStepView } from "../../rules/classChoices";
import type { Character } from "../../types/character";
import type { AvailableRuleChoice } from "../../rules/ruleChoices";
import { pickedOptionNames } from "../../rules/ruleChoices";
import { normalizeSkillName } from "../../rules/skills";
import { Badge } from "../ui/Badge";
import { CollapsibleCard } from "../ui/CollapsibleCard";
import { RuleChoicePicker, SkillPicker } from "./builderStyles";

/** The saved picks the cards read to show what the player chose. */
export type ClassChoicePicks = Pick<
  Character,
  "ruleChoices" | "proficiencyPicks" | "skillChoices" | "chosenSkills"
>;

export interface ClassChoiceCardsProps {
  /** The Class Choices step's view: the skill picks, the choice cards and the Expertise milestones. */
  view: ClassChoicesStepView;
  picks: ClassChoicePicks;
  /** The skills the rules grant, which a skill pick cannot take. */
  autoGranted: string[];
  primaryClass?: string;
  onToggleRuleChoice: (choice: AvailableRuleChoice, option: string) => void;
  onClearChoice: (choice: AvailableRuleChoice) => void;
  onToggleStartingSkill: (skill: string, source: string) => void;
  onToggleExpertise: (item: string) => void;
  onPruneInvalidExpertise: () => void;
  theme: any;
}

/**
 * The Class Choices part: the Skills card, the rule-choice cards by group, and the Expertise card. It reports every
 * pick through its callbacks and writes nothing itself.
 */
export const ClassChoiceCards: React.FC<ClassChoiceCardsProps> = ({
  view,
  picks,
  autoGranted,
  primaryClass,
  onToggleRuleChoice,
  onClearChoice,
  onToggleStartingSkill,
  onToggleExpertise,
  onPruneInvalidExpertise,
  theme,
}) => {
  const { startingSkills, skillPicks, cards } = view;
  const hasSkillCard = startingSkills.length > 0 || skillPicks.length > 0;
  const hasCardChoice = Object.values(cards).some((choices) => choices.length > 0);

  const {
    fightingStyle: fightingStyleChoices,
    maneuver: maneuverChoices,
    warlock: warlockChoices,
    infusion: infusionChoices,
    other: otherChoices,
  } = cards;
  const { picks: expertisePicks, invalidPicks } = view.expertise;

  const renderChoice = (choice: AvailableRuleChoice, chipTag?: string) => {
    const saved =
      choice.pick === "proficiency"
        ? (picks.proficiencyPicks?.[choice.id] ?? [])
        : (picks.ruleChoices?.find((rc) => rc.id === choice.id)?.picked ?? []);
    const chosen = pickedOptionNames(
      saved,
      choice.options.map((o) => o.name),
    );
    return (
      <View key={choice.id} style={{ gap: 4 }}>
        <RuleChoicePicker
          label={choice.traitName}
          choose={choice.choose}
          from={choice.options.map((o) => o.name)}
          chosen={chosen}
          onToggle={(option) => onToggleRuleChoice(choice, option)}
          onClear={() => onClearChoice(choice)}
          chipTag={chipTag}
          theme={theme}
        />
        {chosen.length > 0 && (
          <View style={{ gap: 2, marginTop: 2 }}>
            {chosen.map((cName) => {
              const opt = choice.options.find((o) => o.name === cName);
              if (!opt?.description) return null;
              return (
                <Text
                  key={cName}
                  style={{ color: theme.textMuted, fontSize: 11 }}
                >
                  <Text
                    style={{ color: theme.accentHover, fontWeight: "600" }}
                  >
                    {opt.name}:{" "}
                  </Text>
                  {opt.description}
                </Text>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderChoiceCard = (
    key: string,
    title: string,
    choices: AvailableRuleChoice[],
    badge?: string,
  ) => {
    if (choices.length === 0) return null;
    return (
      <CollapsibleCard
        key={key}
        title={title}
        badge={
          badge ? (
            <Badge label={badge} variant="accent" size="sm" />
          ) : undefined
        }
        style={{ gap: 12 }}
      >
        {choices.map((choice) => renderChoice(choice))}
      </CollapsibleCard>
    );
  };

  // One card for every skill pick: the starting picker, then the Proficiency Choices that are skill picks.
  // Each is named by its source, and a pick whose grant gives Expertise is tagged on the picked names.
  const skillsCard = !hasSkillCard ? null : (
    <CollapsibleCard key="prog_skills" title="Skills" style={{ gap: 12 }}>
      {startingSkills.map((sc) => {
        const choiceEntry = picks.skillChoices?.find(
          (c) => c.id === sc.source,
        );
        const normFrom = sc.from.map(normalizeSkillName);
        const normAuto = autoGranted.map(normalizeSkillName);
        const chosen = choiceEntry
          ? choiceEntry.picked
          : (picks.chosenSkills || []).filter(
              (s) =>
                normFrom.includes(normalizeSkillName(s)) &&
                !normAuto.includes(normalizeSkillName(s)),
            );
        return (
          <SkillPicker
            key={sc.source}
            label={`${primaryClass} starting skills`}
            choose={sc.choose}
            from={sc.from}
            chosen={chosen}
            autoGranted={autoGranted}
            onToggle={(skill) => onToggleStartingSkill(skill, sc.source)}
            theme={theme}
          />
        );
      })}
      {skillPicks.map((offer) =>
        renderChoice(offer, offer.expertise ? "Expertise" : undefined),
      )}
    </CollapsibleCard>
  );

  return (
    <>
      {hasSkillCard || hasCardChoice ? (
        <>
          {skillsCard}
          {renderChoiceCard(
            "prog_fighting_styles",
            "Fighting Styles",
            fightingStyleChoices,
            "Fighting Style",
          )}
          {renderChoiceCard(
            "prog_maneuvers",
            "Battle Master Maneuvers",
            maneuverChoices,
            "Maneuvers",
          )}
          {renderChoiceCard(
            "prog_warlock",
            "Pact Boon & Eldritch Invocations",
            warlockChoices,
            "Warlock",
          )}
          {renderChoiceCard(
            "prog_infusions",
            "Infusions Known",
            infusionChoices,
            "Artificer",
          )}
          {renderChoiceCard(
            "prog_other",
            "Class & Subclass Choices",
            otherChoices,
          )}
        </>
      ) : null}

      {expertisePicks.length > 0 && (
        <CollapsibleCard
          title="Expertise"
          subtitle="Doubled proficiency bonus (2× PB) on chosen proficient skills and tools."
          style={{ gap: 12 }}
        >
          {invalidPicks.length > 0 && (
            <View
              style={{
                backgroundColor: theme.surfaceHighlight,
                borderColor: theme.warning,
                borderWidth: 1,
                borderRadius: 6,
                padding: 8,
                gap: 4,
              }}
            >
              <Text
                style={{
                  color: theme.warning,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                ⚠️ Invalid Expertise Warning
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                The following choices are no longer proficient:{" "}
                {invalidPicks.join(", ")}.
              </Text>
              <TouchableOpacity
                onPress={onPruneInvalidExpertise}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ alignSelf: "flex-start", marginTop: 2 }}
              >
                <Text
                  style={{
                    color: theme.accentHover,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  Prune Invalid Choices
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {expertisePicks.map(({ milestone, chosen, from }) => (
            <View key={milestone.id} style={{ gap: 4 }}>
              <RuleChoicePicker
                label={milestone.label}
                choose={milestone.count}
                from={from}
                chosen={chosen}
                onToggle={(item) => onToggleExpertise(item)}
                theme={theme}
              />
            </View>
          ))}
        </CollapsibleCard>
      )}
    </>
  );
};
