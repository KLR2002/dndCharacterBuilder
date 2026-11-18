import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../../context/ThemeContext";
import type { SpellData } from "../../types/dnd5e";
import { SearchBar } from "../ui/SearchBar";

export const LEVEL_NAMES = [
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

export interface SpellLearnListProps {
  spells: SpellData[];
  /** The schools a third caster's spells are restricted to, outside cantrips. Empty when unrestricted. */
  restrictedSchools: string[];
  selectedNames: string[];
  /** Rows shown selected and not tappable: the spells the owner already knows. */
  lockedNames?: string[];
  /** Action text on each row: `idle` before the spell is picked, `selected` after. Without it, a checkmark. */
  actionLabels?: { idle: string; selected: string };
  searchPlaceholder: string;
  rowDetail?: (spell: SpellData) => string;
  onToggle: (spell: SpellData) => void;
  onViewDetail?: (spell: SpellData) => void;
}

const levelDetail = (spell: SpellData) => (spell.level === 0 ? "Cantrip" : `Lvl ${spell.level}`);

/** The searchable spell list with a level filter and, for third casters, the restricted-schools toggle. */
export function SpellLearnList({
  spells,
  restrictedSchools,
  selectedNames,
  lockedNames = [],
  actionLabels,
  searchPlaceholder,
  rowDetail = levelDetail,
  onToggle,
  onViewDetail,
}: SpellLearnListProps) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<number | null>(null);
  const [restricted, setRestricted] = useState(true);

  const maxLevel = useMemo(() => Math.max(0, ...spells.map((s) => s.level)), [spells]);
  const selected = useMemo(() => new Set(selectedNames.map((n) => n.toLowerCase())), [selectedNames]);
  const locked = useMemo(() => new Set(lockedNames.map((n) => n.toLowerCase())), [lockedNames]);

  const query = search.trim().toLowerCase();
  const restrictionOn = restricted && restrictedSchools.length > 0;
  const shown = spells.filter(
    (s) =>
      (level === null || s.level === level) &&
      (!restrictionOn || s.level === 0 || restrictedSchools.includes(s.school ?? "")) &&
      (!query || s.name.toLowerCase().includes(query) || (s.school ?? "").toLowerCase().includes(query)),
  );

  return (
    <View style={{ gap: 6 }}>
      <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder} />

      {restrictedSchools.length > 0 && (
        <View style={styles.pillRow}>
          <Pill label="All Schools" active={!restricted} onPress={() => setRestricted(false)} />
          <Pill label={restrictedSchools.join(" & ")} active={restricted} onPress={() => setRestricted(true)} />
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: "center" }}>
        <Pill label="All Levels" active={level === null} onPress={() => setLevel(null)} />
        {LEVEL_NAMES.slice(0, maxLevel + 1).map((name, idx) => (
          <Pill key={`filter_lvl_${idx}`} label={name} active={level === idx} onPress={() => setLevel(idx)} />
        ))}
      </ScrollView>

      {shown.map((spell) => {
        const name = spell.name.toLowerCase();
        return (
          <SpellRow
            key={`${spell.name}_${spell.source}`}
            spell={spell}
            detail={rowDetail(spell)}
            selected={selected.has(name) || locked.has(name)}
            locked={locked.has(name)}
            actionLabels={actionLabels}
            onToggle={onToggle}
            onViewDetail={onViewDetail}
          />
        );
      })}
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.pill,
        {
          backgroundColor: active ? theme.accentGlow : theme.surfaceHighlight,
          borderColor: active ? theme.accentHover : theme.border,
        },
      ]}
    >
      <Text style={{ color: active ? theme.text : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SpellRow({
  spell,
  detail,
  selected,
  locked,
  actionLabels,
  onToggle,
  onViewDetail,
}: {
  spell: SpellData;
  detail: string;
  selected: boolean;
  locked: boolean;
  actionLabels?: { idle: string; selected: string };
  onToggle: (spell: SpellData) => void;
  onViewDetail?: (spell: SpellData) => void;
}) {
  const { theme } = useAppTheme();
  const action = actionLabels ? (selected ? actionLabels.selected : actionLabels.idle) : null;
  return (
    <View
      style={[
        styles.row,
        {
          borderColor: selected ? theme.accentBorder : theme.border,
          backgroundColor: selected ? theme.accentGlow : theme.surface,
          opacity: locked ? 0.6 : 1,
        },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${actionLabels?.idle ?? "Learn"} ${spell.name}`}
        accessibilityState={{ disabled: locked, selected }}
        disabled={locked}
        onPress={() => onToggle(spell)}
        activeOpacity={0.7}
        style={styles.pressable}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: selected ? "700" : "500" }} numberOfLines={1}>
            {spell.name}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        {action !== null ? (
          <Text style={{ color: selected ? theme.textSecondary : theme.accentHover, fontSize: 13, fontWeight: "600" }}>{action}</Text>
        ) : selected ? (
          <Ionicons name="checkmark" size={16} color={theme.accentHover} />
        ) : null}
      </TouchableOpacity>
      {onViewDetail && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Details ${spell.name}`}
          onPress={() => onViewDetail(spell)}
          hitSlop={8}
        >
          <Ionicons name="information-circle-outline" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: "row", gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pressable: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
