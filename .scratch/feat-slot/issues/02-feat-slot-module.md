# 02: One rules module answers for every Feat Slot

**What to build:** Create `src/rules/featSlot.ts` (read ADR 0023 and the **Feat Slot** and **Increase Choice** entries in `GLOSSARY.md` first). Its interface:

- `type FeatSlot = { kind: "asi"; className: string; classLevel: number } | { kind: "origin"; grantedBy: "race" | "background" }`.
- `interface FeatSlotPick { slot: FeatSlot; featName: string | null; featSource?: string; featAbility?: AbilityKey; subChoicePicks?: Record<string, string[]> }`.
- `findFeat(name, source | undefined, compendium, activeBooks): FeatData | null`: by name and source; with no source, by name only when exactly one active feat has it; never assume `PHB`.
- `featIncreaseOptions(feat: FeatData | null): FeatAbilityBonusOptions`: from `abilityScoreIncrease` (fixed) and `abilityScoreChoices` (choice) only. A feat with neither, or a stale catalog without the field, gives `none`.
- `featSlotView(character, pick, { compendium, activeBooks })`: the feats offered (active books, each with its `validateFeatPrerequisites` result, and a feat the character already holds marked as held), the picked feat's record, its increase options, the Rule Choices it opens (`featSubChoicesForSelection` / `featGrantedRuleChoices`), its feat spell picks (`featSpellChoicesOf`), and `complete` (feat chosen, increase chosen when it is a choice, every opened Rule Choice filled; spell picks never block).
- `applyFeatSlotPick(character, pick, ...)`: the ASI slot goes through `applyAsiWithHitPoints` and then `pickRuleChoice` for each sub-choice pick (what `AsiFeatSection.tsx` lines ~99-140 do today, without feat names); an origin slot goes through `applyOriginFeat` / `grantBackgroundFeat` in `src/rules/feats.ts`.

Then delete `HALF_FEATS` and `getFeatAbilityBonusOptions` from `src/rules/leveling.ts` and move every caller to `featIncreaseOptions(findFeat(...))`: `levelUpFlow.ts` (`asiFeatAbilityPending`, `asiFeatStepView`), `AsiFeatSection.tsx`, `AsiFeatStep.tsx`, `AncestrySection.tsx`, `BackgroundSection.tsx`, and the checks. Remove every `featSource || "PHB"` guess (grep for it) in favour of `findFeat`. `asiFeatStepView` and `asiFeatAbilityPending` read `featSlotView`; keep their exports if the step still needs them. No UI layout change in this ticket; the builder keeps its own state until ticket 05.

**Blocked by:** 01

**Status:** done

**Landed:** 527c48e, with 6a61a10 (`featPickView`: the Level-Up Flow reads a pick's sub-choices without checking every feat's prerequisites). No feat in the dump has `count > 1`, more than one choice, or both a fixed increase and a choice, so the single-choice shape stays. `findFeat` treats the Background marker as no source. `asiFeatAbilityPending` reads `findFeat` + `featIncreaseOptions` (no character in its signature); `applyLevelUpPlan` still applies sub-choices through its own path. check:all, check:live (141/141) and `ONLY="Level-Up" WIDTHS=393` passed.

- [x] `checks/featSlot.test.ts` (tdd, red first, paste it): Resilient from a catalog with `abilityScoreChoices` gives a six-score choice; the same feat with neither field gives `none` and is still offered; Fighting Initiate's view lists the Fighting Initiate Rule Choice and `complete` is false until it is picked; Magic Initiate's spell picks do not make `complete` false; `findFeat("Resilient", undefined)` finds the one active Resilient, and returns null for a name two active feats share.
- [x] `grep -rn "HALF_FEATS\|getFeatAbilityBonusOptions\|\"PHB\"" src/components src/rules/featSlot.ts src/rules/leveling.ts src/rules/levelUpFlow.ts` lists nothing related to feats (paste it).
- [x] A saved character whose feat took +1 Constitution from Resilient keeps that +1 on a catalog without `abilityScoreChoices` (test).
- [x] `npm run check:all` and `npm run check:live` pass. `ONLY="Level-Up" WIDTHS=393 npm run layout:check` passes.
