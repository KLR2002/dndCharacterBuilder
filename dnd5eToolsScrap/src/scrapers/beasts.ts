import type { ToolsClient } from "../types/models.ts";
import { resolveAllCopies } from "../parser/copy-resolver.ts";
import { renderEntries } from "../parser/entry-renderer.ts";
import { cleanTags } from "../parser/tag-cleaner.ts";
import type { BeastActionModel, BeastModel, BeastTraitModel } from "../types/models.ts";

const SIZE_MAP: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
};

const ELEMENTAL_NAMES = new Set([
  "air elemental",
  "earth elemental",
  "fire elemental",
  "water elemental",
]);

const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
];

function getCreatureType(typeField: any): string {
  if (!typeField) return "";
  if (typeof typeField === "string") return typeField.toLowerCase();
  if (typeof typeField === "object") {
    if (typeof typeField.type === "string") return typeField.type.toLowerCase();
    if (typeof typeField.type === "object" && typeof typeField.type?.type === "string") {
      return typeField.type.type.toLowerCase();
    }
  }
  return "";
}

function parseCr(rawCr: any): { display: string; numeric: number } {
  if (rawCr == null) return { display: "0", numeric: 0 };
  let display = "0";
  if (typeof rawCr === "string") {
    display = rawCr.trim();
  } else if (typeof rawCr === "number") {
    display = String(rawCr);
  } else if (typeof rawCr === "object" && rawCr.cr != null) {
    display = String(rawCr.cr).trim();
  }

  if (display === "1/8") return { display, numeric: 0.125 };
  if (display === "1/4") return { display, numeric: 0.25 };
  if (display === "1/2") return { display, numeric: 0.5 };

  const num = parseFloat(display);
  return { display, numeric: isNaN(num) ? 0 : num };
}

function parseAc(rawAc: any): number {
  if (rawAc == null) return 10;
  if (typeof rawAc === "number") return rawAc;
  if (Array.isArray(rawAc) && rawAc.length > 0) {
    const first = rawAc[0];
    if (typeof first === "number") return first;
    if (typeof first?.ac === "number") return first.ac;
  }
  return 10;
}

function parseSpeed(rawSpeed: any): BeastModel["speed"] {
  const speed: BeastModel["speed"] = {};
  if (!rawSpeed || typeof rawSpeed !== "object") return { walk: 30 };

  const extract = (val: any): number | undefined => {
    if (typeof val === "number") return val;
    if (typeof val?.number === "number") return val.number;
    if (typeof val === "string") {
      const m = val.match(/\d+/);
      return m ? parseInt(m[0], 10) : undefined;
    }
    return undefined;
  };

  const walk = extract(rawSpeed.walk);
  if (walk !== undefined) speed.walk = walk;
  const swim = extract(rawSpeed.swim);
  if (swim !== undefined) speed.swim = swim;
  const fly = extract(rawSpeed.fly);
  if (fly !== undefined) speed.fly = fly;
  const climb = extract(rawSpeed.climb);
  if (climb !== undefined) speed.climb = climb;
  const burrow = extract(rawSpeed.burrow);
  if (burrow !== undefined) speed.burrow = burrow;

  if (speed.walk === undefined && Object.keys(speed).length === 0) {
    speed.walk = 0;
  }

  return speed;
}

function parseActions(rawActions: any[]): BeastActionModel[] {
  if (!Array.isArray(rawActions)) return [];
  const actions: BeastActionModel[] = [];

  for (const act of rawActions) {
    if (!act || !act.name) continue;
    const name = cleanTags(act.name, "plain");
    const rawText = Array.isArray(act.entries) ? act.entries.join(" ") : String(act.entries || "");
    const description = renderEntries(act.entries, "markdown");

    // Extract attack bonus from {@hit X}
    let attackBonus: number | undefined;
    const hitMatch = rawText.match(/\{@hit ([+-]?\d+)\}/);
    if (hitMatch) {
      attackBonus = parseInt(hitMatch[1], 10);
    }

    // Extract damage formula from {@damage X}
    let damageDice: string | undefined;
    const dmgMatch = rawText.match(/\{@damage ([^}]+)\}/);
    if (dmgMatch) {
      damageDice = dmgMatch[1].trim();
    }

    // Extract damage type
    let damageType: string | undefined;
    const lowerDesc = description.toLowerCase();
    for (const dt of DAMAGE_TYPES) {
      if (lowerDesc.includes(`${dt} damage`)) {
        damageType = dt;
        break;
      }
    }

    actions.push({
      name,
      description,
      ...(attackBonus !== undefined ? { attackBonus } : {}),
      ...(damageDice ? { damageDice } : {}),
      ...(damageType ? { damageType } : {}),
    });
  }

  return actions;
}

function parseTraits(rawTraits: any[]): BeastTraitModel[] {
  if (!Array.isArray(rawTraits)) return [];
  const traits: BeastTraitModel[] = [];

  for (const t of rawTraits) {
    if (!t || !t.name) continue;
    traits.push({
      name: cleanTags(t.name, "plain"),
      description: renderEntries(t.entries, "markdown"),
    });
  }

  return traits;
}

export async function scrapeBeasts(client: ToolsClient): Promise<BeastModel[]> {
  console.log("  → Fetching bestiary index from data/bestiary/index.json...");
  const bestiaryIndex = await client.fetchJson<Record<string, string>>("data/bestiary/index.json");

  const allRawMonsters: any[] = [];

  for (const [sourceKey, fileName] of Object.entries(bestiaryIndex)) {
    console.log(`  → Fetching bestiary for ${sourceKey} (${fileName})...`);
    try {
      const fileData = await client.fetchJson<{ monster?: any[] }>(`data/bestiary/${fileName}`);
      if (Array.isArray(fileData.monster)) {
        allRawMonsters.push(...fileData.monster);
      }
    } catch (err: any) {
      console.warn(`[WARN] Failed to fetch ${fileName}: ${err.message}`);
    }
  }

  console.log(`  → Resolving copies for ${allRawMonsters.length} creatures...`);
  const resolved = resolveAllCopies(allRawMonsters);
  const beasts: BeastModel[] = [];
  const seen = new Set<string>();

  for (const raw of resolved) {
    if (!raw.name || !raw.source) continue;

    // Check swarm: strictly exclude swarms
    const isSwarm =
      (raw.swarm != null && raw.swarm !== false) ||
      Boolean(raw.type && typeof raw.type === "object" && raw.type.swarmSize) ||
      raw.name.toLowerCase().startsWith("swarm of ");

    if (isSwarm) {
      continue;
    }

    const typeStr = getCreatureType(raw.type);
    const isBeast = typeStr === "beast";
    const isElementalCandidate =
      typeStr === "elemental" &&
      raw.source === "MM" &&
      ELEMENTAL_NAMES.has(raw.name.toLowerCase());

    if (!isBeast && !isElementalCandidate) {
      continue;
    }

    const { display: crDisplay, numeric: crNumeric } = parseCr(raw.cr);

    // Standard & Moon wild shape beasts cap at CR 6
    if (isBeast && crNumeric > 6) {
      continue;
    }

    const key = `${raw.name.toLowerCase()}__${raw.source.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sizeCode = Array.isArray(raw.size) ? raw.size[0] : raw.size;
    const size = SIZE_MAP[sizeCode] || sizeCode || "Medium";

    const ac = parseAc(raw.ac);

    const hpAverage =
      typeof raw.hp?.average === "number"
        ? raw.hp.average
        : typeof raw.hp === "number"
        ? raw.hp
        : 1;
    const hpFormula = raw.hp?.formula ? cleanTags(raw.hp.formula, "plain") : `${hpAverage}`;

    const speed = parseSpeed(raw.speed);

    const abilities = {
      str: typeof raw.str === "number" ? raw.str : 10,
      dex: typeof raw.dex === "number" ? raw.dex : 10,
      con: typeof raw.con === "number" ? raw.con : 10,
      int: typeof raw.int === "number" ? raw.int : 10,
      wis: typeof raw.wis === "number" ? raw.wis : 10,
      cha: typeof raw.cha === "number" ? raw.cha : 10,
    };

    const senses: string[] = [];
    if (Array.isArray(raw.senses)) {
      senses.push(...raw.senses.map((s: any) => cleanTags(String(s), "plain")));
    } else if (raw.senses) {
      senses.push(cleanTags(String(raw.senses), "plain"));
    }

    const passivePerception =
      typeof raw.passive === "number"
        ? raw.passive
        : 10 + Math.floor((abilities.wis - 10) / 2);

    const skills: Record<string, number> = {};
    if (raw.skill && typeof raw.skill === "object") {
      for (const [sk, val] of Object.entries(raw.skill)) {
        const num = parseInt(String(val).replace("+", ""), 10);
        if (!isNaN(num)) skills[sk] = num;
      }
    }

    const traits = parseTraits(raw.trait);
    const actions = parseActions(raw.action);

    beasts.push({
      name: raw.name,
      source: raw.source,
      size,
      type: isBeast ? "beast" : "elemental",
      cr: crDisplay,
      crNumeric,
      ac,
      hp: {
        average: hpAverage,
        formula: hpFormula,
      },
      speed,
      abilities,
      senses: senses.length > 0 ? senses : undefined,
      passivePerception,
      skills: Object.keys(skills).length > 0 ? skills : undefined,
      traits: traits.length > 0 ? traits : undefined,
      actions: actions.length > 0 ? actions : undefined,
      ...(isElementalCandidate ? { isElementalWildShape: true } : {}),
    });
  }

  // Sort by name, then CR, then source
  beasts.sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    if (a.crNumeric !== b.crNumeric) return a.crNumeric - b.crNumeric;
    return a.source.localeCompare(b.source);
  });

  console.log(`  ✓ Filtered and prepared ${beasts.length} beasts & Wild Shape elementals!`);
  return beasts;
}
