// This module imports nothing. compendium.ts imports raceLookup.ts, and both need this rule, so it cannot live in either.

// The source of the SRD Baseline's records. The same value as SRD_SOURCE in constants/books.ts.
const SRD = "SRD";

/**
 * Whether a record from `source` is admitted by `activeBooks` (ADR 0025). A record with no source and an SRD record are always
 * admitted. Book codes compare without regard to case. `undefined` (ALL_BOOKS) admits every book, and an empty list admits none.
 */
export function admitsBook(activeBooks: readonly string[] | undefined, source?: string): boolean {
  if (!source || source === SRD || activeBooks === undefined) return true;
  const code = source.toLowerCase();
  return activeBooks.some((book) => book.toLowerCase() === code);
}

/**
 * Whether a record from `source` belongs to an active book: admitted, and not an SRD record. A held name prefers such a
 * record. With no book list (ALL_BOOKS) no record counts as active, so the first listed one is used.
 */
export function isActiveBookRecord(activeBooks: readonly string[] | undefined, source: string): boolean {
  return activeBooks !== undefined && source !== SRD && admitsBook(activeBooks, source);
}
