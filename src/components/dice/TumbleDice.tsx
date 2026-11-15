import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ACCENT_PALETTES, type AccentOption } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import { TUMBLE_MS, TUMBLE_SOLID_CAP, TUMBLE_STAGGER_MS, tumbleQuaternion, tumblePop } from "../../rules/diceAnimation.ts";
import { d100Parts, makeDie, planSolidDice, poseShowing, type DieGeometry, type SolidSides } from "../../rules/diceSolids.ts";
import { rollAccentId } from "../../rules/rollColors.ts";
import type { RollLogEntry } from "../../rules/rollLog.ts";
import { randomMotion } from "./diceMotion";
import { NativeTumbleDice } from "./NativeDice";
import { drawDie, fillPill } from "./drawDie";
import { CELL, DIE_RADIUS, tumbleCells, tumbleHeight } from "./tumbleCells";

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

/**
 * The web row: every solid die of the batch is drawn on one canvas, repainted on each animation frame
 * with the native row's timing, lift and shadow. Each die keeps a hidden element beside the canvas that
 * carries its name. The frame loop stops when the last die has settled and when the row unmounts.
 */
function TumbleCanvas({ bodies }: { bodies: SolidBody[] }) {
  const [width, setWidth] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motions = useMemo(() => bodies.map(() => randomMotion()), [bodies]);
  const targets = useMemo(() => bodies.map((body, index) => poseShowing(body.geo, body.reading, motions[index].yaw)), [bodies, motions]);
  const cells = useMemo(() => tumbleCells(bodies.length, width), [bodies.length, width]);
  const height = width > 0 ? tumbleHeight(bodies.length, width) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const start = performance.now();
    let frame = 0;
    const paint = (now: number) => {
      const elapsed = now - start;
      let moving = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      bodies.forEach((body, index) => {
        const motion = motions[index];
        const progress = Math.min(1, Math.max(0, (elapsed - index * TUMBLE_STAGGER_MS) / TUMBLE_MS));
        if (progress < 1) moving = true;
        const pop = tumblePop(progress);
        const scale = 1 + 0.22 * pop;
        const centreX = cells[index].x + CELL / 2;
        const centreY = cells[index].y + CELL / 2;
        const lift = -8 * pop;

        ctx.globalAlpha = 0.35 * (1 - 0.6 * pop);
        ctx.fillStyle = "#000";
        const shadowScale = scale * (1 - 0.3 * pop);
        fillPill(ctx, centreX, centreY + 26 * scale + lift, (CELL * 0.5) * shadowScale, 8 * shadowScale);
        ctx.globalAlpha = 1;

        drawDie(ctx, {
          geo: body.geo,
          pose: tumbleQuaternion(targets[index], motion.axis, motion.spin, progress),
          accent: body.accent,
          dropped: body.dropped && progress >= 1,
          size: DIE_RADIUS * scale,
          x: centreX,
          y: centreY + lift,
        });
      });
      if (moving) frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [bodies, cells, height, motions, targets, width]);

  // Nothing is laid out before the row is measured: a row of unknown width would wrap into one column, far taller than the card.
  return (
    <View
      testID="dice-solids"
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ width: "100%", height }}>
      {width > 0 ? <canvas ref={canvasRef} style={{ width, height, display: "block" }} /> : null}
      {width > 0
        ? bodies.map((body, index) => (
            <View
              key={index}
              testID={`die-solid-${index}`}
              accessibilityLabel={body.label}
              style={[styles.label, { left: cells[index].x, top: cells[index].y }]}
            />
          ))
        : null}
    </View>
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
  if (Platform.OS === "android") return <NativeTumbleDice bodies={bodies} />;
  if (Platform.OS === "web") return <TumbleCanvas bodies={bodies} />;
  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    // Room for the lift and the pop scale of the top row, so the card's scroll area does not clip it.
    paddingTop: 12,
  },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    width: CELL,
    height: CELL,
    opacity: 0,
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
