import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ACCENT_PALETTES } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import type { PendingThrow } from "../../context/RollLogContext";
import { sampleThrow, THROW_FPS, type ThrowPose } from "../../rules/diceThrow.ts";
import type { Quat } from "../../rules/diceMath.ts";
import type { DieGeometry } from "../../rules/diceSolids.ts";
import { rollAccentId } from "../../rules/rollColors.ts";
import { SOLID_EXTENT, SolidDie } from "./SolidDie";

/** How long the dice stay on screen once they have stopped, and how long they take to fade. */
const REST_MS = 1500;
const FADE_MS = 500;

type Phase = "flying" | "resting" | "fading";

/**
 * The recorded Throw played over the whole screen. While the dice fly the layer takes the first tap,
 * which shows the result at once. When the last die stops the result is revealed, the layer lets
 * touches through, and the dice fade out after they have rested.
 */
export function ThrowLayer({
  pending,
  onReveal,
  onDone,
}: {
  pending: PendingThrow;
  onReveal: () => void;
  onDone: () => void;
}) {
  const { accentId } = useAppTheme();
  const [phase, setPhase] = useState<Phase>("flying");
  const frameCount = pending.results[0].frameCount;
  const duration = (frameCount - 1) / THROW_FPS;
  const time = useSharedValue(0);
  const fade = useSharedValue(1);
  const callbacks = useRef({ onReveal, onDone });
  useEffect(() => {
    callbacks.current = { onReveal, onDone };
  });

  const frames = useMemo(() => pending.results.map((result) => Array.from(result.frames)), [pending]);
  const dice = useMemo(
    () => pending.entries.flatMap((entry) => entry.roll.dice.map((die) => ({ die, batchIndex: entry.batchIndex }))),
    [pending],
  );

  useEffect(() => {
    if (phase !== "flying") return;
    time.value = withTiming(duration, { duration: duration * 1000, easing: Easing.linear });
    const timer = setTimeout(() => {
      callbacks.current.onReveal();
      setPhase("resting");
    }, duration * 1000);
    return () => {
      clearTimeout(timer);
      cancelAnimation(time);
    };
  }, [phase, duration, time]);

  useEffect(() => {
    if (phase !== "resting") return;
    const timer = setTimeout(() => setPhase("fading"), REST_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    fade.value = withTiming(0, { duration: FADE_MS, easing: Easing.linear });
    const timer = setTimeout(() => callbacks.current.onDone(), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase, fade]);

  const tap = () => {
    callbacks.current.onReveal();
    callbacks.current.onDone();
  };

  const layerStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Pressable
      testID="throw-layer"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      onPress={tap}
      style={[StyleSheet.absoluteFill, { pointerEvents: phase === "flying" ? "auto" : "none" }]}>
      <Animated.View style={[StyleSheet.absoluteFill, layerStyle]}>
        {pending.geos.map((geo, body) => {
          const { die, batchIndex } = dice[pending.owner[body]];
          const suffix = die.dropped ? ", dropped" : "";
          const label =
            geo.kind === "units"
              ? undefined
              : geo.kind === "tens"
                ? `d100 showing ${die.face}${suffix}`
                : `d${die.sides} showing ${die.face}${suffix}`;
          return (
            <ThrownBody
              key={body}
              testID={`throw-die-${body}`}
              label={label}
              geo={geo}
              frames={frames[body]}
              frameCount={frameCount}
              time={time}
              size={pending.size}
              accent={ACCENT_PALETTES[rollAccentId(accentId, batchIndex)]}
              dropped={die.dropped && phase !== "flying"}
              settled={phase !== "flying"}
            />
          );
        })}
      </Animated.View>
    </Pressable>
  );
}

/**
 * One body of the Throw: its shadow on the floor and the die itself, placed and tilted by the recorded
 * pose at the shared clock. The die sits above every shadow, and higher dice above lower ones.
 */
function ThrownBody({
  testID,
  label,
  geo,
  frames,
  frameCount,
  time,
  size,
  accent,
  dropped,
  settled,
}: {
  testID: string;
  label?: string;
  geo: DieGeometry;
  frames: number[];
  frameCount: number;
  time: SharedValue<number>;
  size: number;
  accent: { primary: string; text: string };
  dropped: boolean;
  settled: boolean;
}) {
  const pose = useDerivedValue<ThrowPose>(() => sampleThrow(frames, frameCount, time.value), [frames, frameCount, time]);
  const quaternion = useDerivedValue<Quat>(() => pose.value.q);
  const rest = geo.inradius * size;
  const extent = size * SOLID_EXTENT;

  const dieStyle = useAnimatedStyle(() => {
    const lift = pose.value.z - rest;
    return {
      left: pose.value.x - extent / 2,
      top: pose.value.y - extent / 2,
      zIndex: 10 + Math.round(pose.value.z),
      transform: [{ scale: 1 + lift * 0.0023 }],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const lift = pose.value.z - rest;
    return {
      left: pose.value.x + 3 + lift * 0.16 - size * 0.85,
      top: pose.value.y + 6 + lift * 0.26 - size * 0.7,
      opacity: Math.max(0.08, 0.34 - lift * 0.0014),
    };
  });

  return (
    <>
      <Animated.View style={[styles.shadow, { width: size * 1.7, height: size * 1.4, borderRadius: size * 0.7 }, shadowStyle]} />
      <Animated.View
        testID={testID}
        accessibilityLabel={label}
        style={[{ position: "absolute", width: extent, height: extent }, dieStyle]}>
        {/* Keyed on the settled state: the web build does not repaint a fill that changes after mount. */}
        <SolidDie key={settled ? "settled" : "moving"} geo={geo} quaternion={quaternion} size={size} accent={accent} dropped={dropped} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    backgroundColor: "#000",
  },
});
