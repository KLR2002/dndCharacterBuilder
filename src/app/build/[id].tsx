import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DetailsStep } from "../../components/creationFlow/DetailsStep";
import { FlowShell, FlowStepTitle, useFlowStepScrollContentPadding, type FlowStepView } from "../../components/creationFlow/FlowShell";
import { IdentityPanel, identitySummaryLine } from "../../components/creationFlow/IdentityPanel";
import { ReviewStep } from "../../components/creationFlow/ReviewStep";
import { STEP_TITLES } from "../../components/creationFlow/stepTitles";
import { BuilderTab } from "../../components/tabs/BuilderTab";
import { SpellsTab } from "../../components/tabs/SpellsTab";
import { Button } from "../../components/ui/Button";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useSerifFont } from "../../hooks/useSerifFont";
import {
  applyBuildStepUpdate,
  creationSteps,
  currentCreationStep,
  finishCreationStep,
  isCreationFinished,
  isCreationStepValid,
  type CreationStep,
} from "../../rules/creationFlow";
import type { Character, CreationStepId } from "../../types/character";

/**
 * The Creation Flow screen. Step order, status, validity, the needs-attention marks and the current step are
 * read only from `src/rules/creationFlow.ts`; this screen never decides them. The `step` query param opens a
 * finished or the current step of a draft, or any step of a finished character (Edit Build); locked steps of a
 * draft are not reachable. On a finished character the flow is Edit Build: it applies the release-and-flag
 * rule to changes and lets the Class step only lower levels — a level up enters through the Level-Up Flow.
 * The layout is the shared flow chrome (`FlowShell`), which the Level-Up Flow renders through as well.
 */
export default function BuildScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; step?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const stepParam = Array.isArray(params.step) ? params.step[0] : params.step;
  const { characters, selectCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const serif = useSerifFont();

  useEffect(() => {
    if (id) selectCharacter(id);
  }, [id, characters, selectCharacter]);

  const character = characters.find((c) => c.id === id) ?? null;
  const flowOpts = useMemo(() => ({ activeBooks }), [activeBooks]);
  // The step scroll content pads its bottom on phones so the floating dice button never covers the last rows.
  const flowScrollPad = useFlowStepScrollContentPadding();
  const steps = useMemo(
    () => (character ? creationSteps(character, flowOpts) : []),
    [character, flowOpts],
  );
  const current = useMemo(
    () => (character ? currentCreationStep(character, flowOpts) : null),
    [character, flowOpts],
  );

  const openStep = useMemo<CreationStepId | null>(() => {
    if (!character || steps.length === 0) return null;
    const byId = new Map(steps.map((s) => [s.id, s]));
    const param = stepParam as CreationStepId | undefined;
    if (isCreationFinished(character)) {
      return param && byId.has(param) ? param : steps[0].id;
    }
    if (param && byId.has(param) && byId.get(param)!.status !== "locked") return param;
    return current ?? steps[steps.length - 1].id;
  }, [character, steps, stepParam, current]);

  // Which transition records a change on the open step is decided by applyBuildStepUpdate in the rules
  // module, not here.
  const handleUpdate = (updates: Partial<Character> | ((c: Character) => Character)) => {
    if (!character || !openStep) return;
    updateCharacter(character.id, (cur) => {
      const next = typeof updates === "function" ? updates(cur) : { ...cur, ...updates };
      return applyBuildStepUpdate(cur, next, openStep, flowOpts);
    });
  };

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

  const draft = !isCreationFinished(character);
  // Edit Build on a finished character: a flagged step can be finished again, which clears its warning.
  const editBuild = !draft;
  const openInfo = steps.find((s) => s.id === openStep) ?? null;
  const finishable = editBuild && openInfo?.needsAttention === true;
  const valid = openStep ? isCreationStepValid(character, openStep, flowOpts) : false;
  const entry = character.classes?.[0];
  const primaryLabel = !draft
    ? finishable
      ? "Finish step"
      : "Back to sheet"
    : openStep === "review"
      ? "Create character"
      : openStep === "class" && entry
        ? `Choose ${entry.className}`
        : "Continue";

  const openStepById = (stepId: CreationStepId) => {
    router.push(`/build/${character.id}?step=${stepId}` as any);
  };

  const onPrimary = () => {
    if (!openStep) return;
    if (!draft) {
      if (finishable) {
        const finished = finishCreationStep(character, openStep, flowOpts);
        updateCharacter(character.id, () => finished);
        const remaining = finished.creationProgress?.needsAttention ?? [];
        if (remaining.length > 0) router.replace(`/build/${character.id}?step=${remaining[0]}` as any);
        else router.replace(`/character/${character.id}` as any);
        return;
      }
      router.replace(`/character/${character.id}` as any);
      return;
    }
    const finished = finishCreationStep(character, openStep, flowOpts);
    updateCharacter(character.id, () => finished);
    const nextStep = finished.creationProgress?.currentStep;
    if (nextStep) router.replace(`/build/${character.id}?step=${nextStep}` as any);
    else router.replace(`/character/${character.id}` as any);
  };

  const stepViews: FlowStepView[] = steps.map((step: CreationStep) => ({
    id: step.id,
    title: STEP_TITLES[step.id],
    open: step.id === openStep,
    current: step.id === current,
    locked: step.status === "locked",
    done: step.status === "finished",
    needsAttention: step.needsAttention,
  }));

  // The builder sections and the spells tab carry their own horizontal padding; only the flow's own
  // details/review scroll views pad here, so the content is never double-padded.
  const stepContent = () => {
    if (!openStep) return null;
    if (openStep === "spells") {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>
          <SpellsTab />
        </View>
      );
    }
    if (openStep === "details") {
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.stepScrollContent, flowScrollPad]} keyboardShouldPersistTaps="handled">
          <DetailsStep character={character} onUpdate={handleUpdate} />
        </ScrollView>
      );
    }
    if (openStep === "review") {
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.stepScrollContent, flowScrollPad]} keyboardShouldPersistTaps="handled">
          <ReviewStep character={character} activeBooks={activeBooks} />
        </ScrollView>
      );
    }
    return (
      <View style={{ flex: 1, minHeight: 0 }}>
        <BuilderTab character={character} onUpdate={handleUpdate} step={openStep} />
      </View>
    );
  };

  return (
    <FlowShell
      steps={stepViews}
      onOpenStep={(stepId) => openStepById(stepId as CreationStepId)}
      stepTitle={<FlowStepTitle title={openStep ? STEP_TITLES[openStep] : ""} needsAttention={openInfo?.needsAttention} />}
      content={stepContent()}
      primaryAction={
        <Button
          title={primaryLabel}
          variant="primary"
          size="lg"
          disabled={(draft || finishable) && !valid}
          onPress={onPrimary}
          style={styles.primaryAction}
        />
      }
      identityLine={
        <Text numberOfLines={1} style={[styles.identityLine, { color: theme.text, fontFamily: serif }]}>
          {identitySummaryLine(character)}
        </Text>
      }
      identityPanel={<IdentityPanel character={character} activeBooks={activeBooks} />}
    />
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
