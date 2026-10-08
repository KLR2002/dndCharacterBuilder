import type { EdgeInsets } from "react-native-safe-area-context";

/** Breakpoint thresholds (px). */
export const BREAKPOINTS = {
  /** Below this: single-column steppers, full-width cards */
  compact: 380,
  /** Below this: phone-class layout (stacked footers, smaller fonts) */
  phone: 600,
  /** At or above this: tablet layout (side-by-side panels possible) */
  tablet: 768,
} as const;

/** Pure layout metrics derived from viewport width/height. */
export interface ResponsiveLayout {
  /** Viewport width in dp. */
  width: number;
  /** Viewport height in dp. */
  height: number;
  /** `true` when width < 380dp — tightest mobile layout. */
  isCompact: boolean;
  /** `true` when width < 600dp — phone-class screens. */
  isPhone: boolean;
  /** `true` when width >= 768dp — tablet-class screens. */
  isTablet: boolean;
  /** Safe area insets from device (notch, status bar, home indicator). */
  insets: EdgeInsets;
  /** Usable content width after removing horizontal safe area insets. */
  contentWidth: number;
  /** Responsive horizontal padding: 8 on compact, 12 on phone, 16 on tablet. */
  horizontalPadding: number;
}

/** Zero insets for default and testing. */
export const ZERO_INSETS: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Pure breakpoint computation — testable without React.
 * Pass viewport dimensions and safe area insets to get layout metrics.
 */
export function computeLayout(
  width: number,
  height: number,
  insets: EdgeInsets = ZERO_INSETS,
): ResponsiveLayout {
  const isCompact = width < BREAKPOINTS.compact;
  const isPhone = width < BREAKPOINTS.phone;
  const isTablet = width >= BREAKPOINTS.tablet;
  const contentWidth = Math.max(0, width - insets.left - insets.right);
  const horizontalPadding = isCompact ? 8 : isPhone ? 12 : 16;

  return {
    width,
    height,
    isCompact,
    isPhone,
    isTablet,
    insets,
    contentWidth,
    horizontalPadding,
  };
}
