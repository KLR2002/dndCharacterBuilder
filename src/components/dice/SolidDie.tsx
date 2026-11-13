import React, { useMemo } from "react";
import Animated, { useAnimatedProps, useDerivedValue, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, G, Polygon, Text as SvgText } from "react-native-svg";
import type { Quat } from "../../rules/diceMath.ts";
import type { DieFace, DieGeometry } from "../../rules/diceSolids.ts";
import { hexToRgb, pipMarks, projectDie, type DieProjection, type ProjectionStyle, type Rgb } from "../../rules/diceProjection.ts";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedText = Animated.createAnimatedComponent(SvgText);
const AnimatedG = Animated.createAnimatedComponent(G);

/** The grey body and muted numerals of a die that has been dropped from the roll. */
const DROPPED_BODY: Rgb = [104, 108, 116];
const DROPPED_INK: Rgb = [210, 210, 210];

/** The canvas is this many circumradii across, so a tilted die and its labels stay inside it. */
export const SOLID_EXTENT = 2.7;

type Accent = { primary: string; text: string };

/**
 * A solid die drawn with SVG polygons. The orientation is read from `quaternion` on every frame, so
 * the caller animates the pose by writing that shared value.
 */
export function SolidDie({
  geo,
  quaternion,
  size,
  accent,
  dropped = false,
}: {
  geo: DieGeometry;
  quaternion: SharedValue<Quat>;
  size: number;
  accent: Accent;
  dropped?: boolean;
}) {
  const primary = accent.primary;
  const text = accent.text;
  const style = useMemo<ProjectionStyle>(
    () => ({
      base: dropped ? DROPPED_BODY : hexToRgb(primary),
      ink: dropped ? DROPPED_INK : hexToRgb(text),
      dropped,
    }),
    [primary, text, dropped],
  );

  const projection = useDerivedValue<DieProjection>(
    () => projectDie(geo, quaternion.value, size, style),
    [geo, quaternion, size, style],
  );

  const extent = size * SOLID_EXTENT;
  const strokeWidth = Math.max(1, size * 0.035);

  return (
    <Svg width={extent} height={extent} viewBox={`${-extent / 2} ${-extent / 2} ${extent} ${extent}`}>
      {geo.faces.map((face, index) => (
        <FaceView key={index} projection={projection} index={index} face={face} size={size} strokeWidth={strokeWidth} />
      ))}
    </Svg>
  );
}

function FaceView({
  projection,
  index,
  face,
  size,
  strokeWidth,
}: {
  projection: SharedValue<DieProjection>;
  index: number;
  face: DieFace;
  size: number;
  strokeWidth: number;
}) {
  const polygonProps = useAnimatedProps(() => {
    const drawn = projection.value.faces[index];
    return {
      points: drawn.points,
      fill: drawn.fill,
      stroke: drawn.stroke,
      opacity: drawn.visible ? 1 : 0,
    };
  });

  return (
    <>
      <AnimatedPolygon animatedProps={polygonProps} strokeWidth={strokeWidth} strokeLinejoin="round" />
      {face.labels.map((label, k) =>
        label.kind === "pips" ? (
          <PipLabel key={k} projection={projection} index={index} slot={k} value={label.value} halfSize={label.size} />
        ) : (
          <TextLabel key={k} projection={projection} index={index} slot={k} text={label.text} size={label.size} />
        ),
      )}
    </>
  );
}

function TextLabel({
  projection,
  index,
  slot,
  text,
  size,
}: {
  projection: SharedValue<DieProjection>;
  index: number;
  slot: number;
  text: string;
  size: number;
}) {
  const props = useAnimatedProps(() => {
    const face = projection.value.faces[index];
    return {
      transform: face.labels[slot].transform,
      fill: face.labels[slot].fill,
      opacity: face.visible ? 1 : 0,
    };
  });
  return (
    <AnimatedText
      animatedProps={props}
      fontSize={size * 100}
      fontWeight="800"
      textAnchor="middle"
      dy={size * 35}
    >
      {text}
    </AnimatedText>
  );
}

function PipLabel({
  projection,
  index,
  slot,
  value,
  halfSize,
}: {
  projection: SharedValue<DieProjection>;
  index: number;
  slot: number;
  value: number;
  halfSize: number;
}) {
  const props = useAnimatedProps(() => {
    const face = projection.value.faces[index];
    return {
      transform: face.labels[slot].transform,
      fill: face.labels[slot].fill,
      opacity: face.visible ? 1 : 0,
    };
  });
  const pips = useMemo(() => pipMarks(value, halfSize), [value, halfSize]);
  return (
    <AnimatedG animatedProps={props}>
      {pips.map((pip, i) => (
        <Circle key={i} cx={pip.cx} cy={pip.cy} r={pip.r} />
      ))}
    </AnimatedG>
  );
}
