import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { ALL_RESOURCE_BOOKS, DEFAULT_ACTIVE_BOOK_CODES } from "../constants/books";
import { useAppTheme } from "../context/ThemeContext";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

interface FirstRunModalProps {
  visible: boolean;
  onComplete: (activeBooks: string[]) => void;
}

export const FirstRunModal: React.FC<FirstRunModalProps> = ({ visible, onComplete }) => {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const [selectedBooks, setSelectedBooks] = useState<string[]>(DEFAULT_ACTIVE_BOOK_CODES);

  const toggleBook = (code: string) => {
    setSelectedBooks((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const selectAll = () => {
    setSelectedBooks(ALL_RESOURCE_BOOKS.map((b) => b.code));
  };

  const deselectAll = () => {
    setSelectedBooks([]);
  };

  const resetDefault = () => {
    setSelectedBooks(DEFAULT_ACTIVE_BOOK_CODES);
  };

  return (
    <Modal
      visible={visible}
      onClose={() => onComplete(selectedBooks)}
      title="Welcome, Adventurer!"
      subtitle="Choose which official source books you'd like to use. You can change this anytime in Options."
      maxHeightPercent={90}
      footer={
        <View style={[styles.footer, isCompact ? styles.footerCompact : styles.footerWide]}>
          <Text
            style={[
              styles.countText,
              isCompact && styles.countTextCompact,
              { color: theme.textSecondary },
            ]}>
            {selectedBooks.length} of {ALL_RESOURCE_BOOKS.length} books selected
          </Text>
          <Button
            title="Start Building Characters"
            onPress={() => onComplete(selectedBooks)}
            size="md"
            style={isCompact ? styles.actionBtnCompact : undefined}
          />
        </View>
      }>
      {/* Quick Actions */}
      <View style={styles.buttonRow}>
        <Button title="Select All" variant="secondary" size="sm" onPress={selectAll} />
        <Button title="Deselect All" variant="secondary" size="sm" onPress={deselectAll} />
        <Button title="Reset to Default" variant="secondary" size="sm" onPress={resetDefault} />
      </View>

      {/* Book Checklist */}
      <View style={styles.bookList}>
        {ALL_RESOURCE_BOOKS.map((book) => {
          const isSelected = selectedBooks.includes(book.code);
          return (
            <TouchableOpacity
              key={book.code}
              activeOpacity={0.7}
              onPress={() => toggleBook(book.code)}
              style={[
                styles.bookItem,
                {
                  backgroundColor: isSelected ? theme.surfaceRaised : theme.surface,
                  borderColor: isSelected ? theme.accent : theme.border,
                },
              ]}>
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? theme.accent : "transparent",
                    borderColor: isSelected ? theme.accent : theme.borderLight,
                  },
                ]}>
                {isSelected ? (
                  <Text style={[styles.checkmark, { color: theme.accentText }]}>✓</Text>
                ) : null}
              </View>

              <View style={styles.bookInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.bookCode, { color: theme.accent }]}>{book.code}</Text>
                  <Text style={[styles.bookName, { color: theme.text }]} numberOfLines={1}>
                    {book.name}
                  </Text>
                </View>
              </View>

              <Badge
                label={book.category.toUpperCase()}
                size="sm"
                variant={book.isDefaultActive ? "accent" : "surface"}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  bookList: {
    gap: 8,
  },
  bookItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: -2,
  },
  bookInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bookCode: {
    fontWeight: "700",
    fontSize: 13,
  },
  bookName: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  footer: {
    width: "100%",
  },
  footerCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  footerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  countText: {
    fontSize: 13,
  },
  countTextCompact: {
    textAlign: "center",
  },
  actionBtnCompact: {
    width: "100%",
  },
});
