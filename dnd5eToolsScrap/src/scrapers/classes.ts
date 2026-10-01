import { ToolsClient } from "../client.js";
import { renderEntries } from "../parser/entry-renderer.js";
import { cleanTags } from "../parser/tag-cleaner.js";
import { ClassFeatureModel, ClassModel, SubclassModel } from "../types/models.js";

const STAT_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export async function scrapeClasses(client: ToolsClient): Promise<ClassModel[]> {
  console.log("  → Fetching class index from data/class/index.json...");
  const classIndex = await client.fetchJson<Record<string, string>>("data/class/index.json");

  const classes: ClassModel[] = [];

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
            toolProficiencies.push(cleanTags(typeof t === "string" ? t : t.full || t.name || "", "plain"));
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

      for (const cf of classFeaturesForThis) {
        // Skip entry ref stubs that only contain { type: "refClassFeature" }
        const isOnlyRef =
          Array.isArray(cf.entries) &&
          cf.entries.length === 1 &&
          cf.entries[0]?.type === "refClassFeature";

        if (isOnlyRef) continue;

        features.push({
          name: cleanTags(cf.name, "plain"),
          level: cf.level,
          description: renderEntries(cf.entries, "markdown"),
          isOptional: cf.isClassFeatureVariant || false,
        });
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

        for (const scf of scFeaturesForThis) {
          const isOnlyRef =
            Array.isArray(scf.entries) &&
            scf.entries.length === 1 &&
            scf.entries[0]?.type === "refSubclassFeature";

          if (isOnlyRef) continue;

          scFeatures.push({
            name: cleanTags(scf.name, "plain"),
            level: scf.level,
            description: renderEntries(scf.entries, "markdown"),
          });
        }

        scFeatures.sort((a, b) => a.level - b.level);

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
        multiclassing,
        description: renderEntries(raw.entries, "markdown"),
      });
    }
  }

  return classes;
}
