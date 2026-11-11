import React from "react";
import { StyleSheet, Text, View, ViewProps } from "react-native";
import type { AppTheme } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";

export type BadgeVariant = "accent" | "surface" | "warning" | "success" | "muted" | "secondary" | "danger" | "outline";

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

/** The fill, text and border colours of a badge variant. The roll badge reuses them so both badges look the same. */
export function badgeVariantColors(
  theme: AppTheme,
  variant: BadgeVariant,
): { backgroundColor: string; textColor: string; borderColor: string } {
  if (variant === "accent") {
    return { backgroundColor: theme.accentGlow, textColor: theme.accentHover, borderColor: theme.accentBorder };
  }
  if (variant === "secondary") {
    return { backgroundColor: theme.surfaceRaised, textColor: theme.textSecondary, borderColor: theme.border };
  }
  if (variant === "danger") {
    return { backgroundColor: "rgba(239, 68, 68, 0.15)", textColor: theme.danger, borderColor: "rgba(239, 68, 68, 0.4)" };
  }
  if (variant === "outline") {
    return { backgroundColor: "transparent", textColor: theme.textSecondary, borderColor: theme.border };
  }
  if (variant === "warning") {
    return { backgroundColor: "rgba(245, 158, 11, 0.15)", textColor: theme.warning, borderColor: "rgba(245, 158, 11, 0.4)" };
  }
  if (variant === "success") {
    return { backgroundColor: "rgba(34, 197, 94, 0.15)", textColor: theme.success, borderColor: "rgba(34, 197, 94, 0.4)" };
  }
  if (variant === "muted") {
    return { backgroundColor: "rgba(100, 116, 139, 0.15)", textColor: theme.textMuted, borderColor: theme.border };
  }
  return { backgroundColor: theme.surfaceHighlight, textColor: theme.textSecondary, borderColor: theme.border };
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = "surface", size = "md", style, ...props }) => {
  const { theme } = useAppTheme();

  const { backgroundColor: bg, textColor, borderColor } = badgeVariantColors(theme, variant);

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
