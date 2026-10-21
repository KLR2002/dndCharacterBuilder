/**
 * npm run review:grants
 *
 * Writes the review file: every grant added and every mark (the decisions), the
 * matches that still have no decision, and the notes section of the decisions file.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PROFICIENCY_GRANT_OVERRIDES, REVIEWED_GRANTS_NOTHING } from "../overrides/proficiency-grants.ts";
import { coverageGaps } from "./coverage.ts";
import { notesSection, renderDecisionReview } from "./review.ts";

const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));
const scratchDir = fileURLToPath(new URL("../../../.scratch/proficiency-sheet/", import.meta.url));

const data = {
  classes: JSON.parse(fs.readFileSync(`${dataDir}classes.json`, "utf8")),
  feats: JSON.parse(fs.readFileSync(`${dataDir}feats.json`, "utf8")),
};
const open = coverageGaps(data, REVIEWED_GRANTS_NOTHING);
const notes = notesSection(fs.readFileSync(`${scratchDir}review-decisions.md`, "utf8"));
const text = renderDecisionReview({
  grants: [...PROFICIENCY_GRANT_OVERRIDES.classes, ...PROFICIENCY_GRANT_OVERRIDES.feats],
  marks: REVIEWED_GRANTS_NOTHING,
  open,
  notes,
});
fs.writeFileSync(`${scratchDir}review.md`, text);
console.log(
  `review:grants: ${PROFICIENCY_GRANT_OVERRIDES.classes.length + PROFICIENCY_GRANT_OVERRIDES.feats.length} grants, ${REVIEWED_GRANTS_NOTHING.length} marks, ${open.length} open; written to .scratch/proficiency-sheet/review.md`
);
