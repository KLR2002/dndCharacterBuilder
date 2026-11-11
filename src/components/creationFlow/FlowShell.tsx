import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRollLog } from "../../context/RollLogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { BREAKPOINTS, useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSerifFont } from "../../hooks/useSerifFont";

import { DICE_BUTTON_EDGE_MARGIN, DICE_BUTTON_FOOTPRINT, DICE_BUTTON_SIZE } from "../dice/DiceOverlay";
import { Modal } from "../ui/Modal";

/**
 * The flow's wide breakpoint: at or above this width FlowShell shows the wide layout (step list on the
 * left, the step in the centre, footer); below it the phone layout with the bottom bar the floating dice
 * button sits above. The step scroll content's bottom padding switches at the same width. It is
 * BREAKPOINTS.tablet by reference, so the flows and the sheet always switch at the same width.
 */
export const FLOW_WIDE_MIN_WIDTH = BREAKPOINTS.tablet;

/**
 * The width from which the wide layout also shows the identity panel as a side column on the right, as
 * the design keeps it always visible at wide widths. Between FLOW_WIDE_MIN_WIDTH and this width a 200px
 * step list plus a 280px side column would leave the step under 320px, so there the wide footer carries
 * the identity line that opens the "Character" modal instead. It is BREAKPOINTS.desktop by reference.
 */
export const FLOW_IDENTITY_SIDE_MIN_WIDTH = BREAKPOINTS.desktop;

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
  /** The touchable identity line in the phone bottom bar and the wide footer below FLOW_IDENTITY_SIDE_MIN_WIDTH; it opens the identity panel modal. */
  identityLine: React.ReactNode;
  /** The identity panel: the side column at FLOW_IDENTITY_SIDE_MIN_WIDTH and up, otherwise the modal the identity line opens. */
  identityPanel: React.ReactNode;
  /** testID of the phone bottom bar, measured so the floating dice button sits above it. */
  bottomBarTestID?: string;
}

/**
 * The shared chrome of the Creation Flow and the Level-Up Flow: step chips on phones, a step list on the
 * left with the step in the centre at FLOW_WIDE_MIN_WIDTH and up. From FLOW_IDENTITY_SIDE_MIN_WIDTH up the
 * identity panel is a side column on the right; below that the wide footer holds the identity line that
 * opens the "Character" modal, and on phones the bottom bar does. The floating dice button sits above the
 * phone bar, never on its own row. Both flows render their steps through this shell; the steps themselves
 * come from their rules modules.
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
  const wide = width >= FLOW_WIDE_MIN_WIDTH;
  const identitySide = width >= FLOW_IDENTITY_SIDE_MIN_WIDTH;
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
    // Between FLOW_WIDE_MIN_WIDTH and FLOW_IDENTITY_SIDE_MIN_WIDTH the wide footer reaches the viewport's
    // right edge, where the floating dice button sits, so it reserves the button's footprint on its right
    // (the footer's own 16px padding plus DICE_BUTTON_FOOTPRINT): the action and the identity line end
    // left of the button. From FLOW_IDENTITY_SIDE_MIN_WIDTH up the identity side column already keeps the
    // footer clear of the button, so nothing is reserved there.
    const reserveDiceFootprint = !identitySide;
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
            <View
              testID="flow-wide-footer"
              style={[
                styles.wideFooter,
                { borderTopColor: theme.border },
                reserveDiceFootprint ? { paddingRight: 16 + DICE_BUTTON_FOOTPRINT } : null,
              ]}>
              {identitySide ? null : (
                <TouchableOpacity
                  testID="flow-identity-line"
                  accessibilityRole="button"
                  onPress={() => setIdentityOpen(true)}
                  activeOpacity={0.7}
                  style={styles.identityLineBtn}
                >
                  {identityLine}
                  <Ionicons name="chevron-up" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
              <View testID="flow-primary-action" style={styles.primaryAction}>
                {primaryAction}
              </View>
            </View>
          </View>
          {identitySide ? (
            <View
              testID="flow-identity-side"
              style={[styles.identitySide, { borderLeftColor: theme.border, backgroundColor: theme.surface }]}
            >
              <ScrollView contentContainerStyle={styles.identitySideContent}>{identityPanel}</ScrollView>
            </View>
          ) : null}
        </View>
        {identitySide ? null : (
          <Modal visible={identityOpen} onClose={() => setIdentityOpen(false)} title="Character">
            {identityPanel}
          </Modal>
        )}
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
          testID="flow-identity-line"
          accessibilityRole="button"
          onPress={() => setIdentityOpen(true)}
          activeOpacity={0.7}
          style={styles.identityLineBtn}
        >
          {identityLine}
          <Ionicons name="chevron-up" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
        <View testID="flow-primary-action" style={styles.primaryAction}>
          {primaryAction}
        </View>
      </View>
      <Modal visible={identityOpen} onClose={() => setIdentityOpen(false)} title="Character">
        {identityPanel}
      </Modal>
    </SafeAreaView>
  );
}

/**
 * Extra contentContainerStyle for a flow's step scroll content. The padding follows the flow's own bottom
 * bar: while FlowShell shows that bar (width below FLOW_WIDE_MIN_WIDTH) the floating dice button
 * (DICE_BUTTON_SIZE, sitting DICE_BUTTON_EDGE_MARGIN above the bar) must not cover the last rows, so the
 * content pads its bottom by DICE_BUTTON_SIZE + DICE_BUTTON_EDGE_MARGIN there; at wide widths the button
 * sits at the viewport's bottom-right corner and nothing is added.
 */
export function useFlowStepScrollContentPadding(): ViewStyle {
  const { width } = useResponsiveLayout();
  return width < FLOW_WIDE_MIN_WIDTH ? { paddingBottom: DICE_BUTTON_SIZE + DICE_BUTTON_EDGE_MARGIN } : {};
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
    gap: 8,
  },
  identitySide: {
    width: 280,
    borderLeftWidth: 1,
  },
  identitySideContent: {
    padding: 16,
  },
});
