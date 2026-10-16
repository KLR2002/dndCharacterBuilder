import type { ChoiceOption, ClassFeatureData } from "../types/dnd5e.ts";

/**
 * The description the Features tab shows for a class or subclass feature. A feature whose choices
 * fold option features beneath it (the scraper's `options` entries) lists those options after its
 * text: a "Choose N:" line, then one bullet per option. An option printed in the owner's book, or
 * with no book, is always listed; one printed in another book only while that book is active.
 * A feature with no listable options keeps its description unchanged.
 */
export function describeClassFeature(
  feature: ClassFeatureData,
  ownerBook: string,
  activeBooks: readonly string[],
  fallback: string
): string {
  const description = feature.description || fallback;
  const choices = feature.choices;
  if (!choices?.options) return description;

  const owner = ownerBook.toUpperCase();
  const active = activeBooks.map((b) => b.toUpperCase());
  const listed = choices.options.filter((o) => {
    const book = o.source?.toUpperCase();
    return !book || book === owner || active.includes(book);
  });
  if (listed.length === 0) return description;

  const bullets = listed.map(optionBullet);
  return [description, [`Choose ${choices.pick}:`, ...bullets].join("\n")].join("\n\n");
}

function optionBullet(option: ChoiceOption): string {
  const text = option.description.trim();
  if (!text) return `- **${option.name}**`;
  // Continuation lines are indented so a multi-paragraph option stays inside its bullet.
  return `- **${option.name}**: ${text.replace(/\n(?=.)/g, "\n  ")}`;
}
