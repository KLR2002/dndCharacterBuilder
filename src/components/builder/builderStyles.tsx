import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AbilityKey } from "../../types/character";
import { normalizeSkillName } from "../../rules/skills";

export const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export interface SkillPickerProps {
  label: string;
  choose: number;
  from: string[];
  chosen: string[];
  autoGranted: string[];
  onToggle: (skill: string) => void;
  theme: any;
}

export const SkillPicker: React.FC<SkillPickerProps> = ({
  label,
  choose,
  from,
  chosen,
  autoGranted,
  onToggle,
  theme,
}) => {
  const normFrom = from.map(normalizeSkillName);
  const normChosen = chosen.map(normalizeSkillName);
  const normAuto = autoGranted.map(normalizeSkillName);
  const pickerChosen = normChosen.filter((s) => normFrom.includes(s) && !normAuto.includes(s));
  const remaining = choose - pickerChosen.length;

  return (
    <View style={{ gap: 6 }}>
      <View style={pkStyles.headerRow}>
        <Text style={[pkStyles.headerLabel, { color: theme.text }]}>{label}</Text>
        <Text style={{ color: remaining === 0 ? theme.accent : theme.warning, fontSize: 12, fontWeight: "600" }}>
          Picked {pickerChosen.length} / {choose}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {normFrom.map((s) => {
          const granted = normAuto.includes(s);
          const isChosen = normChosen.includes(s);
          const canPick = !granted && !isChosen && remaining > 0;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => (!granted && (isChosen || canPick) ? onToggle(s) : undefined)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                pkStyles.chip,
                {
                  backgroundColor: isChosen ? theme.accentGlow : theme.surfaceHighlight,
                  borderColor: isChosen ? theme.accent : theme.border,
                  opacity: !granted && !isChosen && !canPick ? 0.4 : 1,
                },
              ]}
            >
              {granted && <Ionicons name="lock-closed" size={10} color={theme.textMuted} style={{ marginRight: 3 }} />}
              <Text style={{ color: granted ? theme.textMuted : isChosen ? theme.accent : theme.textSecondary, fontSize: 12, fontWeight: isChosen ? "700" : "500" }}>
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export interface RuleChoicePickerProps {
  label: string;
  choose: number;
  from: string[];
  chosen: string[];
  autoGranted?: string[];
  onToggle: (item: string) => void;
  onClear?: () => void;
  /** A short tag shown on each picked option, for example "Expertise". */
  chipTag?: string;
  theme: any;
}

export const RuleChoicePicker: React.FC<RuleChoicePickerProps> = ({
  label,
  choose,
  from,
  chosen,
  autoGranted = [],
  onToggle,
  onClear,
  chipTag,
  theme,
}) => {
  const normFrom = from;
  const pickerChosen = chosen.filter((s) => normFrom.includes(s) && !autoGranted.includes(s));
  const remaining = choose - pickerChosen.length;

  return (
    <View style={{ gap: 6 }}>
      <View style={pkStyles.headerRow}>
        <Text style={[pkStyles.headerLabel, { color: theme.text }]}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {onClear && pickerChosen.length > 0 && (
            <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: theme.textMuted, fontSize: 11, textDecorationLine: "underline" }}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
          <Text style={{ color: remaining === 0 ? theme.accent : theme.warning, fontSize: 12, fontWeight: "600" }}>
            Picked {pickerChosen.length} / {choose}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {normFrom.map((item) => {
          const granted = autoGranted.includes(item);
          const isChosen = chosen.includes(item);
          const canPick = !granted && !isChosen && (remaining > 0 || choose === 1);
          return (
            <TouchableOpacity
              key={item}
              onPress={() => (!granted && (isChosen || canPick) ? onToggle(item) : undefined)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                pkStyles.chip,
                {
                  backgroundColor: isChosen ? theme.accentGlow : theme.surfaceHighlight,
                  borderColor: isChosen ? theme.accent : theme.border,
                  opacity: !granted && !isChosen && !canPick ? 0.4 : 1,
                },
              ]}
            >
              {granted && <Ionicons name="lock-closed" size={10} color={theme.textMuted} style={{ marginRight: 3 }} />}
              <Text
                style={{
                  color: granted ? theme.textMuted : isChosen ? theme.accent : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: isChosen ? "700" : "500",
                }}
              >
                {item}
              </Text>
              {isChosen && chipTag && (
                <Text style={{ color: theme.accent, fontSize: 10, fontWeight: "700", marginLeft: 5 }}>{chipTag}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const pkStyles = StyleSheet.create({
  // A picker header: the label wraps inside the row, and the counter moves beneath it when there is no room.
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  headerLabel: {
    flexShrink: 1,
    maxWidth: "100%",
    fontWeight: "700",
    fontSize: 13,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 36,
  },
});

export const builderStyles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  tabsScroll: { borderRadius: 10, borderWidth: 1 },
  tabsContent: { flexDirection: "row", gap: 2, padding: 4 },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    minHeight: 44,
  },
  tabText: { fontSize: 13, fontWeight: "700" },

  section: { gap: 14 },
  banner: { padding: 10, borderRadius: 8, alignItems: "center" },

  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  methodText: { fontSize: 11 },

  poolChip: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  scoresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scoreCard: {
    width: "48%",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  scoreCardCompact: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  scoreCardLabel: {
    flex: 1,
  },
  abilityLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  abilityMod: { fontSize: 26, fontWeight: "800", marginVertical: 2 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperBtn: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  baseNum: { fontSize: 18, fontWeight: "700", minWidth: 26, textAlign: "center" },
  scoreInput: { width: 60, height: 44, borderRadius: 8, borderWidth: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  saSlot: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  saX: { padding: 2 },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  bannerTitle: { fontSize: 16, fontWeight: "700" },
  heading: { fontSize: 14, fontWeight: "700" },
  itemTitle: { fontSize: 15, fontWeight: "700" },

  subracesBox: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", gap: 6 },
  subLabel: { fontSize: 12, fontWeight: "600" },
  subraceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },

  lineageChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, minHeight: 40, justifyContent: "center" },
  choiceChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, minHeight: 40, justifyContent: "center" },
  optionChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, minHeight: 40, justifyContent: "center", alignItems: "center" },

  classRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 8, borderWidth: 1 },
  className: { fontSize: 16, fontWeight: "700" },
  levelNum: { fontSize: 18, fontWeight: "800", minWidth: 28, textAlign: "center" },

  subclassChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, minHeight: 40, justifyContent: "center" },
  input: { height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  modeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
});
