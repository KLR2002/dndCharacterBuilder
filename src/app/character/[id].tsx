import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActionsTab } from "../../components/tabs/ActionsTab";
import { FeaturesTab } from "../../components/tabs/FeaturesTab";
import { InventoryTab } from "../../components/tabs/InventoryTab";
import { JournalTab } from "../../components/tabs/JournalTab";
import { SpellsTab } from "../../components/tabs/SpellsTab";
import { StatsTab } from "../../components/tabs/StatsTab";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { HpQuickEditModal } from "../../components/HpQuickEditModal";
import { ReviewNotices } from "../../components/ReviewNotices";
import {
  SHEET_TAB_BAR_HEIGHT,
  SheetMenuRow,
  SheetTabBar,
  SheetTabKey,
  SheetTabRail,
} from "../../components/sheet/sheetChrome";
import { useCharacters } from "../../context/CharacterContext";
import { useRollLog } from "../../context/RollLogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useHpQuickEdit } from "../../hooks/useHpQuickEdit";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSerifFont } from "../../hooks/useSerifFont";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { isCreationFinished } from "../../rules/creationFlow";
import { MAX_LEVEL } from "../../rules/levelUpFlow";
import { resolvedSize } from "../../rules/sizeChoice";
import { currentCompendium } from "../../services/compendium";
import { commitCharacterName } from "../../rules/characterName";
import { dismissNotices } from "../../rules/needsReview";

export default function CharacterSheetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { characters, currentCharacter, selectCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact, isTablet } = useResponsiveLayout();
  const { setBottomObstruction } = useRollLog();

  const [activeTab, setActiveTab] = useState<SheetTabKey>("stats");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [tabBarHeight, setTabBarHeight] = useState(SHEET_TAB_BAR_HEIGHT);
  const serif = useSerifFont();

  useEffect(() => {
    if (id) {
      selectCharacter(id);
    }
  }, [id, characters, selectCharacter]);

  // A draft has no sheet: opening its route lands in the Creation Flow on its current step. The check
  // reads the route's own character, not the context's selected one: this screen can stay mounted under
  // another route (a deep link to /build/<draft> selects that draft), and must not redirect then.
  const routeCharacter = characters.find((c) => c.id === id) ?? null;
  const isDraft = routeCharacter ? !isCreationFinished(routeCharacter) : false;
  useEffect(() => {
    if (isDraft && id) {
      router.replace(`/build/${id}` as any);
    }
  }, [isDraft, id, router]);

  // On phones the tab bar sits at the bottom edge, and the floating dice button reports its height so the
  // button sits above the bar, never over a tab. At wide widths the rail is on the left, so nothing is reported.
  useEffect(() => {
    if (isTablet) setBottomObstruction(0);
    return () => setBottomObstruction(0);
  }, [isTablet, setBottomObstruction]);

  const evaluated = useMemo(
    () => (currentCharacter ? evaluateCharacter(currentCharacter, { compendium: currentCompendium(), activeBooks }) : null),
    [currentCharacter, activeBooks]
  );
  // While a wild shape is active the header badge shows the form's HP and opens its HP box.
  const hpQuickEdit = useHpQuickEdit(
    currentCharacter,
    evaluated?.hp.max ?? 0,
    currentCharacter?.activeWildShape ? "wildShape" : "character"
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

  // While the redirect to the Creation Flow runs, the sheet renders nothing.
  if (isDraft) return null;

  const totalLevel = evaluated.totalLevel;
  const maxHp = evaluated.hp.max;
  const activeWildShape = currentCharacter.activeWildShape;
  const formTempHp = activeWildShape?.tempHp ?? 0;
  const classSummary = (currentCharacter.classes || [])
    .map((c) => `${c.className} ${c.level}`)
    .join(" / ") || "Lvl 1";
  const raceName = currentCharacter.race?.name ?? "Race Unset";
  const sizeSummary = currentCharacter.race ? resolvedSize(currentCharacter, { activeBooks }) : undefined;
  const canLevelUp = totalLevel < MAX_LEVEL;

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

  const notices = (currentCharacter.needsReview?.length ?? 0) > 0 ? (
    <ReviewNotices
      key={currentCharacter.id}
      notices={currentCharacter.needsReview ?? []}
      onDismiss={(notice) =>
        updateCharacter(currentCharacter.id, (c) => ({ ...c, needsReview: dismissNotices(c.needsReview, notice) }))
      }
      onDismissAll={() =>
        updateCharacter(currentCharacter.id, (c) => ({ ...c, needsReview: dismissNotices(c.needsReview) }))
      }
    />
  ) : null;

  const tabContent = (
    <>
      {activeTab === "stats" && <StatsTab />}
      {activeTab === "actions" && <ActionsTab />}
      {activeTab === "spells" && <SpellsTab />}
      {activeTab === "inventory" && <InventoryTab />}
      {activeTab === "features" && <FeaturesTab />}
      {activeTab === "journal" && <JournalTab />}
    </>
  );

  // One compact header bar: back, the name over the race and class line (with the level badge), the HP and
  // AC chips. On phones a menu holds Level up and Edit Build; at 768px and up those two move into the rail.
  const header = (
    <View
      testID="sheet-header"
      style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={[styles.headerIconBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
        <Ionicons name="arrow-back" size={20} color={theme.text} />
      </TouchableOpacity>

      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
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
              style={[styles.charName, styles.charNameInput, { color: theme.text, borderBottomColor: theme.accentHover }, isCompact && { fontSize: 14 }]}
            />
          ) : (
            <TouchableOpacity
              onPress={startNameEdit}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Edit character name"
              style={styles.charNameButton}>
              <Text
                style={[styles.charName, { color: theme.text, fontFamily: serif }, isCompact && { fontSize: 14 }]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {currentCharacter.name}
              </Text>
            </TouchableOpacity>
          )}
          <Badge label={`Lvl ${totalLevel}`} variant="accent" size="sm" style={{ flexShrink: 0 }} />
        </View>
        <Text style={[styles.subLine, { color: theme.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
          {raceName} • {classSummary}{sizeSummary ? ` • ${sizeSummary}` : ""}
        </Text>
      </View>

      <View style={styles.headerChips}>
        <TouchableOpacity
          {...hpQuickEdit.triggerProps}
          style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
          {activeWildShape ? (
            // The paw marks the number as beast HP, so it stays visible in compact layouts too.
            <Ionicons name="paw" size={14} color={activeWildShape.currentHp > 0 ? theme.hpGreen : theme.danger} />
          ) : (
            <Ionicons name="heart" size={14} color={currentCharacter.currentHp > 0 ? theme.hpGreen : theme.danger} />
          )}
          <Text style={[styles.chipText, { color: theme.text }]}>
            {activeWildShape
              ? `${activeWildShape.currentHp}/${activeWildShape.maxHp}`
              : `${currentCharacter.currentHp}/${maxHp}`}
            {formTempHp > 0 && <Text style={{ color: theme.tempHpYellow }}> +{formTempHp}</Text>}
          </Text>
        </TouchableOpacity>

        <View style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
          <Ionicons name="shield-outline" size={13} color={theme.accentHover} />
          <Text style={[styles.chipText, { color: theme.text }]}>{evaluated.armorClass.ac}</Text>
        </View>

        {!isTablet && (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Sheet menu"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={[styles.headerIconBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const menuModal = (
    <Modal visible={menuOpen} onClose={() => setMenuOpen(false)} title="Character">
      {canLevelUp && (
        <SheetMenuRow
          icon="trending-up"
          label="Level up"
          onPress={() => {
            setMenuOpen(false);
            router.push(`/levelup/${currentCharacter.id}` as any);
          }}
        />
      )}
      <SheetMenuRow
        icon="create-outline"
        label="Edit Build"
        last
        onPress={() => {
          setMenuOpen(false);
          router.push(`/build/${currentCharacter.id}` as any);
        }}
      />
    </Modal>
  );

  if (isTablet) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {header}
        <View style={styles.wideOuter}>
          <SheetTabRail
            active={activeTab}
            onSelect={setActiveTab}
            onLevelUp={() => router.push(`/levelup/${currentCharacter.id}` as any)}
            onEditBuild={() => router.push(`/build/${currentCharacter.id}` as any)}
            canLevelUp={canLevelUp}
          />
          <View style={styles.wideMain}>
            {notices}
            <View style={[styles.tabContent, { maxWidth: activeTab === "stats" ? 1080 : 960 }]}>
              {tabContent}
            </View>
          </View>
        </View>
        {menuModal}
        <HpQuickEditModal {...hpQuickEdit.modalProps} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {header}
      {/* Rendered before the scrolling content, and absolutely positioned at the bottom edge. */}
      <SheetTabBar
        active={activeTab}
        onSelect={setActiveTab}
        onLayout={(height) => {
          setTabBarHeight(height);
          setBottomObstruction(height);
        }}
      />
      {notices}
      {/* The bar and the floating dice button (56dp + 16dp gap) sit in this bottom padding, never over content. */}
      <View style={[styles.tabContent, { paddingBottom: tabBarHeight + 72 }]}>
        {tabContent}
      </View>
      {menuModal}
      <HpQuickEditModal {...hpQuickEdit.modalProps} />
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
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  charName: {
    fontSize: 16,
    fontWeight: "bold",
    flexShrink: 1,
    minWidth: 0,
    includeFontPadding: false,
  },
  charNameButton: {
    flexShrink: 1,
    minWidth: 0,
  },
  charNameInput: {
    flex: 1,
    paddingVertical: 0,
    textAlignVertical: "center",
    borderBottomWidth: 1,
  },
  subLine: {
    fontSize: 11,
  },
  headerChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tabContent: {
    flex: 1,
    width: "100%",
    minHeight: 0,
  },
  wideOuter: {
    flex: 1,
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    flexDirection: "row",
    minHeight: 0,
  },
  wideMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    alignItems: "center",
  },
});
