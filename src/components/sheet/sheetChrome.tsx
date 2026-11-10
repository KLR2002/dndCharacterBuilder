import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/ThemeContext";

export type SheetTabKey = "stats" | "actions" | "spells" | "inventory" | "features" | "journal";

interface SheetTabDefinition {
  key: SheetTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** The sheet's six tabs, in the bar's order. */
export const SHEET_TABS: SheetTabDefinition[] = [
  { key: "stats", label: "Stats", icon: "shield-outline" },
  { key: "actions", label: "Actions", icon: "flash-outline" },
  { key: "spells", label: "Spells", icon: "sparkles-outline" },
  { key: "inventory", label: "Inventory", icon: "bag-outline" },
  { key: "features", label: "Features", icon: "star-outline" },
  { key: "journal", label: "Journal", icon: "book-outline" },
];

/** The phone bottom bar's height; the floating dice button and the scroll padding follow the measured layout. */
export const SHEET_TAB_BAR_HEIGHT = 64;

/** The tab bar's vertical padding above and below its tab items (the bottom one grows by the safe-area inset). */
const TAB_BAR_VERTICAL_PADDING = 4;

/**
 * The phone tab bar: one bottom bar with all six tabs, icon over a short label, every target 56dp tall.
 * It is absolutely positioned at the bottom of its parent, and the parent renders it before the scrolling
 * content so the tabs come first in the accessibility tree. The bar pads its bottom by the safe-area
 * inset, so the 56dp targets clear the gesture area; onLayout reports the full height (inset included),
 * which is what the floating dice button lifts itself above.
 */
export function SheetTabBar({
  active,
  onSelect,
  onLayout,
}: {
  active: SheetTabKey;
  onSelect: (tab: SheetTabKey) => void;
  onLayout?: (height: number) => void;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="sheet-tab-bar"
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
      style={[
        styles.tabBar,
        { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: TAB_BAR_VERTICAL_PADDING + insets.bottom },
      ]}>
      {SHEET_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            onPress={() => onSelect(tab.key)}
            style={styles.tabBarItem}>
            <Ionicons name={tab.icon} size={20} color={isActive ? theme.accentHover : theme.textSecondary} />
            <Text
              style={{
                color: isActive ? theme.accentHover : theme.textSecondary,
                fontSize: 9.5,
                fontWeight: isActive ? "700" : "500",
              }}
              numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * The wide (768px and up) left rail: all six tabs as icon + label rows, and below a divider the header's
 * actions, Level up and Edit Build. Every row is a 48dp target.
 */
export function SheetTabRail({
  active,
  onSelect,
  onLevelUp,
  onEditBuild,
  canLevelUp,
}: {
  active: SheetTabKey;
  onSelect: (tab: SheetTabKey) => void;
  onLevelUp: () => void;
  onEditBuild: () => void;
  canLevelUp: boolean;
}) {
  const { theme } = useAppTheme();
  const row = (
    key: string,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    isActive: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.railRow,
        {
          backgroundColor: isActive ? theme.accentGlow : "transparent",
          borderColor: isActive ? theme.accentBorder : theme.border,
        },
      ]}>
      <Ionicons name={icon} size={18} color={isActive ? theme.accentHover : theme.textSecondary} />
      <Text
        numberOfLines={1}
        style={{
          color: isActive ? theme.accentHover : theme.textSecondary,
          fontSize: 13,
          fontWeight: isActive ? "700" : "500",
          flexShrink: 1,
          minWidth: 0,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View testID="sheet-tab-rail" style={[styles.rail, { borderRightColor: theme.border, backgroundColor: theme.surface }]}>
      <ScrollView contentContainerStyle={styles.railContent}>
        {SHEET_TABS.map((tab) => row(tab.key, tab.label, tab.icon, tab.key === active, () => onSelect(tab.key)))}
        <View style={[styles.railDivider, { borderTopColor: theme.border }]}>
          {canLevelUp ? row("levelup", "Level up", "trending-up", false, onLevelUp) : null}
          {row("editbuild", "Edit Build", "create-outline", false, onEditBuild)}
        </View>
      </ScrollView>
    </View>
  );
}

/** One row of the phone header's menu: icon, label, a 48dp target, a hairline under all but the last row. */
export function SheetMenuRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.menuRow, { borderBottomColor: theme.border, borderBottomWidth: last ? 0 : 1 }]}>
      <Ionicons name={icon} size={20} color={theme.accentHover} />
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingTop: TAB_BAR_VERTICAL_PADDING,
    paddingBottom: TAB_BAR_VERTICAL_PADDING,
    minHeight: SHEET_TAB_BAR_HEIGHT,
    // The bar is rendered before the scrolling content but positioned at the bottom edge, so it needs
    // its own layer to stay on top of (and tappable above) the content.
    zIndex: 20,
    elevation: 20,
  },
  tabBarItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  rail: {
    width: 200,
    borderRightWidth: 1,
  },
  railContent: {
    padding: 12,
    gap: 6,
  },
  railRow: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  railDivider: {
    borderTopWidth: 1,
    marginTop: 6,
    paddingTop: 6,
    gap: 6,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 4,
  },
});
