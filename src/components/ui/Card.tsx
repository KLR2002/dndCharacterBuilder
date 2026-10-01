import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";

interface CardProps extends ViewProps {
  highlight?: boolean;
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, highlight, bordered = true, ...props }) => {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: highlight ? theme.surfaceRaised : theme.surface,
          borderColor: highlight ? theme.accentBorder : bordered ? theme.border : "transparent",
        },
        highlight && {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 3,
        },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 6,
  },
});
