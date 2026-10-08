import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function getSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "data" && entry.name !== "node_modules") {
        results.push(...getSourceFiles(fullPath));
      }
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

test("glossary consistency: prohibited terms from GLOSSARY.md do not appear in source code", () => {
  const glossaryPath = path.join(process.cwd(), "GLOSSARY.md");
  assert.ok(fs.existsSync(glossaryPath), "GLOSSARY.md must exist");
  const content = fs.readFileSync(glossaryPath, "utf-8");

  // Extract explicit multi-word avoid terms (multi-word terms are domain-specific and avoid false positives)
  const avoidMatches = content.match(/_Avoid_:\s*(.+)/g) || [];
  const multiWordProhibited: string[] = [];

  for (const line of avoidMatches) {
    const rawTerms = line.replace(/_Avoid_:\s*/, "").split(",");
    for (const term of rawTerms) {
      const cleaned = term.trim().replace(/^\*+|\*+$/g, "");
      if (cleaned.includes(" ") && cleaned.length > 5) {
        multiWordProhibited.push(cleaned.toLowerCase());
      }
    }
  }

  assert.ok(multiWordProhibited.length > 5, "Should extract prohibited multi-word phrases from GLOSSARY.md");

  const scanFiles = [
    ...getSourceFiles(path.join(process.cwd(), "src")),
    ...getSourceFiles(path.join(process.cwd(), "checks")).filter(
      (f) => !f.endsWith("glossaryConsistency.test.ts")
    ),
  ];

  const violations: { file: string; term: string }[] = [];

  for (const file of scanFiles) {
    const fileContent = fs.readFileSync(file, "utf-8").toLowerCase();
    for (const term of multiWordProhibited) {
      if (fileContent.includes(term)) {
        violations.push({ file: path.relative(process.cwd(), file), term });
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found prohibited GLOSSARY.md terms in src and checks:\n${violations.map((v) => `  - ${v.file}: "${v.term}"`).join("\n")}`
  );
});

test("glossary consistency: prohibited domain symbol patterns do not appear in code", () => {
  const domainPatterns: { name: string; regex: RegExp }[] = [
    { name: "toggleRuleChoice", regex: /\btoggle[A-Z0-9_]*RuleChoice\b/ },
    { name: "patronSpells", regex: /\bpatronSpells\b|\bpatron_spells\b/ },
    { name: "bonusCantrip", regex: /\bbonusCantrip\b|\bbonus_cantrip\b/ },
    { name: "bonusDomainSlots", regex: /\bbonus_domain_slots\b|\bbonusDomainSlots\b/ },
    { name: "bonusKnownSpells", regex: /\bbonus_known_spells\b|\bbonusKnownSpells\b/ },
    { name: "alternateSpeeds", regex: /\balternateSpeeds\b|\bspeedTypes\b/ },
    { name: "totemToggle", regex: /\banimalPerk\b|\btotemToggle\b|\btotem_toggle\b/ },
    { name: "hybridPerks", regex: /\bhybridPerks\b|\bhybrid_perks\b/ },
  ];

  const scanFiles = [
    ...getSourceFiles(path.join(process.cwd(), "src")),
    ...getSourceFiles(path.join(process.cwd(), "checks")).filter(
      (f) => !f.endsWith("glossaryConsistency.test.ts")
    ),
  ];

  const patternViolations: { file: string; pattern: string; line: number; text: string }[] = [];

  for (const file of scanFiles) {
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip deprecated alias declarations or comments
      if (line.includes("@deprecated") || line.includes("export const toggleSubclassRuleChoice")) continue;
      for (const p of domainPatterns) {
        if (p.regex.test(line)) {
          patternViolations.push({
            file: path.relative(process.cwd(), file),
            pattern: p.name,
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }
  }

  assert.deepEqual(
    patternViolations,
    [],
    `Found prohibited domain symbol patterns:\n${patternViolations.map((v) => `  - ${v.file}:${v.line} (${v.pattern}): "${v.text}"`).join("\n")}`
  );
});
