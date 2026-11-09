import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";
import { useAppTheme } from "../../context/ThemeContext";
import type { Roll, RolledDie } from "../../rules/dice.ts";
import { animatedDice } from "../../rules/diceAnimation.ts";

/**
 * The 2.5D dice renderer: each die tumbles with Reanimated rotate/scale/translate transforms to an
 * upright pose showing the face the Roll already decided, so the animation can never disagree with
 * the text total. A d6 is a View with pips; every other die is an SVG polygon with its numeral. Faces
 * are filled from the current accent; a dropped die renders muted. This module is lazy-loaded behind
 * the DiceRenderer slot and is not fetched while 3D dice are off.
 */

const DIE_SIZE = 40;
// Tumbling ends well under a second even for a full row of capped dice: 460ms tween plus 30ms stagger.
const TWEEN_MS = 460;
const STAGGER_MS = 30;

/** The 3x3 pip cells a d6 face lights up, cells numbered row by row. */
const D6_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** The vertices of a regular `n`-gon in a 100x100 box, one vertex up. */
function polygonPoints(n: number): string {
  return Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${50 + 45 * Math.cos(angle)},${50 + 45 * Math.sin(angle)}`;
  }).join(" ");
}

/** One die: the face comes straight from the Roll, only the pose animates. */
function AnimatedDie({ die, index }: { die: RolledDie; index: number }) {
  const { theme } = useAppTheme();
  const dropped = die.dropped;
  const fill = dropped ? theme.surfaceHighlight : theme.accent;
  const ink = dropped ? theme.textMuted : theme.accentHover;
  const label = dropped ? theme.textMuted : theme.accentText;

  // Deterministic start pose per die and face, so a re-roll visibly re-tumbles.
  const spins = 2 + (index % 2);
  const startRotate = -(360 * spins + ((die.face * 47 + index * 31) % 360));
  const rotate = useSharedValue(startRotate);
  const scale = useSharedValue(1.35);
  const lift = useSharedValue(-16);

  useEffect(() => {
    const delay = index * STAGGER_MS;
    rotate.value = startRotate;
    scale.value = 1.35;
    lift.value = -16;
    rotate.value = withDelay(delay, withTiming(0, { duration: TWEEN_MS, easing: Easing.out(Easing.cubic) }));
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.12, { duration: TWEEN_MS * 0.55, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: TWEEN_MS * 0.45, easing: Easing.out(Easing.quad) }),
      ),
    );
    lift.value = withDelay(
      delay,
      withSequence(
        withTiming(-6, { duration: TWEEN_MS * 0.5, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: TWEEN_MS * 0.5, easing: Easing.out(Easing.bounce) }),
      ),
    );
  }, [die, index, rotate, scale, lift, startRotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }, { scale: scale.value }, { translateY: lift.value }],
    opacity: dropped ? 0.4 : 1,
  }));

  return (
    <Animated.View
      testID={`die-3d-${index}`}
      accessibilityLabel={`d${die.sides} showing ${die.face}${dropped ? ", dropped" : ""}`}
      style={[styles.die, animatedStyle]}
    >
      {die.sides === 6 ? (
        <View style={[styles.face, { backgroundColor: fill, borderColor: ink }]}>
          {(D6_PIPS[die.face] ?? [4]).map((cell) => (
            <View
              key={cell}
              style={[
                styles.pip,
                {
                  backgroundColor: label,
                  left: `${((cell % 3) + 0.5) * (100 / 3)}%`,
                  top: `${(Math.floor(cell / 3) + 0.5) * (100 / 3)}%`,
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Svg width={DIE_SIZE} height={DIE_SIZE} viewBox="0 0 100 100">
          <Polygon
            points={polygonPoints(Math.min(die.sides, 20))}
            fill={fill}
            stroke={ink}
            strokeWidth={7}
            strokeLinejoin="round"
          />
          <SvgText
            x="50"
            y="50"
            dy="0.36em"
            textAnchor="middle"
            fontSize={die.face >= 100 ? 26 : 38}
            fontWeight="700"
            fill={label}
          >
            {String(die.face)}
          </SvgText>
        </Svg>
      )}
    </Animated.View>
  );
}

/** The animated dice of one Roll, capped by animatedDice; the text chips below always list every face. */
export function AnimatedDiceRoll({ roll }: { roll: Roll }) {
  const dice = animatedDice(roll);
  if (dice.length === 0) return null;
  return (
    <View testID="dice-3d" style={styles.row}>
      {dice.map((die, index) => (
        <AnimatedDie key={index} die={die} index={index} />
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
  die: {
    width: DIE_SIZE,
    height: DIE_SIZE,
  },
  face: {
    width: DIE_SIZE,
    height: DIE_SIZE,
    borderRadius: 8,
    borderWidth: 2,
  },
  pip: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 4,
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
});
