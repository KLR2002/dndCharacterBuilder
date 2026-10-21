import type { ToolsClient } from "../types/models.ts";
import { renderEntries } from "../parser/entry-renderer.ts";
import { cleanTags } from "../parser/tag-cleaner.ts";
import { liftSpellChoice } from "../parser/spell-choice.ts";
import {
  newProficiencyReport,
  resolveFeatureGrants,
  startingToolGrants,
  type GrantSubject,
} from "../parser/proficiency-grants.ts";
import { PROFICIENCY_GRANT_OVERRIDES } from "../overrides/proficiency-grants.ts";
import type {
  ChoiceOption,
  ClassFeatureModel,
  ClassModel,
  FeatureChoice,
  SubclassAdditionalSpells,
  SubclassModel,
} from "../types/models.ts";
import type { ProficiencyGrant, ProficiencyReport } from "../types/proficiency.ts";

const STAT_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function cleanSpellNameString(str: string): string {
  if (typeof str !== "string") return str;
  if (str.includes("=")) return str.trim();
  let s = cleanTags(str, "plain").trim();
  if (s.includes("#")) s = s.split("#")[0].trim();
  if (s.includes("|")) s = s.split("|")[0].trim();
  return s;
}

function cleanSpellVal(val: any): any {
  if (Array.isArray(val)) {
    return val.map((item) => cleanSpellVal(item));
  }
  if (val && typeof val === "object") {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = cleanSpellVal(v);
    }
    return res;
  }
  if (typeof val === "string") {
    return cleanSpellNameString(val);
  }
  return val;
}

function parseAdditionalSpells(rawAdditionalSpells: any): SubclassAdditionalSpells[] | undefined {
  if (!Array.isArray(rawAdditionalSpells) || rawAdditionalSpells.length === 0) return undefined;
  return rawAdditionalSpells.map((entry) => {
    const res: SubclassAdditionalSpells = {};
    if (entry.name) res.name = cleanTags(entry.name, "plain");
    for (const cat of ["prepared", "known", "expanded", "innate"] as const) {
      if (entry[cat]) {
        res[cat] = cleanSpellVal(entry[cat]);
      }
    }
    return res;
  });
}

/** Finds the first `options` entry in a feature's entry tree. */
function findOptionsEntry(entries: any): any | undefined {
  if (!Array.isArray(entries)) return undefined;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.type === "options") return entry;
    const nested = findOptionsEntry(entry.entries);
    if (nested) return nested;
  }
  return undefined;
}

/** The name and level a `refSubclassFeature` or `refClassFeature` entry points at. */
function parseFeatureRef(
  entry: any,
  refType: "refClassFeature" | "refSubclassFeature"
): { name: string; level: number } | undefined {
  if (entry?.type !== refType) return undefined;
  // Subclass refs: name|className|classSource|subclassShortName|subclassSource|level|featureSource.
  // Class refs: name|className|classSource|level|featureSource.
  const raw = refType === "refSubclassFeature" ? entry.subclassFeature : entry.classFeature;
  if (typeof raw !== "string") return undefined;
  const parts = raw.split("|");
  const level = Number(refType === "refSubclassFeature" ? parts[5] : parts[3]);
  if (!parts[0]?.trim() || !Number.isFinite(level)) return undefined;
  return { name: parts[0].trim(), level };
}

/**
 * Resolves a feature's `options` entry to the sibling features it names. Every ref must resolve
 * to a sibling of the same name and level, or the feature gets no choices at all.
 */
function resolveChoice(
  parent: any,
  siblings: any[],
  refType: "refClassFeature" | "refSubclassFeature"
): { choices: FeatureChoice; folded: any[] } | undefined {
  const options = findOptionsEntry(parent.entries);
  if (!options || !Array.isArray(options.entries) || options.entries.length === 0) return undefined;

  const folded: any[] = [];
  for (const ref of options.entries) {
    const target = parseFeatureRef(ref, refType);
    if (!target) return undefined;
    const sibling = siblings.find(
      (s) => s !== parent && s.name === target.name && s.level === target.level
    );
    if (!sibling) return undefined;
    folded.push(sibling);
  }

  return {
    choices: {
      pick: options.count ?? 1,
      options: folded.map((sibling) => ({
        name: cleanTags(sibling.name, "plain"),
        description: renderEntries(sibling.entries, "markdown"),
        source: sibling.source ?? parent.source,
        level: sibling.level,
      })),
    },
    folded,
  };
}

/**
 * The raw features to emit, each with the choices its options entry resolves to. Option siblings
 * that a parent resolves are folded into it and dropped from the list. Ref-only stubs are skipped.
 */
function featuresWithChoices(
  raws: any[],
  refType: "refClassFeature" | "refSubclassFeature"
): { raw: any; choices?: FeatureChoice; folded: any[] }[] {
  const isOnlyRef = (f: any) =>
    Array.isArray(f.entries) && f.entries.length === 1 && f.entries[0]?.type === refType;
  const candidates = raws.filter((f) => !isOnlyRef(f));

  const resolvedByParent = new Map<any, { choices: FeatureChoice; folded: any[] }>();
  const folded = new Set<any>();
  for (const raw of candidates) {
    const resolved = resolveChoice(raw, candidates, refType);
    if (!resolved) continue;
    resolvedByParent.set(raw, resolved);
    for (const sibling of resolved.folded) folded.add(sibling);
  }

  return candidates
    .filter((f) => !folded.has(f))
    .map((raw) => {
      const resolved = resolvedByParent.get(raw);
      return { raw, choices: resolved?.choices, folded: resolved?.folded ?? [] };
    });
}

/**
 * The grant subjects of a parent's folded options, in option order. An option's own prose is its grant
 * text, so its Proficiency Grants are extracted and held on the option, as a feature's are on the feature.
 */
function optionGrantSubjects(
  choices: FeatureChoice | undefined,
  folded: any[],
  owner: { source: string; owner: string }
): { holder: ChoiceOption; subject: GrantSubject }[] {
  return (choices?.options ?? []).map((option, i) => ({
    holder: option,
    subject: { ...owner, feature: option.name, level: folded[i].level, description: option.description },
  }));
}

export async function scrapeClasses(
  client: ToolsClient,
  report: ProficiencyReport = newProficiencyReport()
): Promise<ClassModel[]> {
  console.log("  → Fetching class index from data/class/index.json...");
  const classIndex = await client.fetchJson<Record<string, string>>("data/class/index.json");

  const classes: ClassModel[] = [];
  /** Features whose prose grants are resolved once every class is read (overrides may name any of them). */
  const pending: Array<{ holder: { grants?: ProficiencyGrant[] }; subject: GrantSubject }> = [];

  for (const [classKey, fileName] of Object.entries(classIndex)) {
    console.log(`  → Fetching ${classKey} (${fileName})...`);
    const classData = await client.fetchJson<{
      class?: any[];
      classFeature?: any[];
      subclass?: any[];
      subclassFeature?: any[];
    }>(`data/class/${fileName}`);

    const rawClasses = classData.class || [];
    const allClassFeatures = classData.classFeature || [];
    const rawSubclasses = classData.subclass || [];
    const allSubclassFeatures = classData.subclassFeature || [];

    for (const raw of rawClasses) {
      // Hit Die
      const hitDie = raw.hd ? `${raw.hd.number || 1}d${raw.hd.faces}` : "1d8";

      // Saving Throws
      const savingThrows = (raw.proficiency || []).map(
        (p: string) => STAT_NAMES[p.toLowerCase()] || p.toUpperCase()
      );

      // Starting Proficiencies
      const armorProficiencies: string[] = [];
      const weaponProficiencies: string[] = [];
      const toolProficiencies: string[] = [];
      const startingToolTexts: string[] = [];
      let skillProficiencies = { choose: 2, from: [] as string[] };

      if (raw.startingProficiencies) {
        if (Array.isArray(raw.startingProficiencies.armor)) {
          for (const a of raw.startingProficiencies.armor) {
            armorProficiencies.push(cleanTags(typeof a === "string" ? a : a.full || a.name || "", "plain"));
          }
        }
        if (Array.isArray(raw.startingProficiencies.weapons)) {
          for (const w of raw.startingProficiencies.weapons) {
            weaponProficiencies.push(cleanTags(typeof w === "string" ? w : w.full || w.name || "", "plain"));
          }
        }
        if (Array.isArray(raw.startingProficiencies.tools)) {
          for (const t of raw.startingProficiencies.tools) {
            const text = cleanTags(typeof t === "string" ? t : t.full || t.name || "", "plain");
            toolProficiencies.push(text);
            // An optional entry is a rule option the class offers, not a starting tool.
            if (!(t && typeof t === "object" && t.optional === true)) startingToolTexts.push(text);
          }
        }
        if (Array.isArray(raw.startingProficiencies.skills)) {
          for (const s of raw.startingProficiencies.skills) {
            if (s.choose) {
              skillProficiencies = {
                choose: s.choose.count || 2,
                from: (s.choose.from || []).map((skill: string) => cleanTags(skill, "plain")),
              };
            }
          }
        }
      }

      // Spellcasting
      const spellcasting = raw.spellcastingAbility
        ? {
            ability: STAT_NAMES[raw.spellcastingAbility] || raw.spellcastingAbility,
            progression: raw.casterProgression || "full",
            preparedSpells: raw.preparedSpells ? cleanTags(raw.preparedSpells, "plain") : undefined,
          }
        : null;

      // Class Features (Level 1-20)
      const features: ClassFeatureModel[] = [];
      const classFeaturesForThis = allClassFeatures.filter(
        (cf) =>
          cf.className === raw.name &&
          (cf.classSource === raw.source || !cf.classSource)
      );

      // Skips entry ref stubs that only contain { type: "refClassFeature" }
      for (const { raw: cf, choices, folded } of featuresWithChoices(classFeaturesForThis, "refClassFeature")) {
        const feature: ClassFeatureModel = {
          name: cleanTags(cf.name, "plain"),
          level: cf.level,
          description: renderEntries(cf.entries, "markdown"),
          isOptional: cf.isClassFeatureVariant || false,
          ...(choices ? { choices } : {}),
        };
        features.push(feature);
        pending.push({
          holder: feature,
          subject: { source: raw.source, owner: raw.name, feature: feature.name, level: feature.level, description: feature.description },
        });
        pending.push(...optionGrantSubjects(choices, folded, { source: raw.source, owner: raw.name }));
      }

      // Starting tools are a grant owner of their own: the class's level-1 tool grants, read from the same
      // tool texts the class record carries (see enrich:grants, which applies them to the tracked data).
      const starting = startingToolGrants(
        { source: raw.source, owner: raw.name, feature: "Starting Proficiencies", level: 1 },
        startingToolTexts
      );
      if (starting.unparsed.length > 0) {
        report.unparsed.push({ owner: raw.name, feature: "Starting Proficiencies", level: 1, unparsed: starting.unparsed });
      }

      features.sort((a, b) => a.level - b.level);

      // Subclasses
      const subclasses: SubclassModel[] = [];
      const subclassesForThis = rawSubclasses.filter(
        (sc) =>
          sc.className === raw.name &&
          (sc.classSource === raw.source || !sc.classSource)
      );

      for (const sc of subclassesForThis) {
        const scFeatures: ClassFeatureModel[] = [];
        const scFeaturesForThis = allSubclassFeatures.filter(
          (scf) =>
            scf.className === raw.name &&
            (scf.subclassShortName === sc.shortName || scf.subclassShortName === sc.name) &&
            (scf.subclassSource === sc.source || !scf.subclassSource)
        );

        // Skips entry ref stubs that only contain { type: "refSubclassFeature" }
        const subclassName = cleanTags(sc.name, "plain");
        for (const { raw: scf, choices, folded } of featuresWithChoices(scFeaturesForThis, "refSubclassFeature")) {
          const feature: ClassFeatureModel = {
            name: cleanTags(scf.name, "plain"),
            level: scf.level,
            description: renderEntries(scf.entries, "markdown"),
            ...(choices ? { choices } : {}),
          };
          scFeatures.push(feature);
          const owner = { source: sc.source, owner: `${raw.name}/${subclassName}` };
          pending.push({
            holder: feature,
            subject: { ...owner, feature: feature.name, level: feature.level, description: feature.description },
          });
          pending.push(...optionGrantSubjects(choices, folded, owner));
        }

        scFeatures.sort((a, b) => a.level - b.level);

        const additionalSpells = parseAdditionalSpells(sc.additionalSpells);
        const spellChoice = liftSpellChoice(additionalSpells);

        subclasses.push({
          name: cleanTags(sc.name, "plain"),
          shortName: sc.shortName || sc.name,
          source: sc.source,
          className: raw.name,
          classSource: raw.source,
          spellcastingAbility: sc.spellcastingAbility
            ? STAT_NAMES[sc.spellcastingAbility] || sc.spellcastingAbility
            : undefined,
          features: scFeatures,
          ...(additionalSpells ? { additionalSpells } : {}),
          ...(spellChoice ? { spellChoice } : {}),
          description: renderEntries(sc.entries, "markdown"),
        });
      }

      // Multiclassing
      let multiclassing: ClassModel["multiclassing"] = undefined;
      if (raw.multiclassing) {
        const reqs: Record<string, number> = {};
        if (raw.multiclassing.requirements) {
          for (const [k, v] of Object.entries(raw.multiclassing.requirements)) {
            if (typeof v === "number") {
              reqs[STAT_NAMES[k] || k] = v;
            }
          }
        }
        multiclassing = {
          requirements: reqs,
          proficienciesGained: raw.multiclassing.proficienciesGained,
        };
      }

      classes.push({
        name: raw.name,
        source: raw.source,
        hitDie,
        primaryAbility: (raw.primaryAbility || []).map((a: string) => STAT_NAMES[a] || a),
        savingThrows,
        armorProficiencies,
        weaponProficiencies,
        toolProficiencies,
        skillProficiencies,
        spellcasting,
        features,
        subclasses,
        ...(starting.grants.length > 0 ? { grants: starting.grants } : {}),
        multiclassing,
        description: renderEntries(raw.entries, "markdown"),
      });
    }
  }

  const resolved = resolveFeatureGrants(
    pending.map((p) => p.subject),
    PROFICIENCY_GRANT_OVERRIDES.classes,
    report
  );
  resolved.forEach((result, i) => {
    if (result.grants.length > 0) pending[i].holder.grants = result.grants;
  });

  return classes;
}
