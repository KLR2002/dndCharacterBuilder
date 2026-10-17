import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RestModal } from "../../components/RestModal";
import { ActionsTab } from "../../components/tabs/ActionsTab";
import { BuilderTab } from "../../components/tabs/BuilderTab";
import { FeaturesTab } from "../../components/tabs/FeaturesTab";
import { InventoryTab } from "../../components/tabs/InventoryTab";
import { JournalTab } from "../../components/tabs/JournalTab";
import { SpellsTab } from "../../components/tabs/SpellsTab";
import { StatsTab } from "../../components/tabs/StatsTab";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { commitCharacterName } from "../../rules/characterName";

type TabKey = "builder" | "stats" | "spells" | "inventory" | "features" | "journal" | "actions";

interface TabDefinition {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabDefinition[] = [
  { key: "builder", label: "Builder", icon: "construct-outline" },
  { key: "stats", label: "Stats", icon: "shield-outline" },
  { key: "spells", label: "Spells", icon: "sparkles-outline" },
  { key: "inventory", label: "Inventory", icon: "bag-outline" },
  { key: "features", label: "Features", icon: "star-outline" },
  { key: "journal", label: "Journal", icon: "book-outline" },
  { key: "actions", label: "Actions", icon: "flash-outline" },
];

export default function CharacterSheetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { characters, currentCharacter, selectCharacter, updateCharacter } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

  const [activeTab, setActiveTab] = useState<TabKey>("builder");
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [scrollX, setScrollX] = useState(0);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    if (id) {
      selectCharacter(id);
    }
  }, [id, characters, selectCharacter]);

  const evaluated = useMemo(
    () => (currentCharacter ? evaluateCharacter(currentCharacter) : null),
    [currentCharacter]
  );

  if (!currentCharacter || !evaluated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.notFoundContainer}>
          <Text style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>
            Character not found or loading...
          </Text>
          <Button title="Go Back" variant="primary" onPress={() => router.replace("/")} />
        </View>
      </SafeAreaView>
    );
  }

  const totalLevel = evaluated.totalLevel;
  const maxHp = evaluated.hp.max;
  const classSummary = (currentCharacter.classes || [])
    .map((c) => `${c.className} ${c.level}`)
    .join(" / ") || "Lvl 1";
  const raceSummary = currentCharacter.race?.name || "Race Unset";

  const startNameEdit = () => {
    setNameDraft(currentCharacter.name);
    setIsEditingName(true);
  };

  const finishNameEdit = () => {
    setIsEditingName(false);
    const name = commitCharacterName(nameDraft, currentCharacter.name);
    if (name !== currentCharacter.name) {
      updateCharacter(currentCharacter.id, { name });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header Bar */}
      <View style={[styles.topHeader, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={[styles.headerInner, isCompact && { paddingHorizontal: 8 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.backBtn,
              { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
              isCompact && { width: 32, height: 32 }
            ]}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>

          {/* Character Title & Summary */}
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isEditingName ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  onSubmitEditing={finishNameEdit}
                  onBlur={finishNameEdit}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  maxLength={60}
                  accessibilityLabel="Character name"
                  style={[styles.charName, styles.charNameInput, { color: theme.text, borderBottomColor: theme.accent }, isCompact && { fontSize: 14 }]}
                />
              ) : (
                <TouchableOpacity
                  onPress={startNameEdit}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit character name"
                  style={styles.charNameButton}>
                  <Text style={[styles.charName, { color: theme.text }, isCompact && { fontSize: 14 }]} numberOfLines={1}>
                    {currentCharacter.name}
                  </Text>
                </TouchableOpacity>
              )}
              <Badge label={`Lvl ${totalLevel}`} variant="accent" size="sm" />
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={1}>
              {raceSummary} • {classSummary}
            </Text>
          </View>

          {/* Quick HP & Rest Buttons */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.quickHpBadge, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
              {!isCompact && (
                <Ionicons name="heart" size={14} color={currentCharacter.currentHp > 0 ? theme.hpGreen : theme.danger} />
              )}
              <Text style={[styles.quickHpText, { color: theme.text }]}>
                {currentCharacter.currentHp}/{maxHp}
              </Text>
            </View>

            <View style={[styles.quickHpBadge, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="shield-outline" size={13} color={theme.accent} />
              <Text style={[styles.quickHpText, { color: theme.text }]}>
                {evaluated.armorClass.ac}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setRestModalVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.restBtn,
                { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                isCompact && { width: 32, height: 32 }
              ]}>
              <Ionicons name="bed-outline" size={18} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 7 Consecutive Horizontal Tabs Bar */}
      <View style={[styles.tabsBarWrapper, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.tabsInner}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
            onContentSizeChange={(w) => setScrollWidth(w)}
            onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
            contentContainerStyle={styles.tabsScrollContent}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabItem,
                    isCompact && { paddingHorizontal: 10 },
                    isActive && [styles.activeTabItem, { borderBottomColor: theme.accent }],
                  ]}>
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={isActive ? theme.accent : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isActive ? theme.accent : theme.textSecondary, fontWeight: isActive ? "700" : "500" },
                      isCompact && { fontSize: 12 }
                    ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Left Fade Indicator */}
          {scrollX > 0 && (
            <View style={[styles.fadeIndicator, styles.fadeLeft]} pointerEvents="none">
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.9 }]} />
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.6 }]} />
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.3 }]} />
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.1 }]} />
            </View>
          )}

          {/* Right Fade Indicator */}
          {scrollWidth > layoutWidth && scrollX < scrollWidth - layoutWidth - 5 && (
            <View style={[styles.fadeIndicator, styles.fadeRight]} pointerEvents="none">
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.1 }]} />
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.3 }]} />
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.6 }]} />
              <View style={[styles.fadeStrip, { backgroundColor: theme.surface, opacity: 0.9 }]} />
            </View>
          )}
        </View>
      </View>

      {/* Tab Content Display */}
      <View style={styles.tabContentWrapper}>
        {activeTab === "builder" && <BuilderTab />}
        {activeTab === "stats" && <StatsTab />}
        {activeTab === "spells" && <SpellsTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "features" && <FeaturesTab />}
        {activeTab === "journal" && <JournalTab />}
        {activeTab === "actions" && <ActionsTab />}
      </View>

      {/* Rest Modal */}
      <RestModal
        visible={restModalVisible}
        onClose={() => setRestModalVisible(false)}
        onTakeRest={() => setRestModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  topHeader: {
    width: "100%",
    borderBottomWidth: 1,
  },
  headerInner: {
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  charName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  charNameButton: {
    flexShrink: 1,
  },
  charNameInput: {
    flex: 1,
    paddingVertical: 0,
    borderBottomWidth: 1,
  },
  quickHpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  quickHpText: {
    fontSize: 12,
    fontWeight: "700",
  },
  restBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsBarWrapper: {
    width: "100%",
    borderBottomWidth: 1,
  },
  tabsInner: {
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
  },
  tabsScrollContent: {
    paddingHorizontal: 8,
  },
  tabContentWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    minHeight: 44,
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontSize: 13,
  },
  fadeIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 24,
    flexDirection: "row",
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
  },
  fadeStrip: {
    width: 6,
    height: "100%",
  },
});
