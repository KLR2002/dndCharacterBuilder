import type { ActiveBooks } from "../constants/books.ts";
import { BACKGROUND_FEAT_SOURCE } from "../constants/rules.ts";
import type { AsiSelection, Character } from "../types/character.ts";
import type { FeatData } from "../types/dnd5e.ts";
import type { Compendium, CompendiumListings } from "../services/compendium.ts";
import { findFeat } from "./featIncrease.ts";
import { findHeldRecord } from "./raceLookup.ts";
import { featOfSelection } from "./spellGrants.ts";

export interface FeatFeatureRow {
  id: string;
  name: string;
  source: string;
  description: string;
}

type NamedFeat = AsiSelection & { featName: string };

interface FeatContext {
  character: Character;
  compendium: Compendium;
  activeBooks: ActiveBooks;
  listings: CompendiumListings;
  feats: FeatData[];
}

const FALLBACK_DESCRIPTION = "Feat benefits.";

const isNamedFeat = (selection: AsiSelection): selection is NamedFeat => selection.type === "feat" && !!selection.featName;

/**
 * The feat rows the Features tab lists: the origin feats (a race's, a lineage's or a background's) first, then the feats taken
 * with an ability score increase, each in saved order. An origin feat always reads level 1.
 */
export function featFeatureRows(character: Character, compendium: Compendium, activeBooks: ActiveBooks): FeatFeatureRow[] {
  const listings = compendium.for(activeBooks);
  const ctx: FeatContext = { character, compendium, activeBooks, listings, feats: listings.feats() };
  const originRows = (character.originFeats ?? []).filter(isNamedFeat).map((selection, index) =>
    originRow(selection, `origin_feat_${index}_${selection.featName}`, ctx)
  );
  const asiRows = (character.asiSelections ?? []).filter(isNamedFeat).map((selection) =>
    bookFeatRow(selection, selection.level, `feat_${selection.featName}_${selection.level}`, ctx)
  );
  return [...originRows, ...asiRows];
}

function originRow(selection: NamedFeat, id: string, ctx: FeatContext): FeatFeatureRow {
  if (selection.featSource !== BACKGROUND_FEAT_SOURCE) return bookFeatRow(selection, 1, id, ctx);
  const record = featOfSelection(selection, ctx.feats, {
    activeBooks: ctx.activeBooks,
    listings: ctx.listings,
    backgroundSource: ctx.character.background?.source,
  });
  return {
    id,
    name: `${selection.featName} (Feat, Lvl 1)`,
    source: record?.source ?? BACKGROUND_FEAT_SOURCE,
    description: record?.description || FALLBACK_DESCRIPTION,
  };
}

function bookFeatRow(selection: NamedFeat, level: number, id: string, ctx: FeatContext): FeatFeatureRow {
  const record = findHeldRecord(ctx.feats, { name: selection.featName, source: selection.featSource }, ctx.activeBooks);
  return {
    id,
    name: `${selection.featName} (Feat, Lvl ${level})`,
    source: findFeat(selection.featName, selection.featSource, ctx.compendium, ctx.activeBooks)?.source ?? selection.featSource ?? "",
    description: record?.description || FALLBACK_DESCRIPTION,
  };
}
