import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
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
import { NewCharacterModal } from "../components/NewCharacterModal";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { SearchBar } from "../components/ui/SearchBar";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";
import { evaluateCharacter } from "../rules/characterEvaluation";
import { currentCompendium } from "../services/compendium";
import { Character, Folder } from "../types/character";

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
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
  } = useCharacters();

  const [searchQuery, setSearchQuery] = useState("");
  const [newCharModalVisible, setNewCharModalVisible] = useState(false);
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

  const handleCharacterCreated = (characterId: string) => {
    router.push(`/character/${characterId}` as any);
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

  // Group characters by folder
  const { folderMap, uncategorized } = useMemo(() => {
    const map: Record<string, Character[]> = {};
    const uncat: Character[] = [];

    for (const f of folders) {
      map[f.id] = [];
    }

    for (const char of filteredCharacters) {
      if (char.folderId && map[char.folderId]) {
        map[char.folderId].push(char);
      } else {
        uncat.push(char);
      }
    }

    return { folderMap: map, uncategorized: uncat };
  }, [folders, filteredCharacters]);

  const renderCharacterCard = (char: Character) => {
    const evaluated = evaluateCharacter(char, { compendium: currentCompendium(), activeBooks });
    const totalLevel = evaluated.totalLevel;
    const maxHp = evaluated.hp.max;
    const primaryClass = char.classes[0]?.className || "Class Unset";
    const raceName = char.race?.name || "Race Unset";

    return (
      <TouchableOpacity
        key={char.id}
        onPress={() => router.push(`/character/${char.id}` as any)}
        style={[
          styles.characterCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Character Avatar / Placeholder */}
        <View
          style={[
            styles.cardAvatarBox,
            {
              backgroundColor: theme.surfaceHighlight,
              borderColor: theme.accent,
            },
          ]}
        >
          {char.avatarUri ? (
            <Image
              source={{ uri: char.avatarUri }}
              style={styles.cardAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="person" size={24} color={theme.accent} />
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={[styles.charCardName, { color: theme.text }]}
              numberOfLines={1}
            >
              {char.name || "Unnamed"}
            </Text>
            <Badge label={`Lvl ${totalLevel}`} variant="accent" size="sm" />
          </View>

          <Text
            style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}
            numberOfLines={1}
          >
            {raceName} • {primaryClass}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <Badge
              label={`HP: ${char.currentHp}/${maxHp}`}
              variant={char.currentHp > 0 ? "success" : "danger"}
              size="sm"
            />
            {char.alignment ? (
              <Badge label={char.alignment} variant="secondary" size="sm" />
            ) : null}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.cardActionsCol}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              setMoveCharModal({ visible: true, char });
            }}
            style={styles.iconBtn}
          >
            <Ionicons
              name="folder-outline"
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              confirmDeleteCharacter(char);
            }}
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

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
              onPress={() => setNewCharModalVisible(true)}
              style={[
                styles.headerActionBtn,
                { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
            >
              <Ionicons name="add" size={22} color="#fff" />
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
                color={theme.accent}
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
              onPress={() => setNewCharModalVisible(true)}
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
                  color={theme.accent}
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
                  ) : (
                    charsInFolder.map(renderCharacterCard)
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Uncategorized Characters */}
        {uncategorized.length > 0 && (
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
                  UNCATEGORIZED ({uncategorized.length})
                </Text>
              </View>
            )}

            <View style={{ gap: 8 }}>
              {uncategorized.map(renderCharacterCard)}
            </View>
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

      {/* New Character Creation Modal */}
      <NewCharacterModal
        visible={newCharModalVisible}
        onClose={() => setNewCharModalVisible(false)}
        onCreated={handleCharacterCreated}
      />

      {/* New Folder Creation Modal */}
      <Modal
        visible={newFolderModalVisible}
        onClose={() => setNewFolderModalVisible(false)}
        title="Create New Folder"
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
            <Ionicons name="folder-outline" size={18} color={theme.accent} />
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
    maxWidth: 1024,
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
    maxWidth: 1024,
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
  cardActionsCol: {
    gap: 6,
    paddingLeft: 4,
  },
  iconBtn: {
    padding: 6,
  },
  input: {
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
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
