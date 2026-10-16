export type CleanMode = "markdown" | "plain";

/**
 * Resolves a single 5e.tools tag to clean text / markdown.
 */
export function cleanTag(tag: string, content: string, mode: CleanMode = "markdown"): string {
  const parts = content.split("|");
  const first = parts[0]?.trim() || "";

  switch (tag.toLowerCase()) {
    case "b":
    case "bold":
      return mode === "markdown" ? `**${first}**` : first;
    case "i":
    case "italic":
    case "em":
      return mode === "markdown" ? `*${first}*` : first;
    case "u":
    case "underline":
      return mode === "markdown" ? `<u>${first}</u>` : first;
    case "s":
    case "strike":
      return mode === "markdown" ? `~~${first}~~` : first;
    case "code":
      return mode === "markdown" ? `\`${first}\`` : first;
    case "note":
      return mode === "markdown" ? `*(Note: ${first})*` : `Note: ${first}`;
    case "damage":
      return first;
    case "dice":
      return parts.length > 1 && parts[1]?.trim() ? parts[1].trim() : first;
    case "d20": {
      const num = Number(first);
      return !isNaN(num) && num >= 0 ? `+${num}` : first;
    }
    case "dc":
      return `DC ${first}`;
    case "hit":
      return first.startsWith("+") || first.startsWith("-") ? first : `+${first}`;
    case "chance":
      return `${first}%`;
    case "recharge":
      return first ? `(Recharge ${first}-6)` : `(Recharge 6)`;
    case "filter":
    case "link":
    case "5etools":
    case "book":
    case "adventure":
    case "area":
    case "quickref":
      return first;
    case "spell":
    case "item":
    case "creature":
    case "race":
    case "class":
    case "subclass":
    case "feat":
    case "background":
    case "condition":
    case "disease":
    case "action":
    case "status":
    case "sense":
    case "skill":
    case "optfeature":
    case "reward":
    case "table":
    case "deity":
    case "hazard":
    case "object":
    case "facility":
    case "vehicle":
    case "vehupgrade":
    case "language":
    case "card":
    case "deck":
    case "psionic":
    case "variantrule":
    case "itemmastery":
    case "itemproperty":
    case "cult":
    case "boon":
    case "trap":
    case "charoption":
      // Standard format: name|source|displayText
      if (parts.length >= 3 && parts[2]?.trim()) {
        return parts[2].trim();
      }
      return first;
    case "classfeature":
    case "subclassfeature": {
      // name|class|source|level|...|displayText
      const last = parts[parts.length - 1]?.trim() || "";
      if (parts.length > 3 && isNaN(Number(last)) && last !== "") {
        return last;
      }
      return first;
    }
    default:
      return parts[parts.length - 1]?.trim() || first;
  }
}

/**
 * Strips or converts all 5e.tools tags (e.g. {@spell fireball|phb}) from a string.
 * Recursively resolves nested tags.
 */
export function cleanTags(str: string | null | undefined, mode: CleanMode = "markdown"): string {
  if (!str || typeof str !== "string") return "";
  let res = str;
  let prev = "";
  const tagRegex = /\{@([a-zA-Z0-9]+)(?: ([^{}]+?))?\}/g;

  // Loop to resolve nested tags inside-out
  let iterations = 0;
  while (res !== prev && res.includes("{@") && iterations < 10) {
    prev = res;
    res = res.replace(tagRegex, (_, tag, content = "") => cleanTag(tag, content, mode));
    iterations++;
  }

  // Clean any remaining unclosed braces or stray artifacts
  return res.replace(/\s+/g, " ").trim();
}
