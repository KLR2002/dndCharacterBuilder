import React, { useState } from "react";
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../context/ThemeContext";
import { Card } from "./Card";

interface CollapsibleCardProps {
  title: string;
  /** A line under the title, shown in both states. */
  subtitle?: string;
  /** A badge shown to the left of the chevron, in both states. */
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Whether the body starts open. Defaults to open. */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * A Card whose title row shows or hides its body. It opens by default, and its open state is kept by the card alone.
 */
export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ title, subtitle, badge, style, defaultExpanded = true, children }) => {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Card style={[{ gap: 10 }, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={() => setExpanded((open) => !open)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 32 }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }}>{title}</Text>
          {subtitle ? <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {badge}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.textMuted} />
        </View>
      </TouchableOpacity>
      {expanded ? children : null}
    </Card>
  );
};
