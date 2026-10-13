import type { ToolsClient } from "../types/models.ts";
import { resolveAllCopies } from "../parser/copy-resolver.ts";
import { renderEntries } from "../parser/entry-renderer.ts";
import { cleanTags } from "../parser/tag-cleaner.ts";
import type { SpellModel } from "../types/models.ts";

const SCHOOL_MAP: Record<string, string> = {
  A: "Abjuration",
  V: "Evocation",
  E: "Enchantment",
  I: "Illusion",
  D: "Divination",
  N: "Necromancy",
  T: "Transmutation",
  C: "Conjuration",
  P: "Psionic",
};

export async function scrapeSpells(client: ToolsClient): Promise<SpellModel[]> {
  console.log("  → Fetching spell index from data/spells/index.json...");
  const spellIndex = await client.fetchJson<Record<string, string>>("data/spells/index.json");

  console.log("  → Fetching spell class sources from data/spells/sources.json...");
  let spellSources: Record<string, Record<string, any>> = {};
  try {
    spellSources = await client.fetchJson<Record<string, Record<string, any>>>("data/spells/sources.json");
  } catch (err: any) {
    console.warn(`[WARN] Could not fetch spell sources: ${err.message}`);
  }

  const allRawSpells: any[] = [];

  for (const [sourceKey, fileName] of Object.entries(spellIndex)) {
    console.log(`  → Fetching spells for ${sourceKey} (${fileName})...`);
    try {
      const fileData = await client.fetchJson<{ spell?: any[] }>(`data/spells/${fileName}`);
      if (Array.isArray(fileData.spell)) {
        allRawSpells.push(...fileData.spell);
      }
    } catch (err: any) {
      console.warn(`[WARN] Failed to fetch ${fileName}: ${err.message}`);
    }
  }

  const resolved = resolveAllCopies(allRawSpells);
  const spells: SpellModel[] = [];
  const seen = new Set<string>();

  for (const raw of resolved) {
    const key = `${raw.name.toLowerCase()}__${(raw.source || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const school = SCHOOL_MAP[raw.school] || raw.school || "Universal";

    // Casting Time
    const castingTime = formatCastingTime(raw.time);

    // Range
    const range = formatRange(raw.range);

    // Components
    const components = formatComponents(raw.components);

    // Duration
    const durationInfo = formatDuration(raw.duration);

    // Ritual
    const ritual = Boolean(raw.meta?.ritual);

    // Classes & Subclasses lookup from sources.json
    const sourceBucket = spellSources[raw.source] || {};
    const spellInfo = sourceBucket[raw.name] || {};

    const classes: string[] = [];
    const classVariants: { name: string; source: string; definedInSource: string }[] = [];

    const addClass = (name: string) => {
      if (!classes.includes(name)) classes.push(name);
    };

    const addVariant = (name: string, source: string, definedInSource: string) => {
      if (
        !classVariants.some(
          (v) => v.name === name && v.definedInSource === definedInSource
        )
      ) {
        classVariants.push({ name, source, definedInSource });
      }
    };

    if (Array.isArray(spellInfo.class)) {
      for (const c of spellInfo.class) {
        if (!c.name) continue;
        const definedIn = c.source || raw.source;
        if (definedIn === raw.source) {
          addClass(c.name);
        } else {
          addVariant(c.name, raw.source, definedIn);
        }
      }
    }

    if (Array.isArray(spellInfo.classVariant)) {
      for (const cv of spellInfo.classVariant) {
        if (!cv.name) continue;
        const definedIn = cv.definedInSource || raw.source;
        if (definedIn === raw.source) {
          addClass(cv.name);
        } else {
          addVariant(cv.name, cv.source || raw.source, definedIn);
        }
      }
    }

    const subclasses: string[] = [];
    if (Array.isArray(spellInfo.subclass)) {
      for (const sc of spellInfo.subclass) {
        if (sc.name) subclasses.push(sc.name);
        else if (sc.subclass?.name) subclasses.push(sc.subclass.name);
      }
    }

    // Higher Levels description
    let higherLevels: string | null = null;
    if (Array.isArray(raw.entriesHigherLevel)) {
      higherLevels = renderEntries(raw.entriesHigherLevel, "markdown");
    }

    spells.push({
      name: cleanTags(raw.name, "plain"),
      source: raw.source,
      level: raw.level ?? 0,
      school,
      castingTime,
      range,
      components: components.structured,
      componentsString: components.text,
      duration: durationInfo.text,
      concentration: durationInfo.concentration,
      ritual,
      classes: [...new Set(classes)].sort(),
      ...(classVariants.length > 0 ? { classVariants } : {}),
      subclasses: [...new Set(subclasses)].sort(),
      damageTypes: Array.isArray(raw.damageInflict) ? raw.damageInflict : [],
      savingThrows: Array.isArray(raw.savingThrow) ? raw.savingThrow : [],
      description: renderEntries(raw.entries, "markdown"),
      higherLevels,
      rawEntries: raw.entries,
    });
  }

  // Sort by level then name
  spells.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.name.localeCompare(b.name);
  });

  return spells;
}

function formatCastingTime(time: any[] | null | undefined): string {
  if (!time || !Array.isArray(time) || time.length === 0) return "1 action";
  const parts: string[] = [];
  for (const t of time) {
    if (!t) continue;
    const num = t.number || 1;
    const unit = t.unit || "action";
    let str = `${num} ${unit}${num > 1 && !unit.endsWith("s") ? "s" : ""}`;
    if (t.condition) {
      str += `, ${cleanTags(t.condition, "plain")}`;
    }
    parts.push(str);
  }
  return parts.join(" or ");
}

function formatRange(range: any): string {
  if (!range || typeof range !== "object") return "Special";

  if (range.type === "point") {
    const dist = range.distance;
    if (!dist) return "Special";
    if (dist.type === "self") return "Self";
    if (dist.type === "touch") return "Touch";
    if (dist.type === "sight") return "Sight";
    if (dist.type === "unlimited") return "Unlimited";
    if (dist.amount != null) return `${dist.amount} ${dist.type || "feet"}`;
    return dist.type || "Special";
  }

  if (range.type === "radius" || range.type === "sphere" || range.type === "cone" || range.type === "line" || range.type === "cube" || range.type === "hemisphere") {
    const dist = range.distance;
    if (dist && dist.amount != null) {
      return `Self (${dist.amount}-${dist.type || "foot"} ${range.type})`;
    }
    return `Self (${range.type})`;
  }

  if (range.type === "special") return "Special";
  return range.type || "Special";
}

function formatComponents(components: any): {
  structured: { verbal: boolean; somatic: boolean; material: boolean | string };
  text: string;
} {
  if (!components || typeof components !== "object") {
    return {
      structured: { verbal: false, somatic: false, material: false },
      text: "None",
    };
  }

  const v = Boolean(components.v);
  const s = Boolean(components.s);
  let m: boolean | string = false;
  let materialText = "";

  if (components.m) {
    if (typeof components.m === "string") {
      m = cleanTags(components.m, "plain");
      materialText = ` (${m})`;
    } else if (typeof components.m === "object") {
      const matStr = components.m.text || "";
      m = cleanTags(matStr, "plain");
      materialText = ` (${m})`;
    } else {
      m = true;
    }
  }

  const parts: string[] = [];
  if (v) parts.push("V");
  if (s) parts.push("S");
  if (m) parts.push(`M${materialText}`);

  return {
    structured: { verbal: v, somatic: s, material: m },
    text: parts.join(", ") || "None",
  };
}

function formatDuration(duration: any[] | null | undefined): {
  text: string;
  concentration: boolean;
} {
  if (!duration || !Array.isArray(duration) || duration.length === 0) {
    return { text: "Instantaneous", concentration: false };
  }

  const d = duration[0];
  if (!d) return { text: "Instantaneous", concentration: false };

  const concentration = Boolean(d.concentration);

  if (d.type === "instant") {
    return { text: "Instantaneous", concentration: false };
  }

  if (d.type === "timed" && d.duration) {
    const amt = d.duration.amount || 1;
    const type = d.duration.type || "minute";
    const unit = amt > 1 && !type.endsWith("s") ? `${type}s` : type;
    const base = `${amt} ${unit}`;
    return {
      text: concentration ? `Concentration, up to ${base}` : base,
      concentration,
    };
  }

  if (d.type === "permanent") {
    if (Array.isArray(d.ends)) {
      return { text: `Until ${d.ends.join(" or ")}`, concentration: false };
    }
    return { text: "Until dispelled", concentration: false };
  }

  if (d.type === "special") {
    return { text: "Special", concentration };
  }

  return { text: d.type || "Special", concentration };
}
