import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { computeLayout } from "./responsiveLayout";
import type { ResponsiveLayout } from "./responsiveLayout";

export { BREAKPOINTS, ZERO_INSETS, computeLayout } from "./responsiveLayout";
export type { ResponsiveLayout } from "./responsiveLayout";

/**
 * Centralized responsive layout hook.
 * Uses `useWindowDimensions` + `useSafeAreaInsets` — no external deps.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return computeLayout(width, height, insets);
}
