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
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { findSpell, getSpells } from "../../services/dataService";
import { calculateMulticlassSpellSlots, formatModifier } from "../../services/dndRules";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { currentCompendium } from "../../services/compendium";
import {
  isSpellAvailableForClass,
  profileSpellContext,
  type ClassSpellProfile,
} from "../../rules/spellcasting";
import {
  getInnateSpellProfile,
  type InnateSpellProfile,
  type InnateSpellEntry,
} from "../../rules/innateMagic";
import {
  getSpellSlotLedger,
  toggleSpellSlot,
  togglePactSlot as togglePactSlotRule,
  spendSorceryPoints,
  toggleMysticArcanumCast as toggleMysticArcanumCastRule,
  toggleInnateSpellUse as toggleInnateSpellUseRule,
  inscribeRitual as inscribeRitualRule,
  removeInscribedRitual as removeInscribedRitualRule,
  swapSubclassSpell,
  resetSubclassSpellSwap,
  isPrepared as isSpellPrepared,
  togglePrepared as togglePreparedRule,
  learnSpell as learnSpellRule,
  forgetSpell as forgetSpellRule,
  countPrepared,
} from "../../rules/characterSpells";
import {
  isSubclassSpellReplaceable,
  getSubclassAllowedSwapSchools,
  getEligibleSubclassSpellSwaps,
} from "../../rules/subclassSpells";
import {
  getAtWillInvocationSpells,
  getMaxRitualBookLevel,
  getMysticArcanumTiers,
  hasInvocation,
  isSpellEligibleForRitualBook,
} from "../../rules/ruleChoices";
import { effectiveScores } from "../../rules/abilities";
import { proficiencyBonus, totalLevel } from "../../rules/proficiencies";
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

function getSubclassPreparedBadgeLabel(className: string): string {
  switch (className) {
    case "Cleric":
      return "Domain Spell";
    case "Druid":
      return "Circle Spell";
    case "Paladin":
      return "Oath Spell";
    case "Artificer":
      return "Specialist Spell";
    case "Monk":
      return "Ki Spell";
    default:
      return "Always Prepared";
  }
}

function getSubclassPreparedCounterSuffix(className: string): string {
  switch (className) {
    case "Cleric":
      return "domain";
    case "Druid":
      return "circle";
    case "Paladin":
      return "oath";
    case "Artificer":
      return "specialist";
    case "Monk":
      return "ki";
    default:
      return "always prepared";
  }
}

export const SpellsTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

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
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapSearchQuery, setSwapSearchQuery] = useState("");
  const [swapTargetSpell, setSwapTargetSpell] = useState<{
    originalName: string;
    currentName: string;
    spell: SpellData;
  } | null>(null);
  const [pickerSchoolFilter, setPickerSchoolFilter] = useState<string | null>(null);
  const [inscribeModalVisible, setInscribeModalVisible] = useState(false);
  const [inscribeSearchQuery, setInscribeSearchQuery] = useState("");
  const [inscribeLevelFilter, setInscribeLevelFilter] = useState<number | null>(null);

  // Unified Character Evaluation pass
  const evaluated = useMemo(() => {
    if (!currentCharacter) return null;
    return evaluateCharacter(currentCharacter, { compendium: currentCompendium(), activeBooks });
  }, [currentCharacter, activeBooks]);

  // Spell slot ledger from pure domain engine
  const spellLedger = useMemo(() => {
    return currentCharacter ? getSpellSlotLedger(currentCharacter, evaluated) : null;
  }, [currentCharacter, evaluated]);

  // 1. Multiclass Spell Profiles from evaluated model
  const spellProfiles = useMemo(() => {
    return evaluated?.spellProfiles ?? [];
  }, [evaluated]);

  const activeProfileIndex = useMemo(() => {
    if (spellProfiles.length === 0) return 0;
    return Math.min(selectedProfileIndex, spellProfiles.length - 1);
  }, [selectedProfileIndex, spellProfiles.length]);

  const activeProfile: ClassSpellProfile | null = useMemo(() => {
    return spellProfiles[activeProfileIndex] ?? null;
  }, [spellProfiles, activeProfileIndex]);

  const isEldritchKnight = useMemo(() => {
    if (!activeProfile) return false;
    const cls = activeProfile.className.toLowerCase();
    const sub = (activeProfile.subclass || "").toLowerCase();
    return cls === "eldritch knight" || (cls === "fighter" && sub.includes("eldritch knight"));
  }, [activeProfile]);

  const isArcaneTrickster = useMemo(() => {
    if (!activeProfile) return false;
    const cls = activeProfile.className.toLowerCase();
    const sub = (activeProfile.subclass || "").toLowerCase();
    return cls === "arcane trickster" || (cls === "rogue" && sub.includes("arcane trickster"));
  }, [activeProfile]);

  // 2. Warlock Pact Slots from evaluated model
  const warlockPactSlots = useMemo(() => {
    return evaluated?.pactMagic ?? null;
  }, [evaluated]);

  // 3. Standard Multiclass Spell Slots
  const multiclassSlotsResult = useMemo(() => {
    return currentCharacter ? calculateMulticlassSpellSlots(currentCharacter) : { slots: [] as number[] };
  }, [currentCharacter]);

  // 4. Innate & Racial Spells profile
  const innateProfile: InnateSpellProfile | null = useMemo(() => {
    return currentCharacter ? getInnateSpellProfile(currentCharacter) : null;
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
      {
        name: string;
        source: string;
        ownerKey: string;
        className?: string;
        details?: SpellData;
        isAlwaysPrepared?: boolean;
        isSubclassGrant?: boolean;
        isReplaced?: boolean;
        originalName?: string;
        isAtWillInvocation?: boolean;
        invocationName?: string;
      }[]
    > = {};
    for (let i = 0; i <= 9; i++) map[i] = [];

    if (!activeProfile) return map;

    const alwaysPrepMap = new Map<string, SpellData>();
    for (const s of activeProfile.alwaysPreparedSpells || []) {
      alwaysPrepMap.set(s.name.toLowerCase(), s);
    }

    const seenNames = new Set<string>();

    for (const item of activeKnownSpells) {
      const details = findSpell(item.name, item.source);
      const lvl = details?.level ?? 0;
      const isAlwaysPrep = alwaysPrepMap.has(item.name.toLowerCase());
      seenNames.add(item.name.toLowerCase());
      if (map[lvl]) {
        map[lvl].push({ ...item, details, isAlwaysPrepared: isAlwaysPrep });
      }
    }

    const ownerKey = activeProfile.ownerKey;
    for (const spell of activeProfile.alwaysPreparedSpells || []) {
      const norm = spell.name.toLowerCase();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        const lvl = spell.level ?? 0;
        if (map[lvl]) {
          map[lvl].push({
            name: spell.name,
            source: spell.source,
            ownerKey,
            className: activeProfile.className,
            details: spell,
            isAlwaysPrepared: true,
          });
        }
      }
    }

    for (const spell of activeProfile.subclassKnownSpells || []) {
      const norm = spell.name.toLowerCase();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        const lvl = spell.level ?? 0;
        if (map[lvl]) {
          map[lvl].push({
            name: spell.name,
            source: spell.source,
            ownerKey,
            className: activeProfile.className,
            details: spell,
            isSubclassGrant: true,
            isReplaced: spell.isReplaced,
            originalName: spell.originalName,
          });
        }
      }
    }

    // Include chosen at-will invocation spells in cantrip/at-will list
    const atWillInvocations = currentCharacter ? getAtWillInvocationSpells(currentCharacter) : [];
    const isWarlockOrPrimary =
      activeProfile.className === "Warlock" ||
      (!spellProfiles.some((p) => p.className === "Warlock") && activeProfileIndex === 0);

    if (isWarlockOrPrimary && atWillInvocations.length > 0) {
      for (const { invocationName, spellName } of atWillInvocations) {
        const norm = spellName.toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          const details = findSpell(spellName);
          map[0].push({
            name: spellName,
            source: details?.source || "PHB",
            ownerKey: `${activeProfile.className}__Invocation`,
            className: activeProfile.className,
            details,
            isAtWillInvocation: true,
            invocationName,
          });
        }
      }
    }

    for (let i = 0; i <= 9; i++) {
      map[i].sort((a, b) => a.name.localeCompare(b.name));
    }

    return map;
  }, [activeKnownSpells, activeProfile, currentCharacter, activeProfileIndex, spellProfiles]);

  // Prepared non-cantrip spells count for the active profile (excluding always-prepared spells)
  const preparedCount = useMemo(() => {
    if (!activeProfile || !currentCharacter) return 0;
    return countPrepared(currentCharacter, activeProfile, currentCompendium());
  }, [activeProfile, currentCharacter]);

  const alwaysPreparedCount = useMemo(() => {
    if (!activeProfile || !activeProfile.alwaysPreparedSpells) return 0;
    return activeProfile.alwaysPreparedSpells.filter((s) => s.level > 0).length;
  }, [activeProfile]);

  const hasAgonizingBlast = useMemo(() => {
    return currentCharacter ? hasInvocation(currentCharacter, "Agonizing Blast") : false;
  }, [currentCharacter]);

  const chaModifier = useMemo(() => {
    if (!currentCharacter) return 0;
    return effectiveScores(currentCharacter).modifiers.cha;
  }, [currentCharacter]);

  const warlockClass = useMemo(() => {
    return (currentCharacter?.classes || []).find((c) => c.className.toLowerCase() === "warlock");
  }, [currentCharacter]);
  const warlockLevel = warlockClass ? warlockClass.level : 0;
  const hasAncientSecrets = useMemo(() => {
    return currentCharacter ? hasInvocation(currentCharacter, "Book of Ancient Secrets") : false;
  }, [currentCharacter]);
  const maxRitualLevel = getMaxRitualBookLevel(warlockLevel);

  const eligibleInscribeSpells = useMemo(() => {
    if (!hasAncientSecrets || warlockLevel < 2) return [];
    const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
    const allSpellsList = getSpells(upperBooks);
    const currentBookNames = new Set(
      (currentCharacter?.ritualBook || []).map((r) => r.name.toLowerCase().trim())
    );

    return allSpellsList
      .filter((s) => isSpellEligibleForRitualBook(s, warlockLevel, activeBooks))
      .filter((s) => !currentBookNames.has(s.name.toLowerCase().trim()))
      .filter((s) => {
        if (inscribeLevelFilter !== null && s.level !== inscribeLevelFilter) return false;
        if (inscribeSearchQuery.trim()) {
          const q = inscribeSearchQuery.toLowerCase().trim();
          return s.name.toLowerCase().includes(q) || Boolean(s.school?.toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [
    hasAncientSecrets,
    warlockLevel,
    activeBooks,
    currentCharacter?.ritualBook,
    inscribeLevelFilter,
    inscribeSearchQuery,
  ]);

  const mysticArcanumTiers = useMemo(() => {
    return currentCharacter ? getMysticArcanumTiers(currentCharacter) : [];
  }, [currentCharacter]);

  // Filtered spells for the Add Spells picker modal
  const filteredPickerSpells = useMemo(() => {
    if (!activeProfile) return [];
    const targetCastingClass =
      activeProfile.className === "Fighter" || activeProfile.className === "Rogue"
        ? "Wizard"
        : activeProfile.className;

    return allSpells.filter((s) => {
      const matchesClass = isSpellAvailableForClass(
        s,
        targetCastingClass,
        activeBooks,
        profileSpellContext(activeProfile)
      );
      const matchesMaxLevel = s.level <= activeProfile.maxSpellLevel;
      const matchesLevel =
        selectedSpellLevel === null ||
        (selectedSpellLevel <= activeProfile.maxSpellLevel && s.level === selectedSpellLevel);
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Boolean(s.school?.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesSchoolFilter = true;
      if (pickerSchoolFilter === "restricted") {
        if (isEldritchKnight) {
          matchesSchoolFilter = s.level === 0 || s.school === "Abjuration" || s.school === "Evocation";
        } else if (isArcaneTrickster) {
          matchesSchoolFilter = s.level === 0 || s.school === "Enchantment" || s.school === "Illusion";
        }
      }

      return matchesClass && matchesMaxLevel && matchesLevel && matchesSearch && matchesSchoolFilter;
    });
  }, [
    allSpells,
    searchQuery,
    selectedSpellLevel,
    activeProfile,
    activeBooks,
    pickerSchoolFilter,
    isEldritchKnight,
    isArcaneTrickster,
  ]);

  const swapAllowedSchools = useMemo(() => {
    if (!activeProfile?.subclass) return [];
    return getSubclassAllowedSwapSchools(activeProfile.subclass);
  }, [activeProfile]);

  const eligibleSwaps = useMemo(() => {
    if (!swapTargetSpell || !activeProfile?.subclass) return [];
    return getEligibleSubclassSpellSwaps(
      activeProfile.subclass,
      swapTargetSpell.spell,
      activeBooks
    );
  }, [swapTargetSpell, activeProfile, activeBooks]);

  const filteredEligibleSwaps = useMemo(() => {
    if (!swapSearchQuery) return eligibleSwaps;
    const q = swapSearchQuery.toLowerCase();
    return eligibleSwaps.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        Boolean(s.school?.toLowerCase().includes(q))
    );
  }, [eligibleSwaps, swapSearchQuery]);

  // Helpers and event handlers
  const showSpellDetail = (item: { name: string; source: string; details?: SpellData }) => {
    const s = item.details || findSpell(item.name, item.source);
    if (!s) return;

    const isEb = s.name.toLowerCase() === "eldritch blast";
    const ebSubtitle = isEb && hasAgonizingBlast ? ` • 1d10 + ${chaModifier} force [Agonizing Blast: +${chaModifier} dmg]` : "";
    const ebDamageLine = isEb && hasAgonizingBlast ? `• Damage: 1d10 + ${chaModifier} force [Agonizing Blast: +${chaModifier} dmg]\n` : "";

    const formattedDesc =
      `${s.level === 0 ? "Cantrip" : `${s.level}th-level`} ${s.school || ""}\n\n` +
      `• Casting Time: ${s.castingTime || "1 action"}\n` +
      `• Range: ${s.range || "Self"}\n` +
      `• Components: ${s.componentsString || "V, S"}\n` +
      `• Duration: ${s.duration || "Instantaneous"}\n` +
      ebDamageLine +
      `\n${s.description || "No description available."}`;

    setDetailModal({
      visible: true,
      title: s.name,
      subtitle: `${s.level === 0 ? "Cantrip" : `Level ${s.level}`} (${s.source})${ebSubtitle}`,
      content: formattedDesc,
    });
  };

  const toggleInnateSpellUse = (spell: InnateSpellEntry) => {
    if (!currentCharacter) return;
    updateCharacter(currentCharacter.id, toggleInnateSpellUseRule(currentCharacter, spell));
  };

  const renderInnateCard = () => {
    if (!innateProfile || innateProfile.spells.length === 0 || !currentCharacter) return null;

    const sign = innateProfile.spellAttackBonus >= 0 ? "+" : "";

    return (
      <Card style={[styles.innateCard, { borderColor: theme.accent, backgroundColor: theme.surface }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.accent }]}>
              {innateProfile.title.toUpperCase()}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
              Innate racial magic from your ancestry (Long Rest reset)
            </Text>
          </View>
          <Badge
            label={`${innateProfile.ability.toUpperCase()} (DC ${innateProfile.spellSaveDc} / ${sign}${innateProfile.spellAttackBonus})`}
            variant="accent"
            size="sm"
          />
        </View>

        {/* Racial Spellcasting Stats */}
        <View style={[styles.innateStatsRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <View style={styles.innateStatCol}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>ABILITY</Text>
            <Text style={[styles.innateStatVal, { color: theme.accent }]}>
              {innateProfile.ability.toUpperCase()}
            </Text>
          </View>
          <View style={styles.innateStatCol}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>SAVE DC</Text>
            <Text style={[styles.innateStatVal, { color: theme.text }]}>
              {innateProfile.spellSaveDc}
            </Text>
          </View>
          <View style={styles.innateStatCol}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>ATTACK BONUS</Text>
            <Text style={[styles.innateStatVal, { color: theme.text }]}>
              {formatModifier(innateProfile.spellAttackBonus)}
            </Text>
          </View>
        </View>

        {/* Spells List */}
        <View style={{ marginTop: 8, gap: 6 }}>
          {innateProfile.spells.map((spell) => {
            const counter = spell.resourceCounterId
              ? currentCharacter.resourceCounters?.[spell.resourceCounterId]
              : undefined;
            const remaining = counter !== undefined ? counter.current : 1;
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
                        },
                      ]}>
                      {spell.name}
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
                    {spell.name.toLowerCase() === "eldritch blast" && hasAgonizingBlast && (
                      <Badge
                        label={`[Agonizing Blast: +${chaModifier} dmg]`}
                        variant="accent"
                        size="sm"
                      />
                    )}
                    <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {spell.castingTime} • Min Level {spell.minCharacterLevel}
                    {spell.name.toLowerCase() === "eldritch blast" && hasAgonizingBlast
                      ? ` • 1d10 + ${chaModifier} force`
                      : ""}
                  </Text>
                </TouchableOpacity>

                {spell.isCantrip ? (
                  <Badge label="At Will" variant="secondary" size="sm" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {isUsed ? "0/1 (Used)" : "1/1"}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleInnateSpellUse(spell)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.slotCheckbox,
                        {
                          borderColor: theme.accent,
                          backgroundColor: isUsed ? theme.accent : "transparent",
                        },
                      ]}>
                      {isUsed && <Ionicons name="checkmark" size={14} color="#fff" />}
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

  const atWillInvocations = useMemo(() => {
    return currentCharacter ? getAtWillInvocationSpells(currentCharacter) : [];
  }, [currentCharacter]);

  const renderAtWillInvocationsCard = () => {
    if (atWillInvocations.length === 0) return null;
    return (
      <Card style={[styles.innateCard, { borderColor: theme.accent, backgroundColor: theme.surface, marginBottom: 16 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.accent }]}>
              AT-WILL MAGIC (ELDRITCH INVOCATIONS)
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
              Cast at will without expending spell slots
            </Text>
          </View>
          <Badge label="At Will" variant="accent" size="sm" />
        </View>
        <View style={{ marginTop: 8, gap: 6 }}>
          {atWillInvocations.map(({ invocationName, spellName }) => {
            const spell = findSpell(spellName);
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
                    {spellName.toLowerCase() === "eldritch blast" && hasAgonizingBlast && (
                      <Badge
                        label={`[Agonizing Blast: +${chaModifier} dmg]`}
                        variant="accent"
                        size="sm"
                      />
                    )}
                    <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {spell?.castingTime || "1 action"} • {invocationName}
                    {spellName.toLowerCase() === "eldritch blast" && hasAgonizingBlast
                      ? ` • 1d10 + ${chaModifier} force`
                      : ""}
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

  if (spellProfiles.length === 0) {
    if ((innateProfile && innateProfile.spells.length > 0) || atWillInvocations.length > 0) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {renderInnateCard()}
          {renderAtWillInvocationsCard()}
          <Card style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
            <Ionicons name="sparkles-outline" size={32} color={theme.textMuted} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: theme.text, fontSize: 16 }]}>No Class Spellcasting</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary, fontSize: 13 }]}>
              This character does not currently have levels in any spellcasting classes. Class spell slots, prepared spells, and spellbook management will appear here if you take levels in a spellcasting class.
            </Text>
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

  const pactSlotsUsed = spellLedger?.pactSlots?.used ?? 0;
  const remainingPactSlots = spellLedger?.pactSlots?.remaining ?? 0;

  // Standard spell slots
  const spellSlots = multiclassSlotsResult.slots;
  const hasStandardSlots = spellLedger?.hasStandardSlots ?? false;

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
    const next = togglePreparedRule(currentCharacter, currentProfile, item, currentCompendium(), activeBooks);
    if (next !== currentCharacter) updateCharacter(currentCharacter.id, next);
  };

  const addSpellToCharacter = (name: string, source: string) => {
    const next = learnSpellRule(currentCharacter, currentProfile, { name, source }, currentCompendium(), activeBooks);
    if (next !== currentCharacter) updateCharacter(currentCharacter.id, next);
  };

  const removeSpellFromCharacter = (name: string, source: string, ownerKey?: string) => {
    const next = forgetSpellRule(currentCharacter, currentProfile, { name, source, ownerKey }, currentCompendium());
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Multiclass Profile Selector Tabs/Pills */}
      {spellProfiles.length > 1 && (
        <ScrollView
          horizontal={!isCompact}
          showsHorizontalScrollIndicator={false}
          style={styles.profileSelectorScroll}
          contentContainerStyle={[styles.profileSelectorContent, isCompact && { flexDirection: "row", flexWrap: "wrap" }]}>
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

      {/* Eldritch Knight Rules Guidance Banner */}
      {isEldritchKnight && (
        <Card style={{ borderColor: theme.accent, backgroundColor: theme.surfaceHighlight, gap: 4, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
            <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
              Eldritch Knight Spellcasting (PHB)
            </Text>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
            Most spells known must belong to the <Text style={{ fontWeight: "700", color: theme.text }}>Abjuration</Text> or <Text style={{ fontWeight: "700", color: theme.text }}>Evocation</Text> schools. Spells learned at 3rd, 8th, 14th, and 20th level can be from any school of magic.
          </Text>
        </Card>
      )}

      {/* Arcane Trickster Rules Guidance Banner */}
      {isArcaneTrickster && (
        <Card style={{ borderColor: theme.accent, backgroundColor: theme.surfaceHighlight, gap: 4, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
            <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
              Arcane Trickster Spellcasting (PHB)
            </Text>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
            Most spells known must belong to the <Text style={{ fontWeight: "700", color: theme.text }}>Enchantment</Text> or <Text style={{ fontWeight: "700", color: theme.text }}>Illusion</Text> schools. Spells learned at 3rd, 8th, 14th, and 20th level can be from any school of magic.
          </Text>
        </Card>
      )}

      {/* Monk Ki Spellcasting Guidance Banner */}
      {currentProfile.className === "Monk" && (
        <Card style={{ borderColor: theme.accent, backgroundColor: theme.surfaceHighlight, gap: 4, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="sparkles" size={18} color={theme.accent} />
            <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
              Monk Ki Spellcasting ({currentProfile.subclass || "Monastic Tradition"})
            </Text>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
            You cast spells by expending Ki points rather than traditional spell slots. Ki Save DC is 8 + PB + Wis mod ({currentProfile.spellSaveDc}). Ki points reset on a Short or Long Rest.
          </Text>
        </Card>
      )}

      {/* Prepared Casters Counter Card */}
      {currentProfile.preparedLimit !== undefined && (
        <Card style={[styles.preparedCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {currentProfile.className.toUpperCase()} PREPARED SPELLS
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                Spells prepared for the day (Level + {currentProfile.ability.toUpperCase()} mod)
              </Text>
            </View>
            <Badge
              label={
                alwaysPreparedCount > 0
                  ? `${preparedCount} / ${currentProfile.preparedLimit} prepared (+ ${alwaysPreparedCount} ${getSubclassPreparedCounterSuffix(currentProfile.className)})`
                  : `${preparedCount} / ${currentProfile.preparedLimit} Prepared`
              }
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

      {/* Mystic Arcanum (Warlock Level >= 11) */}
      {mysticArcanumTiers.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: "#9333ea" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[styles.sectionTitle, { color: "#9333ea" }]}>
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
            {mysticArcanumTiers.map((tier) => {
              const spell = tier.spellData || (tier.chosenSpellName ? findSpell(tier.chosenSpellName) : undefined);
              const isSpent = tier.isSpent;

              const warlockDc = currentProfile.className === "Warlock" ? currentProfile.spellSaveDc : (8 + proficiencyBonus(totalLevel(currentCharacter)) + chaModifier);
              const warlockAtk = currentProfile.className === "Warlock" ? currentProfile.spellAttackBonus : (proficiencyBonus(totalLevel(currentCharacter)) + chaModifier);

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
                          {spell?.castingTime || "1 action"} • {spell?.range || "Self"} • DC {warlockDc} • {formatModifier(warlockAtk)} Atk
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ color: theme.textMuted, fontSize: 12, fontStyle: "italic" }}>
                        No spell selected. Choose in the Builder tab.
                      </Text>
                    )}
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
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

      {/* Innate & Racial Spells (if ancestry has innate magic) */}
      {renderInnateCard()}

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
                {(currentCharacter?.ritualBook || []).length} inscribed rituals • Max level {maxRitualLevel} (half Warlock level rounded up)
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

          {(!currentCharacter?.ritualBook || currentCharacter.ritualBook.length === 0) ? (
            <Text style={{ color: theme.textMuted, fontSize: 12, fontStyle: "italic", paddingVertical: 4 }}>
              No rituals inscribed yet. Choose your 2 starting rituals in the builder or inscribe rituals found during adventures.
            </Text>
          ) : (
            <View style={{ gap: 4 }}>
              {currentCharacter.ritualBook.map((item, idx) => (
                <View
                  key={`ritual_${item.name}_${idx}`}
                  style={[
                    styles.spellRow,
                    {
                      borderBottomColor: theme.border,
                      borderBottomWidth: idx === currentCharacter.ritualBook!.length - 1 ? 0 : 1,
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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {currentProfile.className === "Monk"
              ? "MONK KI SPELLS"
              : `${currentProfile.className.toUpperCase()} SPELLBOOK & CANTRIPS`}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            {currentProfile.preparedLimit !== undefined
              ? `${preparedCount} / ${currentProfile.preparedLimit} prepared${
                  alwaysPreparedCount > 0
                    ? ` (+ ${alwaysPreparedCount} ${getSubclassPreparedCounterSuffix(currentProfile.className)})`
                    : ""
                }${
                  currentProfile.className.toLowerCase() === "wizard"
                    ? ` • ${activeKnownSpells.length} in spellbook`
                    : ""
                }`
              : currentProfile.className === "Monk"
              ? `${activeKnownSpells.length + (activeProfile?.subclassKnownSpells?.length || 0)} Ki spells available`
              : `${activeKnownSpells.length + (activeProfile?.subclassKnownSpells?.length || 0)} spells known`}
          </Text>
        </View>
        {currentProfile.className !== "Monk" && (
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
      {LEVEL_NAMES.map((levelTitle, lvlIdx) => {
        const spellsAtLevel = groupedSpells[lvlIdx] || [];
        if (spellsAtLevel.length === 0) return null;

        const displayTitle =
          lvlIdx === 0 && spellsAtLevel.some((s) => s.isAtWillInvocation)
            ? "CANTRIPS & AT-WILL"
            : levelTitle.toUpperCase();

        return (
          <View key={`level_group_${lvlIdx}`} style={{ marginBottom: 14 }}>
            <Text style={[styles.levelHeader, { color: theme.textSecondary }]}>
              {displayTitle} ({spellsAtLevel.length})
            </Text>

            <Card style={{ padding: 4 }}>
              {spellsAtLevel.map((item, idx) => {
                const isPrepared = isSpellPrepared(currentCharacter, currentProfile, item);

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
                    {lvlIdx > 0 && currentProfile.className !== "Monk" ? (
                      item.isAlwaysPrepared ? (
                        <View style={styles.prepToggle}>
                          <Ionicons
                            name="lock-closed"
                            size={16}
                            color={theme.accent}
                          />
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => togglePrepared(item)}
                          style={styles.prepToggle}>
                          <Ionicons
                            name={isPrepared ? "radio-button-on" : "radio-button-off"}
                            size={18}
                            color={isPrepared ? theme.accent : theme.textMuted}
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
                        {item.isAlwaysPrepared && (
                          <Badge
                            label={getSubclassPreparedBadgeLabel(currentProfile.className)}
                            variant="secondary"
                            size="sm"
                          />
                        )}
                        {item.isSubclassGrant && !item.isAlwaysPrepared && (
                          <Badge
                            label={
                              item.details?.level === 0
                                ? "Subclass Cantrip"
                                : currentProfile.className === "Monk"
                                ? "Ki Spell"
                                : "Subclass Grant"
                            }
                            variant="secondary"
                            size="sm"
                          />
                        )}
                        {item.ownerKey === "Warlock__Tome" && (
                          <Badge
                            label="[Pact of the Tome]"
                            variant="accent"
                            size="sm"
                          />
                        )}
                        {item.details?.kiCost !== undefined && item.details.kiCost > 0 && (
                          <Badge
                            label={`${item.details.kiCost} Ki`}
                            variant="accent"
                            size="sm"
                          />
                        )}
                        {item.isReplaced && item.originalName && (
                          <Badge
                            label={`Replaced: ${item.originalName}`}
                            variant="accent"
                            size="sm"
                          />
                        )}
                        {isEldritchKnight && item.details && item.details.level > 0 && (
                          <Badge
                            label={
                              item.details.school === "Abjuration" || item.details.school === "Evocation"
                                ? "Abjuration/Evocation"
                                : "Unrestricted Slot"
                            }
                            variant={
                              item.details.school === "Abjuration" || item.details.school === "Evocation"
                                ? "accent"
                                : "secondary"
                            }
                            size="sm"
                          />
                        )}
                        {isArcaneTrickster && item.details && item.details.level > 0 && (
                          <Badge
                            label={
                              item.details.school === "Enchantment" || item.details.school === "Illusion"
                                ? "Enchantment/Illusion"
                                : "Unrestricted Slot"
                            }
                            variant={
                              item.details.school === "Enchantment" || item.details.school === "Illusion"
                                ? "accent"
                                : "secondary"
                            }
                            size="sm"
                          />
                        )}
                        {item.isAtWillInvocation && (
                          <Badge
                            label="At Will - Invocation"
                            variant="accent"
                            size="sm"
                          />
                        )}
                        {item.name.toLowerCase() === "eldritch blast" && hasAgonizingBlast && (
                          <Badge
                            label={`[Agonizing Blast: +${chaModifier} dmg]`}
                            variant="accent"
                            size="sm"
                          />
                        )}
                      </View>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                        {item.details?.school || ""} • {item.details?.castingTime || "1 action"} • {item.source}
                        {item.name.toLowerCase() === "eldritch blast" && hasAgonizingBlast
                          ? ` • 1d10 + ${chaModifier} force`
                          : ""}
                      </Text>
                    </TouchableOpacity>

                    {/* Swap Actions for Subclass-Granted Known Spells */}
                    {item.isSubclassGrant &&
                      !item.isAlwaysPrepared &&
                      (item.details?.level ?? 0) > 0 &&
                      isSubclassSpellReplaceable(
                        currentProfile.className,
                        currentProfile.subclass,
                        item.details?.level
                      ) && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {item.isReplaced && (
                            <Button
                              title="Reset to Default"
                              size="sm"
                              variant="ghost"
                              onPress={() => handleResetSpellSwap(item.originalName || item.name)}
                            />
                          )}
                          <Button
                            title="Swap"
                            icon="swap-horizontal-outline"
                            size="sm"
                            variant="outline"
                            onPress={() => openSwapModal(item)}
                          />
                        </View>
                      )}

                    {/* Remove Spell */}
                    {!item.isAlwaysPrepared &&
                      !item.isSubclassGrant &&
                      !item.isAtWillInvocation &&
                      item.ownerKey !== "Warlock__Tome" && (
                      <TouchableOpacity
                        onPress={() => removeSpellFromCharacter(item.name, item.source, item.ownerKey)}
                        style={{ padding: 6 }}>
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

            {/* Third-Casters Guidance & Quick School Filters */}
            {(isEldritchKnight || isArcaneTrickster) && (
              <View style={{ backgroundColor: theme.surfaceHighlight, padding: 8, borderRadius: 6, marginVertical: 6, borderLeftWidth: 3, borderLeftColor: theme.accent }}>
                <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "700" }}>
                  {isEldritchKnight ? "Eldritch Knight Spell Restrictions" : "Arcane Trickster Spell Restrictions"}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
                  {isEldritchKnight
                    ? "Most spells known must be Abjuration or Evocation. Spells learned at levels 3, 8, 14, and 20 can be from any school."
                    : "Most spells known must be Enchantment or Illusion. Spells learned at levels 3, 8, 14, and 20 can be from any school."}
                </Text>
              </View>
            )}

            {isEldritchKnight && (
              <View style={{ flexDirection: "row", gap: 6, marginVertical: 4 }}>
                <TouchableOpacity
                  onPress={() => setPickerSchoolFilter(null)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: pickerSchoolFilter === null ? theme.accent : theme.surfaceHighlight,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>All Schools</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPickerSchoolFilter("restricted")}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: pickerSchoolFilter === "restricted" ? theme.accent : theme.surfaceHighlight,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Abjuration &amp; Evocation</Text>
                </TouchableOpacity>
              </View>
            )}

            {isArcaneTrickster && (
              <View style={{ flexDirection: "row", gap: 6, marginVertical: 4 }}>
                <TouchableOpacity
                  onPress={() => setPickerSchoolFilter(null)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: pickerSchoolFilter === null ? theme.accent : theme.surfaceHighlight,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>All Schools</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPickerSchoolFilter("restricted")}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: pickerSchoolFilter === "restricted" ? theme.accent : theme.surfaceHighlight,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Enchantment &amp; Illusion</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Level Filter Pills up to activeProfile.maxSpellLevel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginVertical: 8 }}
              contentContainerStyle={{ alignItems: "center" }}>
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
                const alreadyHas = activeKnownSpells.some(
                  (k) => k.name === s.name && k.source === s.source && k.ownerKey === currentProfile.ownerKey
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{s.name}</Text>
                        {isEldritchKnight && s.level > 0 && (
                          <Badge
                            label={
                              s.school === "Abjuration" || s.school === "Evocation"
                                ? "In-School"
                                : "Unrestricted Only"
                            }
                            variant={
                              s.school === "Abjuration" || s.school === "Evocation"
                                ? "accent"
                                : "secondary"
                            }
                            size="sm"
                          />
                        )}
                        {isArcaneTrickster && s.level > 0 && (
                          <Badge
                            label={
                              s.school === "Enchantment" || s.school === "Illusion"
                                ? "In-School"
                                : "Unrestricted Only"
                            }
                            variant={
                              s.school === "Enchantment" || s.school === "Illusion"
                                ? "accent"
                                : "secondary"
                            }
                            size="sm"
                          />
                        )}
                      </View>
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

      {/* Subclass Spell Swap Modal */}
      <RNModal visible={swapModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={[styles.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Swap Subclass Spell
                </Text>
                {swapTargetSpell && (
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                    Replacing: {swapTargetSpell.originalName} ({formatOrdinal(swapTargetSpell.spell.level || 1)} Level)
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setSwapModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

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

            <ScrollView style={{ flex: 1, marginTop: 4 }}>
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
                      title="Select"
                      size="sm"
                      variant="primary"
                      onPress={() => handleSelectSwap(s)}
                    />
                  </View>
                ))
              )}
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

      {/* Inscribe Ritual Modal */}
      <RNModal visible={inscribeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={[styles.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Inscribe Ritual
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
                  Max level {maxRitualLevel} • Cost: 50 gp &amp; 2 hrs per spell level
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInscribeModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

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
                    backgroundColor: inscribeLevelFilter === null ? theme.accent : theme.surfaceHighlight,
                  },
                ]}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>All Levels (1-{maxRitualLevel})</Text>
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
                        backgroundColor: inscribeLevelFilter === lvl ? theme.accent : theme.surfaceHighlight,
                      },
                    ]}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Level {lvl}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView style={{ flex: 1 }}>
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
