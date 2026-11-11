import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowShell, FlowStepTitle, useFlowStepScrollContentPadding, type FlowStepView } from "../../components/creationFlow/FlowShell";
import { IdentityPanel, identitySummaryLine } from "../../components/creationFlow/IdentityPanel";
import { AsiFeatStep } from "../../components/levelUpFlow/AsiFeatStep";
import { ClassChoicesStep } from "../../components/levelUpFlow/ClassChoicesStep";
import { ClassStep } from "../../components/levelUpFlow/ClassStep";
import { HitPointsStep } from "../../components/levelUpFlow/HitPointsStep";
import { ReviewStep } from "../../components/levelUpFlow/ReviewStep";
import { SpellsStep } from "../../components/levelUpFlow/SpellsStep";
import { SubclassStep } from "../../components/levelUpFlow/SubclassStep";
import { LEVEL_UP_STEP_TITLES } from "../../components/levelUpFlow/stepTitles";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useCharacters } from "../../context/CharacterContext";
import { useRollLog } from "../../context/RollLogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useSerifFont } from "../../hooks/useSerifFont";
import { isCreationFinished } from "../../rules/creationFlow";
import {
  applyLevelUpPlan,
  chooseAverageHitPoints,
  classStepOptions,
  flowSteps,
  levelUpStepComplete,
  levelUpSummary,
  newSpellsForLevelUp,
  planLevelUp,
  rollPlanHitPoints,
  setPlanAsi,
  setPlanClassChoicePick,
  setPlanFeatPick,
  setPlanSubclass,
  subclassOptionsForPlan,
  togglePlanSpell,
  type LevelUpClassOption,
  type LevelUpPlan,
  type LevelUpStepId,
} from "../../rules/levelUpFlow";
import { maxHp } from "../../rules/hp";
import { totalLevel } from "../../rules/proficiencies";
import { getFeats } from "../../services/dataService";

/**
 * The Level-Up Flow screen. It opens from the character header's Level up. The flow is driven by the
 * level-up plan in `src/rules/levelUpFlow.ts`: the steps shown are the plan's own, the picks are held in
 * the plan, and nothing is written to the Character until Review's "Level up" applies the plan in one
 * update. Cancel (and the system Back) asks before discarding the plan. The layout is the shared flow
 * chrome (`FlowShell`), the same one the Creation Flow renders through.
 */
export default function LevelUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { characters, selectCharacter, updateCharacter, activeBooks, fullHealOnLevelUp } = useCharacters();
  const { publishRoll } = useRollLog();
  const { theme } = useAppTheme();
  const serif = useSerifFont();

  const [plan, setPlan] = useState<LevelUpPlan | null>(null);
  const [openStepId, setOpenStepId] = useState<LevelUpStepId>("class");
  const [askingDiscard, setAskingDiscard] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Review's "Level up" applies the plan once: the button disables on the first press, and a stale
  // plan is refused by applyLevelUpPlan anyway.
  const [applying, setApplying] = useState(false);
  // Each class's plan (including its rolled Hit Points) is kept for the life of the flow, so returning to
  // a class restores its plan and its roll stays final instead of being re-rolled and logged again.
  const plansByClass = useRef(new Map<string, LevelUpPlan>());

  useEffect(() => {
    if (id) selectCharacter(id);
  }, [id, characters, selectCharacter]);

  const character = characters.find((c) => c.id === id) ?? null;

  // A draft has no Level-Up Flow: its sheet route already redirects to the Creation Flow.
  const draft = character ? !isCreationFinished(character) : false;
  useEffect(() => {
    if (character && draft && id) router.replace(`/build/${id}` as any);
  }, [character, draft, id, router]);

  // The system Back asks before discarding the plan, once a class is picked; a confirmed discard lifts the
  // prevention and navigates away.
  const navigation = useNavigation();
  const hasWork = plan !== null;
  useEffect(() => {
    if (!hasWork || leaving) return;
    const sub = navigation.addListener("beforeRemove", (event) => {
      event.preventDefault();
      setAskingDiscard(true);
    });
    return () => sub();
  }, [navigation, hasWork, leaving]);
  useEffect(() => {
    if (leaving && id) router.replace(`/character/${id}` as any);
  }, [leaving, id, router]);

  const flowOpts = useMemo(() => ({ activeBooks }), [activeBooks]);
  // The step scroll content pads its bottom on phones so the floating dice button never covers the last rows.
  const flowScrollPad = useFlowStepScrollContentPadding();
  const steps = useMemo(() => flowSteps(plan), [plan]);
  const stepComplete = (stepId: LevelUpStepId) =>
    levelUpStepComplete(plan, stepId, { ...flowOpts, character: character ?? undefined });
  const openStep = steps.find((s) => s.id === openStepId) ?? steps[0];
  const currentStepId = steps.find((s) => !stepComplete(s.id))?.id ?? steps[steps.length - 1]?.id;

  if (!character || draft) {
    if (!character) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.notFound}>
            <Text style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>Character not found or loading...</Text>
            <Button title="Go Back" variant="primary" onPress={() => router.replace("/")} />
          </View>
        </SafeAreaView>
      );
    }
    return null;
  }

  const classOptions = classStepOptions(character, flowOpts);
  const allFeats = getFeats(activeBooks);

  const classKey = (name: string) => name.trim().toLowerCase();
  const commitPlan = (next: LevelUpPlan | null) => {
    if (next) plansByClass.current.set(classKey(next.className), next);
    setPlan(next);
  };

  const pickClass = (option: LevelUpClassOption) => {
    if (option.missingRequirement) return;
    // Re-picking the picked class keeps the plan unchanged: its Hit Points pick and every later pick stay.
    if (plan && classKey(plan.className) === classKey(option.className)) return;
    // Returning to an earlier class restores the plan it already had.
    const cached = plansByClass.current.get(classKey(option.className));
    if (cached) {
      setPlan(cached);
      setOpenStepId("class");
      return;
    }
    const result = planLevelUp(character, { className: option.className, source: option.source, activeBooks });
    if (!result.ok) return;
    // A different class starts a fresh plan for it: the later steps depend on it (hit die, subclass, spells).
    commitPlan(result.plan);
    setOpenStepId("class");
  };

  // Once the Hit Die is rolled for the plan's class the roll is final: Average no longer applies.
  const chooseAverage = () => {
    if (plan && plan.hitPoints.mode !== "roll") commitPlan(chooseAverageHitPoints(plan, character));
  };

  const rollHp = () => {
    if (!plan || plan.hitPoints.mode === "roll") return; // one roll per class, no reroll
    const { plan: rolled, roll } = rollPlanHitPoints(plan, character);
    publishRoll({ roll, source: "Hit Points", characterName: character.name });
    commitPlan(rolled);
  };

  const onPrimary = () => {
    if (openStep.id === "review") {
      if (!plan || applying) return;
      setApplying(true);
      updateCharacter(character.id, (cur) => applyLevelUpPlan(cur, plan, { fullHealOnLevelUp, activeBooks }));
      // The plan is applied; lift the Back guard so the return to the sheet is not asked about.
      setLeaving(true);
      return;
    }
    const index = steps.findIndex((s) => s.id === openStep.id);
    const next = steps[Math.min(index + 1, steps.length - 1)];
    if (next && next.id !== openStep.id) setOpenStepId(next.id);
  };

  const discard = () => {
    setAskingDiscard(false);
    setLeaving(true);
  };

  const stepViews: FlowStepView[] = steps.map((step) => ({
    id: step.id,
    title: LEVEL_UP_STEP_TITLES[step.id],
    open: step.id === openStep.id,
    current: step.id === currentStepId,
    locked: false,
    done: stepComplete(step.id),
  }));

  const stepContent = () => {
    if (!plan) {
      return <ClassStep options={classOptions} onPick={pickClass} />;
    }
    switch (openStep.id) {
      case "class":
        return <ClassStep options={classOptions} selectedClassName={plan.className} onPick={pickClass} />;
      case "hitPoints":
        return <HitPointsStep plan={plan} character={character} onAverage={chooseAverage} onRoll={rollHp} />;
      case "subclass":
        return (
          <SubclassStep
            plan={plan}
            options={subclassOptionsForPlan(plan, flowOpts)}
            onPick={(name, source) => commitPlan(setPlanSubclass(plan, name, source))}
          />
        );
      case "asiFeat":
        return (
          <AsiFeatStep
            plan={plan}
            character={character}
            allFeats={allFeats}
            activeBooks={activeBooks}
            onPick={(asi) => commitPlan(setPlanAsi(plan, asi))}
            onFeatPick={(choiceId, option, choose) => commitPlan(setPlanFeatPick(plan, choiceId, option, choose))}
          />
        );
      case "classChoices":
        return (
          <ClassChoicesStep
            plan={plan}
            onToggle={(choiceId, option, choose) => commitPlan(setPlanClassChoicePick(plan, choiceId, option, choose))}
          />
        );
      case "spells":
        return (
          <SpellsStep
            plan={plan}
            spells={newSpellsForLevelUp(character, plan, flowOpts)}
            onToggle={(spell) => commitPlan(togglePlanSpell(plan, spell))}
          />
        );
      case "review":
        return <ReviewStep rows={levelUpSummary(plan, character, { ...flowOpts, fullHealOnLevelUp })} />;
    }
  };

  const appliedPreview = plan ? applyLevelUpPlan(character, plan, { fullHealOnLevelUp: false, activeBooks }) : null;
  const identityPanel = (
    <IdentityPanel
      character={character}
      activeBooks={activeBooks}
      levelHp={
        plan
          ? {
              level: `${totalLevel(character)} → ${totalLevel(appliedPreview ?? character)}`,
              hitPoints: `${maxHp(character)} → ${maxHp(appliedPreview ?? character)}`,
            }
          : undefined
      }
    />
  );

  const topRow = (
    <View style={styles.cancelRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cancel level up"
        onPress={() => setAskingDiscard(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.cancelBtn}
      >
        <Ionicons name="close" size={16} color={theme.textSecondary} />
        <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: "600" }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <FlowShell
        steps={stepViews}
        onOpenStep={(stepId) => setOpenStepId(stepId as LevelUpStepId)}
        topRow={topRow}
        stepTitle={<FlowStepTitle title={LEVEL_UP_STEP_TITLES[openStep.id]} />}
        content={
          <ScrollView
            style={{ flex: 1 }}
            testID="levelup-step-scroll"
            contentContainerStyle={[styles.stepScrollContent, flowScrollPad]}
            keyboardShouldPersistTaps="handled"
          >
            {stepContent()}
          </ScrollView>
        }
        primaryAction={
          <Button
            title={openStep.id === "review" ? "Level up" : "Continue"}
            variant="primary"
            size="lg"
            disabled={applying || !stepComplete(openStep.id)}
            onPress={onPrimary}
            style={styles.primaryAction}
          />
        }
        identityLine={
          <Text numberOfLines={1} style={[styles.identityLine, { color: theme.text, fontFamily: serif }]}>
            {identitySummaryLine(character)}
          </Text>
        }
        identityPanel={identityPanel}
        bottomBarTestID="levelup-bottom-bar"
      />
      <Modal visible={askingDiscard} onClose={() => setAskingDiscard(false)} title="Discard changes?">
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
          <Button title="Keep editing" variant="ghost" onPress={() => setAskingDiscard(false)} />
          <Button title="Discard" variant="danger" onPress={discard} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  stepScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cancelRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  cancelBtn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  identityLine: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  primaryAction: {
    width: "100%",
  },
});
