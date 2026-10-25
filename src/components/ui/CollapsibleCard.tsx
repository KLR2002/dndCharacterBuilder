import React, { useState } from "react";
import { StyleProp, Text, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../context/ThemeContext";
import { Card } from "./Card";

interface CollapsibleCardProps {
  title: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A Card whose title row shows or hides its body. It opens by default, and its open state is kept by the card alone.
 */
export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ title, style, children }) => {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(true);
  return (
    <Card style={[{ gap: 10 }, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={() => setExpanded((open) => !open)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 32 }}
      >
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", flexShrink: 1, minWidth: 0 }}>{title}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.textMuted} />
      </TouchableOpacity>
      {expanded ? children : null}
    </Card>
  );
};
