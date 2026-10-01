import React, { useMemo, useState } from "react";
import {
  Modal as RNModal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { findSpell, getSpells } from "../../services/dataService";
import {
  calculateMulticlassSpellSlots,
  formatModifier,
} from "../../services/dndRules";
import {
  getClassSpellProfiles,
  calculateWarlockPactSlots,
  type ClassSpellProfile,
} from "../../rules/spellcasting";
import type { KnownSpell } from "../../types/character";
import type { SpellData } from "../../types/dnd5e";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { SearchBar } from "../ui/SearchBar";

const LEVEL_NAMES = [
  "Cantrips",
  "1st Level",
  "2nd Level",
  "3rd Level",
  "4th Level",
  "5th Level",
  "6th Level",
  "7th Level",
  "8th Level",
  "9th Level",
];

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

function checkIsSpellPrepared(
  item: { name: string; source: string; ownerKey?: string },
  profile: ClassSpellProfile,
  preparedSpellsList: string[]
): boolean {
  const ownerKey = item.ownerKey || `${profile.className}__${profile.source}`;
  const canonicalKey = `${item.name}__${item.source}__${ownerKey}`;
  const legacyKey = `${item.name}__${item.source}`;
  return preparedSpellsList.some((k) => k === canonicalKey || k === legacyKey);
}

export const SpellsTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();

  // State hooks
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(0);
  const [spellPickerVisible, setSpellPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpellLevel, setSelectedSpellLevel] = useState<number | null>(null);
  const [metamagicModalVisible, setMetamagicModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  // 1. Multiclass Spell Profiles
  const spellProfiles = useMemo(() => {
    return currentCharacter ? getClassSpellProfiles(currentCharacter) : [];
  }, [currentCharacter]);

  const activeProfileIndex = useMemo(() => {
    if (spellProfiles.length === 0) return 0;
    return Math.min(selectedProfileIndex, spellProfiles.length - 1);
  }, [selectedProfileIndex, spellProfiles.length]);

  const activeProfile: ClassSpellProfile | null = useMemo(() => {
    return spellProfiles[activeProfileIndex] ?? null;
  }, [spellProfiles, activeProfileIndex]);

  // 2. Warlock Pact Slots
  const warlockPactSlots = useMemo(() => {
    return currentCharacter ? calculateWarlockPactSlots(currentCharacter) : null;
  }, [currentCharacter]);

  // 3. Standard Multiclass Spell Slots
  const multiclassSlotsResult = useMemo(() => {
    return currentCharacter ? calculateMulticlassSpellSlots(currentCharacter) : { slots: [] as number[] };
  }, [currentCharacter]);

  // Library spells
  const allSpells = useMemo(() => getSpells(activeBooks), [activeBooks]);

  // Spells known by the active profile
  const activeKnownSpells = useMemo(() => {
    return activeProfile ? activeProfile.knownSpells : [];
  }, [activeProfile]);

  // Group active profile's known spells by spell level
  const groupedSpells = useMemo(() => {
    const map: Record<
      number,
      { name: string; source: string; ownerKey: string; className?: string; details?: SpellData }[]
    > = {};
    for (let i = 0; i <= 9; i++) map[i] = [];

    for (const item of activeKnownSpells) {
      const details = findSpell(item.name, item.source);
      const lvl = details?.level ?? 0;
      if (map[lvl]) {
        map[lvl].push({ ...item, details });
      }
    }
    return map;
  }, [activeKnownSpells]);

  // Prepared non-cantrip spells count for the active profile
  const preparedCount = useMemo(() => {
    if (!activeProfile || !currentCharacter) return 0;
    const prepList = currentCharacter.preparedSpells || [];
    return activeKnownSpells.filter((item) => {
      const details = findSpell(item.name, item.source);
      const lvl = details?.level ?? 0;
      if (lvl === 0) return false;
      return checkIsSpellPrepared(item, activeProfile, prepList);
    }).length;
  }, [activeProfile, currentCharacter, activeKnownSpells]);

  // Filtered spells for the Add Spells picker modal
  const filteredPickerSpells = useMemo(() => {
    if (!activeProfile) return [];
    const targetCastingClass =
      activeProfile.className === "Fighter" || activeProfile.className === "Rogue"
        ? "Wizard"
        : activeProfile.className;

    return allSpells.filter((s) => {
      const matchesClass =
        Boolean(s.classes?.includes(targetCastingClass)) ||
        Boolean(s.classes?.includes(activeProfile.className));
      const matchesMaxLevel = s.level <= activeProfile.maxSpellLevel;
      const matchesLevel =
        selectedSpellLevel === null ||
        (selectedSpellLevel <= activeProfile.maxSpellLevel && s.level === selectedSpellLevel);
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Boolean(s.school?.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesClass && matchesMaxLevel && matchesLevel && matchesSearch;
    });
  }, [allSpells, searchQuery, selectedSpellLevel, activeProfile]);

  // Early returns strictly AFTER all React hooks
  if (!currentCharacter) {
    return null;
  }

  if (spellProfiles.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="sparkles-outline" size={48} color={theme.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Spellcasting Features</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            This character does not currently have any spellcasting classes or features. Add levels in a spellcasting class (such as Wizard, Cleric, Sorcerer, Bard, Druid, Warlock, Paladin, Ranger, or a spellcasting archetype like Eldritch Knight or Arcane Trickster) in the Builder tab to view and manage spells.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  // Active profile is guaranteed to exist here
  const currentProfile = activeProfile!;

  // Sorcerer specifics
  const sorcererClass = currentCharacter.classes.find((c) => c.className === "Sorcerer");
  const sorcererLevel = sorcererClass?.level || 0;
  const hasMetamagicAccess = sorcererLevel >= 3;
  const maxSorceryPoints = sorcererLevel;
  const usedSorceryPoints = currentCharacter.sorceryPointsUsed || 0;
  const currentSorceryPoints = Math.max(0, maxSorceryPoints - usedSorceryPoints);
  const maxMetamagic = sorcererLevel >= 17 ? 4 : sorcererLevel >= 10 ? 3 : 2;
  const selectedMetamagic = currentCharacter.metamagicOptions ?? currentCharacter.chosenMetamagic ?? [];

  // Warlock pact slot calculations
  const pactSlotsUsed = currentCharacter.pactSlotsUsed ?? currentCharacter.usedPactSlots ?? 0;
  const remainingPactSlots = warlockPactSlots ? Math.max(0, warlockPactSlots.count - pactSlotsUsed) : 0;

  // Standard spell slots
  const spellSlots = multiclassSlotsResult.slots;
  const hasStandardSlots = spellSlots.some((s) => s > 0);

  // Slot handlers
  const toggleSlot = (lvl: number, slotIndex: number, currentUsed: number) => {
    const nextUsed = slotIndex < currentUsed ? slotIndex : slotIndex + 1;
    updateCharacter(currentCharacter.id, {
      usedSpellSlots: {
        ...(currentCharacter.usedSpellSlots || {}),
        [lvl]: nextUsed,
      },
    });
  };

  const togglePactSlot = (slotIndex: number, currentUsed: number) => {
    const nextUsed = slotIndex < currentUsed ? slotIndex : slotIndex + 1;
    updateCharacter(currentCharacter.id, {
      pactSlotsUsed: nextUsed,
      usedPactSlots: nextUsed,
    });
  };

  // Metamagic handlers
  const spendSorceryPoint = (amount: number = 1) => {
    const next = Math.min(maxSorceryPoints, usedSorceryPoints + amount);
    updateCharacter(currentCharacter.id, { sorceryPointsUsed: next });
  };

  const regainSorceryPoint = (amount: number = 1) => {
    const next = Math.max(0, usedSorceryPoints - amount);
    updateCharacter(currentCharacter.id, { sorceryPointsUsed: next });
  };

  const toggleMetamagic = (name: string) => {
    const current = currentCharacter.metamagicOptions ?? currentCharacter.chosenMetamagic ?? [];
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
    const ownerKey = item.ownerKey || `${currentProfile.className}__${currentProfile.source}`;
    const canonicalKey = `${item.name}__${item.source}__${ownerKey}`;
    const legacyKey = `${item.name}__${item.source}`;
    const currentPrep = currentCharacter.preparedSpells || [];
    const isCurrentlyPrepared = currentPrep.some((k) => k === canonicalKey || k === legacyKey);

    let nextPrep: string[];
    if (isCurrentlyPrepared) {
      nextPrep = currentPrep.filter((k) => k !== canonicalKey && k !== legacyKey);
    } else {
      nextPrep = [...currentPrep, canonicalKey];
    }
    updateCharacter(currentCharacter.id, {
      preparedSpells: nextPrep,
    });
  };

  const addSpellToCharacter = (name: string, source: string) => {
    const ownerKey = `${currentProfile.className}__${currentProfile.source}`;
    const exists = (currentCharacter.knownSpells || []).some(
      (s) =>
        s.name === name &&
        s.source === source &&
        (s.ownerKey === ownerKey || (!s.ownerKey && s.className === currentProfile.className))
    );
    if (!exists) {
      const newKnownSpell: KnownSpell = {
        name,
        source,
        ownerKey,
        className: currentProfile.className,
      };
      updateCharacter(currentCharacter.id, {
        knownSpells: [...(currentCharacter.knownSpells || []), newKnownSpell],
      });
    }
  };

  const removeSpellFromCharacter = (name: string, source: string, ownerKey: string) => {
    const filtered = (currentCharacter.knownSpells || []).filter(
      (s) => !(s.name === name && s.source === source && (s.ownerKey === ownerKey || s.ownerKey === undefined))
    );
    const canonicalKey = `${name}__${source}__${ownerKey}`;
    const legacyKey = `${name}__${source}`;
    const nextPrep = (currentCharacter.preparedSpells || []).filter(
      (k) => k !== canonicalKey && k !== legacyKey && !k.startsWith(`${name}__${source}__`)
    );
    updateCharacter(currentCharacter.id, {
      knownSpells: filtered,
      preparedSpells: nextPrep,
    });
  };

  const showSpellDetail = (item: { name: string; source: string; details?: SpellData }) => {
    const s = item.details || findSpell(item.name, item.source);
    if (!s) return;

    const formattedDesc =
      `${s.level === 0 ? "Cantrip" : `${s.level}th-level`} ${s.school || ""}\n\n` +
      `• Casting Time: ${s.castingTime || "1 action"}\n` +
      `• Range: ${s.range || "Self"}\n` +
      `• Components: ${s.componentsString || "V, S"}\n` +
      `• Duration: ${s.duration || "Instantaneous"}\n\n` +
      `${s.description || "No description available."}`;

    setDetailModal({
      visible: true,
      title: s.name,
      subtitle: `${s.level === 0 ? "Cantrip" : `Level ${s.level}`} (${s.source})`,
      content: formattedDesc,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Multiclass Profile Selector Tabs/Pills */}
      {spellProfiles.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.profileSelectorScroll}
          contentContainerStyle={styles.profileSelectorContent}>
          {spellProfiles.map((profile, idx) => {
            const isSelected = idx === activeProfileIndex;
            const sign = profile.spellAttackBonus >= 0 ? "+" : "";
            const pillLabel = `${profile.className} (${profile.ability.toUpperCase()} DC ${profile.spellSaveDc} / ${sign}${profile.spellAttackBonus})`;

            return (
              <TouchableOpacity
                key={`profile_${profile.className}_${profile.source}_${idx}`}
                onPress={() => setSelectedProfileIndex(idx)}
                style={[
                  styles.profilePill,
                  {
                    backgroundColor: isSelected ? theme.accent : theme.surface,
                    borderColor: isSelected ? theme.accent : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.profilePillText,
                    {
                      color: isSelected ? "#fff" : theme.text,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}>
                  {pillLabel}
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
          <Text style={[styles.statValue, { color: theme.accent }]}>{currentProfile.ability.toUpperCase()}</Text>
          <Text style={[styles.statSub, { color: theme.textSecondary }]}>{currentProfile.className}</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>SAVE DC</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{currentProfile.spellSaveDc}</Text>
          <Text style={[styles.statSub, { color: theme.textSecondary }]}>8 + Prof + Mod</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>ATTACK BONUS</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{formatModifier(currentProfile.spellAttackBonus)}</Text>
          <Text style={[styles.statSub, { color: theme.textSecondary }]}>Prof + Mod</Text>
        </View>
      </View>

      {/* Prepared Casters Counter Card */}
      {currentProfile.preparedLimit !== undefined && (
        <Card style={[styles.preparedCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {currentProfile.className.toUpperCase()} PREPARED SPELLS
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                Spells prepared for the day (Level + {currentProfile.ability.toUpperCase()} mod)
              </Text>
            </View>
            <Badge
              label={`${preparedCount} / ${currentProfile.preparedLimit} Prepared`}
              variant={preparedCount > currentProfile.preparedLimit ? "danger" : "accent"}
              size="md"
            />
          </View>
        </Card>
      )}

      {/* Sorcerer Metamagic & Sorcery Points Section (Sorcerer Level >= 3) */}
      {hasMetamagicAccess && (
        <Card style={[styles.sorceryCard, { borderColor: theme.accent }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.accent }]}>SORCERY POINTS</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                {currentSorceryPoints} / {maxSorceryPoints} Available (Long Rest reset)
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
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
              <Button
                title={`Metamagic (${selectedMetamagic.length}/${maxMetamagic})`}
                size="sm"
                variant="outline"
                onPress={() => setMetamagicModalVisible(true)}
              />
            </View>
          </View>

          {/* Chosen Metamagic list */}
          {selectedMetamagic.length > 0 && (
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
                    style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight, borderColor: theme.accent }]}>
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "600" }}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>
      )}

      {/* Warlock Pact Slots (Strictly Separate from Multiclass Slots) */}
      {warlockPactSlots && (
        <Card style={[styles.pactCard, { borderColor: "#9333ea" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={[styles.sectionTitle, { color: "#c084fc" }]}>WARLOCK PACT MAGIC</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                {warlockPactSlots.count} {warlockPactSlots.count === 1 ? "slot" : "slots"} of {formatOrdinal(warlockPactSlots.level)} level (Short Rest reset)
              </Text>
            </View>
            <Badge label="Short Rest reset" variant="secondary" size="sm" />
          </View>

          <View style={styles.slotsTrackerRow}>
            {Array.from({ length: warlockPactSlots.count }).map((_, slotIdx) => {
              const isUsed = slotIdx < pactSlotsUsed;
              return (
                <TouchableOpacity
                  key={`pact_slot_${slotIdx}`}
                  onPress={() => togglePactSlot(slotIdx, pactSlotsUsed)}
                  style={[
                    styles.slotCheckbox,
                    {
                      borderColor: "#9333ea",
                      backgroundColor: isUsed ? "#9333ea" : "transparent",
                    },
                  ]}>
                  {isUsed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
            <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 8 }}>
              {remainingPactSlots} / {warlockPactSlots.count} remaining
            </Text>
          </View>
        </Card>
      )}

      {/* Multiclass / Standard Spell Slots Table (Levels 1-9) */}
      {hasStandardSlots && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>SPELL SLOTS</Text>
            <Badge label="Long Rest reset" variant="secondary" size="sm" />
          </View>
          <View style={{ gap: 8 }}>
            {spellSlots.map((maxSlots, idx) => {
              if (maxSlots === 0) return null;
              const lvl = idx + 1;
              const used = (currentCharacter.usedSpellSlots || {})[lvl] || 0;
              const remaining = Math.max(0, maxSlots - used);

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
                          style={[
                            styles.slotCheckbox,
                            {
                              borderColor: theme.accent,
                              backgroundColor: isUsed ? theme.accent : "transparent",
                            },
                          ]}>
                          {isUsed && <Ionicons name="checkmark" size={14} color="#fff" />}
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

      {/* Known / Prepared Spells Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {currentProfile.className.toUpperCase()} SPELLBOOK & CANTRIPS
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            {activeKnownSpells.length} spells known
            {currentProfile.preparedLimit !== undefined
              ? ` • ${preparedCount} / ${currentProfile.preparedLimit} prepared`
              : ""}
          </Text>
        </View>
        <Button
          title="Add Spells"
          icon="add"
          size="sm"
          variant="primary"
          onPress={() => setSpellPickerVisible(true)}
        />
      </View>

      {/* Spells List by Level */}
      {LEVEL_NAMES.map((levelTitle, lvlIdx) => {
        const spellsAtLevel = groupedSpells[lvlIdx] || [];
        if (spellsAtLevel.length === 0) return null;

        return (
          <View key={`level_group_${lvlIdx}`} style={{ marginBottom: 14 }}>
            <Text style={[styles.levelHeader, { color: theme.textSecondary }]}>
              {levelTitle.toUpperCase()} ({spellsAtLevel.length})
            </Text>

            <Card style={{ padding: 4 }}>
              {spellsAtLevel.map((item, idx) => {
                const isPrepared = checkIsSpellPrepared(
                  item,
                  currentProfile,
                  currentCharacter.preparedSpells || []
                );

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
                    {lvlIdx > 0 ? (
                      <TouchableOpacity
                        onPress={() => togglePrepared(item)}
                        style={styles.prepToggle}>
                        <Ionicons
                          name={isPrepared ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={isPrepared ? theme.accent : theme.textMuted}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ width: 26 }} />
                    )}

                    {/* Spell Name & Info (opens detail modal) */}
                    <TouchableOpacity
                      onPress={() => showSpellDetail(item)}
                      style={{ flex: 1, paddingVertical: 4 }}>
                      <Text style={[styles.spellTitle, { color: theme.text }]}>
                        {item.name}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                        {item.details?.school || ""} • {item.details?.castingTime || "1 action"} • {item.source}
                      </Text>
                    </TouchableOpacity>

                    {/* Remove Spell */}
                    <TouchableOpacity
                      onPress={() => removeSpellFromCharacter(item.name, item.source, item.ownerKey)}
                      style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}

      {/* Spell Picker Modal */}
      <RNModal visible={spellPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={[styles.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Add Spells ({currentProfile.className})
              </Text>
              <TouchableOpacity onPress={() => setSpellPickerVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${currentProfile.className} spells...`}
            />

            {/* Level Filter Pills up to activeProfile.maxSpellLevel */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              <TouchableOpacity
                onPress={() => setSelectedSpellLevel(null)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: selectedSpellLevel === null ? theme.accent : theme.surfaceHighlight,
                  },
                ]}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>All Levels</Text>
              </TouchableOpacity>
              {LEVEL_NAMES.slice(0, currentProfile.maxSpellLevel + 1).map((name, idx) => (
                <TouchableOpacity
                  key={`filter_lvl_${idx}`}
                  onPress={() => setSelectedSpellLevel(idx)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: selectedSpellLevel === idx ? theme.accent : theme.surfaceHighlight,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ flex: 1 }}>
              {filteredPickerSpells.slice(0, 100).map((s) => {
                const ownerKey = `${currentProfile.className}__${currentProfile.source}`;
                const alreadyHas = activeKnownSpells.some(
                  (k) =>
                    k.name === s.name &&
                    k.source === s.source &&
                    (k.ownerKey === ownerKey || (!k.ownerKey && k.className === currentProfile.className))
                );

                return (
                  <View
                    key={`${s.name}_${s.source}`}
                    style={[styles.pickerSpellRow, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                      onPress={() =>
                        setDetailModal({
                          visible: true,
                          title: s.name,
                          subtitle: `${s.level === 0 ? "Cantrip" : `Level ${s.level}`} (${s.source})`,
                          content: `${s.level === 0 ? "Cantrip" : `${s.level}th-level`} ${s.school || ""}\n\n• Casting Time: ${s.castingTime || "1 action"}\n• Range: ${s.range || "Self"}\n• Components: ${s.componentsString || "V, S"}\n• Duration: ${s.duration || "Instantaneous"}\n\n${s.description || ""}`,
                        })
                      }
                      style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{s.name}</Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                        {s.level === 0 ? "Cantrip" : `Lvl ${s.level}`} • {s.school || ""} • {s.source}
                      </Text>
                    </TouchableOpacity>

                    <Button
                      title={alreadyHas ? "Added" : "Add"}
                      size="sm"
                      variant={alreadyHas ? "secondary" : "primary"}
                      disabled={alreadyHas}
                      onPress={() => addSpellToCharacter(s.name, s.source)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </Card>
        </View>
      </RNModal>

      {/* Metamagic Selection Modal */}
      <RNModal visible={metamagicModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Choose Metamagic Options</Text>
              <TouchableOpacity onPress={() => setMetamagicModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 12 }}>
              Select up to {maxMetamagic} options (Level {sorcererLevel} Sorcerer). Selected: {selectedMetamagic.length}/{maxMetamagic}
            </Text>

            <ScrollView>
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
                        backgroundColor: isChosen ? theme.accent + "20" : theme.surfaceHighlight,
                        borderColor: isChosen ? theme.accent : theme.border,
                        opacity: isMaxReached ? 0.5 : 1,
                      },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ color: isChosen ? theme.accent : theme.text, fontWeight: "700" }}>
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
                      color={isChosen ? theme.accent : theme.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Card>
        </View>
      </RNModal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 620,
    height: "85%",
    padding: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
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
});
