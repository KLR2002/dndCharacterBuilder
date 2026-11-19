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
import { findSpell, getSpells } from "../../services/dataService";
import { formatModifier } from "../../services/dndRules";
import { currentCompendium } from "../../services/compendium";
import { type LockedPreparedCard } from "../../rules/spellcasting";
import type { InnateSpellEntry } from "../../rules/innateMagic";
import {
  toggleSpellSlot,
  togglePactSlot as togglePactSlotRule,
  spendSorceryPoints,
  toggleMysticArcanumCast as toggleMysticArcanumCastRule,
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
import { SpellLearnList, LEVEL_NAMES } from "../spells/SpellLearnList";
import { learnableSpells } from "../../rules/learnableSpells";
import {
  spellDetailText,
  spellPage,
  subclassSwapOffer,
  type SpellPageGrantedCard,
} from "../../rules/spellPage";

const METAMAGIC_OPTIONS = [
  {
    name: "Careful Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell's full force. Spend 1 sorcery point and choose up to Cha mod creatures; they automatically succeed on their save.",
  },
  {
    name: "Distant Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell that has a range of 5 feet or greater, you can spend 1 sorcery point to double the range of the spell. When you cast a spell that has a range of touch, you can spend 1 sorcery point to make the range 30 feet.",
  },
  {
    name: "Empowered Spell",
    cost: "1 Sorcery Point",
    desc: "When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.",
  },
  {
    name: "Extended Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell that has a duration of 1 minute or longer, you can spend 1 sorcery point to double its duration, to a maximum duration of 24 hours.",
  },
  {
    name: "Heightened Spell",
    cost: "3 Sorcery Points",
    desc: "When you cast a spell that forces a creature to make a saving throw to resist its effects, you can spend 3 sorcery points to give one target of the spell disadvantage on its first saving throw made against the spell.",
  },
  {
    name: "Quickened Spell",
    cost: "2 Sorcery Points",
    desc: "When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.",
  },
  {
    name: "Subtle Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell, you can spend 1 sorcery point to cast it without somatic or verbal components.",
  },
  {
    name: "Twinned Spell",
    cost: "Spell Level (1 for Cantrip)",
    desc: "When you cast a spell that targets only one creature and doesn't have a range of self, you can spend sorcery points equal to the spell's level (1 for cantrip) to target a second creature in range with the same spell.",
  },
];

function formatOrdinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

/** The copy of a race's Innate Magic card: its subtitle, and whether its rows show the Min Level. */
const RACE_INNATE_COPY = {
  subtitle: "Innate racial magic from your ancestry (Long Rest reset)",
  showMinLevel: true,
};

/** The copy of a feat's Innate Magic card: its subtitle, and whether its rows show the Min Level. */
const FEAT_INNATE_COPY = {
  subtitle: "Spells from this feat (Long Rest reset)",
  showMinLevel: false,
};

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
    spell: SpellData;
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

  // Library spells
  const allSpells = useMemo(() => getSpells(activeBooks), [activeBooks]);

  // Spells known by the open owner
  const activeKnownSpells = useMemo(() => {
    return page?.profile ? page.profile.knownSpells : [];
  }, [page]);

  const ritual = page?.ritualBook ?? null;
  const hasAncientSecrets = ritual !== null;
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

  const knownNames = useMemo(() => activeKnownSpells.map((k) => k.name), [activeKnownSpells]);

  // The Add Spells picker: the spells this owner may learn, plus the ones it knows (shown locked).
  const pickerLearnable = useMemo(() => {
    if (!page?.profile || !currentCharacter) return null;
    return learnableSpells(currentCharacter, page.profile, { activeBooks });
  }, [page, currentCharacter, activeBooks]);

  const pickerSpells = useMemo(() => {
    if (!pickerLearnable) return [];
    const known = activeKnownSpells
      .map((k) => allSpells.find((s) => s.name === k.name && s.source === k.source))
      .filter((s): s is SpellData => s !== undefined);
    return [...pickerLearnable.spells, ...known].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [pickerLearnable, activeKnownSpells, allSpells]);

  // The swap offer for the spell being replaced; the modal is only open while a target is set.
  const swapOffer = useMemo(() => {
    if (!swapTargetSpell || !currentCharacter || !page?.owner) return { allowedSchools: [], eligible: [] };
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
  const showSpellDetail = (item: { name: string; source: string; details?: SpellData }) => {
    const s = item.details || findSpell(item.name, item.source);
    if (!s || !currentCharacter) return;
    setDetailModal({ visible: true, ...spellDetailText(s, currentCharacter) });
  };

  const toggleInnateSpellUse = (spell: InnateSpellEntry) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, toggleInnateSpellUseRule(currentCharacter, spell));
  };

  const renderInnateCard = (
    profile: SpellPageGrantedCard,
    copy: { subtitle: string; showMinLevel: boolean; key?: string }
  ) => {
    if ((profile.spells.length === 0 && !profile.notices?.length) || !currentCharacter) return null;

    const sign = (profile.spellAttackBonus ?? 0) >= 0 ? "+" : "";
    const ability = profile.ability;

    return (
      <Card key={copy.key} style={[styles.innateCard, { borderColor: theme.accentHover, backgroundColor: theme.surface }]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>
              {profile.title.toUpperCase()}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
              {copy.subtitle}
            </Text>
          </View>
          {ability && (
            <Badge
              label={`${ability.toUpperCase()} (DC ${profile.spellSaveDc} / ${sign}${profile.spellAttackBonus})`}
              variant="accent"
              size="sm"
            />
          )}
        </View>

        {profile.notices?.map((notice) => (
          <Text key={notice} style={{ color: theme.warning, fontSize: 12, marginBottom: 6 }}>
            {notice}
          </Text>
        ))}

        {ability && (
          <View style={[styles.innateStatsRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <View style={styles.innateStatCol}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>ABILITY</Text>
              <Text style={[styles.innateStatVal, { color: theme.accentHover }]}>
                {ability.toUpperCase()}
              </Text>
            </View>
            <View style={styles.innateStatCol}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>SAVE DC</Text>
              <Text style={[styles.innateStatVal, { color: theme.text }]}>
                {profile.spellSaveDc ?? "—"}
              </Text>
            </View>
            <View style={styles.innateStatCol}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>ATTACK BONUS</Text>
              <Text style={[styles.innateStatVal, { color: theme.text }]}>
                {profile.spellAttackBonus === undefined ? "—" : formatModifier(profile.spellAttackBonus)}
              </Text>
            </View>
          </View>
        )}

        {/* Spells List */}
        <View style={{ marginTop: 8, gap: 6 }}>
          {profile.spells.map((spell) => {
            const max = spell.maxUses ?? 1;
            const counter = spell.resourceCounterId
              ? currentCharacter.resourceCounters?.[spell.resourceCounterId]
              : undefined;
            const remaining = counter !== undefined ? counter.current : max;
            const isUsed = remaining === 0;

            return (
              <View
                key={`innate_${spell.name}_${spell.level}`}
                style={[
                  styles.innateSpellRow,
                  {
                    borderBottomColor: theme.border,
                    backgroundColor: isUsed ? theme.surfaceHighlight + "50" : "transparent",
                  },
                ]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => showSpellDetail({ name: spell.name, source: spell.source })}
                  style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text
                      style={[
                        styles.spellTitle,
                        {
                          color: isUsed ? theme.textMuted : theme.text,
                          textDecorationLine: isUsed ? "line-through" : "none",
                          flexShrink: 1,
                        },
                      ]}>
                      {spell.name}
                      {spell.note !== undefined && (
                        <Text style={{ fontWeight: "400", color: theme.textSecondary }}>{` (${spell.note.replace(/ /g, "\u00A0")})`}</Text>
                      )}
                    </Text>
                    {spell.isCantrip ? (
                      <Badge label="Cantrip" variant="surface" size="sm" />
                    ) : (
                      <Badge
                        label={`${formatOrdinal(spell.level)} Level`}
                        variant="surface"
                        size="sm"
                      />
                    )}
                    {spell.blast && <Badge label={spell.blast.badge.label} variant={spell.blast.badge.tone} size="sm" />}
                    <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {spell.castingTime}
                    {copy.showMinLevel ? ` • Min Level ${spell.minCharacterLevel}` : ""}
                    {spell.blast ? ` • ${spell.blast.damage}` : ""}
                  </Text>
                </TouchableOpacity>

                {spell.resourceCounterId === undefined ? (
                  <Badge label="At Will" variant="secondary" size="sm" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {isUsed ? `0/${max} (Used)` : `${max}/${max}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleInnateSpellUse(spell)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.slotCheckbox,
                        {
                          borderColor: theme.accentHover,
                          backgroundColor: isUsed ? theme.accentGlow : "transparent",
                        },
                      ]}>
                      {isUsed && <Ionicons name="checkmark" size={14} color={theme.accentHover} />}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Card>
    );
  };

  const renderGrantedCards = () =>
    grantedProfiles.map((profile, index) =>
      renderInnateCard(profile, {
        ...(profile.origin === "race" ? RACE_INNATE_COPY : FEAT_INNATE_COPY),
        key: `granted_${index}`,
      })
    );

  /** The locked card of a source's plain prepared spells: each spell carries the lock, with no counter and no ability row. */
  const renderLockedCards = () =>
    lockedCards.map((card, index) => (
      <Card key={`locked_${index}`} style={[styles.innateCard, { borderColor: theme.accentHover, backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>{card.title.toUpperCase()}</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          {card.spells.map((spell) => (
            <View key={`locked_${card.title}_${spell.name}`} style={[styles.innateSpellRow, { borderBottomColor: theme.border }]}>
              <Ionicons name="lock-closed" size={16} color={theme.accentHover} />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => showSpellDetail({ name: spell.name, source: spell.source, details: spell })}
                style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={[styles.spellTitle, { color: theme.text }]}>{spell.name}</Text>
                  <Badge
                    label={spell.level === 0 ? "Cantrip" : `${formatOrdinal(spell.level)} Level`}
                    variant="surface"
                    size="sm"
                  />
                  <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{spell.castingTime}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Card>
    ));

  const renderAtWillInvocationsCard = () => {
    if (atWillInvocations.length === 0) return null;
    return (
      <Card style={[styles.innateCard, { borderColor: theme.accentHover, backgroundColor: theme.surface, marginBottom: 16 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>
              AT-WILL MAGIC (ELDRITCH INVOCATIONS)
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
              Cast at will without expending spell slots
            </Text>
          </View>
          <Badge label="At Will" variant="accent" size="sm" />
        </View>
        <View style={{ marginTop: 8, gap: 6 }}>
          {atWillInvocations.map(({ invocationName, spellName, details: spell, blast }) => {
            return (
              <View
                key={`at_will_${invocationName}_${spellName}`}
                style={[styles.innateSpellRow, { borderBottomColor: theme.border }]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => showSpellDetail({ name: spellName, source: spell?.source || "PHB", details: spell })}
                  style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.spellTitle, { color: theme.text }]}>
                      {spellName}
                    </Text>
                    <Badge label="At Will - Invocation" variant="accent" size="sm" />
                    {blast && <Badge label={blast.badge.label} variant={blast.badge.tone} size="sm" />}
                    <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {spell?.castingTime || "1 action"} • {invocationName}
                    {blast ? ` • ${blast.damage}` : ""}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </Card>
    );
  };

  // Early returns strictly AFTER all React hooks
  if (!currentCharacter) {
    return null;
  }

  if (!page?.profile) {
    if (grantedProfiles.length > 0 || lockedCards.length > 0 || atWillInvocations.length > 0) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, sheetScrollPad]}>
          {renderGrantedCards()}
          {renderLockedCards()}
          {renderAtWillInvocationsCard()}
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

  // Sorcery points show from Sorcerer 2; Metamagic from Sorcerer 3.
  const sorceryPoints = currentPage.sorceryPoints;
  const metamagic = currentPage.metamagic;
  const sorcererLevel = sorceryPoints?.max ?? 0;
  const usedSorceryPoints = sorceryPoints?.used ?? 0;
  const currentSorceryPoints = sorceryPoints?.remaining ?? 0;
  const maxMetamagic = metamagic?.allowance ?? 0;
  const selectedMetamagic = metamagic?.chosen ?? [];

  const pact = currentPage.pactSlots;
  const pactSlotsUsed = pact?.used ?? 0;
  const remainingPactSlots = pact?.remaining ?? 0;

  const arcanumTiers = currentPage.mysticArcanum;
  const slots = currentPage.slots;

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
    const current = selectedMetamagic;
    let updated: string[];
    if (current.includes(name)) {
      updated = current.filter((m) => m !== name);
    } else {
      if (current.length >= maxMetamagic) {
        return;
      }
      updated = [...current, name];
    }
    updateCharacter(currentCharacter.id, {
      metamagicOptions: updated,
      chosenMetamagic: updated,
    });
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

  const removeSpellFromCharacter = (name: string, source: string, ownerKey?: string) => {
    const next = forgetSpellRule(currentCharacter, currentProfile, { name, source, ownerKey }, currentCompendium(), activeBooks);
    updateCharacter(currentCharacter.id, next);
  };

  const openSwapModal = (item: {
    name: string;
    source: string;
    details?: SpellData;
    originalName?: string;
    isReplaced?: boolean;
  }) => {
    const details = item.details || findSpell(item.name, item.source);
    if (!details) return;
    const origName = item.originalName || item.name;
    const origSpell = findSpell(origName) || details;
    setSwapTargetSpell({
      originalName: origName,
      currentName: item.name,
      spell: origSpell,
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

  const handleResetSpellSwap = (originalName: string) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, resetSubclassSpellSwap(currentCharacter, originalName));
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

      {/* Sorcery points (Sorcerer 2); the Metamagic button and list from Sorcerer 3 */}
      {sorceryPoints && (
        <Card style={[styles.sorceryCard, { borderColor: theme.accentHover }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>SORCERY POINTS</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                {currentSorceryPoints} / {sorcererLevel} Available (Long Rest reset)
              </Text>
            </View>

            <View style={styles.sorceryButtons}>
              <Button
                title="-1"
                size="sm"
                variant="danger"
                onPress={() => spendSorceryPoint(1)}
                disabled={currentSorceryPoints <= 0}
              />
              <Button
                title="+1"
                size="sm"
                variant="success"
                onPress={() => regainSorceryPoint(1)}
                disabled={usedSorceryPoints <= 0}
              />
              {metamagic && (
                <Button
                  title={`Metamagic (${selectedMetamagic.length}/${maxMetamagic})`}
                  size="sm"
                  variant="outline"
                  onPress={() => setMetamagicModalVisible(true)}
                />
              )}
            </View>
          </View>

          {/* Chosen Metamagic list */}
          {metamagic && selectedMetamagic.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {selectedMetamagic.map((m: string) => {
                const opt = METAMAGIC_OPTIONS.find((o) => o.name === m);
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() =>
                      setDetailModal({
                        visible: true,
                        title: m,
                        subtitle: opt?.cost,
                        content: opt?.desc || "",
                      })
                    }
                    style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight, borderColor: theme.accentHover }]}>
                    <Text style={{ color: theme.accentHover, fontSize: 12, fontWeight: "600" }}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>
      )}

      {/* Warlock Pact Slots (Strictly Separate from Multiclass Slots) */}
      {pact && (
        <Card style={[styles.pactCard, { borderColor: theme.accentHover }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>WARLOCK PACT MAGIC</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                {pact.total} {pact.total === 1 ? "slot" : "slots"} of {formatOrdinal(pact.level)} level (Short Rest reset)
              </Text>
            </View>
            <Badge label="Short Rest reset" variant="secondary" size="sm" />
          </View>

          <View style={styles.slotsTrackerRow}>
            {Array.from({ length: pact.total }).map((_, slotIdx) => {
              const isUsed = slotIdx < pactSlotsUsed;
              return (
                <TouchableOpacity
                  key={`pact_slot_${slotIdx}`}
                  onPress={() => togglePactSlot(slotIdx, pactSlotsUsed)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.slotCheckbox,
                    {
                      borderColor: theme.accentHover,
                      backgroundColor: isUsed ? theme.accentGlow : "transparent",
                    },
                  ]}>
                  {isUsed && <Ionicons name="checkmark" size={14} color={theme.accentHover} />}
                </TouchableOpacity>
              );
            })}
            <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 8 }}>
              {remainingPactSlots} / {pact.total} remaining
            </Text>
          </View>
        </Card>
      )}

      {/* Mystic Arcanum (Warlock Level >= 11) */}
      {arcanumTiers.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: theme.accentHover }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[styles.sectionTitle, { color: theme.accentHover }]}>
                  MYSTIC ARCANUM
                </Text>
                <Badge label="1/Long Rest" variant="accent" size="sm" />
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                High-level patron magic (does not consume spell slots) • Long Rest reset
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {arcanumTiers.map((tier) => {
              const spell = tier.spellData;
              const isSpent = tier.isSpent;

              return (
                <View
                  key={`arcanum_tier_${tier.level}`}
                  style={[
                    styles.pickerSpellRow,
                    {
                      borderBottomColor: theme.border,
                      backgroundColor: isSpent ? theme.surfaceHighlight + "40" : "transparent",
                      borderRadius: 8,
                      padding: 8,
                    },
                  ]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "700" }}>
                        {formatOrdinal(tier.spellLevel).toUpperCase()} LEVEL (LVL {tier.level})
                      </Text>
                      {tier.chosenSpellName && (
                        <Badge
                          label={isSpent ? "Expended" : "Available"}
                          variant={isSpent ? "secondary" : "accent"}
                          size="sm"
                        />
                      )}
                    </View>

                    {tier.chosenSpellName ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (spell) {
                            showSpellDetail({ name: spell.name, source: spell.source, details: spell });
                          } else {
                            setDetailModal({
                              visible: true,
                              title: tier.chosenSpellName!,
                              subtitle: `${formatOrdinal(tier.spellLevel)} Level Arcanum`,
                              content: `Mystic Arcanum spell: ${tier.chosenSpellName}`,
                            });
                          }
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text
                          style={[
                            styles.spellTitle,
                            {
                              color: isSpent ? theme.textMuted : theme.text,
                              textDecorationLine: isSpent ? "line-through" : "none",
                            },
                          ]}>
                          {tier.chosenSpellName}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                          {spell?.castingTime || "1 action"} • {spell?.range || "Self"} • DC {tier.dc ?? "—"} • {tier.attackBonus === null ? "—" : formatModifier(tier.attackBonus)} Atk
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {tier.chosenSpellName && (
                    <Button
                      title={isSpent ? "Expended" : "Cast (1/Long Rest)"}
                      size="sm"
                      variant={isSpent ? "secondary" : "primary"}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => toggleMysticArcanumCast(tier.spellLevel)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Multiclass / Standard Spell Slots Table (Levels 1-9) */}
      {slots && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>SPELL SLOTS</Text>
            <Badge label="Long Rest reset" variant="secondary" size="sm" />
          </View>
          <View style={{ gap: 8 }}>
            {slots.map(({ level: lvl, total: maxSlots, used, remaining }) => {
              return (
                <View key={`slot_row_${lvl}`} style={styles.slotRow}>
                  <View style={{ width: 80 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>
                      {LEVEL_NAMES[lvl]}
                    </Text>
                  </View>

                  <View style={styles.slotCheckboxesRow}>
                    {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                      const isUsed = slotIdx < used;
                      return (
                        <TouchableOpacity
                          key={`lvl_${lvl}_slot_${slotIdx}`}
                          onPress={() => toggleSlot(lvl, slotIdx, used)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={[
                            styles.slotCheckbox,
                            {
                              borderColor: theme.accentHover,
                              backgroundColor: isUsed ? theme.accentGlow : "transparent",
                            },
                          ]}>
                          {isUsed && <Ionicons name="checkmark" size={14} color={theme.accentHover} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={{ color: theme.textSecondary, fontSize: 12, width: 45, textAlign: "right" }}>
                    {remaining}/{maxSlots}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {renderGrantedCards()}

      {/* Ritual Book (Book of Ancient Secrets) */}
      {Boolean(hasAncientSecrets) && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  RITUAL BOOK (BOOK OF ANCIENT SECRETS)
                </Text>
                <Badge label="Ritual Casting" variant="accent" size="sm" />
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                {ritual?.entries.length ?? 0} inscribed rituals • Max level {maxRitualLevel} (half Warlock level rounded up)
              </Text>
            </View>
            {hasAncientSecrets && (
              <Button
                title="Inscribe Ritual"
                icon="add"
                size="sm"
                variant="secondary"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  setInscribeSearchQuery("");
                  setInscribeLevelFilter(null);
                  setInscribeModalVisible(true);
                }}
              />
            )}
          </View>

          {(ritual?.entries.length ?? 0) === 0 ? (
            <Text style={{ color: theme.textMuted, fontSize: 12, fontStyle: "italic", paddingVertical: 4 }}>
              No rituals inscribed yet. Choose your 2 starting rituals in the builder or inscribe rituals found during adventures.
            </Text>
          ) : (
            <View style={{ gap: 4 }}>
              {(ritual?.entries ?? []).map((item, idx) => (
                <View
                  key={`ritual_${item.name}_${idx}`}
                  style={[
                    styles.spellRow,
                    {
                      borderBottomColor: theme.border,
                      borderBottomWidth: idx === (ritual?.entries.length ?? 0) - 1 ? 0 : 1,
                      paddingVertical: 6,
                    },
                  ]}>
                  <TouchableOpacity
                    onPress={() => {
                      const spell = findSpell(item.name, item.source) || findSpell(item.name);
                      if (spell) {
                        showSpellDetail({ name: spell.name, source: spell.source, details: spell });
                      } else {
                        setDetailModal({
                          visible: true,
                          title: item.name,
                          subtitle: `Level ${item.level} Ritual (${item.source})`,
                          content: "Ritual spell inscribed in Book of Shadows.",
                        });
                      }
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ flex: 1, paddingVertical: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={[styles.spellTitle, { color: theme.text }]}>
                        {item.name}
                      </Text>
                      <Badge label="[Ritual Only]" variant="accent" size="sm" />
                      <Badge label={`Level ${item.level}`} variant="secondary" size="sm" />
                      {item.isStarting ? (
                        <Badge label="Starting" variant="secondary" size="sm" />
                      ) : (
                        <Badge label="Inscribed" variant="secondary" size="sm" />
                      )}
                    </View>
                  </TouchableOpacity>

                  {!item.isStarting && (
                    <TouchableOpacity
                      onPress={() => removeInscribedRitual(item.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </Card>
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

      {/* Spells List by Level */}
      {currentPage.levels.map((group) => {
        const spellsAtLevel = group.rows;

        return (
          <View key={`level_group_${group.level}`} style={{ marginBottom: 14 }}>
            <Text style={[styles.levelHeader, { color: theme.textSecondary }]}>
              {group.title} ({spellsAtLevel.length})
            </Text>

            <Card style={{ padding: 4 }}>
              {spellsAtLevel.map((item, idx) => {
                return (
                  <View
                    key={`${item.name}__${item.source}__${item.ownerKey || ""}`}
                    style={[
                      styles.spellRow,
                      {
                        borderBottomColor: theme.border,
                        borderBottomWidth: idx === spellsAtLevel.length - 1 ? 0 : 1,
                      },
                    ]}>
                    {/* Prepared Checkbox (for non-cantrips) */}
                    {item.prepare !== "none" ? (
                      item.prepare === "locked" ? (
                        <View style={styles.prepToggle}>
                          <Ionicons
                            name="lock-closed"
                            size={16}
                            color={theme.accentHover}
                          />
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => togglePrepared(item)}
                          style={styles.prepToggle}>
                          <Ionicons
                            name={item.prepared ? "radio-button-on" : "radio-button-off"}
                            size={18}
                            color={item.prepared ? theme.accentHover : theme.textMuted}
                          />
                        </TouchableOpacity>
                      )
                    ) : (
                      <View style={{ width: 26 }} />
                    )}

                    {/* Spell Name & Info (opens detail modal) */}
                    <TouchableOpacity
                      onPress={() => showSpellDetail(item)}
                      style={{ flex: 1, paddingVertical: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={[styles.spellTitle, { color: theme.text }]}>
                          {item.name}
                        </Text>
                        {item.badges.map((badge) => (
                          <Badge key={badge.label} label={badge.label} variant={badge.tone} size="sm" />
                        ))}
                      </View>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>{item.subtitle}</Text>
                    </TouchableOpacity>

                    {/* Swap Actions for Subclass-Granted Known Spells */}
                    {item.swap && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {item.swap.canReset && (
                            <Button
                              title="Reset to Default"
                              size="sm"
                              variant="ghost"
                              onPress={() => handleResetSpellSwap(item.swap?.originalName ?? item.name)}
                            />
                          )}
                          <Button
                            title="Swap"
                            icon="swap-horizontal-outline"
                            size="sm"
                            variant="outline"
                            onPress={() =>
                              openSwapModal({
                                name: item.name,
                                source: item.source,
                                details: item.details,
                                originalName: item.swap?.originalName,
                              })
                            }
                          />
                        </View>
                      )}

                    {/* Remove Spell */}
                    {item.canForget && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.name}`}
                        onPress={() => removeSpellFromCharacter(item.name, item.source, item.ownerKey)}
                        style={{ padding: 6, minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}

      {/* Spell Picker Modal */}
      <Modal
        visible={spellPickerVisible}
        onClose={() => setSpellPickerVisible(false)}
        title={`Add Spells (${currentProfile.className})`}
      >
        <SpellLearnList
          spells={pickerSpells}
          restrictedSchools={pickerLearnable?.restrictedSchools ?? []}
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
        subtitle={swapTargetSpell ? `Replacing: ${swapTargetSpell.originalName} (${formatOrdinal(swapTargetSpell.spell.level || 1)} Level)` : undefined}
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
