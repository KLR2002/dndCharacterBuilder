import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { useRollLog } from "../../context/RollLogContext";
import { formatModifier } from "../../rules/abilities.ts";
import { rollActionAttack, rollActionDamage } from "../../rules/actionRolls.ts";
import type { D20Mode } from "../../rules/dice.ts";
import { badgeVariantColors, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export interface RollBadgeProps {
  /** The badge text, e.g. "+5 to hit" or "1d8 + 3 slashing". */
  label: string;
  /**
   * The d20 roll's source, e.g. "Longsword attack". With only `pool` set, the damage roll's source, e.g.
   * "Longsword damage".
   */
  source: string;
  /** The rolling character, named in the Roll Log heading. */
  characterName?: string;
  /** A d20 roll with this modifier (an attack, check, save or skill bonus). Tap rolls it with no advantage. */
  modifier?: number;
  /**
   * A damage pool like "1d8 + 3". Alone, tap rolls it. Together with `modifier`, the attack's result card
   * offers it as "Roll damage" ("Roll critical damage" after a natural 20).
   */
  pool?: string;
  /** The damage roll's source when it differs from `source`, e.g. "Longsword damage". */
  poolSource?: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  testID?: string;
}

const MODE_CHOICES: { mode: D20Mode; label: string; primary?: boolean }[] = [
  { mode: "disadvantage", label: "Disadvantage" },
  { mode: "none", label: "Roll", primary: true },
  { mode: "advantage", label: "Advantage" },
];

/**
 * A bonus or damage badge that rolls. Tap rolls at once with no advantage; a long-press opens the roll
 * sheet (the shared Modal) with Disadvantage, Roll and Advantage. Holding is not reachable by keyboard or
 * screen reader, so the badge also exposes "Roll with advantage" and "Roll with disadvantage" as
 * accessibility actions (the default activate rolls), and on web the context-menu key on the focused badge
 * opens the same sheet (Enter already activates the badge's roll, so it is not the sheet's key). The badge
 * is a 48dp target with a dice icon and a pressed state. Rolls publish through the Roll Log seam only and
 * spend nothing.
 */
export function RollBadge({
  label,
  source,
  characterName,
  modifier,
  pool,
  poolSource,
  variant = "surface",
  size = "md",
  testID,
}: RollBadgeProps) {
  const { theme } = useAppTheme();
  const { publishRoll } = useRollLog();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const isD20 = modifier !== undefined;

  const rollWith = (mode: D20Mode) => {
    if (!isD20) return;
    rollActionAttack(
      { attackBonus: modifier, damage: pool ?? "" },
      { source, damageSource: poolSource ?? source, characterName },
      mode,
      publishRoll,
    );
  };

  const onPress = (event?: { stopPropagation?: () => void }) => {
    // The badge sits inside a tappable row; the row's own tap must not also fire on web.
    event?.stopPropagation?.();
    if (isD20) rollWith("none");
    else if (pool) rollActionDamage(pool, { source, characterName }, publishRoll);
  };

  const onAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const action = event.nativeEvent.actionName;
    if (action === "Roll with advantage") rollWith("advantage");
    else if (action === "Roll with disadvantage") rollWith("disadvantage");
  };

  // Web keyboard path to the roll sheet: the context-menu key while the badge is focused.
  useEffect(() => {
    if (Platform.OS !== "web" || !focused || !isD20) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ContextMenu") {
        event.preventDefault();
        setSheetOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focused, isD20]);

  const { backgroundColor: bg, textColor, borderColor } = badgeVariantColors(theme, variant);

  const isSmall = size === "sm";

  // The accessible name carries the roll's source and value ("Roll Longsword attack, +5",
  // "Roll Longsword damage, 1d8 + 3"), so badges on the same screen stay distinguishable.
  const accessibleName = isD20
    ? `Roll ${source}, ${formatModifier(modifier)}`
    : `Roll ${poolSource ?? source}, ${pool ?? label}`;

  return (
    <>
      <Pressable
        testID={testID ?? "roll-badge"}
        accessibilityRole="button"
        accessibilityLabel={accessibleName}
        accessibilityActions={
          isD20
            ? [
                { name: "Roll with advantage", label: "Roll with advantage" },
                { name: "Roll with disadvantage", label: "Roll with disadvantage" },
              ]
            : undefined
        }
        onAccessibilityAction={isD20 ? onAccessibilityAction : undefined}
        onPress={onPress}
        onLongPress={isD20 ? () => setSheetOpen(true) : undefined}
        delayLongPress={350}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          styles.badge,
          {
            borderColor,
            backgroundColor: pressed ? theme.accentGlow : bg,
            minHeight: 48,
            paddingVertical: isSmall ? 2 : 6,
            paddingHorizontal: isSmall ? 8 : 12,
          },
        ]}>
        <Ionicons name="dice-outline" size={isSmall ? 13 : 15} color={textColor} />
        <Text
          style={[
            styles.label,
            { color: textColor, fontSize: isSmall ? 11 : 13 },
          ]}>
          {label}
        </Text>
      </Pressable>
      {isD20 ? (
        <Modal
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={source}
          subtitle={`d20 ${formatModifier(modifier)}`}>
          <View style={{ gap: 10 }}>
            {MODE_CHOICES.map(({ mode, label: choiceLabel, primary }) => (
              <Button
                key={mode}
                title={choiceLabel}
                variant={primary ? "primary" : "secondary"}
                size="lg"
                onPress={() => {
                  setSheetOpen(false);
                  rollWith(mode);
                }}
                style={{ width: "100%" }}
              />
            ))}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
    justifyContent: "center",
    maxWidth: "100%",
  },
  label: {
    fontWeight: "600",
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
});
