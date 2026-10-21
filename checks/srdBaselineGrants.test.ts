import test from "node:test";
import assert from "node:assert/strict";
import type { ClassData, FeatData, ProficiencyGrant } from "../src/types/dnd5e.ts";
import { loadSrdCatalog } from "./testUtils.ts";

// The SRD classes, subclasses and feats are PHB content: prune-to-srd.mjs keeps only PHB rows.
// A grant's id starts with the book it was scraped from, for example
// "PHB/Cleric/Life Domain/Bonus Proficiency@1#armor:fixed:heavy armor".
const SRD_GRANT_BOOK = "PHB";

interface GrantOwner {
  label: string;
  grants?: ProficiencyGrant[];
}

function classGrantOwners(classes: ClassData[]): GrantOwner[] {
  return classes.flatMap((cls) => [
    ...cls.features.map((f) => ({ label: `${cls.name} / ${f.name}`, grants: f.grants })),
    ...cls.subclasses.flatMap((sub) =>
      sub.features.map((f) => ({ label: `${cls.name} / ${sub.name} / ${f.name}`, grants: f.grants })),
    ),
  ]);
}

function featGrantOwners(feats: FeatData[]): GrantOwner[] {
  return feats.map((f) => ({ label: `Feat / ${f.name}`, grants: f.grants }));
}

function grantsFromOtherBooks(owners: GrantOwner[], book = SRD_GRANT_BOOK): string[] {
  return owners.flatMap((owner) =>
    (owner.grants ?? [])
      .filter((grant) => grant.id.split("/")[0] !== book)
      .map((grant) => `${owner.label}: ${grant.id}`),
  );
}

const classes = loadSrdCatalog<ClassData[]>("classes");
const feats = loadSrdCatalog<FeatData[]>("feats");

test("srdBaselineGrants: the baseline carries grants, so the book guard below is not vacuous", () => {
  const owners = [...classGrantOwners(classes), ...featGrantOwners(feats)];
  assert.ok(
    owners.some((owner) => (owner.grants ?? []).length > 0),
    "at least one SRD class, subclass feature or feat must carry a grant",
  );
});

test("srdBaselineGrants: no SRD class, subclass feature or feat carries a grant from a non-SRD book", () => {
  const owners = [...classGrantOwners(classes), ...featGrantOwners(feats)];
  assert.deepEqual(grantsFromOtherBooks(owners), []);
});

test("srdBaselineGrants: the SRD Life Domain Bonus Proficiency feature grants heavy armor", () => {
  const cleric = classes.find((c) => c.name === "Cleric");
  const lifeDomain = cleric?.subclasses.find((sub) => sub.name === "Life Domain");
  const feature = lifeDomain?.features.find((f) => f.name === "Bonus Proficiency");
  assert.deepEqual(feature?.grants, [
    {
      id: "PHB/Cleric/Life Domain/Bonus Proficiency@1#armor:fixed:heavy armor",
      aliases: ["PHB/Cleric/Life Domain/Bonus Proficiency@1#0"],
      kind: "fixed",
      category: "armor",
      names: ["heavy armor"],
    },
  ]);
});

test("srdBaselineGrants: the book check flags a grant from another book and passes one from the SRD book (invented fixture)", () => {
  const owners: GrantOwner[] = [
    {
      label: "Invented Class / Invented Vow",
      grants: [
        { id: "ZZZ/Invented Class/Invented Vow@3#0", kind: "fixed", category: "tools", names: ["invented tool"] },
      ],
    },
    {
      label: "Invented Class / Invented Oath",
      grants: [
        { id: "PHB/Invented Class/Invented Oath@1#0", kind: "fixed", category: "languages", names: ["Invented Tongue"] },
      ],
    },
  ];
  assert.deepEqual(grantsFromOtherBooks(owners), [
    "Invented Class / Invented Vow: ZZZ/Invented Class/Invented Vow@3#0",
  ]);
});
