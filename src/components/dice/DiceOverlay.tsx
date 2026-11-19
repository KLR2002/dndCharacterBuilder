import Ionicons from "@expo/vector-icons/Ionicons";
import React, { Suspense, useEffect } from "react";
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ACCENT_PALETTES } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import { useRollLog } from "../../context/RollLogContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { entryHeading, type RollLogEntry } from "../../rules/rollLog.ts";
import { Button } from "../ui/Button";
import { DiceTray } from "./DiceTray";
import { useDiceAnimation } from "./useDiceAnimation";
import { batchAccentId, RollResultView } from "./rollViews";

// TumbleDice and ThrowLayer each load in their own chunk on first render: TumbleDice only under Tumble, ThrowLayer only while a Throw is in the air.
const TumbleDice = React.lazy(() => import("./TumbleDice").then((module) => ({ default: module.TumbleDice })));
const ThrowLayer = React.lazy(() => import("./ThrowLayer").then((module) => ({ default: module.ThrowLayer })));

/** How long the result card stays before it disappears on its own. */
const RESULT_CARD_TIMEOUT_MS = 8000;

/** The result card's share of the window height; a batch taller than this scrolls inside the card. */
const RESULT_CARD_MAX_HEIGHT_RATIO = 0.6;

/** The floating dice button's diameter in dp. */
export const DICE_BUTTON_SIZE = 56;

/** The button's gap from the screen's right edge, and from the phone bottom bar's top, in dp. */
export const DICE_BUTTON_EDGE_MARGIN = 16;

/** The horizontal space the floating button takes from the screen's right edge: its size plus its margin. */
export const DICE_BUTTON_FOOTPRINT = DICE_BUTTON_SIZE + DICE_BUTTON_EDGE_MARGIN;

/** The 56dp floating dice button, bottom-right of every screen. Only an open modal's overlay covers it. */
function FloatingDiceButton({ bottom, onPress }: { bottom: number; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      testID="dice-button"
      accessibilityRole="button"
      accessibilityLabel="Dice tray"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
          bottom,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <Ionicons name="dice-outline" size={26} color={theme.accentHover} />
    </Pressable>
  );
}

/**
 * The result card, just above the floating button: full width minus the 16px gutters on phones, at
 * most 360px at the bottom-right at wide widths. It stacks one block per Roll of the batch, each with
 * its own total and its own follow-up action; a batch of two or more tints each block with its accent.
 * Tapping a block opens the tray on the Log segment. The card scrolls inside a maximum height. It
 * disappears when dismissed, when replaced by a newer batch, or after about 8 seconds — never while a
 * block still offers a follow-up. The card itself is never a live region: it mounts fresh on every
 * Roll, and a region that appears already populated is not announced reliably, so each platform
 * announces through exactly one other mechanism (see DiceOverlay).
 */
function ResultCard({
  entries,
  bottom,
  fullWidth,
  onDismiss,
  onOpenLog,
}: {
  entries: RollLogEntry[];
  bottom: number;
  fullWidth: boolean;
  onDismiss: () => void;
  onOpenLog: () => void;
}) {
  const { theme, accentId } = useAppTheme();
  const { height } = useWindowDimensions();
  const animation = useDiceAnimation();
  return (
    <View
      testID="result-card"
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
          bottom,
          right: 16,
          ...(fullWidth ? { left: 16 } : { maxWidth: 360 }),
        },
      ]}>
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: height * RESULT_CARD_MAX_HEIGHT_RATIO - 30 }}
        contentContainerStyle={styles.blocks}>
        {animation === "tumble" ? (
          <Suspense fallback={null}>
            <TumbleDice key={entries[0]?.batchId} entries={entries} />
          </Suspense>
        ) : null}
        {entries.map((entry) => {
          const blockAccent = batchAccentId(entry, accentId);
          return (
            <View
              key={entry.id}
              testID="result-block"
              style={blockAccent ? [styles.block, { borderLeftWidth: 4, borderLeftColor: ACCENT_PALETTES[blockAccent].primary }] : undefined}>
              <Pressable
                testID="result-card-body"
                accessibilityRole="button"
                accessibilityLabel={`${entryHeading(entry)}, total ${entry.roll.total}`}
                accessibilityHint="Opens the Roll Log"
                onPress={onOpenLog}
                style={styles.cardBody}>
                <RollResultView entry={entry} accentId={blockAccent} />
              </Pressable>
              {/* Sibling of the block's press target, not nested: press events bubble, and a nested button
                  would also fire the press and open the tray over the result. */}
              {entry.followUp ? (
                <Button
                  title={entry.followUp.label}
                  variant="secondary"
                  size="md"
                  icon="dice-outline"
                  onPress={entry.followUp.onPress}
                  style={{ width: "100%", marginTop: 4 }}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss result"
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.dismissBtn}>
        <Ionicons name="close" size={16} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

/**
 * The dice UI mounted once at the root layout, so it sits on every screen: the floating button, the
 * result card of the latest Roll, and the tray. `bottomObstruction` lifts the button above a screen's
 * bottom primary-action bar on phones.
 */
export function DiceOverlay() {
  const { insets, isPhone } = useResponsiveLayout();
  const { latest, dismissResult, openTray, bottomObstruction, setThrowOrigin, flight, endFlight, revealResult } = useRollLog();

  // A newer batch replaces the card and restarts its timeout; the timer never outlives the card, and a
  // card that still offers a follow-up ("Roll damage") on any of its Rolls never auto-dismisses.
  const latestBatchId = latest?.[0]?.batchId ?? null;
  const hasFollowUp = latest?.some((entry) => entry.followUp != null) ?? false;
  useEffect(() => {
    if (latestBatchId === null || hasFollowUp) return;
    const timer = setTimeout(dismissResult, RESULT_CARD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [latestBatchId, hasFollowUp, dismissResult]);

  // Every Roll of the batch, heading and total, in the order it was published.
  const announcement = latest ? latest.map((entry) => `${entryHeading(entry)}, total ${entry.roll.total}`).join(". ") : "";

  // One announcement mechanism per platform, so a screen reader hears each result exactly once.
  // Android and iOS announce explicitly: the card mounts fresh on every Roll (after a dismissal or
  // the 8 s timeout the next Roll's view appears with its announcement already in it), and TalkBack
  // does not reliably announce a live region that appears already populated. Web keeps the live
  // region instead — but always mounted below, so each Roll changes its text rather than mounting a
  // populated region, which works after a dismissal too.
  useEffect(() => {
    if (latest === null || Platform.OS === "web") return;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [latest, announcement]);

  const buttonBottom = insets.bottom + 16 + bottomObstruction;

  // A Throw leaves from the button's centre, so the context follows the button's place on the window.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  useEffect(() => {
    setThrowOrigin([
      windowWidth - DICE_BUTTON_EDGE_MARGIN - DICE_BUTTON_SIZE / 2,
      windowHeight - buttonBottom - DICE_BUTTON_SIZE / 2,
    ]);
  }, [windowWidth, windowHeight, buttonBottom, setThrowOrigin]);

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
      {flight ? (
        <Suspense fallback={null}>
          <ThrowLayer
            key={flight.startId}
            pending={flight}
            onReveal={revealResult}
            onDone={() => endFlight(flight.startId)}
          />
        </Suspense>
      ) : null}
      <FloatingDiceButton bottom={buttonBottom} onPress={() => openTray("dice")} />
      {latest ? (
        <ResultCard
          entries={latest}
          bottom={buttonBottom + DICE_BUTTON_SIZE + 8}
          fullWidth={isPhone}
          onDismiss={dismissResult}
          onOpenLog={() => openTray("log")}
        />
      ) : null}
      {Platform.OS === "web" ? (
        <View accessibilityLiveRegion="polite" testID="dice-announce-region" style={styles.liveRegion}>
          <Text style={styles.liveRegionText}>
            {latest === null ? "" : announcement}
          </Text>
        </View>
      ) : null}
      <DiceTray />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 10,
  },
  button: {
    position: "absolute",
    right: DICE_BUTTON_EDGE_MARGIN,
    width: DICE_BUTTON_SIZE,
    height: DICE_BUTTON_SIZE,
    borderRadius: DICE_BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  blocks: {
    gap: 12,
  },
  block: {
    paddingLeft: 10,
  },
  cardBody: {
    gap: 4,
  },
  dismissBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  // Visually hidden but in the accessibility tree: the always-mounted web live region.
  liveRegion: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
  },
  liveRegionText: {
    fontSize: 1,
  },
});
