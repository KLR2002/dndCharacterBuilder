/**
 * npm run enrich:grants
 *
 * Adds the `grants` field to the tracked class, subclass and feat features in
 * data/classes.json and data/feats.json, and to each tracked class's starting
 * tools; and the `initiativeBonus` field to the tracked class and subclass
 * features. Idempotent; writes a file only when its content changes. The only way
 * grants and Initiative Bonuses reach the tracked data (see ADR 0015 and ADR 0016).
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PROFICIENCY_GRANT_OVERRIDES } from "../overrides/proficiency-grants.ts";
import { INITIATIVE_BONUS_OVERRIDES } from "../overrides/initiative-bonuses.ts";
import { enrichGrantFiles } from "./enrich.ts";
import { allRefs, classFeatureOnlyRefs, type TrackedData } from "./subjects.ts";

const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));
const paths = { classes: `${dataDir}classes.json`, feats: `${dataDir}feats.json` };

const before = { classes: fs.readFileSync(paths.classes, "utf8"), feats: fs.readFileSync(paths.feats, "utf8") };
const after = enrichGrantFiles(before, { ...PROFICIENCY_GRANT_OVERRIDES, initiativeBonuses: INITIATIVE_BONUS_OVERRIDES });

for (const name of ["classes", "feats"] as const) {
  if (after[name] !== before[name]) fs.writeFileSync(paths[name], after[name]);
}

const trackedData: TrackedData = { classes: JSON.parse(after.classes), feats: JSON.parse(after.feats) };
const granted =
  allRefs(trackedData).filter((ref) => ref.holder.grants && ref.holder.grants.length > 0).length +
  trackedData.classes.filter((cls) => cls.grants && cls.grants.length > 0).length;
const initiative = classFeatureOnlyRefs(trackedData.classes).filter((ref) => ref.holder.initiativeBonus).length;
const changed = (["classes", "feats"] as const).filter((name) => after[name] !== before[name]);
console.log(
  `enrich:grants: ${granted} class, subclass and feat features carry grants; ${initiative} class and subclass features carry an Initiative Bonus; ${changed.length ? `wrote ${changed.join(", ")}` : "no file changed"}`
);
