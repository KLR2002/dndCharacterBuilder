import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { useSerifFont } from "../../hooks/useSerifFont";
import { ABILITIES } from "../../rules/abilities";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { currentCompendium } from "../../services/compendium";
import type { Character } from "../../types/character";
import { ABILITY_LABELS } from "../builder/builderStyles";
import { Card } from "../ui/Card";

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.text }]} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
}

/** The Review step: everything chosen, in label/value rows. The "Create character" action is the flow's primary action. */
export function ReviewStep({ character, activeBooks }: { character: Character; activeBooks: string[] }) {
  const { theme } = useAppTheme();
  const serif = useSerifFont();
  const entry = character.classes?.[0];
  const { scores } = evaluateCharacter(character, { compendium: currentCompendium(), activeBooks }).effectiveScores;
  const abilitiesLine = ABILITIES.map((a) => `${ABILITY_LABELS[a]} ${scores[a]}`).join(" · ");
  const skills = (character.chosenSkills ?? []).join(", ");
  const spells = [
    ...(character.knownSpells ?? []).map((s) => s.name),
    ...(character.preparedSpells ?? []).map((p) => p.split("__")[0]),
  ];
  return (
    <View style={{ gap: 10 }}>
      <Card style={{ gap: 6 }}>
        <Text style={[styles.heading, { color: theme.text, fontFamily: serif }]}>
          {character.name.trim() || "Unnamed"}
        </Text>
        <Row label="Class" value={entry ? `${entry.className} ${entry.level}` : ""} />
        <Row label="Subclass" value={entry?.subclassName ?? ""} />
        <Row label="Race" value={character.race?.name ?? ""} />
        <Row label="Subrace" value={character.race?.subraceName ?? ""} />
        <Row label="Background" value={character.background?.name ?? ""} />
      </Card>
      <Card style={{ gap: 6 }}>
        <Row label="Abilities" value={abilitiesLine} />
        <Row label="Skills" value={skills} />
        <Row label="Spells" value={spells.length > 0 ? `${spells.length} chosen` : ""} />
        <Row
          label="Equipment"
          value={
            character.startingGrantsApplied
              ? character.startingOption === "gold"
                ? "Gold"
                : "Starting equipment"
              : character.startingOption === "gold"
                ? "Gold"
                : ""
          }
        />
        <Row label="Gender" value={character.gender ?? ""} />
        <Row label="Alignment" value={character.alignment ?? ""} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 18,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  label: {
    width: 84,
    flexShrink: 0,
    fontSize: 13,
  },
  value: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
});
