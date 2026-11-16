import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ACCENT_PALETTES } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import type { PendingThrow } from "../../context/RollLogContext";
import { TUMBLE_STAGGER_MS } from "../../rules/diceAnimation.ts";
import { poseShowing, type DieGeometry } from "../../rules/diceSolids.ts";
import { rollAccentId } from "../../rules/rollColors.ts";
import { dieLabel } from "./dieLabel";
import { randomMotion } from "./diceMotion";
import { droppedFlags, throwScene, tumbleScene, type SceneAccent } from "./nativeDiceScene";
import { DieLabel, NativeDiceCanvas } from "./NativeDiceCanvas";
import { CELL, ROW_TOP, tumbleCells, tumbleHeight } from "./tumbleCells";

/**
 * The recorded Throw drawn by the native canvas. The scene is built once per Throw, so a change of
 * `revealed` only changes the dropped flags and does not replay the motion.
 */
export function NativeThrowDice({ pending, revealed }: { pending: PendingThrow; revealed: boolean }) {
  const { accentId } = useAppTheme();
  const frameCount = pending.results[0].frameCount;
  const dice = useMemo(
    () => pending.entries.flatMap((entry) => entry.roll.dice.map((die) => ({ die, batchIndex: entry.batchIndex }))),
    [pending],
  );
  const scene = useMemo(
    () =>
      throwScene(
        pending.size,
        frameCount,
        pending.geos.map((geo, body) => ({
          geo,
          frames: pending.results[body].frames,
          accent: ACCENT_PALETTES[rollAccentId(accentId, dice[pending.owner[body]].batchIndex)],
        })),
      ),
    [pending, frameCount, accentId, dice],
  );
  const dropped = droppedFlags(pending.geos.map((_, body) => revealed && dice[pending.owner[body]].die.dropped));
  const labels = pending.geos.flatMap((geo, body) => {
    if (geo.kind === "units") return [];
    const { die } = dice[pending.owner[body]];
    return [dieLabel(die.sides, die.face, die.dropped)];
  });
  return (
    <>
      <NativeDiceCanvas scene={scene} dropped={dropped} style={StyleSheet.absoluteFill} />
      {labels.map((label, index) => (
        <DieLabel key={index} testID={`throw-die-${index}`} label={label} />
      ))}
    </>
  );
}

/** One solid die of a Tumble batch, as the Tumble row needs it. */
export type NativeTumbleBody = {
  geo: DieGeometry;
  reading: number;
  accent: SceneAccent;
  dropped: boolean;
  label?: string;
};

/**
 * The Tumble row drawn by the native canvas, in the same grid as the web row (tumbleCells). Its labels
 * stay in the accessibility tree.
 */
export function NativeTumbleDice({ bodies }: { bodies: NativeTumbleBody[] }) {
  const [width, setWidth] = useState(0);
  const [motions] = useState(() => bodies.map(() => randomMotion()));
  const cells = useMemo(() => tumbleCells(bodies.length, width), [bodies.length, width]);
  const scene = useMemo(
    () =>
      tumbleScene(
        CELL,
        bodies.map((body, index) => ({
          geo: body.geo,
          accent: body.accent,
          target: poseShowing(body.geo, body.reading, motions[index].yaw),
          axis: motions[index].axis,
          spin: motions[index].spin,
          cx: cells[index].x + CELL / 2,
          cy: cells[index].y + CELL / 2,
          delay: index * TUMBLE_STAGGER_MS,
        })),
      ),
    [bodies, motions, cells],
  );
  const labels = bodies.flatMap((body) => (body.label ? [body.label] : []));
  return (
    <View testID="dice-solids" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: width > 0 ? tumbleHeight(bodies.length, width) : CELL + ROW_TOP }}>
      {width > 0 ? (
        <NativeDiceCanvas scene={scene} dropped={droppedFlags(bodies.map((body) => body.dropped))} style={StyleSheet.absoluteFill} />
      ) : null}
      {labels.map((label, index) => (
        <DieLabel key={index} testID={`die-solid-${index}`} label={label} />
      ))}
    </View>
  );
}
