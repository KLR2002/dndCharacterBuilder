import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BREAKPOINTS, useResponsiveLayout } from "../../../hooks/useResponsiveLayout";

export interface AttackRowProps {
  /** The name and subtitle lines of the attack. */
  children: React.ReactNode;
  /** The to-hit roll badge. Spells may have none. */
  toHit?: React.ReactNode;
  /** The damage badge. */
  damage: React.ReactNode;
  onPress?: () => void;
  borderBottomColor?: string;
  borderBottomWidth?: number;
  /** No horizontal padding: the row sits in a card that pads it already. */
  flush?: boolean;
}

/**
 * One attack on the Actions tab. The name column takes the free width and wraps at word boundaries; the
 * badges stay beside it from the wide breakpoint, stack in one column below it, and sit under the name on
 * compact screens.
 */
export const AttackRow: React.FC<AttackRowProps> = ({
  children,
  toHit,
  damage,
  onPress,
  borderBottomColor,
  borderBottomWidth = 0,
  flush = false,
}) => {
  const { width, isCompact } = useResponsiveLayout();
  const stacked = !isCompact && width < BREAKPOINTS.phone;

  const rowStyle = [
    styles.row,
    isCompact && styles.rowCompact,
    flush && styles.rowFlush,
    { borderBottomColor, borderBottomWidth },
  ];
  const badgesStyle = [
    styles.badges,
    isCompact && styles.badgesCompact,
    stacked && styles.badgesStacked,
  ];
  const body = (
    <>
      <View style={[styles.info, isCompact && styles.infoCompact]}>{children}</View>
      <View style={badgesStyle}>
        {toHit}
        {damage}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onPress} style={rowStyle}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyle}>{body}</View>;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  rowFlush: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  rowCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  infoCompact: {
    width: "100%",
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  badgesCompact: {
    flexWrap: "wrap",
    marginTop: 6,
  },
  badgesStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 6,
    maxWidth: "50%",
  },
});
