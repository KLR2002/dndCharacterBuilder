import type { Character } from "../types/character.ts";
import type { ArmorItem, RulesOptions } from "./types.ts";
import { effectiveScores } from "./abilities.ts";
import { hasFightingStyle } from "./ruleChoices.ts";

export function armorCategory(item: ArmorItem): string | undefined {
  const raw = item as unknown as { armorCategory?: string; itemCategory?: string; type?: string };
  if (raw.armorCategory) return raw.armorCategory.toLowerCase();
  if (raw.itemCategory?.toLowerCase() === "shield" || raw.type?.toLowerCase() === "shield") return "shield";
  // ponytail: legacy inventory lacks categories; remove name fallback after data migration.
  const name = `${item.name} ${item.description || ""}`.toLowerCase();
  if (name.includes("shield") || name.includes("buckler")) return "shield";
  if (item.ac == null) return undefined;
  if (/medium armor|breastplate|scale mail|half plate|hide|chain shirt/.test(name)) return "medium";
  if (/heavy armor|plate|chain mail|splint|ring mail/.test(name)) return "heavy";
  return "light";
}
export function unarmoredDefenseClass(character: Character): string | undefined {
  return character.classes.find(c => c.level > 0 && ["Barbarian", "Monk"].includes(c.className))?.className;
}
function isItemInfusedWith(
  character: Character,
  item: ArmorItem | undefined,
  infusionName: string,
  fallbackTarget?: "armor" | "shield"
): boolean {
  if (!item) return false;
  const norm = infusionName.toLowerCase().trim();
  if (item.infusedWith?.toLowerCase().trim() === norm) return true;

  const activeList = character.activeInfusions || [];
  const activeMatch = activeList.find(
    (inf) => inf.infusionName.toLowerCase().trim() === norm
  );
  if (!activeMatch) return false;

  if (activeMatch.targetItemId && item.id) {
    return activeMatch.targetItemId === item.id;
  }
  if (activeMatch.targetItemName) {
    return activeMatch.targetItemName.toLowerCase().trim() === item.name.toLowerCase().trim();
  }

  if (fallbackTarget === "armor" && armorCategory(item) !== "shield") return true;
  if (fallbackTarget === "shield" && armorCategory(item) === "shield") return true;

  return false;
}

export function armorClass(character: Character, opts: RulesOptions): { ac: number; breakdown: string } {
  const { dex, con, wis } = effectiveScores(character, opts).modifiers;
  const equipped = (opts.items ?? character.items).filter(i => i.isEquipped);
  const armor = equipped.find(i => i.ac != null && armorCategory(i) !== "shield" && i.section === "equipped");
  const shield = equipped.find(i => armorCategory(i) === "shield");
  const shieldBonus = shield ? (shield.ac ?? 2) : 0;
  const shieldText = shield ? ` + ${shieldBonus} (Shield)` : "";

  const artificer = (character.classes || []).find(
    (c) => c.className.toLowerCase() === "artificer"
  );
  const artificerLevel = artificer ? artificer.level : 0;
  const edBonus = artificerLevel >= 10 ? 2 : 1;

  let infusionAcBonus = 0;
  let infusionBreakdown = "";

  const armorHasED = isItemInfusedWith(character, armor, "Enhanced Defense", shield ? undefined : "armor");
  const shieldHasED = isItemInfusedWith(character, shield, "Enhanced Defense", armor ? undefined : "shield");
  const shieldHasRepulsion = isItemInfusedWith(character, shield, "Repulsion Shield", "shield");

  if (armorHasED) {
    infusionAcBonus += edBonus;
    infusionBreakdown += ` + ${edBonus} (Enhanced Defense)`;
  } else if (shieldHasED) {
    infusionAcBonus += edBonus;
    infusionBreakdown += ` + ${edBonus} (Enhanced Defense)`;
  }

  if (shieldHasRepulsion) {
    infusionAcBonus += 1;
    infusionBreakdown += ` + 1 (Repulsion Shield)`;
  }

  let magicAcBonus = 0;
  for (const item of equipped) {
    const isAttuned = !item.attunement || item.isAttuned === true;
    if (!isAttuned) continue;

    let bonus = item.bonusAc;
    if (bonus == null && (armorCategory(item) || item.name.toLowerCase().includes("shield") || item.name.toLowerCase().includes("armor"))) {
      const m = item.name.match(/\+(\d+)/);
      if (m) bonus = parseInt(m[1], 10);
    }
    if (bonus && bonus > 0) {
      magicAcBonus += bonus;
    }
  }

  const magicAcText = magicAcBonus > 0 ? ` + ${magicAcBonus} (Magic Item)` : "";

  if (armor) {
    const category = armorCategory(armor);
    const appliedDex = category === "heavy" ? 0 : category === "medium" ? Math.min(dex, 2) : dex;
    const hasDefense = hasFightingStyle(character, "Defense");
    const defenseBonus = hasDefense ? 1 : 0;
    const defenseText = hasDefense ? " + 1 (Defense)" : "";
    return {
      ac: armor.ac! + appliedDex + shieldBonus + defenseBonus + infusionAcBonus + magicAcBonus,
      breakdown: `${armor.ac} (Armor)${category === "heavy" ? "" : ` + ${appliedDex} (Dex${category === "medium" ? " max 2" : ""})`}${shieldText}${defenseText}${infusionBreakdown}${magicAcText}`
    };
  }
  const defense = unarmoredDefenseClass(character);
  if (defense === "Barbarian") return {
    ac: 10 + dex + con + shieldBonus + infusionAcBonus + magicAcBonus,
    breakdown: `10 + ${dex} (Dex) + ${con} (Con)${shieldText}${infusionBreakdown}${magicAcText}`
  };
  if (defense === "Monk" && !shield) return {
    ac: 10 + dex + wis + magicAcBonus,
    breakdown: `10 + ${dex} (Dex) + ${wis} (Wis)${magicAcText}`
  };
  return {
    ac: 10 + dex + shieldBonus + infusionAcBonus + magicAcBonus,
    breakdown: `10 + ${dex} (Dex)${shieldText}${infusionBreakdown}${magicAcText}`
  };
}
