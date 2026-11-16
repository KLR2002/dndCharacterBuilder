import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ACCENT_PALETTES } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import type { PendingThrow } from "../../context/RollLogContext";
import { sampleThrow, THROW_FPS } from "../../rules/diceThrow.ts";
import { rollAccentId } from "../../rules/rollColors.ts";
import { dieLabel } from "./dieLabel";
import { drawDie, fillPill } from "./drawDie";
import { NativeThrowDice } from "./NativeDice";

/** How long the dice stay on screen once they have stopped, and how long they take to fade. */
const REST_MS = 1500;
const FADE_MS = 500;

type Phase = "flying" | "resting" | "fading";

/**
 * The recorded Throw played over the whole screen. While the dice fly the layer takes the first tap,
 * which shows the result at once. When the last die stops the result is revealed, the layer lets
 * touches through, and the dice fade out after they have rested.
 */
function ThrowLayerDice({
  pending,
  onReveal,
  onDone,
}: {
  pending: PendingThrow;
  onReveal: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("flying");
  const frameCount = pending.results[0].frameCount;
  const duration = (frameCount - 1) / THROW_FPS;
  const fade = useSharedValue(1);
  const callbacks = useRef({ onReveal, onDone });
  useEffect(() => {
    callbacks.current = { onReveal, onDone };
  });

  useEffect(() => {
    if (phase !== "flying") return;
    const timer = setTimeout(() => {
      callbacks.current.onReveal();
      setPhase("resting");
    }, duration * 1000);
    return () => clearTimeout(timer);
  }, [phase, duration]);

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
      importantForAccessibility={Platform.OS === "android" ? undefined : "no-hide-descendants"}
      aria-hidden={Platform.OS === "android" ? undefined : true}
      onPress={tap}
      style={[StyleSheet.absoluteFill, { pointerEvents: phase === "flying" ? "auto" : "none" }]}>
      <Animated.View style={[StyleSheet.absoluteFill, layerStyle]}>
        {Platform.OS === "android" && <NativeThrowDice pending={pending} revealed={phase !== "flying"} />}
        {Platform.OS === "web" && <ThrowCanvas pending={pending} revealed={phase !== "flying"} />}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The web Throw: every body and its shadow drawn on one canvas, repainted on each animation frame from
 * the recorded frames. The frame loop stops once the Throw has played and when the layer unmounts. Each
 * die that has a label keeps a hidden element beside the canvas, at the place it stops, with its name.
 */
function ThrowCanvas({ pending, revealed }: { pending: PendingThrow; revealed: boolean }) {
  const { accentId } = useAppTheme();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const frameCount = pending.results[0].frameCount;
  const duration = (frameCount - 1) / THROW_FPS;
  const size = pending.size;

  const bodies = useMemo(() => {
    const dice = pending.entries.flatMap((entry) => entry.roll.dice.map((die) => ({ die, batchIndex: entry.batchIndex })));
    return pending.geos.map((geo, body) => {
      const { die, batchIndex } = dice[pending.owner[body]];
      return {
        geo,
        frames: pending.results[body].frames,
        accent: ACCENT_PALETTES[rollAccentId(accentId, batchIndex)],
        dropped: die.dropped,
        rest: geo.inradius * size,
      };
    });
  }, [pending, accentId, size]);

  const labels = useMemo(() => {
    const dice = pending.entries.flatMap((entry) => entry.roll.dice.map((die) => ({ die })));
    const last = (frameCount - 1) * 7;
    return pending.geos.flatMap((geo, body) => {
      if (geo.kind === "units") return [];
      const { die } = dice[pending.owner[body]];
      const name = dieLabel(die.sides, die.face, die.dropped);
      const frames = pending.results[body].frames;
      return [{ name, x: frames[last], y: frames[last + 1] }];
    });
  }, [pending, frameCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || area.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(area.width * dpr);
    canvas.height = Math.round(area.height * dpr);
    startedAt.current ??= performance.now();
    const start = startedAt.current;

    // The shadows of every body first, then the dice, the lowest first, each at its lifted size.
    const paint = (seconds: number) => {
      const poses = bodies.map((body) => sampleThrow(body.frames, frameCount, seconds));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, area.width, area.height);
      ctx.fillStyle = "#000";
      poses.forEach((pose, i) => {
        const lift = pose.z - bodies[i].rest;
        ctx.globalAlpha = Math.max(0.08, 0.34 - lift * 0.0014);
        fillPill(ctx, pose.x + 3 + lift * 0.16, pose.y + 6 + lift * 0.26, size * 1.7, size * 1.4);
      });
      ctx.globalAlpha = 1;
      const order = bodies.map((_, i) => i).sort((a, b) => poses[a].z - poses[b].z);
      for (const i of order) {
        const body = bodies[i];
        const pose = poses[i];
        const lift = pose.z - body.rest;
        drawDie(ctx, {
          geo: body.geo,
          pose: pose.q,
          accent: body.accent,
          dropped: body.dropped && revealed,
          size: size * (1 + lift * 0.0023),
          x: pose.x,
          y: pose.y,
        });
      }
    };

    let frame = 0;
    const tick = (now: number) => {
      const seconds = Math.min(duration, (now - start) / 1000);
      paint(seconds);
      if (seconds < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [area, bodies, duration, frameCount, revealed, size]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setArea({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
      {area.width > 0 ? (
        <canvas ref={canvasRef} style={{ position: "absolute", left: 0, top: 0, width: area.width, height: area.height }} />
      ) : null}
      {area.width > 0
        ? labels.map((label, index) => (
            <View
              key={index}
              testID={`throw-die-${index}`}
              accessibilityLabel={label.name}
              style={[styles.label, { left: label.x - size, top: label.y - size, width: size * 2, height: size * 2 }]}
            />
          ))
        : null}
    </View>
  );
}

/**
 * The Throw on the platforms that draw dice. Other platforms have no dice canvas, so the Throw plays as Off:
 * the result shows at once and nothing is drawn.
 */
export function ThrowLayer(props: React.ComponentProps<typeof ThrowLayerDice>) {
  if (Platform.OS === "web" || Platform.OS === "android") return <ThrowLayerDice {...props} />;
  return <OffThrow onReveal={props.onReveal} onDone={props.onDone} />;
}

function OffThrow({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const callbacks = useRef({ onReveal, onDone });
  useEffect(() => {
    callbacks.current.onReveal();
    callbacks.current.onDone();
  }, []);
  return null;
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },
});
