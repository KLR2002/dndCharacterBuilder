import React, { type ComponentType } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

type NativeCanvasProps = { scene: string; dropped: string; style?: StyleProp<ViewStyle> };

// requireNativeViewManager throws where the dice-canvas module is not built (web, iOS), so the view is
// looked up on first render. Only the Android branches render it.
let manager: ComponentType<NativeCanvasProps> | null = null;

/** The solid dice drawn by the dice-canvas module. Render it on Android only. */
export function NativeDiceCanvas(props: NativeCanvasProps) {
  manager ??= requireNativeViewManager<NativeCanvasProps>("DiceCanvas");
  const Manager = manager;
  return <Manager {...props} />;
}

/** One die's name for the accessibility tree: a single transparent pixel that takes no touches. */
export function DieLabel({ testID, label }: { testID: string; label: string }) {
  return <View testID={testID} accessible accessibilityLabel={label} style={styles.label} />;
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    backgroundColor: "transparent",
    pointerEvents: "none",
  },
});
