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
import { SearchBar } from "../ui/SearchBar";
import { SpellLearnList } from "../spells/SpellLearnList";
import { SpellLevelGroups } from "../spells/SpellLevelGroups";
import type { SpellRowActions } from "../spells/SpellRow";
import { SpellResourceCards, type SpellResourceActions } from "../spells/SpellResourceCards";
import { RitualBookCard } from "../spells/RitualBookCard";
import { AtWillSpellCard, GrantedSpellCard, LockedSpellCard } from "../spells/GrantedSpellCard";
import { METAMAGIC_OPTIONS } from "../spells/metamagicOptions";
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

      {/* Subclass Spell Swap Modal */}
      <Modal
        visible={swapModalVisible}
        onClose={() => setSwapModalVisible(false)}
        title="Swap Subclass Spell"
        subtitle={swapTargetSpell ? `Replacing: ${swapTargetSpell.originalName} (${formatOrdinal(swapOffer.original?.level || 1)} Level)` : undefined}
      >
        <SearchBar
          value={swapSearchQuery}
          onChangeText={setSwapSearchQuery}
          placeholder="Search eligible replacement spells..."
        />

        <View style={{ marginVertical: 6 }}>
          <Text style={{ color: theme.textMuted, fontSize: 11 }}>
            Allowed Schools: {swapAllowedSchools.join(", ")} • Sorcerer, Warlock, Wizard
          </Text>
        </View>

          {filteredEligibleSwaps.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>
              No eligible replacement spells found.
            </Text>
          </View>
        ) : (
          filteredEligibleSwaps.map((s) => (
            <View
              key={`${s.name}_${s.source}`}
              style={[styles.pickerSpellRow, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => setDetailModal({ visible: true, ...spellDetailText(s, currentCharacter) })}
                style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{s.name}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  {s.level === 0 ? "Cantrip" : `Lvl ${s.level}`} • {s.school || ""} • {s.source}
                </Text>
              </TouchableOpacity>

              <Button
                title="Select"
                size="sm"
                variant="primary"
                onPress={() => handleSelectSwap(s)}
              />
            </View>
          ))
        )}
      </Modal>

      {/* Metamagic Selection Modal */}
      <Modal
        visible={metamagicModalVisible}
        onClose={() => setMetamagicModalVisible(false)}
        title="Choose Metamagic Options"
      >
        <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 12 }}>
          Select up to {maxMetamagic} options (Level {sorcererLevel} Sorcerer). Selected: {selectedMetamagic.length}/{maxMetamagic}
        </Text>

          {METAMAGIC_OPTIONS.map((opt) => {
          const isChosen = selectedMetamagic.includes(opt.name);
          const isMaxReached = selectedMetamagic.length >= maxMetamagic && !isChosen;

          return (
            <TouchableOpacity
              key={opt.name}
              onPress={() => toggleMetamagic(opt.name)}
              disabled={isMaxReached}
              style={[
                styles.metaOptionCard,
                {
                  backgroundColor: isChosen ? theme.accentGlow : theme.surfaceHighlight,
                  borderColor: isChosen ? theme.accentHover : theme.border,
                  opacity: isMaxReached ? 0.5 : 1,
                },
              ]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: isChosen ? theme.accentHover : theme.text, fontWeight: "700" }}>
                    {opt.name}
                  </Text>
                  <Badge label={opt.cost} size="sm" variant="secondary" />
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                  {opt.desc}
                </Text>
              </View>
              <Ionicons
                name={isChosen ? "checkbox" : "square-outline"}
                size={20}
                color={isChosen ? theme.accentHover : theme.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </Modal>

      {/* Inscribe Ritual Modal */}
      <Modal
        visible={inscribeModalVisible}
        onClose={() => setInscribeModalVisible(false)}
        title="Inscribe Ritual"
        subtitle={`Max level ${maxRitualLevel} • Cost: 50 gp & 2 hrs per spell level`}
      >
        <SearchBar
          value={inscribeSearchQuery}
          onChangeText={setInscribeSearchQuery}
          placeholder="Search rituals across classes..."
        />

        {/* Level Filter Pills up to maxRitualLevel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginVertical: 8 }}
          contentContainerStyle={{ alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => setInscribeLevelFilter(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.filterPill,
              {
                backgroundColor: inscribeLevelFilter === null ? theme.accentGlow : theme.surfaceHighlight,
                borderColor: inscribeLevelFilter === null ? theme.accentHover : theme.border,
                borderWidth: 1,
              },
            ]}>
            <Text style={{ color: inscribeLevelFilter === null ? theme.text : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>All Levels (1-{maxRitualLevel})</Text>
          </TouchableOpacity>
          {Array.from({ length: maxRitualLevel }).map((_, idx) => {
            const lvl = idx + 1;
            return (
              <TouchableOpacity
                key={`inscribe_lvl_${lvl}`}
                onPress={() => setInscribeLevelFilter(lvl)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: inscribeLevelFilter === lvl ? theme.accentGlow : theme.surfaceHighlight,
                    borderColor: inscribeLevelFilter === lvl ? theme.accentHover : theme.border,
                    borderWidth: 1,
                  },
                ]}>
                <Text style={{ color: inscribeLevelFilter === lvl ? theme.text : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>Level {lvl}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

          {eligibleInscribeSpells.length === 0 ? (
          <View style={{ padding: 16, alignItems: "center" }}>
            <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: "center" }}>
              No eligible rituals found matching your filters.
            </Text>
          </View>
        ) : (
          eligibleInscribeSpells.map((s) => (
            <View
              key={`inscribe_row_${s.name}_${s.source}`}
              style={[styles.pickerSpellRow, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                onPress={() =>
                  setDetailModal({
                    visible: true,
                    title: s.name,
                    subtitle: `Level ${s.level} Ritual (${s.source})`,
                    content: `${s.level}th-level ${s.school || ""} (Ritual)\n\n• Casting Time: ${s.castingTime || "1 action"}\n• Range: ${s.range || "Self"}\n• Components: ${s.componentsString || "V, S"}\n• Duration: ${s.duration || "Instantaneous"}\n• Classes: ${s.classes?.join(", ") || "None"}\n\n${s.description || ""}`,
                  })
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ flex: 1, paddingVertical: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{s.name}</Text>
                  <Badge label={`Level ${s.level}`} variant="secondary" size="sm" />
                  {s.school && <Badge label={s.school} variant="secondary" size="sm" />}
                  <Badge label={s.source} variant="secondary" size="sm" />
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                  {s.classes?.join(", ") || "General"}
                </Text>
              </TouchableOpacity>

              <Button
                title="Inscribe"
                size="sm"
                variant="primary"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => inscribeRitual(s)}
              />
            </View>
          ))
        )}
      </Modal>

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
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
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
  sorceryCard: {
    padding: 14,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitleBlock: {
    flexShrink: 1,
    minWidth: 0,
  },
  sorceryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  pactCard: {
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  slotsTrackerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotCheckboxesRow: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    paddingHorizontal: 10,
  },
  slotCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  levelHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  spellRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  prepToggle: {
    padding: 4,
  },
  spellTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerSpellRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  metaOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  innateCard: {
    padding: 14,
    marginBottom: 16,
  },
  innateStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
  },
  innateStatCol: {
    alignItems: "center",
  },
  innateStatVal: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  innateSpellRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
});
