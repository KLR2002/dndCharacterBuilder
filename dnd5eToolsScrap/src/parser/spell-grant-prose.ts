import type { AdditionalSpells } from "../types/models.ts";
import { proseSentences } from "./proficiency-grants.ts";

/**
 * Reads whether a feat's prose grants spells, and whether its structured spell grants are ones the app's reader turns
 * into Innate Magic (ADR 0017). The coverage gate reads both through these functions.
 */

/**
 * The sentences that grant a spell or cantrip: "you learn … cantrip", "you know … spell", "you can cast … spell",
 * "choose … spell … cast it", and "you have learned … spells" (a feat that gives a ritual book). A trigger such as
 * "whenever you cast a spell" is not a grant, so it does not match.
 */
const GRANT_SENTENCES: RegExp[] = [
  /\byou (?:have )?(?:learn|learned|know|acquire|acquired)\b[^.]*\b(?:spells?|cantrips?)\b/i,
  /\byou can cast\b[^.]*\b(?:spells?|cantrips?)\b/i,
  /\bchoose\b[^.]*\bspells?\b[^.]*\bcast\b/i,
];

/** The sentences of a feat's prose that grant a spell, without their final punctuation. Headings are not sentences. */
export function spellGrantSentences(description: string): string[] {
  return proseSentences(description)
    .filter((sentence) => !sentence.startsWith("#"))
    .map((sentence) => sentence.replace(/[.!?]+$/, "").trim())
    .filter((sentence) => GRANT_SENTENCES.some((pattern) => pattern.test(sentence)));
}

/**
 * Whether the reader can give spells from these grants: a known or innate spell is one the reader models, a named spell or a
 * pick that is not a ritual pick, whether or not the grant names a casting ability (ADR 0017). A prepared spell is one the
 * reader models the same way, and needs no ability of its own (ADR 0017 amendment).
 */
export function readsSpellGrants(grants: AdditionalSpells[] | undefined): boolean {
  return (grants ?? []).some(
    (grant) => modelledSpells(grant.known) || modelledSpells(grant.innate) || modelledSpells(grant.prepared),
  );
}

function modelledSpells(value: unknown): boolean {
  if (typeof value === "string") return true;
  if (Array.isArray(value)) return value.some(modelledSpells);
  if (!value || typeof value !== "object") return false;
  const choose = (value as { choose?: unknown }).choose;
  if (typeof choose === "string") return !isRitualFilter(choose);
  if (choose && typeof choose === "object" && Array.isArray((choose as { from?: unknown }).from)) return true;
  // A ritual list is the ritual book, which the reader does not read (ADR 0017).
  return Object.entries(value).some(([key, inner]) => key !== "count" && key !== "ritual" && modelledSpells(inner));
}

/** A `key=value|key=value` filter with a `components & miscellaneous=ritual` part: the ritual book, which is not modelled. */
function isRitualFilter(filter: string): boolean {
  return filter.split("|").some((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return false;
    return part.slice(0, eq).trim().toLowerCase() === "components & miscellaneous" && part.slice(eq + 1).trim().toLowerCase() === "ritual";
  });
}
