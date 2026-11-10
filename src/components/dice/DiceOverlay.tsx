import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { useRollLog } from "../../context/RollLogContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { entryHeading, type RollLogEntry } from "../../rules/rollLog.ts";
import { Button } from "../ui/Button";
import { DiceTray } from "./DiceTray";
import { RollResultView } from "./rollViews";

/** How long the result card stays before it disappears on its own. */
const RESULT_CARD_TIMEOUT_MS = 8000;

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
 * most 360px at the bottom-right at wide widths. Tapping the card opens the tray on the Log segment;
 * the follow-up action is its own button, separate from the card's press target. It disappears when
 * dismissed, when replaced by a newer Roll, or after about 8 seconds — never while it still offers a
 * follow-up. The card is a polite live region (and announces itself on native), so a screen reader
 * hears each result.
 */
function ResultCard({
  entry,
  bottom,
  fullWidth,
  onDismiss,
  onOpenLog,
}: {
  entry: RollLogEntry;
  bottom: number;
  fullWidth: boolean;
  onDismiss: () => void;
  onOpenLog: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      testID="result-card"
      accessibilityLiveRegion="polite"
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
      <Pressable
        testID="result-card-body"
        accessibilityRole="button"
        accessibilityLabel={`${entryHeading(entry)}, total ${entry.roll.total}`}
        accessibilityHint="Opens the Roll Log"
        onPress={onOpenLog}
        style={styles.cardBody}>
        <RollResultView entry={entry} />
      </Pressable>
      {/* Sibling of the card body, not nested: press events bubble, and a nested button would also
          fire the card's own press and open the tray over the result. */}
      {entry.followUp ? (
        <Button
          title={entry.followUp.label}
          variant="primary"
          size="md"
          icon="dice-outline"
          onPress={entry.followUp.onPress}
          style={{ width: "100%", marginTop: 4 }}
        />
      ) : null}
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
  const { latest, dismissResult, openTray, bottomObstruction } = useRollLog();

  // A newer Roll replaces the card and restarts its timeout; the timer never outlives the card, and a
  // card that still offers a follow-up ("Roll damage") never auto-dismisses.
  const latestId = latest?.id ?? null;
  const hasFollowUp = latest?.followUp != null;
  useEffect(() => {
    if (latestId === null || hasFollowUp) return;
    const timer = setTimeout(dismissResult, RESULT_CARD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [latestId, hasFollowUp, dismissResult]);

  // On web the card's polite live region announces the result; native needs the explicit announcement.
  useEffect(() => {
    if (latest === null || Platform.OS === "web") return;
    AccessibilityInfo.announceForAccessibility(`${entryHeading(latest)}, total ${latest.roll.total}`);
  }, [latest]);

  const buttonBottom = insets.bottom + 16 + bottomObstruction;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
      <FloatingDiceButton bottom={buttonBottom} onPress={() => openTray("dice")} />
      {latest ? (
        <ResultCard
          entry={latest}
          bottom={buttonBottom + 56 + 8}
          fullWidth={isPhone}
          onDismiss={dismissResult}
          onOpenLog={() => openTray("log")}
        />
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
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
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
});
