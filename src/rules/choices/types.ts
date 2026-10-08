import type { SpellData } from "../../types/dnd5e.ts";

export interface RuleChoiceIdParts {
  source: string;
  race: string;
  subrace?: { name?: string; source?: string } | null;
  trait: string;
  index?: number;
}

export function ruleChoiceId({ source, race, subrace, trait, index }: RuleChoiceIdParts): string {
  const base = [source, race, subrace?.name ?? "", trait].join("__");
  return index ? `${base}#${index}` : base;
}

/** A Rule Choice the character is currently offered. */
export interface AvailableRuleChoice {
  id: string;
  traitName: string;
  choose: number;
  /** Level at which the choice becomes offerable. */
  level: number;
  /** Level from which the chosen option's effect applies; defaults to `level`. */
  effectLevel: number;
  /** The feature this choice replaces, when the catalog marks one. */
  replaces?: string;
  origin?: "race" | "class" | "subclass";
  options: { name: string; description: string }[];
}

export function getSubclassName(c: { subclassName?: string; subclass?: string }): string {
  return (c.subclassName || c.subclass || "").trim().toLowerCase();
}

export function formatCantripOptions(cantrips: SpellData[]): { name: string; description: string }[] {
  const seen = new Set<string>();
  const options: { name: string; description: string }[] = [];
  for (const s of cantrips) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      const classList = s.classes && s.classes.length > 0 ? `(${s.classes.join(", ")}) ` : "";
      options.push({
        name: s.name,
        description: s.description ? `${classList}${s.description}` : `${classList}${s.school} cantrip`,
      });
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}
