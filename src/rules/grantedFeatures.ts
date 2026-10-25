import type { Character } from "../types/character.ts";
import type { ClassFeatureData } from "../types/dnd5e.ts";
import type { FeatureCatalog, FeatureInstance } from "./types.ts";
import { getReplacedBaseFeatures } from "./optionalFeatures.ts";
import { ruleChoiceId } from "./choices/types.ts";
import { applyRuleChoice, replacedTraitNames } from "./raceRuleChoices.ts";
import { raisedAbilityGrants } from "./proficiencyPools.ts";
import { recordGrantSources } from "./recordProficiencyGrants.ts";
import { grantRequirementMet, type SubclassOwner } from "./optionFeatureGrants.ts";
import { findClassData } from "./catalogs.ts";
import { isCustomBackground } from "./customBackground.ts";

export function grantedFeatures(character: Character, catalog: FeatureCatalog): FeatureInstance[] {
  const out: FeatureInstance[] = [];
  const replacedBaseFeatures = getReplacedBaseFeatures(character.optionalFeatureReplacements);

  function add(feature: Omit<FeatureInstance, "id">, owner: string, level = 0) {
    const id = JSON.stringify([feature.origin, feature.source, owner, feature.name, level]);
    if (!out.some(x => x.id === id)) out.push({ ...feature, id });
  }
  // The tool and language grants of the race, subrace and background the character holds: each is a feature of its own.
  for (const record of recordGrantSources(character, catalog)) {
    add({ name: record.name, description: "", source: record.source, origin: record.origin, grants: record.grants }, record.owner);
  }
  if (character.lineageReplacement) {
    const lineage = catalog.races.find(r => r.name === character.lineageReplacement);
    if (lineage) {
      for (const trait of lineage.traits || []) {
        add({ ...trait, source: lineage.source, origin: "Race" }, lineage.name);
      }
    }
  } else {
    const choice = character.race;
    const race = catalog.races.find(r => r.name === choice?.name && r.source === choice.source);
    const subrace = race?.subraces?.find(s => s.name === choice?.subraceName && (!choice.subraceSource || s.source === choice.subraceSource));
    const idFor = (source: string, trait: string) =>
      ruleChoiceId({
        source,
        race: choice!.name,
        subrace: choice!.subraceName ? { name: choice!.subraceName } : null,
        trait,
      });
    const suppressed = replacedTraitNames(character, catalog.races);
    for (const trait of race?.traits || []) {
      if (suppressed.has(trait.name)) continue;
      add(
        applyRuleChoice(character, { ...trait, source: race!.source, origin: "Race" }, trait.choice, idFor(race!.source, trait.name)),
        race!.name
      );
    }
    for (const trait of subrace?.traits || []) {
      if (suppressed.has(trait.name)) continue;
      add(
        applyRuleChoice(character, { ...trait, source: subrace!.source, origin: "Subrace" }, trait.choice, idFor(subrace!.source, trait.name)),
        subrace!.name
      );
    }
  }
  const background = character.background;
  const bg = catalog.backgrounds.find(b => b.name === background?.name && b.source === background.source);
  if (isCustomBackground(background) && background?.customFeatureName) {
    add({ name: background.customFeatureName, description: background.customFeatureDesc || "", source: background.source, origin: "Background" }, background.name);
  } else if (bg?.feature) add({ ...bg.feature, source: bg.source, origin: "Background" }, bg.name);

  for (const c of character.classes) {
    const cls = findClassData(catalog.classes, c);
    function addClassFeature(f: ClassFeatureData, origin: "Class" | "Subclass", source: string, owner: string, subclassName?: string) {
      if (f.level > c.level) return;
      const isOptEnabled = Boolean(character.optionalFeatureReplacements?.[f.name]);
      if (f.isOptional) {
        if (!isOptEnabled) return;
      } else {
        if (replacedBaseFeatures.has(f.name)) return;
      }
      const gateOwner = { className: c.className, subclassName: subclassName ?? "", subclassSource: source };
      // A grant that requires another feature's pick applies only with that pick: an unpicked option's grants are not listed.
      const grants = (f.grants ?? []).filter((grant) =>
        origin !== "Subclass" || grantRequirementMet(character, gateOwner, grant.requires, f.name),
      );
      const feature: Omit<FeatureInstance, "id"> = {
        name: f.name,
        description: f.description,
        source,
        origin,
        className: c.className,
        ...(subclassName ? { subclassName } : {}),
        level: f.level,
        ...(grants.length ? { grants } : {}),
        ...(f.initiativeBonus ? { initiativeBonus: f.initiativeBonus } : {}),
      };
      // The catalog repeats these at threshold levels. Retain one grant, not additive uses/attacks.
      if (/^Extra Attack(?: \(\d+\))?$/.test(f.name)) {
        feature.name = "Extra Attack";
        feature.attacks = c.className === "Fighter" ? (c.level >= 20 ? 4 : c.level >= 11 ? 3 : 2) : 2;
        const previous = out.find(x => x.name === "Extra Attack");
        if (previous) {
          if (feature.attacks >= (previous.attacks || 2)) Object.assign(previous, feature);
          return;
        }
      }
      if (f.name === "Unarmored Defense" && out.some(x => x.name === f.name)) return;
      if (f.name === "Channel Divinity" && ["Cleric", "Paladin"].includes(c.className)) {
        feature.max = c.className === "Cleric" ? (c.level >= 18 ? 3 : c.level >= 6 ? 2 : 1) : 1;
        feature.resetOn = "short";
        const previous = out.find(x => x.name === f.name);
        if (previous) {
          previous.max = Math.max(previous.max || 0, feature.max);
          return;
        }
      }
      add(feature, owner, f.level);
      if (origin === "Subclass") addPickedOptions(f, gateOwner, feature.source, owner, subclassName);
    }
    /**
     * A subclass feature's option features are folded into the feature's choice. An option that carries its own
     * grants is listed as a feature of its own while the parent's pick names it, so its grants reach the sheet.
     */
    function addPickedOptions(f: ClassFeatureData, gateOwner: SubclassOwner, source: string, owner: string, subclassName?: string) {
      for (const option of f.choices?.options ?? []) {
        if (!option.grants?.length) continue;
        if (!grantRequirementMet(character, gateOwner, { feature: f.name, level: f.level }, option.name)) continue;
        const level = option.level ?? f.level;
        add(
          {
            name: option.name,
            description: option.description,
            source: option.source ?? source,
            origin: "Subclass",
            className: c.className,
            ...(subclassName ? { subclassName } : {}),
            level,
            grants: option.grants,
          },
          owner,
          level,
        );
      }
    }
    for (const f of cls?.features || []) addClassFeature(f, "Class", c.source, c.className);
    const subclass = cls?.subclasses.find(s => s.name === c.subclassName && (!c.subclassSource || s.source === c.subclassSource));
    for (const f of subclass?.features || []) addClassFeature(f, "Subclass", subclass!.source, `${c.className}/${subclass!.name}`, subclass!.name);
  }
  // Feats from the ability score list and from the origin-feat list (a background's feat) both count.
  for (const selection of [...character.asiSelections, ...(character.originFeats ?? [])]) {
    if (selection.type !== "feat") continue;
    const feat = catalog.feats.find(x => x.name === selection.featName && (!selection.featSource || x.source === selection.featSource));
    if (feat) {
      const grants = raisedAbilityGrants(feat.grants ?? [], selection.featAbility);
      add({ name: feat.name, description: feat.description, source: feat.source, origin: "Feat", ...(grants.length ? { grants } : {}) }, feat.name);
    }
  }
  return out;
}
