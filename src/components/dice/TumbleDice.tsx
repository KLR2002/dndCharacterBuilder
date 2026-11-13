import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ACCENT_PALETTES, type AccentOption } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import { TUMBLE_MS, TUMBLE_SOLID_CAP, TUMBLE_STAGGER_MS, tumbleQuaternion, tumblePop } from "../../rules/diceAnimation.ts";
import { normalize, type Quat, type Vec3 } from "../../rules/diceMath.ts";
import { d100Parts, makeDie, planSolidDice, poseShowing, type DieGeometry, type SolidSides } from "../../rules/diceSolids.ts";
import { rollAccentId } from "../../rules/rollColors.ts";
import type { RollLogEntry } from "../../rules/rollLog.ts";
import { SolidDie } from "./SolidDie";

/** A cell is this many dp across; a solid die is drawn at 36% of it as its circumradius. */
const CELL = 72;
const DIE_RADIUS = CELL * 0.36;

/** One solid die to draw: a body of a standard die, or one of the two bodies of a d100. */
type SolidBody = {
  geo: DieGeometry;
  reading: number;
  accent: AccentOption;
  dropped: boolean;
  label?: string;
};

/**
 * The solid bodies of a batch in Roll order. Every die takes its Roll's accent; a d100 gives its tens
 * body first, then its units body, and only the tens body carries the label.
 */
function solidBodies(entries: RollLogEntry[], selectedAccentId: string): SolidBody[] {
  const dice = entries.flatMap((entry) => {
    const accent = ACCENT_PALETTES[rollAccentId(selectedAccentId, entry.batchIndex)];
    return entry.roll.dice.map((die) => ({ die, accent }));
  });
  const plan = planSolidDice(
    dice.map(({ die }) => die.sides),
    TUMBLE_SOLID_CAP,
  );
  const bodies: SolidBody[] = [];
  dice.forEach(({ die, accent }, index) => {
    if (!plan[index].solid) return;
    const suffix = die.dropped ? ", dropped" : "";
    if (die.sides === 100) {
      const parts = d100Parts(die.face);
      const tens = makeDie(10, "tens");
      const units = makeDie(10, "units");
      bodies.push({ geo: tens, reading: parts.tens, accent, dropped: die.dropped, label: `d100 showing ${die.face}${suffix}` });
      bodies.push({ geo: units, reading: parts.units, accent, dropped: die.dropped });
      return;
    }
    bodies.push({
      geo: makeDie(die.sides as SolidSides, "std"),
      reading: die.face,
      accent,
      dropped: die.dropped,
      label: `d${die.sides} showing ${die.face}${suffix}`,
    });
  });
  return bodies;
}

/** A random turn axis, a spin of two to three and a half full turns, and a yaw about the vertical. */
function randomMotion(): { axis: Vec3; spin: number; yaw: number } {
  return {
    axis: normalize([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
    spin: (2 + Math.random() * 1.5) * 2 * Math.PI,
    yaw: Math.random() * 2 * Math.PI,
  };
}

/** One solid die that tumbles once on mount, then settles on the face its Roll already holds. */
function TumbleBody({ body, delay, testID }: { body: SolidBody; delay: number; testID: string }) {
  const [motion] = useState(randomMotion);
  const target = useMemo<Quat>(() => poseShowing(body.geo, body.reading, motion.yaw), [body.geo, body.reading, motion.yaw]);
  const progress = useSharedValue(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: TUMBLE_MS, easing: Easing.linear }));
  }, [delay, progress]);

  // A dropped die turns grey once it has stopped, not while it is still moving.
  useEffect(() => {
    if (!body.dropped) return;
    const timer = setTimeout(() => setSettled(true), delay + TUMBLE_MS);
    return () => clearTimeout(timer);
  }, [body.dropped, delay]);

  const quaternion = useDerivedValue(() => tumbleQuaternion(target, motion.axis, motion.spin, progress.value));

  const cellStyle = useAnimatedStyle(() => {
    const pop = tumblePop(progress.value);
    return { transform: [{ translateY: -8 * pop }, { scale: 1 + 0.22 * pop }] };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const pop = tumblePop(progress.value);
    return { opacity: 0.35 * (1 - 0.6 * pop), transform: [{ scale: 1 - 0.3 * pop }] };
  });

  return (
    <Animated.View testID={testID} accessibilityLabel={body.label} style={[styles.cell, cellStyle]}>
      <Animated.View style={[styles.shadow, shadowStyle]} />
      {/* Keyed on the settled state: the web build does not repaint a fill that changes after mount. */}
      <SolidDie
        key={settled ? "settled" : "moving"}
        geo={body.geo}
        quaternion={quaternion}
        size={DIE_RADIUS}
        accent={body.accent}
        dropped={body.dropped && settled}
      />
    </Animated.View>
  );
}

/**
 * The solid dice of a batch, tumbling in the result card above its Roll blocks. Dice with no solid
 * (and any die past the cap) are not drawn; the chips below list every face.
 */
export function TumbleDice({ entries }: { entries: RollLogEntry[] }) {
  const { accentId } = useAppTheme();
  const bodies = useMemo(() => solidBodies(entries, accentId), [entries, accentId]);
  if (bodies.length === 0) return null;
  return (
    <View testID="dice-solids" style={styles.row}>
      {bodies.map((body, index) => (
        <TumbleBody key={index} body={body} delay={index * TUMBLE_STAGGER_MS} testID={`die-solid-${index}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: {
    position: "absolute",
    bottom: 6,
    width: CELL * 0.5,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#000",
  },
});
