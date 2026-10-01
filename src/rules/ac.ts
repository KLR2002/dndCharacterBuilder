import type { Character } from "../types/character.ts";
import type { ArmorItem, RulesOptions } from "./types.ts";
import { effectiveScores } from "./abilities.ts";

export function armorCategory(item: ArmorItem): string | undefined {
  if (item.armorCategory) return item.armorCategory.toLowerCase();
  // ponytail: legacy inventory lacks categories; remove name fallback after data migration.
  const name = `${item.name} ${item.description || ""}`.toLowerCase();
  if (name.includes("shield")) return "shield";
  if (item.ac == null) return undefined;
  if (/medium armor|breastplate|scale mail|half plate|hide|chain shirt/.test(name)) return "medium";
  if (/heavy armor|plate|chain mail|splint|ring mail/.test(name)) return "heavy";
  return "light";
}
export function unarmoredDefenseClass(character: Character): string | undefined {
  return character.classes.find(c => c.level > 0 && ["Barbarian", "Monk"].includes(c.className))?.className;
}
export function armorClass(character: Character, opts: RulesOptions = {}): { ac: number; breakdown: string } {
  const { dex, con, wis } = effectiveScores(character, opts).modifiers;
  const equipped = (opts.items ?? character.items).filter(i => i.isEquipped);
  const armor = equipped.find(i => i.ac != null && armorCategory(i) !== "shield" && i.section === "equipped");
  const shield = equipped.find(i => armorCategory(i) === "shield");
  const shieldBonus = shield ? (shield.ac ?? 2) : 0;
  const shieldText = shield ? ` + ${shieldBonus} (Shield)` : "";
  if (armor) {
    const category = armorCategory(armor);
    const appliedDex = category === "heavy" ? 0 : category === "medium" ? Math.min(dex, 2) : dex;
    return { ac: armor.ac! + appliedDex + shieldBonus, breakdown: `${armor.ac} (Armor)${category === "heavy" ? "" : ` + ${appliedDex} (Dex${category === "medium" ? " max 2" : ""})`}${shieldText}` };
  }
  const defense = unarmoredDefenseClass(character);
  if (defense === "Barbarian") return { ac: 10 + dex + con + shieldBonus, breakdown: `10 + ${dex} (Dex) + ${con} (Con)${shieldText}` };
  if (defense === "Monk" && !shield) return { ac: 10 + dex + wis, breakdown: `10 + ${dex} (Dex) + ${wis} (Wis)` };
  return { ac: 10 + dex + shieldBonus, breakdown: `10 + ${dex} (Dex)${shieldText}` };
}
