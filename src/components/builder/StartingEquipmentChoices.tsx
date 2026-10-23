import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  StartingEquipmentAddress,
  StartingEquipmentCard,
  StartingEquipmentCardEntry,
  StartingEquipmentCardOption,
} from "../../rules/startingEquipment";
import { SearchBar } from "../ui/SearchBar";
import { pkStyles } from "./builderStyles";

type TypeEntry = Extract<StartingEquipmentCardEntry, { kind: "type" }>;

/** The name a generic type shows on screen, as the class's equipment text names it. */
const TYPE_LABELS: Record<string, string> = {
  weaponSimple: "Simple weapon",
  weaponMartial: "Martial weapon",
  weaponSimpleMelee: "Simple melee weapon",
  weaponMartialMelee: "Martial melee weapon",
  instrumentMusical: "Musical instrument",
  focusSpellcastingArcane: "Arcane focus",
  focusSpellcastingHoly: "Holy symbol",
  focusSpellcastingDruidic: "Druidic focus",
};

/** A pool longer than this gets a search field above its names. */
const SEARCH_THRESHOLD = 12;

const entryLabel = (entry: StartingEquipmentCardEntry): string => {
  if (entry.kind === "item") return entry.quantity > 1 ? `${entry.name} ×${entry.quantity}` : entry.name;
  if (entry.kind === "type") {
    const label = TYPE_LABELS[entry.equipmentType] ?? entry.equipmentType;
    return entry.quantity > 1 ? `${label} ×${entry.quantity}` : label;
  }
  return "Unknown item";
};

const optionLabel = (option: StartingEquipmentCardOption): string => option.entries.map(entryLabel).join(" + ");

export interface StartingEquipmentChoicesProps {
  card: StartingEquipmentCard;
  onPickOption: (slot: number, letter: string) => void;
  onPickItems: (address: StartingEquipmentAddress, names: string[]) => void;
  theme: any;
}

/** The equipment slots of the first class: a fixed slot lists its items, a choice slot takes one option. */
export const StartingEquipmentChoices: React.FC<StartingEquipmentChoicesProps> = ({ card, onPickOption, onPickItems, theme }) => (
  <View style={{ gap: 12 }}>
    {card.slots.map((slot) => {
      if (slot.kind === "unrecognised") {
        return (
          <Text key={slot.slot} style={{ color: theme.danger, fontSize: 12 }}>
            This slot cannot be read from the catalog.
          </Text>
        );
      }
      if (slot.kind === "fixed") {
        return (
          <View key={slot.slot} style={{ gap: 4 }}>
            {slot.entries.map((entry, i) =>
              entry.kind === "type" ? (
                <TypePicker key={i} entry={entry} onPick={(names) => onPickItems(entry.address, names)} theme={theme} />
              ) : (
                <Text key={i} style={{ color: theme.text, fontSize: 13, flexShrink: 1 }}>
                  {entryLabel(entry)}
                </Text>
              ),
            )}
          </View>
        );
      }
      return (
        <View key={slot.slot} style={{ gap: 6 }}>
          {slot.options.map((option) => (
            <View key={option.letter} style={{ gap: 4 }}>
              <TouchableOpacity
                accessibilityRole="radio"
                accessibilityState={{ checked: option.chosen }}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                onPress={() => onPickOption(slot.slot, option.letter)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 44,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  backgroundColor: option.chosen ? theme.accentGlow : theme.surface,
                  borderColor: option.chosen ? theme.accent : theme.border,
                }}
              >
                <Ionicons
                  name={option.chosen ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={option.chosen ? theme.accent : theme.textMuted}
                />
                <Text
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexShrink: 1,
                    color: option.chosen ? theme.accent : theme.textSecondary,
                    fontSize: 13,
                    fontWeight: option.chosen ? "700" : "500",
                  }}
                >
                  {optionLabel(option)}
                </Text>
              </TouchableOpacity>
              {option.chosen
                ? option.entries.map((entry, i) =>
                    entry.kind === "type" ? (
                      <View key={i} style={{ paddingLeft: 28 }}>
                        <TypePicker entry={entry} onPick={(names) => onPickItems(entry.address, names)} theme={theme} />
                      </View>
                    ) : null,
                  )
                : null}
            </View>
          ))}
        </View>
      );
    })}
  </View>
);

interface TypePickerProps {
  entry: TypeEntry;
  onPick: (names: string[]) => void;
  theme: any;
}

/**
 * One picker per quantity of a generic entry. The pickers fill in order: picker n is open to choose only once picker
 * n - 1 holds a name, so the picks stay a dense list. A picker opens an inline list of the names it offers.
 */
const TypePicker: React.FC<TypePickerProps> = ({ entry, onPick, theme }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const label = TYPE_LABELS[entry.equipmentType] ?? entry.equipmentType;
  const query = search.trim().toLowerCase();
  const names = entry.pool.filter((name) => name.toLowerCase().includes(query));

  const choose = (index: number, name: string) => {
    onPick([...entry.picks.slice(0, index), name, ...entry.picks.slice(index + 1)]);
    setOpenIndex(null);
    setSearch("");
  };

  return (
    <View style={{ gap: 4 }}>
      {Array.from({ length: entry.quantity }, (_, index) => {
        const enabled = index <= entry.picks.length;
        const current = entry.picks[index];
        const open = openIndex === index;
        return (
          <View key={index}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled, expanded: open }}
              disabled={!enabled}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => setOpenIndex(open ? null : index)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                minHeight: 44,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: open ? theme.accent : theme.border,
                backgroundColor: theme.surfaceHighlight,
                opacity: enabled ? 1 : 0.4,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 13, flexShrink: 1, minWidth: 0 }}>{label}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: current ? theme.accent : theme.textMuted,
                    fontSize: 13,
                    fontWeight: "700",
                    flexShrink: 1,
                    minWidth: 0,
                  }}
                >
                  {current ?? "Choose"}
                </Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
            {open ? (
              <View style={{ paddingTop: 6 }}>
                {entry.pool.length > SEARCH_THRESHOLD ? (
                  <SearchBar value={search} onChangeText={setSearch} placeholder="Search…" />
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                  {names.map((name) => {
                    const chosen = name === current;
                    return (
                      <TouchableOpacity
                        key={name}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        onPress={() => choose(index, name)}
                        style={[
                          pkStyles.chip,
                          {
                            minHeight: 36,
                            backgroundColor: chosen ? theme.accentGlow : theme.surface,
                            borderColor: chosen ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: chosen ? theme.accent : theme.textSecondary,
                            fontSize: 12,
                            fontWeight: chosen ? "700" : "500",
                          }}
                        >
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};
