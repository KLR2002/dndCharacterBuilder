import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSheetScrollContentPadding } from "../sheet/sheetChrome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { formatModifier } from "../../services/dndRules";
import { currentCompendium } from "../../services/compendium";
import { type LockedPreparedCard } from "../../rules/spellcasting";
import type { InnateSpellEntry } from "../../rules/innateMagic";
import {
  toggleSpellSlot,
  togglePactSlot as togglePactSlotRule,
  spendSorceryPoints,
  toggleMysticArcanumCast as toggleMysticArcanumCastRule,
  toggleMetamagic as toggleMetamagicRule,
  toggleInnateSpellUse as toggleInnateSpellUseRule,
  inscribeRitual as inscribeRitualRule,
  removeInscribedRitual as removeInscribedRitualRule,
  swapSubclassSpell,
  resetSubclassSpellSwap,
  togglePrepared as togglePreparedRule,
  learnSpell as learnSpellRule,
  forgetSpell as forgetSpellRule,
} from "../../rules/characterSpells";
import type { SpellData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { DetailModal } from "../DetailModal";
import { SpellLearnList } from "../spells/SpellLearnList";
import { SpellLevelGroups } from "../spells/SpellLevelGroups";
import type { SpellRowActions } from "../spells/SpellRow";
import { SpellResourceCards, type SpellResourceActions } from "../spells/SpellResourceCards";
import { MetamagicModal } from "../spells/MetamagicModal";
import { SubclassSwapModal } from "../spells/SubclassSwapModal";
import { InscribeRitualModal } from "../spells/InscribeRitualModal";
import { RitualBookCard } from "../spells/RitualBookCard";
import { AtWillSpellCard, GrantedSpellCard, LockedSpellCard } from "../spells/GrantedSpellCard";
import { formatOrdinal, type SpellDetailPayload } from "../spells/spellFormat";
import {
  addSpellsOffer,
  spellDetailText,
  spellPage,
  subclassSwapOffer,
  type SpellPageGrantedCard,
  type SpellPageRow,
} from "../../rules/spellPage";

export const SpellsTab: React.FC = () => {
  const sheetScrollPad = useSheetScrollContentPadding();
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

  // State hooks
  const [selectedOwnerKey, setSelectedOwnerKey] = useState<string | null>(null);
  const [spellPickerVisible, setSpellPickerVisible] = useState(false);
  const [metamagicModalVisible, setMetamagicModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapSearchQuery, setSwapSearchQuery] = useState("");
  const [swapTargetSpell, setSwapTargetSpell] = useState<{
    originalName: string;
    currentName: string;
  } | null>(null);
  const [inscribeModalVisible, setInscribeModalVisible] = useState(false);
  const [inscribeSearchQuery, setInscribeSearchQuery] = useState("");
  const [inscribeLevelFilter, setInscribeLevelFilter] = useState<number | null>(null);

  const page = useMemo(() => {
    if (!currentCharacter) return null;
    return spellPage(currentCharacter, { compendium: currentCompendium(), activeBooks }, selectedOwnerKey ?? undefined);
  }, [currentCharacter, activeBooks, selectedOwnerKey]);

  const grantedProfiles: SpellPageGrantedCard[] = page?.grantedCards ?? [];
  const lockedCards: LockedPreparedCard[] = page?.lockedCards ?? [];
  const atWillInvocations = page?.atWillCards ?? [];

  const ritual = page?.ritualBook ?? null;
  const maxRitualLevel = ritual?.maxLevel ?? 0;

  // The offer from the Spell Page, narrowed by the modal's level filter and search.
  const eligibleInscribeSpells = useMemo(() => {
    const offer = ritual?.inscribeOffer ?? [];
    return offer.filter((s) => {
      if (inscribeLevelFilter !== null && s.level !== inscribeLevelFilter) return false;
      if (inscribeSearchQuery.trim()) {
        const q = inscribeSearchQuery.toLowerCase().trim();
        return s.name.toLowerCase().includes(q) || Boolean(s.school?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [ritual, inscribeLevelFilter, inscribeSearchQuery]);

  // The Add Spells picker: the spells this owner may learn, plus the ones it knows (shown locked).
  const picker = useMemo(() => {
    if (!page?.owner || !currentCharacter) return null;
    return addSpellsOffer(currentCharacter, page.owner, { compendium: currentCompendium(), activeBooks });
  }, [page, currentCharacter, activeBooks]);
  const knownNames = picker?.knownNames ?? [];

  // The swap offer for the spell being replaced; the modal is only open while a target is set.
  const swapOffer = useMemo(() => {
    if (!swapTargetSpell || !currentCharacter || !page?.owner) return { original: null, allowedSchools: [], eligible: [] };
    return subclassSwapOffer(currentCharacter, page.owner, swapTargetSpell.originalName, {
      compendium: currentCompendium(),
      activeBooks,
    });
  }, [swapTargetSpell, currentCharacter, page, activeBooks]);
  const swapAllowedSchools = swapOffer.allowedSchools;

  const filteredEligibleSwaps = useMemo(() => {
    if (!swapSearchQuery) return swapOffer.eligible;
    const q = swapSearchQuery.toLowerCase();
    return swapOffer.eligible.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        Boolean(s.school?.toLowerCase().includes(q))
    );
  }, [swapOffer, swapSearchQuery]);

  // Helpers and event handlers
  const showSpellDetail = (s: SpellData | undefined) => {
    if (!s || !currentCharacter) return;
    setDetailModal({ visible: true, ...spellDetailText(s, currentCharacter) });
  };

  const toggleInnateSpellUse = (spell: InnateSpellEntry) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, toggleInnateSpellUseRule(currentCharacter, spell));
  };

  // Early returns strictly AFTER all React hooks
  if (!currentCharacter) {
    return null;
  }

  if (!page?.profile) {
    if (grantedProfiles.length > 0 || lockedCards.length > 0 || atWillInvocations.length > 0) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, sheetScrollPad]}>
          {grantedProfiles.map((profile, index) => (
            <GrantedSpellCard
              key={`granted_${index}`}
              profile={profile}
              onToggleUse={toggleInnateSpellUse}
              onShowSpell={showSpellDetail}
            />
          ))}
          {lockedCards.map((card, index) => (
            <LockedSpellCard key={`locked_${index}`} card={card} onShowSpell={showSpellDetail} />
          ))}
          <AtWillSpellCard cards={atWillInvocations} onShowSpell={showSpellDetail} />
          <Card style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
            <Ionicons name="sparkles-outline" size={32} color={theme.textMuted} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: theme.text, fontSize: 16 }]}>No Class Spellcasting</Text>
          </Card>
          <DetailModal
            visible={detailModal.visible}
            title={detailModal.title}
            subtitle={detailModal.subtitle}
            content={detailModal.content}
            onClose={() => setDetailModal({ visible: false, title: "", content: "" })}
          />
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, sheetScrollPad]}>
        <Card style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="sparkles-outline" size={48} color={theme.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Spellcasting Features</Text>
        </Card>
      </ScrollView>
    );
  }

  // The open owner is guaranteed to exist here
  const currentPage = page!;
  const currentProfile = currentPage.profile!;
  const header = currentPage.header!;

  const sorcererLevel = currentPage.sorceryPoints?.max ?? 0;
  const maxMetamagic = currentPage.metamagic?.allowance ?? 0;
  const selectedMetamagic = currentPage.metamagic?.chosen ?? [];

  // Slot handlers
  const toggleSlot = (lvl: number, slotIndex: number, _currentUsed?: number) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, toggleSpellSlot(currentCharacter, lvl, slotIndex));
  };

  const togglePactSlot = (slotIndex: number, _currentUsed?: number) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, togglePactSlotRule(currentCharacter, slotIndex));
  };

  // Metamagic handlers
  const spendSorceryPoint = (amount: number = 1) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, spendSorceryPoints(currentCharacter, amount));
  };

  const regainSorceryPoint = (amount: number = 1) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, spendSorceryPoints(currentCharacter, -amount));
  };

  const toggleMetamagic = (name: string) => {
    updateCharacter(currentCharacter.id, toggleMetamagicRule(currentCharacter, name));
  };

  // Known & Prepared Spell handlers
  const togglePrepared = (item: { name: string; source: string; ownerKey?: string }) => {
    const next = togglePreparedRule(currentCharacter, currentProfile, item, currentCompendium(), activeBooks);
    if (next !== currentCharacter) updateCharacter(currentCharacter.id, next);
  };

  const addSpellToCharacter = (name: string, source: string) => {
    const next = learnSpellRule(currentCharacter, currentProfile, { name, source }, currentCompendium(), activeBooks);
    if (next !== currentCharacter) updateCharacter(currentCharacter.id, next);
  };

  const removeSpellFromCharacter = (row: SpellPageRow) => {
    const { name, source, ownerKey } = row;
    const next = forgetSpellRule(currentCharacter, currentProfile, { name, source, ownerKey }, currentCompendium(), activeBooks);
    updateCharacter(currentCharacter.id, next);
  };

  const openSwapModal = (row: SpellPageRow) => {
    if (!row.details) return;
    setSwapTargetSpell({
      originalName: row.swap?.originalName || row.name,
      currentName: row.name,
    });
    setSwapSearchQuery("");
    setSwapModalVisible(true);
  };

  const handleSelectSwap = (replacementSpell: SpellData) => {
    if (!currentCharacter || !swapTargetSpell) return;
    updateCharacter(
      currentCharacter.id,
      swapSubclassSpell(currentCharacter, swapTargetSpell.originalName, replacementSpell.name)
    );
    setSwapModalVisible(false);
  };

  const handleResetSpellSwap = (row: SpellPageRow) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, resetSubclassSpellSwap(currentCharacter, row.swap?.originalName ?? row.name));
  };

  const rowActions: SpellRowActions = {
    onTogglePrepared: togglePrepared,
    onShowSpell: showSpellDetail,
    onSwap: openSwapModal,
    onReset: handleResetSpellSwap,
    onForget: removeSpellFromCharacter,
  };

  const inscribeRitual = (spell: SpellData) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, inscribeRitualRule(currentCharacter, spell));
    setInscribeModalVisible(false);
  };

  const removeInscribedRitual = (ritualName: string) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, removeInscribedRitualRule(currentCharacter, ritualName));
  };

  const toggleMysticArcanumCast = (spellLevel: number) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, toggleMysticArcanumCastRule(currentCharacter, spellLevel));
  };

  const showDetail = (detail: SpellDetailPayload) => setDetailModal({ visible: true, ...detail });

  const openInscribeModal = () => {
    setInscribeSearchQuery("");
    setInscribeLevelFilter(null);
    setInscribeModalVisible(true);
  };

  const resourceActions: SpellResourceActions = {
    onSpendSorceryPoint: () => spendSorceryPoint(1),
    onRegainSorceryPoint: () => regainSorceryPoint(1),
    onOpenMetamagic: () => setMetamagicModalVisible(true),
    onTogglePactSlot: (slotIndex) => togglePactSlot(slotIndex),
    onToggleSlot: (lvl, slotIndex) => toggleSlot(lvl, slotIndex),
    onToggleArcanumCast: toggleMysticArcanumCast,
    onShowSpell: showSpellDetail,
    onShowDetail: showDetail,
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, sheetScrollPad]}>
      {/* Multiclass Profile Selector Tabs/Pills */}
      {currentPage.owners.length > 1 && (
        <ScrollView
          horizontal={!isCompact}
          showsHorizontalScrollIndicator={false}
          style={styles.profileSelectorScroll}
          contentContainerStyle={[styles.profileSelectorContent, isCompact && { flexDirection: "row", flexWrap: "wrap" }]}>
          {currentPage.owners.map((owner) => {
            const isSelected = owner.selected;

            return (
              <TouchableOpacity
                key={owner.ownerKey}
                onPress={() => setSelectedOwnerKey(owner.ownerKey)}
                style={[
                  styles.profilePill,
                  {
                    backgroundColor: isSelected ? theme.accentGlow : theme.surface,
                    borderColor: isSelected ? theme.accentHover : theme.border,
                    borderWidth: 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.profilePillText,
                    {
                      color: theme.text,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}>
                  {owner.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Spellcasting Header Stats for Active Profile */}
      <View style={styles.statsHeaderRow}>
        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>SPELLCASTING</Text>
          <Text style={[styles.statValue, { color: theme.accentHover }]}>{header.ability}</Text>
          <Text style={[styles.statSub, { color: theme.textSecondary }]}>{header.className}</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>SAVE DC</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{header.spellSaveDc}</Text>
          <Text style={[styles.statSub, { color: theme.textSecondary }]}>8 + Prof + Mod</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>ATTACK BONUS</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{formatModifier(header.spellAttackBonus)}</Text>
          <Text style={[styles.statSub, { color: theme.textSecondary }]}>Prof + Mod</Text>
        </View>
      </View>

      {/* Prepared Casters Counter Card */}
      {currentPage.prepared && (
        <Card style={[styles.preparedCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {currentProfile.className.toUpperCase()} PREPARED SPELLS
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                Spells prepared for the day
              </Text>
            </View>
            <Badge
              label={currentPage.prepared.text}
              variant={currentPage.prepared.overLimit ? "danger" : "accent"}
              size="md"
            />
          </View>
        </Card>
      )}

      <SpellResourceCards
        sorceryPoints={currentPage.sorceryPoints}
        metamagic={currentPage.metamagic}
        pactSlots={currentPage.pactSlots}
        mysticArcanum={currentPage.mysticArcanum}
        slots={currentPage.slots}
        actions={resourceActions}
      />

      {grantedProfiles.map((profile, index) => (
        <GrantedSpellCard
          key={`granted_${index}`}
          profile={profile}
          onToggleUse={toggleInnateSpellUse}
          onShowSpell={showSpellDetail}
        />
      ))}

      {ritual && (
        <RitualBookCard
          ritual={ritual}
          onInscribe={openInscribeModal}
          onRemove={removeInscribedRitual}
          onShowSpell={showSpellDetail}
          onShowDetail={showDetail}
        />
      )}

      {/* Known / Prepared Spells Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{currentPage.listTitle}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{currentPage.listSubtitle}</Text>
        </View>
        {currentPage.canAddSpells && (
          <Button
            title="Add Spells"
            icon="add"
            size="sm"
            variant="primary"
            onPress={() => setSpellPickerVisible(true)}
          />
        )}
      </View>

      <SpellLevelGroups levels={currentPage.levels} actions={rowActions} />

      {/* Spell Picker Modal */}
      <Modal
        visible={spellPickerVisible}
        onClose={() => setSpellPickerVisible(false)}
        title={`Add Spells (${currentProfile.className})`}
      >
        <SpellLearnList
          spells={picker?.spells ?? []}
          restrictedSchools={picker?.restrictedSchools ?? []}
          selectedNames={knownNames}
          lockedNames={knownNames}
          actionLabels={{ idle: "Add", selected: "Added" }}
          searchPlaceholder={`Search ${currentProfile.className} spells...`}
          rowDetail={(s) => `${s.level === 0 ? "Cantrip" : `Lvl ${s.level}`} • ${s.school || ""} • ${s.source}`}
          onToggle={(s) => addSpellToCharacter(s.name, s.source)}
          onViewDetail={(s) => setDetailModal({ visible: true, ...spellDetailText(s, currentCharacter) })}
        />
      </Modal>

      <SubclassSwapModal
        visible={swapModalVisible}
        onClose={() => setSwapModalVisible(false)}
        subtitle={swapTargetSpell ? `Replacing: ${swapTargetSpell.originalName} (${formatOrdinal(swapOffer.original?.level || 1)} Level)` : undefined}
        search={swapSearchQuery}
        onSearchChange={setSwapSearchQuery}
        allowedSchools={swapAllowedSchools}
        eligible={filteredEligibleSwaps}
        onSelect={handleSelectSwap}
        onShowSpell={showSpellDetail}
      />

      <MetamagicModal
        visible={metamagicModalVisible}
        onClose={() => setMetamagicModalVisible(false)}
        sorcererLevel={sorcererLevel}
        allowance={maxMetamagic}
        chosen={selectedMetamagic}
        onToggle={toggleMetamagic}
      />

      <InscribeRitualModal
        visible={inscribeModalVisible}
        onClose={() => setInscribeModalVisible(false)}
        maxRitualLevel={maxRitualLevel}
        search={inscribeSearchQuery}
        onSearchChange={setInscribeSearchQuery}
        levelFilter={inscribeLevelFilter}
        onLevelFilterChange={setInscribeLevelFilter}
        offers={eligibleInscribeSpells}
        onInscribe={inscribeRitual}
        onShowDetail={showDetail}
      />

      {/* Detail Modal */}
      <DetailModal
        visible={detailModal.visible}
        title={detailModal.title}
        subtitle={detailModal.subtitle}
        content={detailModal.content}
        onClose={() => setDetailModal({ visible: false, title: "", content: "" })}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  profileSelectorScroll: {
    marginBottom: 12,
  },
  profileSelectorContent: {
    gap: 8,
    flexDirection: "row",
  },
  profilePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  profilePillText: {
    fontSize: 13,
  },
  statsHeaderRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
    marginVertical: 2,
  },
  statSub: {
    fontSize: 10,
  },
  preparedCard: {
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
});
