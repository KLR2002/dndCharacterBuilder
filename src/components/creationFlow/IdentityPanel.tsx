import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { useSerifFont } from "../../hooks/useSerifFont";
import { ABILITIES, formatModifier } from "../../rules/abilities";
import { evaluateCharacter } from "../../rules/characterEvaluation";
import { currentCompendium } from "../../services/compendium";
import type { Character } from "../../types/character";
import { ABILITY_LABELS } from "../builder/builderStyles";

/** The one-line identity summary above the primary action: class and level, race, background. */
export function identitySummaryLine(character: Character): string {
  const entry = character.classes?.[0];
  const parts = [
    entry ? `${entry.className} ${entry.level}` : null,
    character.race?.name ?? null,
    character.background?.name ?? null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The full identity panel: class and level in the serif, then race, subrace, background, subclass and the six
 * ability scores. Shown in the shared Modal on phones and always visible on the right at wide widths. The
 * Level-Up Flow passes `levelHp`, its level and hit points before → after, above the race rows.
 */
export function IdentityPanel({
  character,
  activeBooks,
  levelHp,
}: {
  character: Character;
  activeBooks: string[];
  levelHp?: { level: string; hitPoints: string };
}) {
  const { theme } = useAppTheme();
  const serif = useSerifFont();
  const entry = character.classes?.[0];
  const { scores, modifiers } = evaluateCharacter(character, { compendium: currentCompendium(), activeBooks }).effectiveScores;
  const classLine = entry ? `${entry.className} ${entry.level}` : "—";
  return (
    <View style={styles.panel}>
      <Text style={[styles.classLine, { color: theme.text, fontFamily: serif }]} numberOfLines={1}>
        {classLine}
      </Text>
      {character.name.trim() ? (
        <Text style={[styles.nameLine, { color: theme.textSecondary, fontFamily: serif }]} numberOfLines={1}>
          {character.name}
        </Text>
      ) : null}
      <View style={[styles.detailBlock, { borderTopColor: theme.border }]}>
        {levelHp ? (
          <>
            <DetailRow label="Level" value={levelHp.level} />
            <DetailRow label="Hit points" value={levelHp.hitPoints} />
          </>
        ) : null}
        {(
          [
            ["Race", character.race?.name ?? ""],
            ["Subrace", character.race?.subraceName ?? ""],
            ["Background", character.background?.name ?? ""],
            ["Subclass", entry?.subclassName ?? ""],
          ] as const
        )
          .filter(([, value]) => value !== "")
          .map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} />
          ))}
      </View>
      <View style={[styles.detailBlock, { borderTopColor: theme.border }]}>
        {ABILITIES.map((ability) => (
          <DetailRow
            key={ability}
            label={ABILITY_LABELS[ability]}
            value={`${scores[ability]} (${formatModifier(modifiers[ability])})`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
  },
  classLine: {
    fontSize: 22,
    fontWeight: "600",
  },
  nameLine: {
    fontSize: 15,
    marginTop: -8,
  },
  detailBlock: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  detailLabel: {
    width: 84,
    flexShrink: 0,
    fontSize: 13,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
});
