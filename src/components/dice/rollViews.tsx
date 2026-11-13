import { Ionicons } from "@expo/vector-icons";
import React, { Suspense } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ACCENT_PALETTES } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import { formatModifier } from "../../rules/abilities.ts";
import type { Roll } from "../../rules/dice.ts";
import { rollAccentId } from "../../rules/rollColors.ts";
import { entryHeading, formatRollTime, rollMarkers, type RollLogEntry } from "../../rules/rollLog.ts";
import { useDiceAnimation } from "./useDiceAnimation";

// The 2.5D renderer (Reanimated + SVG) lives in its own chunk: React.lazy only fetches it when this
// slot actually renders it, so while the dice animation is off nothing of it is loaded.
const AnimatedDiceRoll = React.lazy(() => import("./AnimatedDiceRoll").then((module) => ({ default: module.AnimatedDiceRoll })));

/**
 * The one place an animated dice renderer mounts for a Roll. It receives the completed Roll, faces
 * already decided, so the total never waits for it. Renders nothing while the dice animation is off;
 * then the faces show as the chips below, at once.
 */
export function DiceRenderer({ roll }: { roll: Roll }) {
  const mode = useDiceAnimation();
  if (mode === "off") return null;
  return (
    <Suspense fallback={null}>
      <AnimatedDiceRoll roll={roll} />
    </Suspense>
  );
}

/**
 * The accent a Roll takes inside its batch: a Roll of a batch of two or more gets the batch's accent
 * for its position; a single Roll has none and keeps the selected accent.
 */
export function batchAccentId(entry: Pick<RollLogEntry, "batchSize" | "batchIndex">, selectedAccentId: string): string | undefined {
  return entry.batchSize > 1 ? rollAccentId(selectedAccentId, entry.batchIndex) : undefined;
}

/** One die's face as a small chip; a dropped die is struck through and muted. */
export function DieFaceChip({ sides, face, dropped, accentId }: { sides: number; face: number; dropped?: boolean; accentId?: string }) {
  const { theme } = useAppTheme();
  const palette = accentId ? ACCENT_PALETTES[accentId] : undefined;
  return (
    <View
      testID="die-chip"
      style={[
        styles.dieChip,
        {
          borderColor: dropped ? theme.border : (palette?.border ?? theme.accentBorder),
          backgroundColor: dropped ? "transparent" : (palette?.glow ?? theme.accentGlow),
        },
      ]}>
      <Text
        style={[
          styles.dieFace,
          {
            color: dropped ? theme.textMuted : theme.accentHover,
            textDecorationLine: dropped ? "line-through" : "none",
          },
        ]}>
        {face}
      </Text>
      <Text style={[styles.dieSides, { color: theme.textMuted }]}>d{sides}</Text>
    </View>
  );
}

const MARKER_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string; accent: boolean }> = {
  natural20: { icon: "star", label: "Natural 20", accent: true },
  natural1: { icon: "skull", label: "Natural 1", accent: false },
  critical: { icon: "flash", label: "Critical", accent: true },
};

/** The faces, modifier, large total and markers of one Roll; `accentId` tints its die chips. */
export function RollResultView({ entry, accentId }: { entry: RollLogEntry; accentId?: string }) {
  const { theme } = useAppTheme();
  const { roll } = entry;
  return (
    <View style={styles.resultWrap}>
      <Text testID="result-source" style={[styles.resultSource, { color: theme.textSecondary }]} numberOfLines={1}>
        {entryHeading(entry)}
      </Text>
      {/* The dice renderer's slot: it mounts here with the completed Roll. */}
      <DiceRenderer roll={roll} />
      <View style={styles.facesRow}>
        {roll.dice.map((die, index) => (
          <DieFaceChip key={index} sides={die.sides} face={die.face} dropped={die.dropped} accentId={accentId} />
        ))}
        {roll.modifier !== 0 ? (
          <Text testID="result-modifier" style={[styles.modifierText, { color: theme.textSecondary }]}>
            {formatModifier(roll.modifier)}
          </Text>
        ) : null}
        <Text testID="result-total" style={[styles.totalText, { color: theme.text }]}>
          {roll.total}
        </Text>
      </View>
      {rollMarkers(entry).map((marker) => {
        const meta = MARKER_META[marker];
        const color = meta.accent ? theme.accentHover : theme.danger;
        return (
          <View key={marker} style={styles.markerRow}>
            <Ionicons name={meta.icon} size={13} color={color} />
            <Text style={[styles.markerText, { color }]}>{meta.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** One Roll Log row: character and source, faces, total, markers, time; `accentId` puts a dot before the heading. */
export function RollLogRow({ entry, accentId }: { entry: RollLogEntry; accentId?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.logRow, { borderBottomColor: theme.border }]}>
      <View style={styles.logHead}>
        {accentId ? <View testID="log-entry-dot" style={[styles.logDot, { backgroundColor: ACCENT_PALETTES[accentId].primary }]} /> : null}
        <Text testID="log-entry-heading" style={[styles.logSource, { color: theme.text }]} numberOfLines={1}>
          {entryHeading(entry)}
        </Text>
        <Text style={[styles.logTime, { color: theme.textMuted }]}>{formatRollTime(entry.time)}</Text>
      </View>
      <View style={styles.logFaces}>
        {entry.roll.dice.map((die, index) => (
          <DieFaceChip key={index} sides={die.sides} face={die.face} dropped={die.dropped} />
        ))}
        {entry.roll.modifier !== 0 ? (
          <Text style={[styles.logMod, { color: theme.textSecondary }]}>{formatModifier(entry.roll.modifier)}</Text>
        ) : null}
        <Text style={[styles.logTotal, { color: theme.text }]}>{entry.roll.total}</Text>
      </View>
      {rollMarkers(entry).map((marker) => (
        <Text key={marker} style={[styles.logMarker, { color: marker === "natural1" ? theme.danger : theme.accentHover }]}>
          {MARKER_META[marker].label}
        </Text>
      ))}
    </View>
  );
}

/** The session Roll Log, newest first. */
export function RollLogList({ entries }: { entries: RollLogEntry[] }) {
  const { theme, accentId } = useAppTheme();
  if (entries.length === 0) {
    return <Text style={[styles.logEmpty, { color: theme.textMuted }]}>No rolls yet.</Text>;
  }
  return (
    <View>
      {entries.map((entry) => (
        <RollLogRow key={entry.id} entry={entry} accentId={batchAccentId(entry, accentId)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dieChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    minWidth: 40,
    minHeight: 28,
    justifyContent: "center",
  },
  dieFace: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  dieSides: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  resultWrap: {
    gap: 6,
  },
  resultSource: {
    fontSize: 12,
    fontWeight: "600",
  },
  facesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  modifierText: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  totalText: {
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginLeft: 2,
  },
  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  markerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  logRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 5,
  },
  logHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  logSource: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
  },
  logTime: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  logFaces: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  logMod: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  logTotal: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  logMarker: {
    fontSize: 11,
    fontWeight: "700",
  },
  logEmpty: {
    fontSize: 13,
    paddingVertical: 12,
  },
});
