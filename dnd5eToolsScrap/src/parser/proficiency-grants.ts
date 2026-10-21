import type {
  ProficiencyCategory,
  ProficiencyGrant,
  ProficiencyGrantSpec,
  ProficiencyReport,
} from "../types/proficiency.ts";

/**
 * Turns Proficiency Grants out of feature prose and structured proficiency
 * fields. Only clear grant sentences become grants. A feature whose matching
 * sentences cannot all be parsed gets no grants and is reported instead, so a
 * partial grant never ships silently. Reviewed overrides (names only) replace
 * the extracted grants for one feature.
 */

/** The feature a grant belongs to. `owner` is the class, `Class/Subclass`, `Feat`, `Race` or `Background`. */
export interface GrantSubject {
  source: string;
  owner: string;
  feature: string;
  level: number;
  description: string;
}

/** A reviewed grant set for one feature, written with names only. */
export interface GrantOverride {
  owner: string;
  feature: string;
  level: number;
  grants: ProficiencyGrantSpec[];
}

export interface FeatureGrantResult {
  subject: GrantSubject;
  grants: ProficiencyGrant[];
  unparsed: string[];
}

export interface StructuredProficiencies {
  skills?: unknown[];
  tools?: unknown[];
  languages?: unknown[];
  weapons?: unknown[];
  armor?: unknown[];
  savingThrows?: string[];
}

// Closed rule vocabulary. Names, not prose.

const SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight",
  "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion",
  "Religion", "Sleight of Hand", "Stealth", "Survival",
];
const ABILITIES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const ARTISAN_TOOLS = [
  "alchemist's supplies", "brewer's supplies", "calligrapher's supplies", "carpenter's tools",
  "cartographer's tools", "cobbler's tools", "cook's utensils", "glassblower's tools", "jeweler's tools",
  "leatherworker's tools", "mason's tools", "painter's supplies", "potter's tools", "smith's tools",
  "tinker's tools", "weaver's tools", "woodcarver's tools",
];
const MUSICAL_INSTRUMENTS = [
  "bagpipes", "drum", "dulcimer", "flute", "horn", "lute", "lyre", "pan flute", "shawm", "viol",
];
const GAMING_SETS = ["dice set", "dragonchess set", "playing card set", "three-dragon ante set"];
/** The tool pools a counted or listed category key names: "anyArtisansTool: 1" is one artisan's tool. */
const COUNTED_TOOL_POOLS: Record<string, string[]> = {
  anyArtisansTool: ARTISAN_TOOLS,
  anyMusicalInstrument: MUSICAL_INSTRUMENTS,
  anyGamingSet: GAMING_SETS,
};
/** A list entry that names one of the pools above by its category word, as the choice lists write it. */
const LISTED_TOOL_POOLS: Record<string, string[]> = {
  anyartisanstool: ARTISAN_TOOLS,
  "musical instrument": MUSICAL_INSTRUMENTS,
  anymusicalinstrument: MUSICAL_INSTRUMENTS,
  "gaming set": GAMING_SETS,
  anygamingset: GAMING_SETS,
};
/** A vehicle proficiency, such as "vehicles (water)". The app names it "Vehicles (Water)". */
const VEHICLE = /^vehicles \((?:land|water|air|space)\)$/;
const WEAPON_NAMES = [
  "club", "dagger", "greatclub", "handaxe", "javelin", "light hammer", "mace", "quarterstaff", "sickle",
  "spear", "light crossbow", "dart", "shortbow", "sling", "battleaxe", "flail", "glaive", "greataxe",
  "greatsword", "halberd", "lance", "longsword", "maul", "morningstar", "pike", "rapier", "scimitar",
  "shortsword", "trident", "war pick", "warhammer", "whip", "blowgun", "hand crossbow", "heavy crossbow",
  "longbow", "net", "firearms",
];
const ARMOR_NAMES: Record<string, string> = {
  "light armor": "light armor",
  light: "light armor",
  "medium armor": "medium armor",
  medium: "medium armor",
  "heavy armor": "heavy armor",
  heavy: "heavy armor",
  shield: "shields",
  shields: "shields",
};
const WEAPON_GROUPS: Record<string, string> = {
  simple: "simple weapons",
  "simple weapons": "simple weapons",
  martial: "martial weapons",
  "martial weapons": "martial weapons",
};
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const SKILL_BY_LOWER = new Map(SKILLS.map((s) => [s.toLowerCase(), s]));
const ABILITY_BY_LOWER = new Map(ABILITIES.map((s) => [s.toLowerCase(), s]));
const WEAPON_SET = new Set(WEAPON_NAMES);

/** Sentences that mention proficiency ("proficiency", "proficient") or language learning. Only these are considered at all. */
const CANDIDATE = /proficien|languages?\b|\bspeak,?\s+read\b/i;

/**
 * Mentions that name a proficiency or language without granting one. Each is
 * removed from a sentence before the vocabulary test, so only what remains can
 * make the sentence a candidate. A sentence whose only mention is one of these
 * is not a match.
 */
const NON_GRANT_MENTIONS: RegExp[] = [
  // The proficiency bonus, as in "your proficiency bonus is doubled" or "its whole proficiency bonus".
  /\bproficiency bonus\b/gi,
  // A reference to a proficiency the character already has, as a condition.
  /\b(?:if|when|while|whenever)\s+you(?:'re|\s+are|\s+were|\s+have|\s+already\s+have)\s+(?:already\s+)?(?:proficient|proficiency)\b(?:\s+(?:with|in))?/gi,
  /\bwith\s+(?:which|whom)\s+you\s+(?:are|have)\s+(?:proficient|proficiency)\b(?:\s+(?:with|in))?/gi,
  /\byou\s+must\s+be\s+proficient\b(?:\s+(?:with|in))?/gi,
  // A relative clause over an item the character already has: "a weapon you are proficient with".
  /\b(?:a|an|any|each|every|one|the)\s+[\w'’-]+(?:\s+[\w'’-]+)?\s+you\s+(?:are|'re|have)\s+(?:already\s+)?proficient(?:\s+(?:with|in))?/gi,
  // Language words that are not grants: sharing a language, or a language the character already knows.
  /\bshare\s+(?:a|an|one|the|any)\s+languages?\b/gi,
  /\b(?:a|an|any|one|the)\s+languages?\s+you\s+(?:already\s+)?(?:know|speak|understand)\b/gi,
];

/** A saving throw DC or attack formula, such as "Spell save DC = 8 + your Wisdom modifier". A grant is never a formula. */
const FORMULA = /\bDC\b|\battack modifier\b/i;

/** Whether a sentence mentions a proficiency or language in a way that can grant one. */
function mentionsGrantable(sentence: string): boolean {
  if (FORMULA.test(sentence) && /[=+]/.test(sentence)) return false;
  let rest = sentence;
  for (const mention of NON_GRANT_MENTIONS) rest = rest.replace(mention, " ");
  return CANDIDATE.test(rest);
}

/** A lead-in clause such as "At 1st level," or "When you choose this circle at 3rd level,". "If" is not a lead-in: it makes a grant conditional. */
const LEAD_IN = /^(?:(?:also|in addition|at|when|starting at|beginning at|upon|once|after)\b[^,]*,\s*)+/i;

function parseCount(word: string): number | null {
  const lower = word.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return COUNT_WORDS[lower] ?? null;
}

/** A single list entry, classified into a category and given its canonical name. */
interface Classified {
  category: ProficiencyCategory;
  name: string;
}

function weaponName(text: string): string | null {
  if (WEAPON_GROUPS[text]) return WEAPON_GROUPS[text];
  if (WEAPON_SET.has(text)) return text;
  // Plural forms: "daggers", "light crossbows", "war picks".
  const singular = text.replace(/s$/, "");
  if (singular !== text && WEAPON_SET.has(singular)) return singular;
  return null;
}

/** Classifies one list entry. With a hint, only that category is considered. */
function classify(text: string, hint?: ProficiencyCategory): Classified | null {
  const t = text.trim().toLowerCase().replace(/^(?:the|all)\s+/, "");
  if (!t) return null;
  if (hint === "savingThrows") {
    const ability = ABILITY_BY_LOWER.get(t);
    return ability ? { category: "savingThrows", name: ability } : null;
  }
  if (!hint || hint === "skills") {
    const skill = SKILL_BY_LOWER.get(t);
    if (skill) return { category: "skills", name: skill };
  }
  if (!hint || hint === "armor") {
    const armor = ARMOR_NAMES[t];
    if (armor) return { category: "armor", name: armor };
  }
  if (!hint || hint === "weapons") {
    const weapon = weaponName(t);
    if (weapon) return { category: "weapons", name: weapon };
  }
  if (!hint || hint === "tools") {
    if ((/(?:tools|kit|supplies|utensils|set)$/.test(t) && t !== "gaming set") || VEHICLE.test(t)) {
      return { category: "tools", name: t };
    }
  }
  return null;
}

/** Splits "A, B, or C" and "A and B" into entries. */
function splitItems(text: string): string[] {
  return text
    .split(/\s*,\s*(?:(?:and|or)\s+)?|\s+(?:and|or)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** A choice from listed items, or null when any item is not a clear entry of the category. */
function namedChoice(items: string[], hint: ProficiencyCategory | undefined, count: number): ProficiencyGrantSpec[] | null {
  const names: string[] = [];
  let category: ProficiencyCategory | undefined = hint;
  for (const item of items) {
    const c = classify(item, category);
    if (!c) return null;
    category = c.category;
    if (!names.includes(c.name)) names.push(c.name);
  }
  if (!category || names.length === 0) return null;
  return [{ kind: "choice", category, count, pool: { kind: "names", names } }];
}

const NOUN_CATEGORY: Record<string, ProficiencyCategory> = {
  skill: "skills",
  "saving throw": "savingThrows",
  tool: "tools",
};

/**
 * A choice from a structured `choose` list. A language list naming "other" is any language, and a
 * language list of concrete names is that set of names. A tool list may name a whole pool by its
 * category word ("musical instrument"); each named tool and each pool joins one names pool.
 */
function listedChoice(items: string[], category: ProficiencyCategory, count: number): ProficiencyGrantSpec[] | null {
  if (category === "languages") {
    if (items.some((item) => item.trim().toLowerCase() === "other")) {
      return [{ kind: "choice", category, count, pool: { kind: "any" } }];
    }
    const names: string[] = [];
    for (const item of items) {
      const name = languageName(item.trim().toLowerCase());
      if (!name) return null;
      if (!names.includes(name)) names.push(name);
    }
    return names.length > 0 ? [{ kind: "choice", category, count, pool: { kind: "names", names } }] : null;
  }
  if (category === "tools") {
    const names: string[] = [];
    for (const item of items) {
      const pool = LISTED_TOOL_POOLS[item.trim().toLowerCase()];
      const picked = pool ?? [classify(item, "tools")?.name].filter((name): name is string => Boolean(name));
      if (picked.length === 0) return null;
      for (const name of picked) if (!names.includes(name)) names.push(name);
    }
    return names.length > 0 ? [{ kind: "choice", category, count, pool: { kind: "names", names } }] : null;
  }
  return namedChoice(items, category, count);
}

/** The body of a "gain proficiency with/in ..." sentence, after the word "proficiency" and its preposition. */
function parseProficiencyBody(input: string): ProficiencyGrantSpec[] | null {
  const body = input
    .trim()
    .replace(/\s*\(your choice\)/i, " of your choice")
    .replace(/\s+if you (?:do not|don't) already (?:have|know)\b.*$/i, "")
    .trim();
  if (!body) return null;

  if (/^(?:one|a|an) type of artisan'?s tools of your choice$/i.test(body)) {
    return [{ kind: "choice", category: "tools", count: 1, pool: { kind: "names", names: [...ARTISAN_TOOLS] } }];
  }
  if (/^any one type of artisan'?s tools or any one musical instrument of your choice$/i.test(body)) {
    return [{ kind: "choice", category: "tools", count: 1, pool: { kind: "names", names: [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS] } }];
  }
  const instruments = /^(\S+) musical instruments? of your choice$/i.exec(body);
  if (instruments && parseCount(instruments[1]) !== null) {
    return [{ kind: "choice", category: "tools", count: parseCount(instruments[1]) as number, pool: { kind: "names", names: [...MUSICAL_INSTRUMENTS] } }];
  }
  if (/^all saving throws$/i.test(body)) {
    return [{ kind: "fixed", category: "savingThrows", names: [...ABILITIES] }];
  }

  let m = body.match(/^your choice of (.+)$/i);
  if (m) {
    const items = splitItems(m[1]);
    const first = items.length > 0 ? classify(items[0]) : null;
    return first ? namedChoice(items, first.category, 1) : null;
  }

  // "<count> [of the following] <noun>s [of your choice] [from the following list]: <list>"
  m = body.match(/^(\S+)\s+(?:of the following\s+)?(skills?|saving throws?|tools?)((?:\s+of your choice)?)((?:\s+from the following list)?)\s*(?::\s*(.+))?$/i);
  // Only a count word starts a choice: "smith's tools" is a named tool, not a count.
  if (m && parseCount(m[1]) !== null) {
    const count = parseCount(m[1]) as number;
    const noun = m[2].toLowerCase().replace(/s$/, "");
    const category = NOUN_CATEGORY[noun];
    const choiceOf = m[3].trim().length > 0;
    const fromList = m[4].trim().length > 0;
    const list = m[5];
    if (!category) return null;
    if (!choiceOf && !fromList) return null;
    if (/the following/i.test(body) && !list) return null;
    if (list) return namedChoice(splitItems(list), category, count);
    if (category === "tools") return null;
    return [{ kind: "choice", category, count, pool: { kind: "any" } }];
  }

  // "the <A or B> skill of your choice"
  m = body.match(/^the (.+?) (skill|saving throw|tool)s? of your choice$/i);
  if (m) {
    return namedChoice(splitItems(m[1]), NOUN_CATEGORY[m[2].toLowerCase()], 1);
  }

  // Fixed: "medium armor, shields, and martial weapons", "the Insight and Medicine skills", "Wisdom saving throws".
  if (/\bor\b/i.test(body)) return null;
  let text = body.replace(/^the\s+/i, "");
  let hint: ProficiencyCategory | undefined;
  m = text.match(/^(.+?)\s+(skills?|saving throws?)$/i);
  if (m) {
    hint = /^skill/i.test(m[2]) ? "skills" : "savingThrows";
    text = m[1];
  }
  const fixed: ProficiencyGrantSpec[] = [];
  const byCategory = new Map<ProficiencyCategory, Extract<ProficiencyGrantSpec, { kind: "fixed" }>>();
  for (const item of splitItems(text)) {
    const c = classify(item, hint);
    if (!c) return null;
    let spec = byCategory.get(c.category);
    if (!spec) {
      spec = { kind: "fixed", category: c.category, names: [] };
      byCategory.set(c.category, spec);
      fixed.push(spec);
    }
    if (!spec.names.includes(c.name)) spec.names.push(c.name);
  }
  return fixed.length > 0 ? fixed : null;
}

/** A language sentence after the subject and verb: fixed named languages, or a count of any languages. */
function parseLanguageLearning(verb: string, body: string): ProficiencyGrantSpec[] | null {
  const speak = /^to speak,?\s+read,?\s+and\s+write\s+(.+)$/i.exec(body);
  if (/^learns?$/i.test(verb) && speak) {
    if (/\bor\b/i.test(speak[1])) return null;
    const names = splitItems(speak[1]);
    if (names.length === 0 || !names.every((n) => /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(n))) return null;
    return [{ kind: "fixed", category: "languages", names }];
  }
  const count = /^(\S+)\s+(?:additional\s+)?languages?\s+of\s+your\s+choice$/i.exec(body);
  if (count) {
    const n = parseCount(count[1]);
    return n === null ? null : [{ kind: "choice", category: "languages", count: n, pool: { kind: "any" } }];
  }
  return null;
}

/**
 * One sentence to grant specs, or null when the sentence is a proficiency or
 * language sentence this extractor does not state precisely.
 */
function parseSentence(sentence: string): ProficiencyGrantSpec[] | null {
  const s = sentence.trim().replace(LEAD_IN, "");

  // "Your <thing> grants you proficiency in ..."
  let m = s.match(/^your\b.+?\bgrants you\s+(.+)$/i);
  if (m) {
    const body = /^proficienc(?:y|ies)\s+(?:in|with)\s+(.+)$/i.exec(m[1]);
    return body ? parseProficiencyBody(body[1]) : null;
  }

  // "You gain proficiency with ...", "The sidekick gains proficiency in ...", "You learn ...", "You can also speak, read, and write ..."
  m = s.match(/^(?:you|the sidekick)\s+((?:also\s+|can\s+)*)(gains?|learns?|speak,?\s+read,?\s+and\s+write)\s+(.+)$/i);
  if (!m) return null;
  const verb = m[2];
  const rest = m[3];
  if (/^gains?$/i.test(verb)) {
    const body = /^proficienc(?:y|ies)\s+(?:in|with)\s+(.+)$/i.exec(rest);
    return body ? parseProficiencyBody(body[1]) : null;
  }
  return parseLanguageLearning(verb, rest);
}

/** Splits prose into sentences, dropping markdown emphasis and list markers. */
function proseSentences(prose: string): string[] {
  return prose
    .split(/\n+|\s{2,}/)
    .map((line) => line.replace(/[*_`]/g, "").replace(/^\s*(?:[-•]\s*)+/, "").trim())
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z(])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stripTerminal(sentence: string): string {
  return sentence.replace(/[.!?]+$/, "").trim();
}

/**
 * The sentences of a feature's prose that match the proficiency vocabulary,
 * without their final punctuation. The extractor and the coverage gate both
 * read matches through this one function.
 */
export function matchedSentences(description: string): string[] {
  return proseSentences(description).filter(mentionsGrantable).map(stripTerminal);
}

/** Extracts grant specs from prose. Sentences that match the vocabulary but do not parse are returned as `unparsed`. */
export function extractProseGrants(description: string): { specs: ProficiencyGrantSpec[]; unparsed: string[] } {
  const specs: ProficiencyGrantSpec[] = [];
  const unparsed: string[] = [];
  for (const sentence of matchedSentences(description)) {
    const parsed = parseSentence(sentence);
    if (parsed) specs.push(...parsed);
    else unparsed.push(sentence);
  }
  return { specs, unparsed };
}

export function newProficiencyReport(): ProficiencyReport {
  return { covered: 0, unparsed: [] };
}

/** A grant id: source, owner, feature, level and the grant's position in its feature. Never changes once shipped. */
export function grantId(subject: Pick<GrantSubject, "source" | "owner" | "feature" | "level">, position: number): string {
  return `${subject.source}/${subject.owner}/${subject.feature}@${subject.level}#${position}`;
}

function build(
  subject: Pick<GrantSubject, "source" | "owner" | "feature" | "level">,
  specs: ProficiencyGrantSpec[]
): ProficiencyGrant[] {
  return specs.map((spec, position) => ({ id: grantId(subject, position), ...spec }) as ProficiencyGrant);
}

/** The source-less key an override is matched on. An override applies to every source's copy of a feature. */
function featureKey(s: { owner: string; feature: string; level: number }): string {
  return `${s.owner}|${s.feature}|${s.level}`;
}

/** The full identity of a grant subject. Two classes with one name from different sources have distinct subjects. */
function subjectKey(s: GrantSubject): string {
  return `${s.source}|${s.owner}|${s.feature}|${s.level}`;
}

/**
 * The overrides that name no feature in `subjects`. Whether that is an error is
 * the caller's call: the tracked files hold every class, so there it is.
 */
export function unmatchedOverrides(subjects: GrantSubject[], overrides: GrantOverride[]): GrantOverride[] {
  const keys = new Set(subjects.map(featureKey));
  return overrides.filter((override) => !keys.has(featureKey(override)));
}

/**
 * Resolves the grants of every feature in a scrape: prose extraction, then
 * overrides. An override for a feature the scrape does not include has nothing
 * to apply to, and is ignored, because a partial scrape is normal; the tracked
 * data is checked for stale overrides by the enrichment (see unmatchedOverrides).
 *
 * Two subjects with the same source, owner, name and level are one feature
 * listed twice when their descriptions match (a subclass listed under two
 * parent classes). They resolve once, and every such subject gets that same
 * result, so the result array stays index-aligned with `subjects`. Such a
 * feature is counted and reported once. Same key with different descriptions
 * is an ambiguity and throws. Updates `report` with covered features and the
 * unparsed list.
 */
export function resolveFeatureGrants(
  subjects: GrantSubject[],
  overrides: GrantOverride[],
  report: ProficiencyReport
): FeatureGrantResult[] {
  const firstIndex = new Map<string, number>();
  const firstOf: number[] = subjects.map((subject, i) => {
    const key = subjectKey(subject);
    const first = firstIndex.get(key);
    if (first === undefined) {
      firstIndex.set(key, i);
      return i;
    }
    if (subjects[first].description !== subject.description) throw new Error(`duplicate proficiency subject: ${key}`);
    return first;
  });

  const featureKeys = new Set(subjects.map(featureKey));
  const overrideByKey = new Map<string, GrantOverride>();
  for (const override of overrides) {
    const key = featureKey(override);
    if (featureKeys.has(key)) overrideByKey.set(key, override);
  }

  const resolvedAt = new Map<number, FeatureGrantResult>();
  subjects.forEach((subject, i) => {
    if (firstOf[i] !== i) return;
    const override = overrideByKey.get(featureKey(subject));
    let grants: ProficiencyGrant[];
    let unparsed: string[];
    if (override) {
      grants = build(subject, override.grants);
      unparsed = [];
    } else {
      const extracted = extractProseGrants(subject.description);
      unparsed = extracted.unparsed;
      grants = unparsed.length > 0 ? [] : build(subject, extracted.specs);
    }
    if (grants.length > 0) report.covered += 1;
    if (!override && unparsed.length > 0) {
      report.unparsed.push({ owner: subject.owner, feature: subject.feature, level: subject.level, unparsed });
    }
    resolvedAt.set(i, { subject, grants, unparsed });
  });

  return firstOf.map((first) => resolvedAt.get(first) as FeatureGrantResult);
}

/**
 * The fixed skill entries of a 5e.tools skill block, such as `{ perception: true }`. Skill choices (a
 * `choose` list, or a count of `any`) are left out: they are not grants yet, and the skill-choice offers
 * still read them.
 */
export function fixedSkillEntries(entries: unknown): unknown[] {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const fixed = Object.fromEntries(Object.entries(entry).filter(([key, value]) => value === true && key !== "choose"));
    return Object.keys(fixed).length > 0 ? [fixed] : [];
  });
}

/**
 * Grants from a structured proficiency block (race, background, or class
 * starting proficiencies). A block with any entry the mapping cannot state
 * precisely gets no grants at all; the unparsed entries are returned instead.
 * A reviewed override for the feature replaces the block entirely.
 */
export function structuredGrants(
  subject: Pick<GrantSubject, "source" | "owner" | "feature" | "level">,
  raw: StructuredProficiencies,
  overrides: GrantOverride[] = []
): { grants: ProficiencyGrant[]; unparsed: string[] } {
  const override = overrides.find((candidate) => featureKey(candidate) === featureKey(subject));
  if (override) return { grants: build(subject, override.grants), unparsed: [] };

  const specs: ProficiencyGrantSpec[] = [];
  const unparsed: string[] = [];
  const fixedByCategory = new Map<ProficiencyCategory, Extract<ProficiencyGrantSpec, { kind: "fixed" }>>();

  const addFixed = (category: ProficiencyCategory, name: string) => {
    let spec = fixedByCategory.get(category);
    if (!spec) {
      spec = { kind: "fixed", category, names: [] };
      fixedByCategory.set(category, spec);
      specs.push(spec);
    }
    if (!spec.names.includes(name)) spec.names.push(name);
  };

  // Skills come last: a grant's position is its id, so the fields that predate skill entries keep their ids.
  const fields: Array<[keyof StructuredProficiencies, ProficiencyCategory]> = [
    ["tools", "tools"],
    ["languages", "languages"],
    ["weapons", "weapons"],
    ["armor", "armor"],
    ["skills", "skills"],
  ];
  for (const [field, category] of fields) {
    for (const entry of (raw[field] as unknown[] | undefined) ?? []) {
      if (typeof entry === "string") {
        const parsed = parseProficiencyBody(entry);
        if (!parsed) unparsed.push(`${field}: ${entry}`);
        else for (const spec of parsed) {
          if (spec.kind === "fixed") for (const name of spec.names) addFixed(spec.category, name);
          else specs.push(spec);
        }
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
        const token = `${field}: ${key}`;
        if (value === false) continue;
        if (key === "choose" && value && typeof value === "object") {
          const choose = value as { from?: unknown; count?: unknown };
          const from = Array.isArray(choose.from) ? choose.from.map(String) : [];
          const count = typeof choose.count === "number" ? choose.count : 1;
          const chosen = from.length > 0 ? listedChoice(from, category, count) : null;
          if (chosen) specs.push(...chosen);
          else unparsed.push(`${field}: choose`);
          continue;
        }
        if (key === "other" && category === "languages" && value === true) {
          specs.push({ kind: "choice", category, count: 1, pool: { kind: "any" } });
          continue;
        }
        if (value === true) {
          const name = category === "languages" ? languageName(key) : classify(key.split("|")[0], category)?.name;
          if (name) addFixed(category, name);
          else unparsed.push(token);
          continue;
        }
        if (typeof value === "number") {
          if (key === "any" && (category === "skills" || category === "languages" || category === "tools")) {
            specs.push({ kind: "choice", category, count: value, pool: { kind: "any" } });
          } else if (key === "anyStandard" && category === "languages") {
            specs.push({ kind: "choice", category, count: value, pool: { kind: "any" } });
          } else if (category === "tools" && COUNTED_TOOL_POOLS[key]) {
            specs.push({ kind: "choice", category, count: value, pool: { kind: "names", names: [...COUNTED_TOOL_POOLS[key]] } });
          } else {
            unparsed.push(token);
          }
          continue;
        }
        unparsed.push(token);
      }
    }
  }

  for (const name of raw.savingThrows ?? []) {
    if (ABILITY_BY_LOWER.has(name.toLowerCase())) addFixed("savingThrows", ABILITY_BY_LOWER.get(name.toLowerCase())!);
    else unparsed.push(`savingThrows: ${name}`);
  }

  if (unparsed.length > 0) return { grants: [], unparsed };
  return { grants: build(subject, specs), unparsed };
}

/**
 * The starting tools of a class, from the text of each tool entry it lists. Every entry must state a
 * tool grant, or the whole list gets no grants and its entries are returned as unparsed. Fixed names of
 * one list merge into one grant; each choice is its own grant after them.
 */
export function startingToolGrants(
  subject: Pick<GrantSubject, "source" | "owner" | "feature" | "level">,
  toolTexts: string[]
): { grants: ProficiencyGrant[]; unparsed: string[] } {
  const specs: ProficiencyGrantSpec[] = [];
  const unparsed: string[] = [];
  let fixed: Extract<ProficiencyGrantSpec, { kind: "fixed" }> | undefined;
  for (const text of toolTexts) {
    const parsed = parseProficiencyBody(text);
    if (!parsed || parsed.some((spec) => spec.category !== "tools")) {
      unparsed.push(text);
      continue;
    }
    for (const spec of parsed) {
      if (spec.kind === "choice") {
        specs.push(spec);
        continue;
      }
      if (!fixed) {
        fixed = { kind: "fixed", category: "tools", names: [] };
        specs.push(fixed);
      }
      for (const name of spec.names) if (!fixed.names.includes(name)) fixed.names.push(name);
    }
  }
  if (unparsed.length > 0) return { grants: [], unparsed };
  return { grants: build(subject, specs), unparsed };
}

/** A language key such as "common" or "deep speech", as a name. "other" is not a language and stays unparsed. */
function languageName(key: string): string | null {
  if (key === "other" || !/^[a-z]+(?: [a-z]+)*$/.test(key)) return null;
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}
