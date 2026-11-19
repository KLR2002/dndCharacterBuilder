import type { ArmorCategory, Character } from "../types/character.ts";
import type { ArmorItem, RulesOptions } from "./types.ts";
import { effectiveScores } from "./abilities.ts";
import { hasFightingStyle } from "./ruleChoices.ts";

const CATEGORY_BY_CATALOG_TYPE = new Map<string, ArmorCategory>([
  ["light armor", "light"],
  ["medium armor", "medium"],
  ["heavy armor", "heavy"],
  ["shield", "shield"],
]);

/** The armor category of a catalog item type such as "Light Armor"; undefined for any other type. */
export function armorCategoryOfType(type: string | null | undefined): ArmorCategory | undefined {
  return type ? CATEGORY_BY_CATALOG_TYPE.get(type.toLowerCase()) : undefined;
}

export function armorCategory(item: ArmorItem): string | undefined {
  if (item.armorCategory) return item.armorCategory;
  const raw = item as unknown as { itemCategory?: string; type?: string };
  if (raw.itemCategory?.toLowerCase() === "shield" || raw.type?.toLowerCase() === "shield") return "shield";
  // ponytail: legacy inventory lacks categories; remove name fallback after data migration.
  const name = item.name.toLowerCase();
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

/** One term of an armor class: its kind, its label in the breakdown, and its value. */
export type ArmorClassPart = {
  kind: "base" | "ability" | "shield" | "fightingStyle" | "infusion" | "magic";
  label: string;
  value: number;
};

export type ArmorClassResult = { ac: number; breakdown: string; parts: ArmorClassPart[] };

/** The breakdown text of one part: "14 (Armor)", or the bare number when the part has no label. */
function renderPart(part: ArmorClassPart): string {
  return part.label ? `${part.value} (${part.label})` : `${part.value}`;
}

function resultOf(parts: ArmorClassPart[]): ArmorClassResult {
  return {
    ac: parts.reduce((total, part) => total + part.value, 0),
    breakdown: parts.map(renderPart).join(" + "),
    parts,
  };
}

export function armorClass(character: Character, opts: RulesOptions): ArmorClassResult {
  const { dex, con, wis } = effectiveScores(character, opts).modifiers;
  const equipped = (opts.items ?? character.items).filter(i => i.isEquipped);
  const armor = equipped.find(i => i.ac != null && armorCategory(i) !== "shield");
  const shield = equipped.find(i => armorCategory(i) === "shield");
  const shieldBonus = shield ? (shield.ac ?? 2) : 0;
  const shieldParts: ArmorClassPart[] = shield ? [{ kind: "shield", label: "Shield", value: shieldBonus }] : [];

  const artificer = (character.classes || []).find(
    (c) => c.className.toLowerCase() === "artificer"
  );
  const artificerLevel = artificer ? artificer.level : 0;
  const edBonus = artificerLevel >= 10 ? 2 : 1;

  const infusionParts: ArmorClassPart[] = [];

  const armorHasED = isItemInfusedWith(character, armor, "Enhanced Defense", shield ? undefined : "armor");
  const shieldHasED = isItemInfusedWith(character, shield, "Enhanced Defense", armor ? undefined : "shield");
  const shieldHasRepulsion = isItemInfusedWith(character, shield, "Repulsion Shield", "shield");

  if (armorHasED || shieldHasED) {
    infusionParts.push({ kind: "infusion", label: "Enhanced Defense", value: edBonus });
  }

  if (shieldHasRepulsion) {
    infusionParts.push({ kind: "infusion", label: "Repulsion Shield", value: 1 });
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

  const magicParts: ArmorClassPart[] = magicAcBonus > 0 ? [{ kind: "magic", label: "Magic Item", value: magicAcBonus }] : [];

  if (armor) {
    const category = armorCategory(armor);
    const appliedDex = category === "heavy" ? 0 : category === "medium" ? Math.min(dex, 2) : dex;
    const hasDefense = hasFightingStyle(character, "Defense");
    const dexParts: ArmorClassPart[] = category === "heavy"
      ? []
      : [{ kind: "ability", label: category === "medium" ? "Dex max 2" : "Dex", value: appliedDex }];
    const defenseParts: ArmorClassPart[] = hasDefense ? [{ kind: "fightingStyle", label: "Defense", value: 1 }] : [];
    return resultOf([
      { kind: "base", label: "Armor", value: armor.ac! },
      ...dexParts,
      ...shieldParts,
      ...defenseParts,
      ...infusionParts,
      ...magicParts,
    ]);
  }
  const defense = unarmoredDefenseClass(character);
  if (defense === "Barbarian") return resultOf([
    { kind: "base", label: "", value: 10 },
    { kind: "ability", label: "Dex", value: dex },
    { kind: "ability", label: "Con", value: con },
    ...shieldParts,
    ...infusionParts,
    ...magicParts,
  ]);
  if (defense === "Monk" && !shield) return resultOf([
    { kind: "base", label: "", value: 10 },
    { kind: "ability", label: "Dex", value: dex },
    { kind: "ability", label: "Wis", value: wis },
    ...magicParts,
  ]);
  return resultOf([
    { kind: "base", label: "", value: 10 },
    { kind: "ability", label: "Dex", value: dex },
    ...shieldParts,
    ...infusionParts,
    ...magicParts,
  ]);
}
