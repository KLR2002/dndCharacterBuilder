import React from "react";
import { View } from "react-native";
import type { Character } from "../../types/character";
import { effectiveScores } from "../../rules/abilities";
import { hitDieOf } from "../../rules/classData";
import { planAverageHitPoints, type LevelUpPlan } from "../../rules/levelUpFlow";
import { ChoiceRow } from "./ChoiceRow";

/**
 * The Hit Points step: Average (the class's fixed value plus Constitution) or Roll (one roll of the Hit
 * Die, rolled once, no reroll). The pick lives in the plan; the roll is published to the Roll Log by the
 * screen, which owns the seam.
 */
export function HitPointsStep({
  plan,
  character,
  rolledOnce,
  onAverage,
  onRoll,
}: {
  plan: LevelUpPlan;
  character: Character;
  /** True once the Hit Die was rolled in this flow: the Roll row stays disabled, no reroll. */
  rolledOnce: boolean;
  onAverage: () => void;
  onRoll: () => void;
}) {
  const die = hitDieOf({ className: plan.className, source: plan.source, level: plan.toLevel });
  const conMod = effectiveScores(character).modifiers.con ?? 0;
  const average = planAverageHitPoints(plan, character);
  const rolled = plan.hitPoints.mode === "roll";
  const rollDetail = rolled
    ? `1d${die}+${conMod} → +${plan.hitPoints.amount}`
    : `1d${die}+${conMod}`;
  return (
    <View style={{ gap: 8 }}>
      <ChoiceRow
        label="Average"
        detail={`+${average}`}
        selected={plan.hitPoints.mode === "average"}
        accessibilityLabel="Average hit points"
        onPress={onAverage}
      />
      <ChoiceRow
        label="Roll"
        detail={rollDetail}
        selected={rolled}
        disabled={rolledOnce}
        accessibilityLabel="Roll hit points"
        onPress={onRoll}
      />
    </View>
  );
}
