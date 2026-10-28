import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../context/ThemeContext";
import { Button } from "./ui/Button";

/** The expanded notices scroll inside this share of the window height, so the tab content below keeps room. */
const LIST_MAX_WINDOW_SHARE = 0.4;

/** Dismissing is irreversible, so neighbouring buttons must not share touch area. */
const NO_HIT_SLOP = { top: 0, bottom: 0, left: 0, right: 0 };

interface ReviewNoticesProps {
  notices: readonly string[];
  onDismiss: (notice: string) => void;
  onDismissAll: () => void;
}

/** A character's review notices as a count row that expands to the list. */
export function ReviewNotices({ notices, onDismiss, onDismissAll }: ReviewNoticesProps) {
  const { theme } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  if (notices.length === 0) return null;

  return (
    <View style={styles.outer}>
      <View style={[styles.box, { backgroundColor: theme.warning + "15", borderColor: theme.warning + "60" }]}>
        <TouchableOpacity
          onPress={() => setExpanded((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          style={styles.header}>
          <Ionicons name="warning-outline" size={16} color={theme.warning} />
          <Text style={[styles.count, { color: theme.text }]}>{notices.length} to review</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.textMuted} />
        </TouchableOpacity>

        {expanded && (
          <>
            <ScrollView nestedScrollEnabled style={[styles.scroll, { maxHeight: windowHeight * LIST_MAX_WINDOW_SHARE }]}>
              <View style={styles.list}>
                {notices.map((notice, index) => (
                  <View key={index} style={styles.item}>
                    <Text style={[styles.noticeText, { color: theme.text }]}>{notice}</Text>
                    <Button
                      title="Dismiss"
                      variant="ghost"
                      size="sm"
                      hitSlop={NO_HIT_SLOP}
                      onPress={() => onDismiss(notice)}
                      accessibilityLabel={`Dismiss ${notice}`}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>
            {notices.length > 1 && (
              <View style={styles.footer}>
                <Button title="Dismiss all" variant="outline" size="sm" hitSlop={NO_HIT_SLOP} onPress={onDismissAll} />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  box: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
  },
  count: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "700",
  },
  scroll: {
    flexGrow: 0,
  },
  list: {
    gap: 8,
    paddingBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 13,
  },
  footer: {
    alignItems: "flex-start",
    marginTop: 4,
    paddingBottom: 8,
  },
});
