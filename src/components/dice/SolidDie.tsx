import React, { useMemo } from "react";
import { Platform } from "react-native";
import Animated, { useAnimatedProps, useDerivedValue, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, G, Polygon, Text as SvgText } from "react-native-svg";
import type { Quat } from "../../rules/diceMath.ts";
import type { DieFace, DieGeometry } from "../../rules/diceSolids.ts";
import { pipMarks, projectDie, solidStyle, type DieProjection, type LabelMatrix, type ProjectionStyle } from "../../rules/diceProjection.ts";

// A label's matrix reaches react-native-svg under a different prop name per platform. Native animated props skip
// the JS step that turns `transform` into the native `matrix` prop, so native takes `matrix` (six numbers) and the
// web, which renders `transform`, takes that.
const IS_WEB = Platform.OS === "web";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedText = Animated.createAnimatedComponent(SvgText);
const AnimatedG = Animated.createAnimatedComponent(G);

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
  const style = useMemo<ProjectionStyle>(() => solidStyle({ primary, text }, dropped), [primary, text, dropped]);

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
    const label = face.labels[slot];
    const props: { fill: string; opacity: number; transform?: LabelMatrix; matrix?: LabelMatrix } = {
      fill: label.fill,
      opacity: face.visible ? 1 : 0,
    };
    if (IS_WEB) props.transform = label.transform;
    else props.matrix = label.transform;
    return props;
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
    const label = face.labels[slot];
    const props: { fill: string; opacity: number; transform?: LabelMatrix; matrix?: LabelMatrix } = {
      fill: label.fill,
      opacity: face.visible ? 1 : 0,
    };
    if (IS_WEB) props.transform = label.transform;
    else props.matrix = label.transform;
    return props;
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
