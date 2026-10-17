/**
 * Returns the trimmed name to store, or the previous name when the input is blank.
 */
export function commitCharacterName(input: string, previous: string): string {
  const trimmed = input.trim();
  return trimmed === "" ? previous : trimmed;
}
