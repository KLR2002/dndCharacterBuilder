import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SearchBar } from "../components/ui/SearchBar";
import { ALL_RESOURCE_BOOKS, DEFAULT_ACTIVE_BOOK_CODES, ResourceBook } from "../constants/books";
import { ACCENT_PALETTES } from "../constants/theme";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";

export default function OptionsScreen() {
  const router = useRouter();
  const { theme, accentId, setAccentId } = useAppTheme();
  const { activeBooks, setActiveBooks } = useCharacters();

  const [bookSearch, setBookSearch] = useState("");

  const filteredBooks = useMemo(() => {
    if (!bookSearch.trim()) return ALL_RESOURCE_BOOKS;
    const q = bookSearch.toLowerCase();
    return ALL_RESOURCE_BOOKS.filter(
      (b: ResourceBook) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
    );
  }, [bookSearch]);

  const activeSet = useMemo(() => new Set(activeBooks), [activeBooks]);

  const toggleBook = (code: string) => {
    const nextSet = new Set(activeSet);
    if (nextSet.has(code)) {
      nextSet.delete(code);
    } else {
      nextSet.add(code);
    }
    setActiveBooks(Array.from(nextSet));
  };

  const selectDefaults = () => {
    setActiveBooks(DEFAULT_ACTIVE_BOOK_CODES);
  };

  const selectAll = () => {
    setActiveBooks(ALL_RESOURCE_BOOKS.map((b: ResourceBook) => b.code));
  };

  const clearAll = () => {
    setActiveBooks(["PHB"]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.headerBarInner}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings & Compendium</Text>

          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* THEME COLOR SELECTOR */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="color-palette-outline" size={18} color={theme.accent} />
            <Text style={[styles.sectionHeading, { color: theme.text }]}>
              ACCENT COLOR THEME (MATCHED WITH BLACK)
            </Text>
          </View>

          <Card style={{ padding: 14 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>
              Choose an accent highlight color paired with the deep dark theme:
            </Text>

            <View style={styles.paletteGrid}>
              {Object.values(ACCENT_PALETTES).map((pal) => {
                const isSelected = accentId === pal.id;
                return (
                  <TouchableOpacity
                    key={pal.id}
                    onPress={() => setAccentId(pal.id)}
                    style={[
                      styles.paletteOption,
                      {
                        backgroundColor: theme.surfaceHighlight,
                        borderColor: isSelected ? pal.primary : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}>
                    <View style={[styles.colorCircle, { backgroundColor: pal.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isSelected ? pal.primary : theme.text, fontWeight: "600", fontSize: 13 }}>
                        {pal.name}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={pal.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>

        {/* ACTIVE SOURCE BOOKS */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="library-outline" size={18} color={theme.accent} />
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                ACTIVE COMPENDIUM SOURCES ({activeBooks.length})
              </Text>
            </View>
          </View>

          <Card style={{ padding: 14 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 10 }}>
              Select which books and supplements provide races, subclasses, feats, items, and spells in your builder.
            </Text>

            {/* Quick Action Buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <Button
                title="Recommended Defaults"
                size="sm"
                variant="primary"
                onPress={selectDefaults}
              />
              <Button
                title="Select All"
                size="sm"
                variant="secondary"
                onPress={selectAll}
              />
              <Button
                title="Core Only (PHB)"
                size="sm"
                variant="outline"
                onPress={clearAll}
              />
            </View>

            <SearchBar
              value={bookSearch}
              onChangeText={setBookSearch}
              placeholder="Filter source books..."
            />

            <View style={{ marginTop: 12, gap: 6 }}>
              {filteredBooks.map((book: ResourceBook) => {
                const isChecked = activeSet.has(book.code);
                return (
                  <TouchableOpacity
                    key={book.code}
                    onPress={() => toggleBook(book.code)}
                    style={[
                      styles.bookRow,
                      {
                        backgroundColor: isChecked ? theme.surfaceHighlight : "transparent",
                        borderColor: isChecked ? theme.accent : theme.border,
                      },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>
                          {book.name}
                        </Text>
                        <Badge label={book.code} size="sm" variant={isChecked ? "accent" : "secondary"} />
                      </View>
                      <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                        {book.category}
                      </Text>
                    </View>

                    <Ionicons
                      name={isChecked ? "checkbox" : "square-outline"}
                      size={22}
                      color={isChecked ? theme.accent : theme.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>

        {/* ABOUT & STORAGE SECTION */}
        <Card style={{ padding: 14, gap: 8 }}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>APP DETAILS</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
            D&D 5e Character Vault is an offline-ready character creation and gameplay tracker based on the official 2014 ruleset.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <Badge label="5e Tools 2014 Data" variant="secondary" />
            <Badge label="Expo SDK 57" variant="secondary" />
            <Badge label="Offline Storage" variant="secondary" />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    width: "100%",
    borderBottomWidth: 1,
  },
  headerBarInner: {
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  scrollContent: {
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  paletteGrid: {
    gap: 8,
  },
  paletteOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 12,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
});
