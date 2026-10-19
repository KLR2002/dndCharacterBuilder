import React from "react";
import { StyleSheet, Text, View, ViewProps } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";

interface BadgeProps extends ViewProps {
  label: string;
  variant?: "accent" | "surface" | "warning" | "success" | "muted" | "secondary" | "danger" | "outline";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = "surface", size = "md", style, ...props }) => {
  const { theme } = useAppTheme();

  let bg = theme.surfaceHighlight;
  let textColor = theme.textSecondary;
  let borderColor = theme.border;

  if (variant === "accent") {
    bg = theme.accentGlow;
    textColor = theme.accent;
    borderColor = theme.accentBorder;
  } else if (variant === "secondary") {
    bg = theme.surfaceRaised;
    textColor = theme.textSecondary;
    borderColor = theme.border;
  } else if (variant === "danger") {
    bg = "rgba(239, 68, 68, 0.15)";
    textColor = theme.danger;
    borderColor = "rgba(239, 68, 68, 0.4)";
  } else if (variant === "outline") {
    bg = "transparent";
    textColor = theme.textSecondary;
    borderColor = theme.border;
  } else if (variant === "warning") {
    bg = "rgba(245, 158, 11, 0.15)";
    textColor = theme.warning;
    borderColor = "rgba(245, 158, 11, 0.4)";
  } else if (variant === "success") {
    bg = "rgba(34, 197, 94, 0.15)";
    textColor = theme.success;
    borderColor = "rgba(34, 197, 94, 0.4)";
  } else if (variant === "muted") {
    bg = "rgba(100, 116, 139, 0.15)";
    textColor = theme.textMuted;
    borderColor = theme.border;
  }

  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 10,
        },
        style,
      ]}
      {...props}>
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSmall ? 11 : 13,
          },
        ]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  text: {
    fontWeight: "600",
    textTransform: "none",
    flexShrink: 1,
  },
});
