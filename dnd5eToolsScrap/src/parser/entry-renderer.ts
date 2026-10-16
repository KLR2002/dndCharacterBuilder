import { cleanTags, type CleanMode } from "./tag-cleaner.ts";

/**
 * Renders nested 5e.tools entry trees into structured Markdown or Plain Text.
 */
export function renderEntries(
  entries: any[] | string | null | undefined,
  mode: CleanMode = "markdown",
  depth = 0
): string {
  if (!entries) return "";

  if (typeof entries === "string") {
    return cleanTags(entries, mode);
  }

  if (!Array.isArray(entries)) {
    return renderEntryObject(entries, mode, depth);
  }

  const blocks: string[] = [];

  for (const entry of entries) {
    if (!entry) continue;

    if (typeof entry === "string") {
      const text = cleanTags(entry, mode);
      if (text) blocks.push(text);
    } else if (typeof entry === "object") {
      const rendered = renderEntryObject(entry, mode, depth);
      if (rendered) blocks.push(rendered);
    }
  }

  const cleanedBlocks = blocks.filter(Boolean);
  const combined: string[] = [];
  for (const block of cleanedBlocks) {
    if (
      combined.length > 0 &&
      block.startsWith("- ") &&
      combined[combined.length - 1].startsWith("- ")
    ) {
      combined[combined.length - 1] += "\n" + block;
    } else {
      combined.push(block);
    }
  }

  return combined.join("\n\n");
}

function extractRefName(entry: any): string {
  if (entry.name) return String(entry.name).trim();
  const raw = entry.subclassFeature || entry.classFeature || entry.optionalfeature || "";
  if (typeof raw === "string") {
    return raw.split("|")[0].trim();
  }
  return "";
}

function renderEntryObject(entry: any, mode: CleanMode, depth: number): string {
  if (!entry || typeof entry !== "object") return "";

  // Handle cell object in tables
  if (entry.type === "cell") {
    if (entry.entry != null) return renderEntries(entry.entry, mode, depth);
    if (entry.roll?.exact != null) return String(entry.roll.exact);
    return "";
  }

  const lines: string[] = [];

  switch (entry.type) {
    case "entries":
    case "section":
    case "inset": {
      if (entry.name) {
        const title = cleanTags(entry.name, mode);
        if (mode === "markdown") {
          const hashes = "#".repeat(Math.min(depth + 3, 6));
          lines.push(`${hashes} ${title}\n`);
        } else {
          lines.push(`--- ${title} ---`);
        }
      }
      if (entry.entries) {
        lines.push(renderEntries(entry.entries, mode, depth + 1));
      }
      break;
    }

    case "list": {
      const listLines: string[] = [];
      if (Array.isArray(entry.items)) {
        for (const item of entry.items) {
          if (typeof item === "string") {
            listLines.push(`- ${cleanTags(item, mode)}`);
          } else if (item && typeof item === "object") {
            if (item.type === "item") {
              const name = cleanTags(item.name, mode);
              const content = item.entry
                ? cleanTags(item.entry, mode)
                : item.entries
                ? renderEntries(item.entries, mode, depth + 1)
                : "";
              listLines.push(name ? `- **${name}** ${content}` : `- ${content}`);
            } else if (item.name) {
              const name = cleanTags(item.name, mode);
              const content = item.entries
                ? renderEntries(item.entries, mode, depth + 1)
                : "";
              listLines.push(`- **${name}** ${content}`);
            } else if (
              item.type === "refSubclassFeature" ||
              item.type === "refClassFeature" ||
              item.type === "refOptionalfeature"
            ) {
              const refName = cleanTags(extractRefName(item), mode);
              if (refName) {
                listLines.push(mode === "markdown" ? `- **${refName}**` : `- ${refName}`);
              }
            } else {
              listLines.push(`- ${renderEntries(item, mode, depth + 1)}`);
            }
          }
        }
      }
      if (listLines.length > 0) {
        lines.push(listLines.join("\n"));
      }
      break;
    }

    case "table": {
      if (entry.caption) {
        const caption = cleanTags(entry.caption, mode);
        lines.push(mode === "markdown" ? `**${caption}**\n` : `[Table: ${caption}]`);
      }

      if (mode === "markdown" && Array.isArray(entry.colLabels) && entry.colLabels.length > 0) {
        const headers = entry.colLabels.map((c: any) => cleanTags(String(c), "markdown"));
        lines.push(`| ${headers.join(" | ")} |`);
        lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

        if (Array.isArray(entry.rows)) {
          for (const row of entry.rows) {
            if (Array.isArray(row)) {
              const cells = row.map((cell: any) => {
                if (cell == null) return "";
                if (typeof cell === "string") return cleanTags(cell, "markdown");
                if (typeof cell === "number") return String(cell);
                if (cell.roll?.exact != null) return String(cell.roll.exact);
                if (cell.entry != null) return cleanTags(String(cell.entry), "markdown");
                return renderEntries(cell, "markdown", depth + 1);
              });
              lines.push(`| ${cells.join(" | ")} |`);
            }
          }
        }
      } else if (Array.isArray(entry.rows)) {
        // Fallback or plain mode
        for (const row of entry.rows) {
          if (Array.isArray(row)) {
            const cells = row.map((c: any) => cleanTags(String(c?.entry || c?.roll?.exact || c || ""), mode));
            lines.push(cells.join(" | "));
          }
        }
      }
      break;
    }

    case "quote": {
      if (entry.entries) {
        const text = renderEntries(entry.entries, mode, depth + 1);
        if (mode === "markdown") {
          const quoted = text
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n");
          lines.push(quoted);
          if (entry.by) {
            lines.push(`> — *${cleanTags(entry.by, mode)}*`);
          }
        } else {
          lines.push(`"${text}"`);
          if (entry.by) lines.push(`- ${cleanTags(entry.by, mode)}`);
        }
      }
      break;
    }

    case "abilityDc": {
      const attrs = (entry.attributes || []).map((a: string) => a.toUpperCase()).join(" or ");
      const name = cleanTags(entry.name || "Spell", mode);
      lines.push(
        mode === "markdown"
          ? `**${name} save DC** = 8 + your proficiency bonus + your ${attrs} modifier`
          : `${name} save DC = 8 + your proficiency bonus + your ${attrs} modifier`
      );
      break;
    }

    case "abilityAttackMod": {
      const attrs = (entry.attributes || []).map((a: string) => a.toUpperCase()).join(" or ");
      const name = cleanTags(entry.name || "Spell", mode);
      lines.push(
        mode === "markdown"
          ? `**${name} attack modifier** = your proficiency bonus + your ${attrs} modifier`
          : `${name} attack modifier = your proficiency bonus + your ${attrs} modifier`
      );
      break;
    }

    case "item": {
      const name = cleanTags(entry.name, mode);
      const content = entry.entry
        ? cleanTags(entry.entry, mode)
        : entry.entries
        ? renderEntries(entry.entries, mode, depth + 1)
        : "";
      lines.push(mode === "markdown" && name ? `**${name}** ${content}` : `${name}: ${content}`);
      break;
    }

    case "refClassFeature":
    case "refSubclassFeature":
    case "refOptionalfeature": {
      const refName = cleanTags(extractRefName(entry), mode);
      if (refName) {
        lines.push(mode === "markdown" ? `- **${refName}**` : `- ${refName}`);
      }
      break;
    }

    default: {
      if (entry.name) {
        const title = cleanTags(entry.name, mode);
        lines.push(mode === "markdown" ? `**${title}**` : title);
      }
      if (entry.entries) {
        lines.push(renderEntries(entry.entries, mode, depth + 1));
      } else if (entry.entry) {
        lines.push(cleanTags(entry.entry, mode));
      }
      break;
    }
  }

  return lines.filter(Boolean).join("\n\n");
}
