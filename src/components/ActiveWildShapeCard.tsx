import React, { useState } from "react";
import { Text, View } from "react-native";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";
import { useHpQuickEdit } from "../hooks/useHpQuickEdit";
import { findBeast } from "../services/dataService";
import type { Character } from "../types/character";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { DetailModal } from "./DetailModal";
import { HitPointBlock } from "./HitPointBlock";
import { HpQuickEditModal } from "./HpQuickEditModal";

export interface ActiveWildShapeCardProps {
  character: Character;
}

/**
 * The Active Wild Shape box, shared by the Stats and Features tabs: the form's name and AC, its own
 * HP (edited through the shared HP box), the carry-over note, and the beast statblock and Revert
 * actions. Renders nothing when no form is active.
 */
export const ActiveWildShapeCard: React.FC<ActiveWildShapeCardProps> = ({ character }) => {
  const { updateCharacter } = useCharacters();
  const { theme } = useAppTheme();

  const [hpAmount, setHpAmount] = useState("1");
  const [statblock, setStatblock] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  // The "wildShape" target never reads max HP (the form's own max is used), so 0 is passed here.
  const hpQuickEdit = useHpQuickEdit(character, 0, "wildShape");

  const shape = character.activeWildShape;
  if (!shape) return null;

  const amount = () => parseInt(hpAmount, 10) || 1;

  const openStatblock = () => {
    const b = findBeast(shape.name, shape.source);
    if (!b) return;
    setStatblock({
      visible: true,
      title: b.name,
      subtitle: `CR ${b.cr} • ${b.size} ${b.type}`,
      content: `**AC**: ${b.ac}\n**HP**: ${b.hp.average} (${b.hp.formula})\n**Speed**: Walk ${b.speed.walk || 0}ft${b.speed.swim ? `, Swim ${b.speed.swim}ft` : ""}${b.speed.fly ? `, Fly ${b.speed.fly}ft` : ""}\n\n**STR** ${b.abilities.str} | **DEX** ${b.abilities.dex} | **CON** ${b.abilities.con} | **INT** ${b.abilities.int} | **WIS** ${b.abilities.wis} | **CHA** ${b.abilities.cha}\n\n${(b.traits || []).map((t) => `**${t.name}**: ${t.description}`).join("\n\n")}\n\n${(b.actions || []).map((a) => `**${a.name}**: ${a.description}`).join("\n\n")}`,
    });
  };

  return (
    <>
      <Card
        style={{
          padding: 14,
          marginBottom: 16,
          backgroundColor: theme.surfaceHighlight,
          borderColor: theme.accentBorder,
          borderWidth: 1.5,
        }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Badge label="ACTIVE WILD SHAPE" variant="accent" size="sm" />
          <Text style={{ flexShrink: 1, fontSize: 17, fontWeight: "700", color: theme.text }}>
            {shape.name}
          </Text>
          <Badge label={`AC ${shape.ac}`} variant="secondary" size="sm" />
        </View>

        <HitPointBlock
          label="WILD SHAPE HP"
          currentHp={shape.currentHp}
          maxHp={shape.maxHp}
          numberProps={hpQuickEdit.triggerProps}
          amount={hpAmount}
          onAmountChange={setHpAmount}
          onDamage={() => hpQuickEdit.apply({ kind: "damage", amount: amount() })}
          onHeal={() => hpQuickEdit.apply({ kind: "heal", amount: amount() })}
        />

        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 8 }}>
          Damage reduces beast HP first. When the form drops, excess damage carries over to your normal HP.
        </Text>

        {/* Action Buttons: Inspect Beast & Revert */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Button
            title="View Beast Attacks & Actions"
            icon="flash-outline"
            variant="outline"
            size="sm"
            style={{ flex: 1, minWidth: 160 }}
            onPress={openStatblock}
          />
          <Button
            title="Revert"
            icon="arrow-undo-outline"
            variant="secondary"
            size="sm"
            onPress={() => updateCharacter(character.id, { activeWildShape: null })}
          />
        </View>
      </Card>

      <HpQuickEditModal {...hpQuickEdit.modalProps} />
      <DetailModal
        visible={statblock.visible}
        title={statblock.title}
        subtitle={statblock.subtitle}
        content={statblock.content}
        onClose={() => setStatblock({ visible: false, title: "", content: "" })}
      />
    </>
  );
};
