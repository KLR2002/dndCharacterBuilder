import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CatalogUpdateModal } from "../components/CatalogUpdateModal";
import { FirstRunModal } from "../components/FirstRunModal";
import { STEP_TITLES } from "../components/creationFlow/stepTitles";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { SearchBar } from "../components/ui/SearchBar";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useSerifFont } from "../hooks/useSerifFont";
import { currentCreationStep, isCreationFinished } from "../rules/creationFlow";
import { evaluateCharacter } from "../rules/characterEvaluation";
import { currentCompendium } from "../services/compendium";
import { Character, Folder } from "../types/character";

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { width, isTablet } = useResponsiveLayout();
  const serif = useSerifFont();
  // Home is a list on phones and a card grid at 768px and up.
  const grid = isTablet;
  const cols = width >= 1200 ? 3 : 2;
  const cardBasis = cols === 3 ? "31%" : "48%";
  const {
    characters,
    folders,
    isFirstRun,
    completeFirstRun,
    catalogUpdateNoticeDue,
    dismissCatalogUpdateNotice,
    activeBooks,
    setActiveBooks,
    createFolder,
    deleteFolder,
    deleteCharacter,
    updateCharacter,
    createCharacter,
  } = useCharacters();

  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderModalVisible, setNewFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<
    Record<string, boolean>
  >({});

  // Move character to folder modal
  const [moveCharModal, setMoveCharModal] = useState<{
    visible: boolean;
    char: Character | null;
  }>({
    visible: false,
    char: null,
  });

  const handleFirstRunComplete = (books?: string[]) => {
    if (books && books.length > 0) {
      setActiveBooks(books);
    }
    completeFirstRun();
  };

  const handleCatalogUpdateLater = () => {
    dismissCatalogUpdateNotice();
  };

  const handleCatalogUpdateOpenSettings = () => {
    dismissCatalogUpdateNotice();
    router.push("/options" as any);
  };

  // "New character" creates a draft on the Class step in the current folder and opens the Creation Flow.
  const handleNewCharacter = async () => {
    // A new draft is created in the root (no folder); the player moves it with the card's move-to-folder action.
    const created = await createCharacter({ name: "", creationProgress: { currentStep: "class" } });
    router.push(`/build/${created.id}` as any);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName("");
      setNewFolderModalVisible(false);
    }
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const confirmDeleteCharacter = (char: Character) => {
    if (Platform.OS === "web") {
      if (window.confirm(`Are you sure you want to delete ${char.name}?`)) {
        deleteCharacter(char.id);
      }
    } else {
      Alert.alert(
        "Delete Character",
        `Are you sure you want to delete ${char.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteCharacter(char.id),
          },
        ],
      );
    }
  };

  const confirmDeleteFolder = (folder: Folder) => {
    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Delete folder "${folder.name}"? Characters inside will be moved to Uncategorized.`,
        )
      ) {
        deleteFolder(folder.id);
      }
    } else {
      Alert.alert(
        "Delete Folder",
        `Delete folder "${folder.name}"? Characters inside will be moved to Uncategorized.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteFolder(folder.id),
          },
        ],
      );
    }
  };

  // Filtered Characters
  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) return characters;
    const q = searchQuery.toLowerCase();
    return characters.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchRace = (c.race?.name || "").toLowerCase().includes(q);
      const matchClass = (c.classes || []).some((cls) =>
        cls.className.toLowerCase().includes(q),
      );
      return matchName || matchRace || matchClass;
    });
  }, [characters, searchQuery]);

  // Group characters by folder; drafts are listed with the uncategorized on phones and get their own
  // group in the wide grid.
  const { folderMap, uncategorized, uncatDrafts } = useMemo(() => {
    const map: Record<string, Character[]> = {};
    const uncat: Character[] = [];
    const drafts: Character[] = [];

    for (const f of folders) {
      map[f.id] = [];
    }

    for (const char of filteredCharacters) {
      if (char.folderId && map[char.folderId]) {
        map[char.folderId].push(char);
      } else if (!isCreationFinished(char)) {
        drafts.push(char);
      } else {
        uncat.push(char);
      }
    }

    return { folderMap: map, uncategorized: uncat, uncatDrafts: drafts };
  }, [folders, filteredCharacters]);

  // One home entry: a full-width row on phones, a card in the wide grid. It keeps the person icon, the
  // row buttons and the Lvl badge; drafts read "Draft · <step>" and carry no level or sub-line.
  const renderCharacterCard = (char: Character, card = false) => {
    const evaluated = evaluateCharacter(char, { compendium: currentCompendium(), activeBooks });
    const totalLevel = evaluated.totalLevel;
    const primaryClass = char.classes[0]?.className || "Class Unset";
    const raceName = char.race?.name || "Race Unset";
    // A draft opens into the Creation Flow on its step, never the sheet.
    const draft = !isCreationFinished(char);
    const draftStep = draft ? currentCreationStep(char, { activeBooks }) : null;
    const cardTitle = draft ? `Draft · ${draftStep ? STEP_TITLES[draftStep] : ""}` : char.name || "Unnamed";

    // Pressable, not TouchableOpacity: on web a TouchableOpacity renders a <button>, and nesting one
    // inside the row's <button> is invalid HTML.
    const rowButtons = (
      <View style={styles.cardActionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${cardTitle} to folder`}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          onPress={(e) => {
            e.stopPropagation();
            setMoveCharModal({ visible: true, char });
          }}
          style={styles.rowAction}>
          <Ionicons name="folder-outline" size={18} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${cardTitle}`}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          onPress={(e) => {
            e.stopPropagation();
            confirmDeleteCharacter(char);
          }}
          style={styles.rowAction}>
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
        </Pressable>
      </View>
    );

    const avatar = (
      <View
        style={[
          styles.cardAvatarBox,
          {
            backgroundColor: theme.surfaceHighlight,
            borderColor: draft ? theme.border : theme.accentBorder,
          },
        ]}>
        {char.avatarUri ? (
          <Image source={{ uri: char.avatarUri }} style={styles.cardAvatarImage} resizeMode="cover" />
        ) : (
          <Ionicons name="person" size={24} color={draft ? theme.textMuted : theme.accentHover} />
        )}
      </View>
    );

    return (
      <TouchableOpacity
        key={char.id}
        testID={`home-entry-${char.id}`}
        accessibilityRole="button"
        accessibilityLabel={cardTitle}
        onPress={() => router.push((draft ? `/build/${char.id}` : `/character/${char.id}`) as any)}
        style={[
          styles.characterCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
          draft && styles.cardDraft,
          card && styles.characterCardGrid,
        ]}>
        {card ? (
          <View style={styles.cardTopRow}>
            {avatar}
            {rowButtons}
          </View>
        ) : (
          avatar
        )}

        <View style={{ flex: 1, minWidth: 0, marginTop: card ? 10 : 0 }}>
          <View style={styles.cardNameRow}>
            <Text
              style={[
                styles.charCardName,
                { color: draft ? theme.textSecondary : theme.text },
                !draft && { fontFamily: serif },
              ]}
              numberOfLines={1}>
              {cardTitle}
            </Text>
            {!draft && <Badge label={`Lvl ${totalLevel}`} variant="accent" size="sm" />}
          </View>

          {!draft && (
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {raceName} • {primaryClass}
            </Text>
          )}

          {!draft && char.alignment ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Badge label={char.alignment} variant="secondary" size="sm" />
            </View>
          ) : null}
        </View>

        {!card ? rowButtons : null}
      </TouchableOpacity>
    );
  };

  const gridCards = (chars: Character[]) => (
    <View style={styles.grid}>
      {chars.map((char) => (
        <View key={char.id} style={{ flexBasis: cardBasis, flexGrow: 1, maxWidth: "100%" }}>
          {renderCharacterCard(char, true)}
        </View>
      ))}
    </View>
  );

  const listRows = (chars: Character[]) => (
    <View style={{ gap: 8 }}>{chars.map((char) => renderCharacterCard(char, false))}</View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
        <View style={styles.headerBarInner}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <View
              style={[
                styles.logoIconBox,
                {
                  backgroundColor: theme.accent,
                },
              ]}
            >
              <Image
                source={require("../../assets/images/dice-twenty-faces-twenty.png")}
                style={styles.logoIconImage}
                resizeMode="contain"
              />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.appTitle, { color: theme.text }]}>
                5e Character Builder
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                2014 Ruleset Compendium
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setNewFolderModalVisible(true)}
              style={[
                styles.headerActionBtn,
                {
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={18}
                color={theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/options" as any)}
              style={[
                styles.headerActionBtn,
                {
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons name="settings-outline" size={18} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNewCharacter}
              style={[
                styles.headerActionBtn,
                { backgroundColor: theme.accent, borderColor: theme.accentHover },
              ]}
            >
              <Ionicons name="add" size={22} color={theme.accentText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search Bar */}
        {characters.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, race, or class..."
            />
          </View>
        )}

        {/* Empty State */}
        {characters.length === 0 && (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { borderColor: theme.border, backgroundColor: theme.surface },
              ]}
            >
              <Ionicons
                name="person-add-outline"
                size={48}
                color={theme.accentHover}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Characters Yet
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: theme.textSecondary }]}
            >
              Begin your journey by creating your first hero!
            </Text>
            <Button
              title="Create New Character"
              icon="add"
              variant="primary"
              size="lg"
              onPress={handleNewCharacter}
              style={{ marginTop: 16 }}
            />
          </View>
        )}

        {/* Folders List */}
        {folders.map((folder) => {
          const charsInFolder = folderMap[folder.id] || [];
          const isCollapsed = !!collapsedFolders[folder.id];

          return (
            <View key={folder.id} style={styles.folderSection}>
              {/* Folder Accordion Header */}
              <TouchableOpacity
                onPress={() => toggleFolderCollapse(folder.id)}
                style={[
                  styles.folderHeader,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons
                  name={isCollapsed ? "folder-outline" : "folder-open"}
                  size={20}
                  color={theme.accentHover}
                />
                <Text style={[styles.folderTitle, { color: theme.text }]}>
                  {folder.name}
                </Text>
                <Badge
                  label={`${charsInFolder.length}`}
                  variant="secondary"
                  size="sm"
                />

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmDeleteFolder(folder);
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>

                <Ionicons
                  name={isCollapsed ? "chevron-down" : "chevron-up"}
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {/* Characters inside this folder */}
              {!isCollapsed && (
                <View style={styles.folderContent}>
                  {charsInFolder.length === 0 ? (
                    <Text
                      style={[
                        styles.folderEmptyText,
                        { color: theme.textMuted },
                      ]}
                    >
                      Folder is empty.
                    </Text>
                  ) : grid ? (
                    gridCards(charsInFolder)
                  ) : (
                    listRows(charsInFolder)
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Uncategorized Characters */}
        {(uncategorized.length > 0 || (!grid && uncatDrafts.length > 0)) && (
          <View style={styles.folderSection}>
            {folders.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <Ionicons
                  name="albums-outline"
                  size={16}
                  color={theme.textMuted}
                />
                <Text
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  UNCATEGORIZED ({uncategorized.length + (grid ? 0 : uncatDrafts.length)})
                </Text>
              </View>
            )}

            {grid ? (
              gridCards(uncategorized)
            ) : (
              listRows([...uncategorized, ...uncatDrafts])
            )}
          </View>
        )}

        {/* Drafts get their own group in the wide grid */}
        {grid && uncatDrafts.length > 0 && (
          <View style={styles.folderSection}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
              }}
            >
              <Ionicons
                name="document-outline"
                size={16}
                color={theme.textMuted}
              />
              <Text
                style={[styles.sectionTitle, { color: theme.textSecondary }]}
              >
                DRAFTS ({uncatDrafts.length})
              </Text>
            </View>
            {gridCards(uncatDrafts)}
          </View>
        )}
      </ScrollView>

      {/* First Run Resource Selection Wizard */}
      <FirstRunModal visible={isFirstRun} onComplete={handleFirstRunComplete} />

      <CatalogUpdateModal
        visible={catalogUpdateNoticeDue}
        onOpenSettings={handleCatalogUpdateOpenSettings}
        onLater={handleCatalogUpdateLater}
      />

      {/* New Folder Creation Modal */}
      <Modal
        visible={newFolderModalVisible}
        onClose={() => setNewFolderModalVisible(false)}
        title="Create New Folder"
        hasUnsavedChanges={newFolderName.trim().length > 0}
        footer={
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <Button
              title="Cancel"
              variant="secondary"
              size="sm"
              onPress={() => setNewFolderModalVisible(false)}
            />
            <Button
              title="Create Folder"
              variant="primary"
              size="sm"
              onPress={handleCreateFolder}
            />
          </View>
        }
      >
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.surfaceHighlight,
              borderColor: theme.border,
            },
          ]}
          value={newFolderName}
          onChangeText={setNewFolderName}
          placeholder="e.g. Curse of Strahd, One-Shots"
          placeholderTextColor={theme.textMuted}
          autoFocus
        />
      </Modal>

      {/* Move Character to Folder Modal */}
      <Modal
        visible={moveCharModal.visible}
        onClose={() => setMoveCharModal({ visible: false, char: null })}
        title={
          moveCharModal.char
            ? `Move ${moveCharModal.char.name} to Folder`
            : "Move Character to Folder"
        }
        footer={
          <Button
            title="Cancel"
            variant="secondary"
            size="sm"
            onPress={() => setMoveCharModal({ visible: false, char: null })}
          />
        }
      >
        <TouchableOpacity
          onPress={() => {
            if (moveCharModal.char) {
              updateCharacter(moveCharModal.char.id, { folderId: null });
            }
            setMoveCharModal({ visible: false, char: null });
          }}
          style={[styles.folderOptionRow, { borderBottomColor: theme.border }]}
        >
          <Ionicons
            name="albums-outline"
            size={18}
            color={theme.textSecondary}
          />
          <Text style={{ color: theme.text, fontSize: 14 }}>
            Uncategorized (No Folder)
          </Text>
        </TouchableOpacity>

        {folders.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => {
              if (moveCharModal.char) {
                updateCharacter(moveCharModal.char.id, { folderId: f.id });
              }
              setMoveCharModal({ visible: false, char: null });
            }}
            style={[
              styles.folderOptionRow,
              { borderBottomColor: theme.border },
            ]}
          >
            <Ionicons name="folder-outline" size={18} color={theme.accentHover} />
            <Text style={{ color: theme.text, fontSize: 14 }}>{f.name}</Text>
          </TouchableOpacity>
        ))}
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
    maxWidth: 1200,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoIconImage: {
    width: 22,
    height: 22,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  folderSection: {
    marginBottom: 16,
  },
  folderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  folderTitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  folderContent: {
    gap: 8,
    paddingLeft: 8,
  },
  folderEmptyText: {
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 8,
    paddingLeft: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  characterCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  characterCardGrid: {
    flexDirection: "column",
    alignItems: "stretch",
    marginBottom: 0,
    height: "100%",
  },
  cardDraft: {
    borderStyle: "dashed",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardActionsRow: {
    flexDirection: "row",
    flexShrink: 0,
    marginLeft: "auto",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  rowAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarImage: {
    width: "100%",
    height: "100%",
  },
  charCardName: {
    fontSize: 16,
    fontWeight: "700",
  },

  input: {
    minHeight: 44,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "android" ? 0 : 8,
    textAlignVertical: "center",
    includeFontPadding: false,
    fontSize: 14,
  },
  folderOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
});
