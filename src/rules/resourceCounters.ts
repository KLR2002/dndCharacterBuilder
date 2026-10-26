import type { AbilityScores, Character, ResourceCounter } from "../types/character.ts";
import { getBardicInspirationDie, getSuperiorityDice } from "./combatDice.ts";

/**
 * Derives canonical 2014 rules class resource counters from character classes and ability modifiers.
 */
export function calculateAutoResourceCounters(
  character: Character,
  modifiers: AbilityScores | Record<string, number>
): Record<string, ResourceCounter> {
  const res: Record<string, ResourceCounter> = {};
  const classes = character.classes || [];

  for (const c of classes) {
    const lvl = c.level;
    if (c.className === "Barbarian") {
      const maxRage = lvl >= 20 ? 999 : lvl >= 17 ? 6 : lvl >= 12 ? 5 : lvl >= 6 ? 4 : lvl >= 3 ? 3 : 2;
      res["rage"] = { id: "rage", name: "Rage", current: maxRage, max: maxRage, resetOn: "long" };
    }
    if (c.className === "Druid" && lvl >= 2) {
      const maxWs = lvl >= 20 ? 999 : 2;
      res["wild_shape"] = { id: "wild_shape", name: "Wild Shape", current: maxWs, max: maxWs, resetOn: "short" };
    }
    if (c.className === "Monk" && lvl >= 2) {
      res["ki"] = { id: "ki", name: "Ki Points", current: lvl, max: lvl, resetOn: "short" };
    }
    if (c.className === "Bard") {
      const maxInsp = Math.max(1, modifiers.cha ?? 0);
      const resetOn = lvl >= 5 ? "short" : "long";
      const die = getBardicInspirationDie(lvl) || "1d6";
      res["bardic_inspiration"] = {
        id: "bardic_inspiration",
        name: `Bardic Inspiration [${die} die]`,
        current: maxInsp,
        max: maxInsp,
        resetOn,
      };
    }
    if (c.className === "Fighter") {
      res["second_wind"] = { id: "second_wind", name: "Second Wind", current: 1, max: 1, resetOn: "short" };
      if (lvl >= 2) {
        const maxSurge = lvl >= 17 ? 2 : 1;
        res["action_surge"] = { id: "action_surge", name: "Action Surge", current: maxSurge, max: maxSurge, resetOn: "short" };
      }
    }
    if (c.className === "Paladin") {
      res["lay_on_hands"] = { id: "lay_on_hands", name: "Lay on Hands (HP Pool)", current: lvl * 5, max: lvl * 5, resetOn: "long" };
    }
  }

  // Unified Channel Divinity: Cleric 2: 1, Cleric 6: 2, Cleric 18: 3; Paladin 3: 1. Max uses = max(clericUses, paladinUses).
  const cleric = classes.find((c) => c.className === "Cleric");
  const paladin = classes.find((c) => c.className === "Paladin");
  const clericUses = cleric ? (cleric.level >= 18 ? 3 : cleric.level >= 6 ? 2 : cleric.level >= 2 ? 1 : 0) : 0;
  const paladinUses = paladin && paladin.level >= 3 ? 1 : 0;
  const maxCd = Math.max(clericUses, paladinUses);
  if (maxCd > 0) {
    res["channel_divinity"] = {
      id: "channel_divinity",
      name: "Channel Divinity",
      current: maxCd,
      max: maxCd,
      resetOn: "short",
    };
  }

  const supDice = getSuperiorityDice(character);
  if (supDice?.battleMaster) {
    const { count, die } = supDice.battleMaster;
    res["superiority_dice"] = {
      id: "superiority_dice",
      name: `Superiority Dice [${die}]`,
      current: count,
      max: count,
      resetOn: "short",
    };
  }
  if (supDice?.bonus) {
    const { count, die } = supDice.bonus;
    res["superiority_dice_d6"] = {
      id: "superiority_dice_d6",
      name: `Superiority Dice [${die}]`,
      current: count,
      max: count,
      resetOn: "short",
    };
  }

  return res;
}

/**
 * Merges derived auto-counters with saved character expenditures.
 * Preserves custom counters created by the player and clamps auto-counter usage to valid bounds.
 */
export function getMergedResourceCounters(
  character: Character,
  autoCounters: Record<string, ResourceCounter>
): Record<string, ResourceCounter> {
  const existing = { ...(character.resourceCounters || {}) };

  // Remove legacy separated channel divinity keys
  delete existing["channel_divinity_pal"];
  delete existing["channel_divinity_cle"];

  // Merge auto-counters with existing values
  const merged: Record<string, ResourceCounter> = { ...existing };

  for (const [id, auto] of Object.entries(autoCounters)) {
    if (existing[id]) {
      merged[id] = {
        ...auto,
        current: Math.min(existing[id].current, auto.max),
      };
    } else {
      merged[id] = { ...auto };
    }
  }

  // A character who lost the Battle Master pool keeps its spent count on the bonus counter, which is new under its own id.
  const bonusCounter = autoCounters["superiority_dice_d6"];
  if (bonusCounter && !autoCounters["superiority_dice"] && existing["superiority_dice"] && !existing["superiority_dice_d6"]) {
    merged["superiority_dice_d6"] = {
      ...bonusCounter,
      current: Math.min(existing["superiority_dice"].current, bonusCounter.max),
    };
  }

  // Clean up obsolete superiority dice counters if character no longer possesses the pool
  if (!autoCounters["superiority_dice"]) {
    delete merged["superiority_dice"];
  }
  if (!autoCounters["superiority_dice_d6"]) {
    delete merged["superiority_dice_d6"];
  }

  return merged;
}
