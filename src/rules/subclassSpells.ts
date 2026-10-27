import { currentCompendium, type Compendium } from "../services/compendium.ts";
import type { Character, RuleChoiceEntry } from "../types/character.ts";
import type { SpellData, SubclassData, AdditionalSpells } from "../types/dnd5e.ts";
import { resolveOptionName } from "./choices/types.ts";
import { findClassData } from "./catalogs.ts";

export interface SubclassSpellsResult {
  prepared: SpellData[];
  known: SpellData[];
  expanded: string[];
  cantrips: SpellData[];
}

export interface SubclassSpellOptions {
  biome?: string;
  affinity?: string;
  kind?: string;
  swaps?: Record<string, string>;
  activeBooks?: string[];
  chosenCantrips?: string[];
  ruleChoices?: RuleChoiceEntry[];
  /** The source of the class entry's catalog class. Omitted or unmatched, the first class of the name is read. */
  classSource?: string;
  /** Defaults to the process-wide current Compendium. */
  compendium?: Compendium;
}

export function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

let spellCatalogs = new WeakMap<Compendium, Map<string, SpellData[]>>();

// One name-keyed spell index per Compendium, so a dataset swap never reads a stale catalog.
// A name can exist under several Sources, so every copy is kept in compendium order.
function getSpellCatalog(compendium: Compendium): Map<string, SpellData[]> {
  let map = spellCatalogs.get(compendium);
  if (!map) {
    map = new Map<string, SpellData[]>();
    for (const spell of compendium.for().spells()) {
      const key = normalizeKey(spell.name);
      const copies = map.get(key);
      if (copies) copies.push(spell);
      else map.set(key, [spell]);
    }
    spellCatalogs.set(compendium, map);
  }
  return map;
}

// Prefers the copy from an active book; otherwise falls back to the first copy, unless only active copies are wanted.
// With `activeOnly`, the SRD Baseline is always on, as it is for class spell lists (isSpellAvailableForClass).
function pickSpell(copies: SpellData[] | undefined, activeBooks?: string[], activeOnly = false): SpellData | undefined {
  if (!copies || copies.length === 0) return undefined;
  if (activeBooks && activeBooks.length > 0) {
    const books = new Set(activeBooks.map((b) => b.toUpperCase()));
    const source = (s: SpellData) => (s.source || "").toUpperCase();
    const active = copies.find((s) => books.has(source(s)));
    if (active) return active;
    if (activeOnly) return copies.find((s) => source(s) === "SRD");
  }
  return copies[0];
}

export function resetSpellCatalogCache(): void {
  spellCatalogs = new WeakMap<Compendium, Map<string, SpellData[]>>();
}

/**
 * The catalog spell a name resolves to, a name as the scraper normalises it, preferring a copy from an active book. `activeOnly`
 * drops a name whose only copies are in books that are switched off, instead of falling back to the first copy.
 */
export function resolveSpellName(
  name: string,
  activeBooks: string[] | undefined,
  compendium: Compendium = currentCompendium(),
  options: { activeOnly?: boolean } = {}
): SpellData | undefined {
  return pickSpell(getSpellCatalog(compendium).get(normalizeKey(name)), activeBooks, options.activeOnly);
}

/**
 * Curated ki cost of each Elemental Discipline that casts a spell, keyed by the discipline's catalog
 * name in lower case. A saved pick is matched to a key through `resolveOptionName`, so an old saved
 * name still finds its entry. Disciplines that cast no spell are listed in NON_SPELL_DISCIPLINES.
 */
export const ELEMENTAL_DISCIPLINE_SPELL_MAP: Record<
  string,
  { spellName: string; kiCost: number; customSpell?: Partial<SpellData> }
> = {
  "fist of four thunders": { spellName: "Thunderwave", kiCost: 2 },
  "sweeping cinder strike": { spellName: "Burning Hands", kiCost: 2 },
  "rush of the gale spirits": { spellName: "Gust of Wind", kiCost: 2 },
  "clench of the north wind": { spellName: "Hold Person", kiCost: 3 },
  "gong of the summit": { spellName: "Shatter", kiCost: 3 },
  "flames of the phoenix": { spellName: "Fireball", kiCost: 4 },
  "mist stance": { spellName: "Gaseous Form", kiCost: 4 },
  "ride the wind": { spellName: "Fly", kiCost: 4 },
  "breath of winter": { spellName: "Cone of Cold", kiCost: 6 },
  "eternal mountain defense": { spellName: "Stoneskin", kiCost: 5 },
  "river of hungry flame": { spellName: "Wall of Fire", kiCost: 5 },
  "wave of rolling earth": { spellName: "Wall of Stone", kiCost: 6 },
  "water whip": {
    spellName: "Water Whip",
    kiCost: 2,
    customSpell: {
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "30 feet",
      description:
        "Spend 2 Ki points to create a whip of water that buffets one creature within 30 feet. Target makes a Dexterity saving throw: takes 3d10 bludgeoning damage on failure (half on success) and can be knocked prone or pulled up to 25 feet toward you.",
      damageTypes: ["bludgeoning"],
      savingThrows: ["dex"],
    },
  },
  "unbroken air": {
    spellName: "Fist of Unbroken Air",
    kiCost: 2,
    customSpell: {
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "30 feet",
      description:
        "Spend 2 Ki points to blast air: target makes a Strength saving throw or takes 3d10 bludgeoning damage and is pushed up to 20 feet away and knocked prone.",
      damageTypes: ["bludgeoning"],
      savingThrows: ["str"],
    },
  },
  "fangs of the fire snake": {
    spellName: "Fangs of the Fire Snake",
    kiCost: 1,
    customSpell: {
      level: 1,
      school: "Transmutation",
      castingTime: "1 bonus action",
      range: "Self",
      description:
        "Spend 1 Ki point to extend your unarmed strike reach by 10 feet until the end of your turn; your unarmed strikes deal fire damage instead of bludgeoning damage, and you can spend 1 extra Ki point when you hit to deal an extra 1d10 fire damage.",
      damageTypes: ["fire"],
      savingThrows: [],
    },
  },
  "shape the flowing river": {
    spellName: "Shape the Flowing River",
    kiCost: 1,
    customSpell: {
      level: 1,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      description:
        "Spend 1 Ki point to shape ice and water within 120 feet: change water to ice and vice versa in an area up to 30 feet on a side.",
      damageTypes: [],
      savingThrows: [],
    },
  },
};

/**
 * Elemental Disciplines that cast no spell, so have no entry in the ki-cost table. Together with the
 * table they partition the catalog's discipline records; a completeness test holds that.
 */
export const NON_SPELL_DISCIPLINES: readonly string[] = ["Elemental Attunement"];

function matchesSubclass(sc: SubclassData, subName: string): boolean {
  const normTarget = normalizeKey(subName);
  const normName = normalizeKey(sc.name);
  const normShort = normalizeKey(sc.shortName || "");

  if (normName === normTarget || normShort === normTarget) return true;
  if (normName.includes(normTarget) || normTarget.includes(normName)) return true;
  if (normShort.length >= 3 && normTarget.includes(normShort)) return true;

  return false;
}

function selectAdditionalSpellsEntries(
  additionalSpells: AdditionalSpells[],
  subclassName: string,
  options?: SubclassSpellOptions
): AdditionalSpells[] {
  if (additionalSpells.length === 0) return [];

  const hasNamedVariants = additionalSpells.some((entry) => Boolean(entry.name));
  if (!hasNamedVariants) {
    return additionalSpells;
  }

  let fromRuleChoices: string | undefined;
  if (options?.ruleChoices) {
    for (const rc of options.ruleChoices) {
      const idLower = rc.id.toLowerCase();
      const traitLower = rc.trait.toLowerCase();
      if (
        idLower.includes("biome") ||
        idLower.includes("affinity") ||
        idLower.includes("genie") ||
        idLower.includes("kind") ||
        traitLower.includes("biome") ||
        traitLower.includes("affinity") ||
        traitLower.includes("genie") ||
        traitLower.includes("kind")
      ) {
        if (rc.picked?.[0]) {
          fromRuleChoices = rc.picked[0];
          break;
        }
      }
    }
  }

  // Determine requested variant tag from options or subclassName string
  const requestedVariant =
    options?.biome ||
    options?.affinity ||
    options?.kind ||
    fromRuleChoices ||
    (() => {
      const lower = subclassName.toLowerCase();
      const match = additionalSpells.find(
        (e) => e.name && lower.includes(e.name.toLowerCase())
      );
      return match?.name;
    })();

  if (requestedVariant) {
    const normVariant = normalizeKey(requestedVariant);
    const matched = additionalSpells.filter(
      (e) => e.name && normalizeKey(e.name) === normVariant
    );
    if (matched.length > 0) return matched;
  }

  // Default to first entry if no variant matched
  return [additionalSpells[0]];
}

export function getSubclassSpells(
  className: string,
  subclassName: string | undefined,
  classLevel: number,
  options?: SubclassSpellOptions
): SubclassSpellsResult {
  const compendium = options?.compendium ?? currentCompendium();
  const emptyResult: SubclassSpellsResult = {
    prepared: [],
    known: [],
    expanded: [],
    cantrips: [],
  };

  if (!className || !subclassName || classLevel < 1) {
    return emptyResult;
  }

  const cls = findClassData(compendium.for().classes(), { className, source: options?.classSource });
  if (!cls || !cls.subclasses || cls.subclasses.length === 0) {
    return emptyResult;
  }

  const subclass = cls.subclasses.find((sc) => matchesSubclass(sc, subclassName));
  const isFourElementsMonk =
    className.toLowerCase() === "monk" &&
    (subclassName.toLowerCase().includes("four elements") ||
      subclassName.toLowerCase().includes("elements"));

  if (
    !subclass ||
    ((!subclass.additionalSpells || subclass.additionalSpells.length === 0) &&
      !isFourElementsMonk)
  ) {
    return emptyResult;
  }

  // Subclass source check under activeBooks
  if (options?.activeBooks && options.activeBooks.length > 0) {
    const isSubclassSourceActive = options.activeBooks.some(
      (b) => b.toUpperCase() === (subclass.source || "").toUpperCase()
    );
    if (!isSubclassSourceActive) {
      return emptyResult;
    }
  }

  const catalog = getSpellCatalog(compendium);
  const entriesToProcess = isFourElementsMonk
    ? []
    : selectAdditionalSpellsEntries(
        subclass.additionalSpells || [],
        subclassName,
        options
      );

  const preparedMap = new Map<string, SpellData>();
  const knownMap = new Map<string, SpellData>();
  const cantripsMap = new Map<string, SpellData>();
  const expandedSet = new Set<string>();

  const resolveSpell = (rawName: string): SpellData | undefined => {
    const baseSpell = pickSpell(catalog.get(normalizeKey(rawName)), options?.activeBooks);
    const canonicalBaseName = baseSpell ? baseSpell.name : rawName;
    let target = rawName;
    let isReplaced = false;

    if (options?.swaps) {
      const normRaw = normalizeKey(rawName);
      for (const [orig, repl] of Object.entries(options.swaps)) {
        if (normalizeKey(orig) === normRaw) {
          target = repl;
          isReplaced = true;
          break;
        }
      }
    }

    const resolved = pickSpell(catalog.get(normalizeKey(target)), options?.activeBooks);
    if (!resolved) {
      if (baseSpell) {
        return { ...baseSpell, isReplaced: false, originalName: canonicalBaseName };
      }
      return undefined;
    }

    return {
      ...resolved,
      isReplaced,
      originalName: canonicalBaseName,
    };
  };

  for (const entry of entriesToProcess) {
    // 1. Prepared spells
    if (entry.prepared) {
      for (const [lvlReqStr, spells] of Object.entries(entry.prepared)) {
        const lvlReq = Number(lvlReqStr);
        if (classLevel >= lvlReq && Array.isArray(spells)) {
          for (const item of spells) {
            if (typeof item === "string") {
              const spell = resolveSpell(item);
              if (spell) {
                if (spell.level === 0) {
                  cantripsMap.set(spell.name, spell);
                } else {
                  preparedMap.set(spell.name, spell);
                }
              }
            }
          }
        }
      }
    }

    // 2. Known spells (including fixed cantrips)
    if (entry.known) {
      for (const [lvlReqStr, spells] of Object.entries(entry.known)) {
        const lvlReq = Number(lvlReqStr);
        if (classLevel >= lvlReq && Array.isArray(spells)) {
          for (const item of spells) {
            if (typeof item === "string") {
              const spell = resolveSpell(item);
              if (spell) {
                if (spell.level === 0) {
                  cantripsMap.set(spell.name, spell);
                } else {
                  knownMap.set(spell.name, spell);
                }
              }
            }
          }
        }
      }
    }

    // 3. Expanded spell lists
    if (entry.expanded) {
      for (const [lvlReqStr, spells] of Object.entries(entry.expanded)) {
        let lvlReq: number;
        if (lvlReqStr.startsWith("s")) {
          const spellLvl = Number(lvlReqStr.slice(1));
          lvlReq = Math.max(1, spellLvl * 2 - 1);
        } else {
          const num = Number(lvlReqStr);
          if (className.toLowerCase() === "warlock" && num <= 9) {
            lvlReq = Math.max(1, num * 2 - 1);
          } else {
            lvlReq = num;
          }
        }

        if (classLevel >= lvlReq && Array.isArray(spells)) {
          for (const item of spells) {
            if (typeof item === "string") {
              const resolved = resolveSpell(item);
              expandedSet.add(resolved ? resolved.name : item);
            }
          }
        }
      }
    }

    // 4. Innate spells (e.g. Way of Shadow, Sun Soul)
    if (entry.innate) {
      for (const [lvlReqStr, val] of Object.entries(entry.innate)) {
        const lvlReq = Number(lvlReqStr);
        if (classLevel >= lvlReq && val && typeof val === "object") {
          const resObj = (val as any).resource;
          if (resObj && typeof resObj === "object") {
            for (const [costStr, spells] of Object.entries(resObj)) {
              const kiCost = Number(costStr) || 2;
              if (Array.isArray(spells)) {
                for (const item of spells) {
                  if (typeof item === "string") {
                    const spell = resolveSpell(item);
                    if (spell) {
                      knownMap.set(spell.name, {
                        ...spell,
                        kiCost,
                      });
                    }
                  }
                }
              }
            }
          } else if (Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === "string") {
                const spell = resolveSpell(item);
                if (spell) knownMap.set(spell.name, spell);
              }
            }
          }
        }
      }
    }
  }

  // 5. Way of the Four Elements special discipline resolution
  if (
    className.toLowerCase() === "monk" &&
    subclassName &&
    (subclassName.toLowerCase().includes("four elements") ||
      subclassName.toLowerCase().includes("elements")) &&
    classLevel >= 3
  ) {
    // Automatic Elemental Attunement cantrip
    cantripsMap.set("Elemental Attunement", {
      name: "Elemental Attunement",
      source: "PHB",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: { verbal: false, somatic: true, material: false },
      componentsString: "S",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      classes: ["Monk"],
      subclasses: ["Way of the Four Elements"],
      damageTypes: [],
      savingThrows: [],
      description:
        "You briefly control elemental forces within 30 feet of you: create a harmless sensory effect, light or snuff a candle/torch/campfire, chill or warm 1 lb of nonliving material for up to 1 hour, or cause earth/fire/water/mist within a 1-foot cube to shape into a crude form for 1 minute.",
      higherLevels: null,
      kiCost: 0,
    });

    // Resolve chosen disciplines from ruleChoices
    if (options?.ruleChoices) {
      for (const rc of options.ruleChoices) {
        if (
          rc.id.toLowerCase().includes("way of the four elements") ||
          rc.trait.toLowerCase().includes("elemental discipline")
        ) {
          if (Array.isArray(rc.picked)) {
            for (const pickedName of rc.picked) {
              const key = resolveOptionName(pickedName, Object.keys(ELEMENTAL_DISCIPLINE_SPELL_MAP));
              const mapping = key ? ELEMENTAL_DISCIPLINE_SPELL_MAP[key] : undefined;
              if (mapping) {
                if (mapping.customSpell) {
                  const custom = mapping.customSpell;
                  knownMap.set(mapping.spellName, {
                    name: mapping.spellName,
                    source: "PHB",
                    level: custom.level ?? 1,
                    school: custom.school ?? "Evocation",
                    castingTime: custom.castingTime ?? "1 action",
                    range: custom.range ?? "30 feet",
                    components: { verbal: false, somatic: true, material: false },
                    componentsString: "S",
                    duration: "Instantaneous",
                    concentration: false,
                    ritual: false,
                    classes: ["Monk"],
                    subclasses: ["Way of the Four Elements"],
                    damageTypes: custom.damageTypes ?? [],
                    savingThrows: custom.savingThrows ?? [],
                    description: custom.description ?? "",
                    higherLevels: null,
                    kiCost: mapping.kiCost,
                  });
                } else {
                  const base = resolveSpell(mapping.spellName);
                  if (base) {
                    knownMap.set(base.name, {
                      ...base,
                      kiCost: mapping.kiCost,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // 6. Resolve chosen cantrips from options.chosenCantrips or options.ruleChoices
  const cantripNamesToResolve = new Set<string>();
  if (options?.chosenCantrips) {
    for (const name of options.chosenCantrips) {
      cantripNamesToResolve.add(name);
    }
  }
  if (options?.ruleChoices) {
    for (const rc of options.ruleChoices) {
      const idLower = rc.id.toLowerCase();
      const traitLower = rc.trait.toLowerCase();
      const isSubclassChoice = rc.origin === "subclass" || idLower.includes(className.toLowerCase());
      const isCantripChoice =
        traitLower.includes("cantrip") ||
        idLower.includes("acolyte of nature") ||
        idLower.includes("reaper") ||
        idLower.includes("arcane initiate") ||
        idLower.includes("giant power") ||
        traitLower.includes("giant power");
      if (isSubclassChoice && isCantripChoice && Array.isArray(rc.picked)) {
        for (const p of rc.picked) {
          cantripNamesToResolve.add(p);
        }
      }
    }
  }

  for (const name of cantripNamesToResolve) {
    const spell = pickSpell(catalog.get(normalizeKey(name)), options?.activeBooks);
    if (spell) {
      cantripsMap.set(spell.name, spell);
    }
  }

  return {
    prepared: Array.from(preparedMap.values()),
    known: Array.from(knownMap.values()),
    expanded: Array.from(expandedSet.values()),
    cantrips: Array.from(cantripsMap.values()),
  };
}

export function isSubclassSpellReplaceable(
  className: string,
  subclassName: string | undefined,
  spellLevel?: number
): boolean {
  if (!className || !subclassName) return false;
  if (spellLevel !== undefined && spellLevel === 0) return false;
  if (className.toLowerCase() !== "sorcerer") return false;
  const lower = subclassName.toLowerCase();
  return lower.includes("clockwork") || lower.includes("aberrant");
}

export function getSubclassAllowedSwapSchools(subclassName: string): string[] {
  if (!subclassName) return [];
  const lower = subclassName.toLowerCase();
  if (lower.includes("clockwork")) return ["Abjuration", "Transmutation"];
  if (lower.includes("aberrant")) return ["Divination", "Enchantment"];
  return [];
}

export function getBaselineSubclassSpellNames(
  className: string,
  subclassName: string,
  compendium: Compendium = currentCompendium()
): string[] {
  // A name-only caller (the swap validation) has no class entry, so the first class of the name is read.
  const cls = findClassData(compendium.for().classes(), { className });
  if (!cls || !cls.subclasses) return [];
  const subclass = cls.subclasses.find((sc) => matchesSubclass(sc, subclassName));
  if (!subclass || !subclass.additionalSpells) return [];

  const names: string[] = [];
  for (const entry of subclass.additionalSpells) {
    if (entry.known) {
      for (const list of Object.values(entry.known)) {
        if (Array.isArray(list)) {
          for (const item of list) {
            if (typeof item === "string") {
              names.push(item);
            }
          }
        }
      }
    }
    if (entry.prepared) {
      for (const list of Object.values(entry.prepared)) {
        if (Array.isArray(list)) {
          for (const item of list) {
            if (typeof item === "string") {
              names.push(item);
            }
          }
        }
      }
    }
  }
  return names;
}

export function validateSubclassSpellSwap(
  className: string,
  subclassName: string,
  originalSpellName: string,
  replacementSpellName: string,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): { valid: boolean; reason?: string } {
  if (!className || !subclassName) {
    return { valid: false, reason: "Class and subclass must be specified." };
  }

  if (!isSubclassSpellReplaceable(className, subclassName)) {
    return { valid: false, reason: `Subclass ${subclassName} does not permit spell swaps.` };
  }

  const baselineNames = getBaselineSubclassSpellNames(className, subclassName, compendium);
  const normOriginal = normalizeKey(originalSpellName);
  const isBaseline = baselineNames.some((n) => normalizeKey(n) === normOriginal);
  if (!isBaseline) {
    return {
      valid: false,
      reason: `"${originalSpellName}" is not a baseline subclass spell for ${subclassName}.`,
    };
  }

  const catalog = getSpellCatalog(compendium);
  const origSpell = pickSpell(catalog.get(normOriginal), activeBooks);
  if (!origSpell) {
    return { valid: false, reason: `Original spell "${originalSpellName}" not found in catalog.` };
  }

  if (origSpell.level === 0) {
    return {
      valid: false,
      reason: "Subclass cantrips cannot be replaced. Only spells of 1st level or higher can be replaced.",
    };
  }

  const normRepl = normalizeKey(replacementSpellName);
  const replSpell = pickSpell(catalog.get(normRepl), activeBooks);
  if (!replSpell) {
    return { valid: false, reason: `Replacement spell "${replacementSpellName}" does not exist.` };
  }

  if (replSpell.level !== origSpell.level) {
    return {
      valid: false,
      reason: `Replacement spell must be level ${origSpell.level}, but "${replSpell.name}" is level ${replSpell.level}.`,
    };
  }

  const allowedSchools = getSubclassAllowedSwapSchools(subclassName);
  const isAllowedSchool = allowedSchools.some(
    (s) => s.toLowerCase() === (replSpell.school || "").toLowerCase()
  );
  if (!isAllowedSchool) {
    return {
      valid: false,
      reason: `Replacement spell must belong to ${allowedSchools.join(" or ")} school, but "${replSpell.name}" is ${replSpell.school}.`,
    };
  }

  const allowedClasses = ["sorcerer", "warlock", "wizard"];
  const isAllowedClass = replSpell.classes?.some((c) =>
    allowedClasses.includes(c.toLowerCase())
  );
  if (!isAllowedClass) {
    return {
      valid: false,
      reason: "Replacement spell must be on the Sorcerer, Warlock, or Wizard spell list.",
    };
  }

  if (activeBooks && activeBooks.length > 0) {
    const isSourceActive = activeBooks.some(
      (b) => b.toUpperCase() === (replSpell.source || "").toUpperCase()
    );
    if (!isSourceActive) {
      return {
        valid: false,
        reason: `Replacement spell source "${replSpell.source}" is not in active books.`,
      };
    }
  }

  return { valid: true };
}

export function getEligibleSubclassSpellSwaps(
  subclassName: string,
  originalSpell: SpellData,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): SpellData[] {
  if (!subclassName || !originalSpell || originalSpell.level === 0) return [];
  const allowedSchools = getSubclassAllowedSwapSchools(subclassName).map((s) => s.toLowerCase());
  if (allowedSchools.length === 0) return [];

  const catalog = getSpellCatalog(compendium);
  const allowedClasses = ["sorcerer", "warlock", "wizard"];
  const activeBooksSet = activeBooks ? new Set(activeBooks.map((b) => b.toUpperCase())) : null;

  const eligible: SpellData[] = [];
  for (const copies of catalog.values()) {
    const spell = pickSpell(copies, activeBooks);
    if (!spell) continue;
    if (spell.level !== originalSpell.level) continue;
    if (!allowedSchools.includes((spell.school || "").toLowerCase())) continue;
    if (!spell.classes?.some((c) => allowedClasses.includes(c.toLowerCase()))) continue;
    if (activeBooksSet && !activeBooksSet.has((spell.source || "").toUpperCase())) continue;
    if (spell.name.toLowerCase() === originalSpell.name.toLowerCase()) continue;
    eligible.push(spell);
  }

  return eligible.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Detects spells in character.knownSpells that were granted exclusively by a former subclass
 * (such as a Warlock patron's expanded spell list) and are not legally learnable under the new subclass
 * or base class spell list.
 */
export function getOrphanedSubclassSpells(
  character: Character,
  className: string,
  oldSubclassName: string,
  newSubclassName?: string,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): string[] {
  if (!oldSubclassName) return [];
  const classLower = className.toLowerCase();

  // Find all spells known by this character for this class
  const classOwnerKey = `${className}__`;
  const isSingleClass = (character.classes || []).length === 1;
  const known = (character.knownSpells || []).filter((k) => {
    if (k.ownerKey?.startsWith(classOwnerKey)) return true;
    if (isSingleClass) return true;
    if (k.className?.toLowerCase() === classLower) return true;
    return false;
  });

  if (known.length === 0) return [];

  // The class entry is unique by name, so its source names the catalog class whose subclasses are read.
  const classSource = (character.classes || []).find((c) => c.className === className)?.source;

  // Expanded spells for former subclass
  const oldSpells = getSubclassSpells(className, oldSubclassName, 20, { activeBooks, compendium, classSource });
  const oldExpandedSet = new Set(oldSpells.expanded.map(normalizeKey));
  if (oldExpandedSet.size === 0) return [];

  // Expanded spells for new subclass (if any)
  const newExpandedSet = new Set(
    newSubclassName
      ? getSubclassSpells(className, newSubclassName, 20, { activeBooks, compendium, classSource }).expanded.map(normalizeKey)
      : []
  );

  const catalog = getSpellCatalog(compendium);
  const orphaned: string[] = [];

  for (const k of known) {
    const norm = normalizeKey(k.name);
    // Was this spell on the former subclass's expanded list?
    if (!oldExpandedSet.has(norm)) continue;

    // Is it also on the new subclass's expanded list?
    if (newExpandedSet.has(norm)) continue;

    // Is it a native class spell on the base spell list?
    const spellData = pickSpell(catalog.get(norm), activeBooks);
    const isNativeBaseSpell = spellData?.classes?.some((c) => c.toLowerCase() === classLower);
    if (isNativeBaseSpell) continue;

    // It was exclusively granted by the former subclass and is now illegal!
    orphaned.push(k.name);
  }

  return orphaned;
}

