import React from "react";
import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../context/ThemeContext";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode | keyof typeof Ionicons.glyphMap;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  icon,
  style,
  disabled,
  ...props
}) => {
  const { theme } = useAppTheme();

  let bg = theme.accent;
  let text = theme.accentText;
  let border = theme.accentBorder;

  if (variant === "secondary") {
    bg = theme.surfaceHighlight;
    text = theme.text;
    border = theme.border;
  } else if (variant === "outline") {
    bg = "transparent";
    text = theme.accent;
    border = theme.accentBorder;
  } else if (variant === "danger") {
    bg = "rgba(239, 68, 68, 0.2)";
    text = theme.danger;
    border = "rgba(239, 68, 68, 0.5)";
  } else if (variant === "success") {
    bg = "rgba(34, 197, 94, 0.2)";
    text = theme.success;
    border = "rgba(34, 197, 94, 0.5)";
  } else if (variant === "ghost") {
    bg = "transparent";
    text = theme.textSecondary;
    border = "transparent";
  }

  const paddingV = size === "sm" ? 6 : size === "lg" ? 14 : 10;
  const paddingH = size === "sm" ? 12 : size === "lg" ? 20 : 16;
  const fontSize = size === "sm" ? 13 : size === "lg" ? 16 : 14;

  const displayTitle =
    typeof icon === "string" && /add/i.test(icon)
      ? title.replace(/^\+\s*/, "")
      : title;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      hitSlop={props.hitSlop ?? { top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          minHeight: size === "sm" ? 36 : 44,
          opacity: disabled ? 0.4 : 1,
        },
        style as ViewStyle,
      ]}
      {...props}>
      {typeof icon === "string" ? (
        <Ionicons name={icon as any} size={size === "sm" ? 14 : 18} color={text} />
      ) : (
        icon
      )}
      <Text style={[styles.text, { color: text, fontSize }]}>{displayTitle}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  text: {
    fontWeight: "600",
  },
});
