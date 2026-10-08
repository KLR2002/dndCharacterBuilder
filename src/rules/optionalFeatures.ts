import type { Character } from "../types/character.ts";
import type { ClassData, ClassFeatureData } from "../types/dnd5e.ts";

export interface OptionalFeatureOption {
  id: string;
  className: string;
  level: number;
  name: string;
  description: string;
  isReplacement: boolean;
  replacesFeatureName?: string;
}

export const KNOWN_FEATURE_REPLACEMENTS: Record<string, string[]> = {
  "Favored Foe": ["Favored Enemy"],
  "Deft Explorer": ["Natural Explorer"],
  "Primal Awareness": ["Primeval Awareness"],
  "Nature's Veil": ["Hide in Plain Sight"],
  "Primal Companion": ["Ranger's Companion"],
  "Blessed Strikes": ["Divine Strike", "Potent Spellcasting"],
};

export function getFeatureReplacements(featureName: string, description = ""): string[] {
  if (KNOWN_FEATURE_REPLACEMENTS[featureName]) {
    return KNOWN_FEATURE_REPLACEMENTS[featureName];
  }
  const match = description.match(/replaces the ([A-Za-z0-9' -]+?) feature/i);
  if (match && match[1]) {
    return [match[1].trim()];
  }
  return [];
}

export function getReplacedBaseFeatures(replacements: Record<string, boolean> = {}): Set<string> {
  const set = new Set<string>();
  for (const [name, enabled] of Object.entries(replacements)) {
    if (!enabled) continue;
    const targets = getFeatureReplacements(name);
    for (const t of targets) {
      set.add(t);
    }
  }
  return set;
}

export function getAvailableOptionalFeatures(
  character: Character,
  classesCatalog: ClassData[]
): OptionalFeatureOption[] {
  const options: OptionalFeatureOption[] = [];

  for (const c of character.classes || []) {
    const cls = classesCatalog.find(
      (x) => x.name.toLowerCase() === c.className.toLowerCase() && (!c.source || x.source === c.source)
    );
    if (!cls) continue;

    const allFeatures: (ClassFeatureData & { origin: "Class" | "Subclass" })[] = [
      ...(cls.features || []).map((f) => ({ ...f, origin: "Class" as const })),
    ];

    if (c.subclassName) {
      const sub = cls.subclasses?.find(
        (s) => s.name.toLowerCase() === c.subclassName!.toLowerCase()
      );
      if (sub?.features) {
        for (const f of sub.features) {
          allFeatures.push({ ...f, origin: "Subclass" as const });
        }
      }
    }

    for (const f of allFeatures) {
      if (!f.isOptional || f.level > c.level) continue;
      const replaces = getFeatureReplacements(f.name, f.description);
      options.push({
        id: `${c.className}_${f.level}_${f.name}`,
        className: c.className,
        level: f.level,
        name: f.name,
        description: f.description,
        isReplacement: replaces.length > 0,
        replacesFeatureName: replaces.length > 0 ? replaces.join(" / ") : undefined,
      });
    }
  }

  return options;
}
