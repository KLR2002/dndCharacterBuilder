/**
 * npm run review:grants
 *
 * Writes .scratch/proficiency-sheet/review.md: every feature whose prose matches
 * the proficiency vocabulary and that has neither grants nor a reviewed mark.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { REVIEWED_GRANTS_NOTHING } from "../overrides/proficiency-grants.ts";
import { coverageGaps } from "./coverage.ts";
import { renderReview } from "./review.ts";

const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));
const reviewPath = fileURLToPath(new URL("../../../.scratch/proficiency-sheet/review.md", import.meta.url));

const data = {
  classes: JSON.parse(fs.readFileSync(`${dataDir}classes.json`, "utf8")),
  feats: JSON.parse(fs.readFileSync(`${dataDir}feats.json`, "utf8")),
};
const gaps = coverageGaps(data, REVIEWED_GRANTS_NOTHING);
fs.writeFileSync(reviewPath, renderReview(gaps));
console.log(`review:grants: ${gaps.length} entries written to .scratch/proficiency-sheet/review.md`);
