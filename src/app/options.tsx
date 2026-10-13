import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { SearchBar } from "../components/ui/SearchBar";
import {
  ALL_RESOURCE_BOOKS,
  BOOK_CATEGORIES,
  BOOK_CATEGORY_LABELS,
  BookCategory,
  DEFAULT_ACTIVE_BOOK_CODES,
  ResourceBook,
} from "../constants/books";
import { ACCENT_PALETTES } from "../constants/theme";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";

export default function OptionsScreen() {
  const router = useRouter();
  const { theme, accentId, setAccentId } = useAppTheme();
  const {
    activeBooks,
    setActiveBooks,
    isIntegrated,
    integratedAt,
    triggerIntegration,
    revertToSrd,
  } = useCharacters();

  const [bookSearch, setBookSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});

  // 5eTools Integration Dialog & Sync State
  const [confirmDisclaimerVisible, setConfirmDisclaimerVisible] =
    useState(false);
  const [confirmRevertVisible, setConfirmRevertVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState({
    category: "Races",
    step: 1,
    total: 10,
  });
  const [syncError, setSyncError] = useState<string | null>(null);

  const startIntegrationProcess = async () => {
    setConfirmDisclaimerVisible(false);
    setIsSyncing(true);
    setSyncError(null);
    setSyncStep({ category: "Races", step: 1, total: 10 });
    try {
      await triggerIntegration((category, step, total) => {
        setSyncStep({ category, step, total });
      });
      setIsSyncing(false);
    } catch (err: any) {
      setSyncError(err?.message || "Failed to download integration data");
    }
  };

  const filteredBooks = useMemo(() => {
    if (!bookSearch.trim()) return ALL_RESOURCE_BOOKS;
    const q = bookSearch.toLowerCase();
    return ALL_RESOURCE_BOOKS.filter(
      (b: ResourceBook) =>
        b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
    );
  }, [bookSearch]);

  const booksByCategory = useMemo(() => {
    const map: Record<BookCategory, ResourceBook[]> = {
      core: [],
      supplement: [],
      setting: [],
      adventure: [],
      other: [],
    };
    for (const book of filteredBooks) {
      if (map[book.category]) {
        map[book.category].push(book);
      }
    }
    return map;
  }, [filteredBooks]);

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

  const toggleCategoryCollapse = (cat: BookCategory) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const enableCategory = (cat: BookCategory) => {
    const categoryBooks = ALL_RESOURCE_BOOKS.filter((b) => b.category === cat);
    const nextSet = new Set(activeSet);
    for (const b of categoryBooks) {
      nextSet.add(b.code);
    }
    setActiveBooks(Array.from(nextSet));
  };

  const disableCategory = (cat: BookCategory) => {
    const categoryBooks = ALL_RESOURCE_BOOKS.filter((b) => b.category === cat);
    const nextSet = new Set(activeSet);
    for (const b of categoryBooks) {
      nextSet.delete(b.code);
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.headerBar,
          { borderBottomColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <View style={styles.headerBarInner}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                backgroundColor: theme.surfaceHighlight,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Settings & Compendium
          </Text>

          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* THEME COLOR SELECTOR */}
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Ionicons
              name="color-palette-outline"
              size={18}
              color={theme.accent}
            />
            <Text style={[styles.sectionHeading, { color: theme.text }]}>
              ACCENT COLOR THEME (MATCHED WITH BLACK)
            </Text>
          </View>

          <Card style={{ padding: 14 }}>
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
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
                    ]}
                  >
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: pal.primary },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: isSelected ? pal.primary : theme.text,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {pal.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={pal.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>

        {/* 5ETOOLS SOURCEBOOK INTEGRATION */}
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons
                name="cloud-download-outline"
                size={18}
                color={theme.accent}
              />
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                5ETOOLS SOURCEBOOK INTEGRATION
              </Text>
            </View>
            <Badge
              label={isIntegrated ? "INTEGRATED" : "SRD BASELINE"}
              variant={isIntegrated ? "accent" : "surface"}
              size="sm"
            />
          </View>

          <Card style={{ padding: 14, gap: 12 }}>
            {!isIntegrated ? (
              <>
                <Text
                  style={{
                    color: theme.textSecondary,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  By default, this app includes only the open System Reference
                  Document (SRD 5.1). If you legally own official D&D 5e
                  sourcebooks, you can enable integration to download reference
                  data directly to your local device.
                </Text>

                <View
                  style={[
                    styles.disclaimerBox,
                    {
                      backgroundColor: theme.surfaceHighlight,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={theme.accent}
                    style={{ marginTop: 2 }}
                  />
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 13,
                      lineHeight: 18,
                      flex: 1,
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>Notice:</Text> This
                    integration is intended exclusively to reference sourcebooks
                    and content that you already legally own.
                  </Text>
                </View>

                <Button
                  title="Enable 5eTools Integration"
                  variant="primary"
                  onPress={() => setConfirmDisclaimerVisible(true)}
                  style={{ alignSelf: "flex-start" }}
                />
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: theme.textSecondary,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  Your local compendium is integrated with external sourcebook
                  data.
                  {integratedAt
                    ? ` (Last synced: ${new Date(integratedAt).toLocaleDateString()})`
                    : ""}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 4,
                  }}
                >
                  <Button
                    title="Re-sync / Update"
                    variant="outline"
                    size="sm"
                    onPress={() => setConfirmDisclaimerVisible(true)}
                  />
                  <Button
                    title="Revert to SRD"
                    variant="secondary"
                    size="sm"
                    onPress={() => setConfirmRevertVisible(true)}
                  />
                </View>
              </>
            )}
          </Card>
        </View>

        {/* ACTIVE SOURCE BOOKS (Visible only when integration is finished) */}
        {isIntegrated && (
          <View style={{ marginBottom: 20 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Ionicons
                  name="library-outline"
                  size={18}
                  color={theme.accent}
                />
                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  ACTIVE COMPENDIUM SOURCES ({activeBooks.length})
                </Text>
              </View>
            </View>

            <Card style={{ padding: 14 }}>
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                Select which books and supplements provide races, subclasses,
                feats, items, and spells in your builder.
              </Text>

              {/* Quick Action Buttons */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginBottom: 12,
                  flexWrap: "wrap",
                }}
              >
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

              <View style={{ marginTop: 14, gap: 12 }}>
                {BOOK_CATEGORIES.map((category) => {
                  const booksInCat = booksByCategory[category] || [];
                  if (booksInCat.length === 0 && bookSearch.trim()) return null;

                  const allInCat = ALL_RESOURCE_BOOKS.filter(
                    (b) => b.category === category,
                  );
                  const activeInCat = allInCat.filter((b) =>
                    activeSet.has(b.code),
                  ).length;
                  const isCollapsed =
                    !bookSearch.trim() &&
                    Boolean(collapsedCategories[category]);

                  return (
                    <View
                      key={category}
                      style={[
                        styles.categoryCard,
                        {
                          backgroundColor: theme.surfaceHighlight,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      {/* Category Header */}
                      <View style={styles.categoryHeader}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => toggleCategoryCollapse(category)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.categoryTitleRow}
                        >
                          <Ionicons
                            name={
                              isCollapsed ? "chevron-forward" : "chevron-down"
                            }
                            size={18}
                            color={theme.accent}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.categoryTitle,
                                { color: theme.text },
                              ]}
                            >
                              {BOOK_CATEGORY_LABELS[category]}
                            </Text>
                            <Text
                              style={{
                                color: theme.textMuted,
                                fontSize: 11,
                                marginTop: 1,
                              }}
                            >
                              {activeInCat} of {allInCat.length} active
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <View style={styles.categoryActions}>
                          <Button
                            title="Enable All"
                            size="sm"
                            variant="outline"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => enableCategory(category)}
                          />
                          <Button
                            title="Disable All"
                            size="sm"
                            variant="secondary"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => disableCategory(category)}
                          />
                        </View>
                      </View>

                      {/* Category Books List */}
                      {!isCollapsed && (
                        <View style={{ marginTop: 10, gap: 6 }}>
                          {booksInCat.map((book: ResourceBook) => {
                            const isChecked = activeSet.has(book.code);
                            return (
                              <TouchableOpacity
                                key={book.code}
                                onPress={() => toggleBook(book.code)}
                                hitSlop={{
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }}
                                style={[
                                  styles.bookRow,
                                  {
                                    backgroundColor: isChecked
                                      ? theme.surface
                                      : "transparent",
                                    borderColor: isChecked
                                      ? theme.accent
                                      : theme.border,
                                  },
                                ]}
                              >
                                <View style={{ flex: 1 }}>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: theme.text,
                                        fontSize: 14,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {book.name}
                                    </Text>
                                    <Badge
                                      label={book.code}
                                      size="sm"
                                      variant={
                                        isChecked ? "accent" : "secondary"
                                      }
                                    />
                                  </View>
                                </View>

                                <Ionicons
                                  name={
                                    isChecked ? "checkbox" : "square-outline"
                                  }
                                  size={22}
                                  color={
                                    isChecked ? theme.accent : theme.textMuted
                                  }
                                />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* ABOUT & STORAGE SECTION */}
        <Card style={{ padding: 14, gap: 8 }}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            APP DETAILS
          </Text>
          <Text
            style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}
          >
            D&D Character Builder is an offline-ready character creation and
            gameplay tracker based on the official 2014 ruleset.
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            <Badge label="5e Tools 2014 Data" variant="secondary" />
            <Badge label="Expo SDK 57" variant="secondary" />
            <Badge label="Offline Storage" variant="secondary" />
          </View>
        </Card>
      </ScrollView>

      {/* Disclaimer Confirmation Modal */}
      <Modal
        visible={confirmDisclaimerVisible}
        onClose={() => setConfirmDisclaimerVisible(false)}
        title="Enable 5eTools Integration"
        subtitle="Owned content reference policy"
        footer={
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 8,
              width: "100%",
            }}
          >
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setConfirmDisclaimerVisible(false)}
            />
            <Button
              title="I Own This Content — Start Sync"
              variant="primary"
              onPress={startIntegrationProcess}
            />
          </View>
        }
      >
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>
            This integration connects directly to the 5eTools data mirror and
            downloads complete rules, classes, subclasses, spells, items, feats,
            and monsters into your browser&apos;s local IndexedDB.
          </Text>
          <View
            style={[
              styles.disclaimerBox,
              {
                backgroundColor: theme.surfaceHighlight,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={theme.accent}
              style={{ marginTop: 2 }}
            />
            <Text
              style={{
                color: theme.text,
                fontSize: 13,
                lineHeight: 18,
                flex: 1,
              }}
            >
              <Text style={{ fontWeight: "bold" }}>Legal Disclaimer:</Text> This
              feature is intended strictly to reference sourcebooks and
              supplementary materials that you already legally own. No
              proprietary data is hosted or redistributed by this application.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Syncing Progress Modal */}
      <Modal
        visible={isSyncing}
        onClose={() => {
          if (syncError) {
            setIsSyncing(false);
            setSyncError(null);
          }
        }}
        title={syncError ? "Integration Error" : "Syncing Compendium"}
        subtitle={
          syncError
            ? undefined
            : `Category ${syncStep.step} of ${syncStep.total}`
        }
        footer={
          syncError ? (
            <Button
              title="Close"
              variant="secondary"
              onPress={() => {
                setIsSyncing(false);
                setSyncError(null);
              }}
            />
          ) : undefined
        }
      >
        {syncError ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.accent || "#ff4d4f", fontSize: 14 }}>
              Failed to complete integration: {syncError}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Please check your internet connection and try again.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16, paddingVertical: 8 }}>
            <Text
              style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}
            >
              Downloading {syncStep.category}...
            </Text>
            <View
              style={{
                width: "100%",
                height: 8,
                backgroundColor: theme.surfaceHighlight,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.round((syncStep.step / syncStep.total) * 100)}%`,
                  height: "100%",
                  backgroundColor: theme.accent,
                }}
              />
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Downloading catalog datasets directly into local IndexedDB
              storage.
            </Text>
          </View>
        )}
      </Modal>

      {/* Revert Confirmation Modal */}
      <Modal
        visible={confirmRevertVisible}
        onClose={() => setConfirmRevertVisible(false)}
        title="Revert to SRD 5.1?"
        subtitle="Clear external compendium data"
        footer={
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 8,
              width: "100%",
            }}
          >
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setConfirmRevertVisible(false)}
            />
            <Button
              title="Confirm Revert"
              variant="primary"
              onPress={async () => {
                setConfirmRevertVisible(false);
                await revertToSrd();
              }}
            />
          </View>
        }
      >
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>
            Are you sure you want to revert to the SRD 5.1 baseline?
          </Text>
          <Text
            style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}
          >
            All external sourcebook data stored in your device will be erased.
            The application will return to using only the 2014 System Reference
            Document rules, classes, and spells.
          </Text>
        </View>
      </Modal>
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
  categoryCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 160,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
