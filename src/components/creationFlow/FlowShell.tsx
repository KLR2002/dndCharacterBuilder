import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRollLog } from "../../context/RollLogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSerifFont } from "../../hooks/useSerifFont";

import { Modal } from "../ui/Modal";

/** One step as the flow chrome shows it: its title, and whether it is the open, current, done or locked one. */
export interface FlowStepView {
  id: string;
  title: string;
  open: boolean;
  current: boolean;
  locked: boolean;
  done: boolean;
  needsAttention?: boolean;
}

export interface FlowShellProps {
  steps: FlowStepView[];
  onOpenStep: (id: string) => void;
  /** The serif title row of the open step. */
  stepTitle: React.ReactNode;
  /** A row above the title, e.g. the flow's Cancel control. */
  topRow?: React.ReactNode;
  /** The open step's body. */
  content: React.ReactNode;
  /** The primary action of the bottom bar / wide footer. */
  primaryAction: React.ReactNode;
  /** The touchable line that opens the identity panel in the phone modal. */
  identityLine: React.ReactNode;
  /** The identity panel: right column at wide widths, the phone modal's content. */
  identityPanel: React.ReactNode;
  /** testID of the phone bottom bar, measured so the floating dice button sits above it. */
  bottomBarTestID?: string;
}

/**
 * The shared chrome of the Creation Flow and the Level-Up Flow: step chips on phones, a step list on the
 * left with the step in the centre and the identity panel on the right at 768px and up, and a bottom bar
 * holding the identity line and the primary action on phones. The floating dice button sits above that
 * bar, never on its own row. Both flows render their steps through this shell; the steps themselves come
 * from their rules modules.
 */
export function FlowShell({
  steps,
  onOpenStep,
  stepTitle,
  topRow,
  content,
  primaryAction,
  identityLine,
  identityPanel,
  bottomBarTestID = "build-bottom-bar",
}: FlowShellProps) {
  const { theme } = useAppTheme();
  const { width } = useResponsiveLayout();
  const wide = width >= 768;
  const { setBottomObstruction } = useRollLog();
  const [identityOpen, setIdentityOpen] = useState(false);

  // On phones the flow's bottom bar holds the primary action, and the floating dice button sits above
  // it, never on its own row or over the action. At wide widths the button stays bottom-right of the
  // viewport, so nothing is reported.
  useEffect(() => {
    if (wide) setBottomObstruction(0);
    return () => setBottomObstruction(0);
  }, [wide, setBottomObstruction]);

  const stepChip = (step: FlowStepView) => (
    <TouchableOpacity
      key={step.id}
      accessibilityRole="button"
      accessibilityLabel={step.title}
      accessibilityState={{ disabled: step.locked }}
      disabled={step.locked}
      onPress={() => onOpenStep(step.id)}
      activeOpacity={0.7}
      style={[
        wide ? styles.stepListRow : styles.chip,
        {
          backgroundColor: step.open ? theme.accentGlow : theme.surface,
          borderColor: step.open || step.current ? theme.accentHover : theme.border,
          opacity: step.locked && !step.needsAttention ? 0.45 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          color: step.current || step.open ? theme.accentHover : theme.textSecondary,
          fontSize: 13,
          fontWeight: step.current ? "700" : "400",
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {step.title}
      </Text>
      {step.done && !step.current ? (
        <Ionicons name="checkmark" size={14} color={theme.textSecondary} />
      ) : null}
      {step.needsAttention ? (
        <View accessibilityRole="image" accessibilityLabel={`Needs attention: ${step.title}`}>
          <Ionicons name="alert-circle" size={14} color={theme.warning} />
        </View>
      ) : null}
      {step.locked ? (
        <View accessibilityRole="image" accessibilityLabel={`Locked: ${step.title}`}>
          <Ionicons name="lock-closed" size={13} color={theme.textMuted} />
        </View>
      ) : null}
    </TouchableOpacity>
  );

  if (wide) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.wideOuter}>
          <View style={[styles.stepList, { borderRightColor: theme.border, backgroundColor: theme.surface }]}>
            <ScrollView contentContainerStyle={styles.stepListContent}>{steps.map(stepChip)}</ScrollView>
          </View>
          <View style={styles.wideMiddle}>
            <View style={styles.wideContent}>
              {topRow}
              {stepTitle}
              {content}
            </View>
            <View style={[styles.wideFooter, { borderTopColor: theme.border }]}>{primaryAction}</View>
          </View>
          <View style={[styles.identitySide, { borderLeftColor: theme.border, backgroundColor: theme.surface }]}>
            <ScrollView contentContainerStyle={styles.identitySideContent}>{identityPanel}</ScrollView>
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
          {topRow}
          {stepTitle}
          {content}
        </View>
      </View>

      <View
        testID={bottomBarTestID}
        onLayout={(event) => setBottomObstruction(event.nativeEvent.layout.height)}
        style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setIdentityOpen(true)}
          activeOpacity={0.7}
          style={styles.identityLineBtn}
        >
          {identityLine}
          <Ionicons name="chevron-up" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
        {primaryAction}
      </View>
      <Modal visible={identityOpen} onClose={() => setIdentityOpen(false)} title="Character">
        {identityPanel}
      </Modal>
    </SafeAreaView>
  );
}

/** The serif title row of the open step, with its needs-attention mark. */
export function FlowStepTitle({ title, needsAttention }: { title: string; needsAttention?: boolean }) {
  const { theme } = useAppTheme();
  const serif = useSerifFont();
  return (
    <View style={[styles.titleRow, { paddingHorizontal: 16 }]}>
      <Text style={[styles.stepTitle, { color: theme.text, fontFamily: serif }]} numberOfLines={2}>
        {title}
      </Text>
      {needsAttention ? (
        <View accessibilityRole="image" accessibilityLabel={`Needs attention: ${title}`}>
          <Ionicons name="alert-circle" size={18} color={theme.warning} style={{ flexShrink: 0 }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
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
