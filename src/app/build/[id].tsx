import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DetailsStep } from "../../components/creationFlow/DetailsStep";
import { IdentityPanel, identitySummaryLine } from "../../components/creationFlow/IdentityPanel";
import { ReviewStep } from "../../components/creationFlow/ReviewStep";
import { STEP_TITLES } from "../../components/creationFlow/stepTitles";
import { BuilderTab } from "../../components/tabs/BuilderTab";
import { SpellsTab } from "../../components/tabs/SpellsTab";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSerifFont } from "../../hooks/useSerifFont";
import {
  applyBuildStepUpdate,
  creationSteps,
  currentCreationStep,
  finishCreationStep,
  isCreationFinished,
  isCreationStepValid,
  type BuildFlowMode,
  type CreationStep,
} from "../../rules/creationFlow";
import type { Character, CreationStepId } from "../../types/character";

/**
 * The Creation Flow screen. Step order, status, validity, the needs-attention marks and the current step are
 * read only from `src/rules/creationFlow.ts`; this screen never decides them. The `step` query param opens a
 * finished or the current step of a draft, or any step of a finished character (Edit Build); locked steps of a
 * draft are not reachable. The `mode` query param distinguishes the two entries on a finished character: Edit
 * Build (the default, `edit`) applies the release-and-flag rule to changes and lets the Class step only lower
 * levels, while the Level up path (`levelup`) keeps the controls that add levels and classes.
 */
export default function BuildScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; step?: string | string[]; mode?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const stepParam = Array.isArray(params.step) ? params.step[0] : params.step;
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const buildMode: BuildFlowMode = modeParam === "levelup" ? "levelup" : "edit";
  const { characters, selectCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const serif = useSerifFont();
  const { width } = useResponsiveLayout();
  const wide = width >= 768;
  const [identityOpen, setIdentityOpen] = useState(false);

  useEffect(() => {
    if (id) selectCharacter(id);
  }, [id, characters, selectCharacter]);

  const character = characters.find((c) => c.id === id) ?? null;
  const flowOpts = useMemo(() => ({ activeBooks }), [activeBooks]);
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
      return applyBuildStepUpdate(cur, next, openStep, buildMode, flowOpts);
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
  const editBuild = !draft && buildMode === "edit";
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
    router.push(`/build/${character.id}?step=${stepId}${buildMode === "levelup" ? "&mode=levelup" : ""}` as any);
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

  const stepChip = (step: CreationStep) => {
    const isCurrent = step.id === current;
    const isOpen = step.id === openStep;
    const locked = step.status === "locked";
    return (
      <TouchableOpacity
        key={step.id}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPress={() => openStepById(step.id)}
        activeOpacity={0.7}
        style={[
          wide ? styles.stepListRow : styles.chip,
          {
            backgroundColor: isOpen ? theme.accentGlow : theme.surface,
            borderColor: isOpen || isCurrent ? theme.accentHover : theme.border,
            opacity: locked && !step.needsAttention ? 0.45 : 1,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            color: isCurrent || isOpen ? theme.accentHover : theme.textSecondary,
            fontSize: 13,
            fontWeight: isCurrent ? "700" : "400",
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {STEP_TITLES[step.id]}
        </Text>
        {step.status === "finished" && !isCurrent ? (
          <Ionicons name="checkmark" size={14} color={theme.textSecondary} />
        ) : null}
        {step.needsAttention ? (
          <View accessibilityRole="image" accessibilityLabel={`Needs attention: ${STEP_TITLES[step.id]}`}>
            <Ionicons name="alert-circle" size={14} color={theme.warning} />
          </View>
        ) : null}
        {locked ? (
          <View accessibilityRole="image" accessibilityLabel={`Locked: ${STEP_TITLES[step.id]}`}>
            <Ionicons name="lock-closed" size={13} color={theme.textMuted} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // The builder sections and the spells tab carry their own horizontal padding; only the flow's own
  // title and the details/review scroll views pad here, so the content is never double-padded.
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.stepScrollContent} keyboardShouldPersistTaps="handled">
          <DetailsStep character={character} onUpdate={handleUpdate} />
        </ScrollView>
      );
    }
    if (openStep === "review") {
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.stepScrollContent} keyboardShouldPersistTaps="handled">
          <ReviewStep character={character} activeBooks={activeBooks} />
        </ScrollView>
      );
    }
    return (
      <View style={{ flex: 1, minHeight: 0 }}>
        <BuilderTab character={character} onUpdate={handleUpdate} step={openStep} flowMode={draft ? undefined : buildMode} />
      </View>
    );
  };

  const stepTitle = (
    <View style={[styles.titleRow, wide && styles.titleRowWide]}>
      <Text style={[styles.stepTitle, { color: theme.text, fontFamily: serif }]} numberOfLines={2}>
        {openStep ? STEP_TITLES[openStep] : ""}
      </Text>
      {openInfo?.needsAttention ? (
        <View accessibilityRole="image" accessibilityLabel={`Needs attention: ${openStep ? STEP_TITLES[openStep] : ""}`}>
          <Ionicons name="alert-circle" size={18} color={theme.warning} style={{ flexShrink: 0 }} />
        </View>
      ) : null}
    </View>
  );

  const primaryAction = (
    <Button
      title={primaryLabel}
      variant="primary"
      size="lg"
      disabled={(draft || finishable) && !valid}
      onPress={onPrimary}
      style={styles.primaryAction}
    />
  );

  if (wide) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.wideOuter}>
          <View style={[styles.stepList, { borderRightColor: theme.border, backgroundColor: theme.surface }]}>
            <ScrollView contentContainerStyle={styles.stepListContent}>
              {steps.map(stepChip)}
            </ScrollView>
          </View>
          <View style={styles.wideMiddle}>
            <View style={styles.wideContent}>
              {stepTitle}
              {stepContent()}
            </View>
            <View style={[styles.wideFooter, { borderTopColor: theme.border }]}>{primaryAction}</View>
          </View>
          <View style={[styles.identitySide, { borderLeftColor: theme.border, backgroundColor: theme.surface }]}>
            <ScrollView contentContainerStyle={styles.identitySideContent}>
              <IdentityPanel character={character} activeBooks={activeBooks} />
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.chipsBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          keyboardShouldPersistTaps="handled"
        >
          {steps.map(stepChip)}
        </ScrollView>
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        <View style={styles.phoneContent}>
          {stepTitle}
          {stepContent()}
        </View>
      </View>

      <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setIdentityOpen(true)}
          activeOpacity={0.7}
          style={styles.identityLineBtn}
        >
          <Text numberOfLines={1} style={[styles.identityLine, { color: theme.text, fontFamily: serif }]}>
            {identitySummaryLine(character)}
          </Text>
          <Ionicons name="chevron-up" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
        {primaryAction}
      </View>
      <Modal visible={identityOpen} onClose={() => setIdentityOpen(false)} title="Character">
        <IdentityPanel character={character} activeBooks={activeBooks} />
      </Modal>
    </SafeAreaView>
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
  chipsBar: {
    borderBottomWidth: 1,
  },
  chipsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  phoneContent: {
    flex: 1,
    minHeight: 0,
    paddingTop: 12,
  },
  stepScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  titleRowWide: {
    paddingHorizontal: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "600",
    flexShrink: 1,
    minWidth: 0,
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  identityLineBtn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  wideOuter: {
    flex: 1,
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    flexDirection: "row",
  },
  stepList: {
    width: 200,
    borderRightWidth: 1,
  },
  stepListContent: {
    padding: 12,
    gap: 6,
  },
  stepListRow: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  wideMiddle: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  wideContent: {
    width: "100%",
    maxWidth: 640,
    flex: 1,
    minHeight: 0,
    paddingTop: 16,
  },
  wideFooter: {
    width: "100%",
    maxWidth: 640,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  identitySide: {
    width: 280,
    borderLeftWidth: 1,
  },
  identitySideContent: {
    padding: 16,
  },
});
