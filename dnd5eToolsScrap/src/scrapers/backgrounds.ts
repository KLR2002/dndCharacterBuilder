import { ToolsClient } from "../client.js";
import { resolveAllCopies } from "../parser/copy-resolver.js";
import { renderEntries } from "../parser/entry-renderer.js";
import { cleanTags } from "../parser/tag-cleaner.js";
import { BackgroundModel } from "../types/models.js";

export async function scrapeBackgrounds(client: ToolsClient): Promise<BackgroundModel[]> {
  console.log("  → Fetching backgrounds from data/backgrounds.json...");
  const rawData = await client.fetchJson<{ background: any[] }>("data/backgrounds.json");

  const resolved = resolveAllCopies(rawData.background || []);
  const backgrounds: BackgroundModel[] = [];

  for (const raw of resolved) {
    // Skill proficiencies
    const skills: string[] = [];
    if (Array.isArray(raw.skillProficiencies)) {
      for (const sp of raw.skillProficiencies) {
        for (const [k, v] of Object.entries(sp)) {
          if (v) {
            skills.push(k.charAt(0).toUpperCase() + k.slice(1));
          }
        }
      }
    }

    // Tool proficiencies
    const tools: string[] = [];
    if (Array.isArray(raw.toolProficiencies)) {
      for (const tp of raw.toolProficiencies) {
        for (const [k, v] of Object.entries(tp)) {
          if (v) {
            tools.push(cleanTags(k, "plain"));
          }
        }
      }
    }

    // Languages
    const languages: string[] = [];
    if (Array.isArray(raw.languageProficiencies)) {
      for (const lp of raw.languageProficiencies) {
        for (const [k, v] of Object.entries(lp)) {
          if (k === "anyStandard") languages.push(`${v} standard languages of your choice`);
          else if (k === "any") languages.push(`${v} languages of your choice`);
          else if (v) languages.push(k.charAt(0).toUpperCase() + k.slice(1));
        }
      }
    }

    // Equipment
    const equipment: string[] = [];
    if (Array.isArray(raw.startingEquipment)) {
      for (const eqGroup of raw.startingEquipment) {
        for (const list of Object.values(eqGroup)) {
          if (Array.isArray(list)) {
            for (const item of list) {
              if (typeof item === "string") {
                equipment.push(cleanTags(item.split("|")[0], "plain"));
              } else if (item && typeof item === "object") {
                const name = item.displayName || item.special || (item.item ? item.item.split("|")[0] : "");
                const qty = item.quantity ? `${item.quantity} ` : "";
                if (name) equipment.push(cleanTags(`${qty}${name}`, "plain"));
                if (item.containsValue) {
                  equipment.push(`${item.containsValue / 100} gp`);
                }
              }
            }
          }
        }
      }
    }

    // Feature extraction
    let feature: BackgroundModel["feature"] = null;
    const characteristics: BackgroundModel["characteristics"] = {};

    if (Array.isArray(raw.entries)) {
      for (const entry of raw.entries) {
        if (!entry || typeof entry !== "object") continue;

        if (entry.data?.isFeature || (typeof entry.name === "string" && entry.name.startsWith("Feature:"))) {
          feature = {
            name: cleanTags(entry.name.replace(/^Feature:\s*/, ""), "plain"),
            description: renderEntries(entry.entries || entry.entry, "markdown"),
          };
        }

        // Characteristics tables
        if (entry.name === "Suggested Characteristics" && Array.isArray(entry.entries)) {
          for (const sub of entry.entries) {
            if (sub && sub.type === "table" && Array.isArray(sub.rows)) {
              const cap = (sub.caption || "").toLowerCase();
              const colLabel = (sub.colLabels?.[1] || "").toLowerCase();
              const targetType = cap.includes("trait") || colLabel.includes("trait")
                ? "personalityTraits"
                : cap.includes("ideal") || colLabel.includes("ideal")
                ? "ideals"
                : cap.includes("bond") || colLabel.includes("bond")
                ? "bonds"
                : cap.includes("flaw") || colLabel.includes("flaw")
                ? "flaws"
                : null;

              if (targetType) {
                characteristics[targetType] = sub.rows.map((row: any[]) => ({
                  roll: String(row[0]?.roll?.exact || row[0] || ""),
                  text: cleanTags(String(row[1]?.entry || row[1] || ""), "plain"),
                }));
              }
            }
          }
        }
      }
    }

    backgrounds.push({
      name: cleanTags(raw.name, "plain"),
      source: raw.source,
      skillProficiencies: skills,
      toolProficiencies: tools,
      languages,
      startingEquipment: equipment,
      feature,
      characteristics,
      description: renderEntries(raw.entries, "markdown"),
      rawEntries: raw.entries,
    });
  }

  return backgrounds;
}
