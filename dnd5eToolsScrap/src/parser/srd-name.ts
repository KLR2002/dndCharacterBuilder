/** The SRD's name for a raw record whose `srd` field gives one as a string (`true` gives none), or undefined. */
export function srdNameOf(raw: { srd?: unknown }): string | undefined {
  return typeof raw.srd === "string" && raw.srd.length > 0 ? raw.srd : undefined;
}
