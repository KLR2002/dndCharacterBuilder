// Pure re-exports for components that import rules from the services layer.
// Character evaluation is called directly from src/rules/characterEvaluation.ts.
export { getAbilityModifier, formatModifier } from "../rules/abilities.ts";
export { totalLevel as calculateTotalLevel, proficiencyBonus as calculateProficiencyBonus } from "../rules/proficiencies.ts";
export { multiclassSlots as calculateMulticlassSpellSlots, pactSlots } from "../rules/slots.ts";
export { hitDiceByType } from "../rules/hp.ts";
export { grantedFeatures } from "../rules/grantedFeatures.ts";
export { getHitDicePools, spendHitDie, recoverHitDie } from "../rules/hitDice.ts";
