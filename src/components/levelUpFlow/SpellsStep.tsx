import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import type { LevelUpPlan, LevelUpReplacementOptions } from "../../rules/levelUpFlow";
import type { LearnableSpells } from "../../rules/learnableSpells";
import type { SpellData } from "../../types/dnd5e";
import { SpellLearnList } from "../spells/SpellLearnList";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

/**
 * The Spells step: the spells the new level makes available to the planned class. Toggling a spell adds
 * or removes it from the plan's `learnedSpells`. Once a count is full, its unpicked spells are disabled.
 * A known caster also sees the replacement: a known spell to forget, then the spell to learn in its place.
 */
export function SpellsStep({
  plan,
  learnable,
  replacement,
  onToggle,
  onForget,
  onLearn,
  onClearReplacement,
}: {
  plan: LevelUpPlan;
  learnable: LearnableSpells;
  replacement: LevelUpReplacementOptions | null;
  onToggle: (spell: { name: string; source: string }) => void;
  onForget: (spell: SpellData) => void;
  onLearn: (spell: SpellData) => void;
  onClearReplacement: () => void;
}) {
  const { theme } = useAppTheme();
  const due = plan.spellsDue ?? null;
  const levelOf = new Map(learnable.spells.map((s) => [s.name.toLowerCase(), s.level]));
  const pickedLevels = (plan.picks.learnedSpells ?? [])
    .map((s) => levelOf.get(s.name.toLowerCase()))
    .filter((level): level is number => level !== undefined);
  const cantrips = pickedLevels.filter((level) => level === 0).length;
  const spells = pickedLevels.length - cantrips;

  const cantripsFull = due !== null && cantrips >= due.cantrips;
  const spellsFull = due !== null && spells >= due.spells;
  const counters = [
    ...(due !== null && due.cantrips > 0 ? [`Cantrips ${cantrips}/${due.cantrips}`] : []),
    ...(due !== null && due.spells > 0 ? [`Spells ${spells}/${due.spells}`] : []),
  ];

  const replaced = plan.picks.replacedSpell;
  const forget = replaced?.forget;
  const learn = replaced?.learn;

  return (
    <View style={{ gap: 8 }}>
      {counters.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {counters.map((label) => (
            <Badge key={label} label={label} variant="secondary" size="sm" />
          ))}
        </View>
      )}
      <SpellLearnList
        spells={learnable.spells}
        restrictedSchools={learnable.restrictedSchools}
        selectedNames={(plan.picks.learnedSpells ?? []).map((s) => s.name)}
        isSpellDisabled={due === null ? undefined : (spell: SpellData) => (spell.level === 0 ? cantripsFull : spellsFull)}
        searchPlaceholder="Search spells…"
        onToggle={(spell: SpellData) => onToggle({ name: spell.name, source: spell.source })}
      />

      {replacement && (
        <View style={styles.replacement}>
          <View style={styles.replacementHeader}>
            <Text style={[styles.heading, { color: theme.text }]}>Replace a spell</Text>
            {(forget || learn) && <Button title="Clear" variant="ghost" onPress={onClearReplacement} />}
          </View>
          <SpellLearnList
            spells={replacement.forget}
            restrictedSchools={[]}
            selectedNames={forget ? [forget.name] : []}
            actionLabels={{ idle: "Forget", selected: "Forget" }}
            searchPlaceholder="Search spells to forget…"
            onToggle={onForget}
          />
          {forget && (
            <SpellLearnList
              spells={replacement.learn}
              restrictedSchools={replacement.restrictedSchools}
              selectedNames={learn ? [learn.name] : []}
              actionLabels={{ idle: "Replace with", selected: "Replace with" }}
              searchPlaceholder="Search spells to learn…"
              onToggle={onLearn}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  replacement: {
    gap: 8,
    marginTop: 8,
  },
  replacementHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
  },
});
