import { test } from "node:test";
import assert from "node:assert/strict";
import { wildShapeCatalogNotice } from "../src/components/wildShapeCatalogNotice.ts";

test("Wild Shape shows the beasts notice for an Integrated Catalog without beasts, whatever the Monster Manual state", () => {
  assert.equal(wildShapeCatalogNotice({ integrated: true, lacksBeasts: true, mmActive: true }), "beasts");
  assert.equal(wildShapeCatalogNotice({ integrated: true, lacksBeasts: true, mmActive: false }), "beasts");
});

test("Wild Shape shows the Monster Manual reminder for an Integrated Catalog with beasts and the Monster Manual inactive", () => {
  assert.equal(wildShapeCatalogNotice({ integrated: true, lacksBeasts: false, mmActive: false }), "monsterManual");
});

test("Wild Shape shows no catalog notice when the Monster Manual is active and the catalog has beasts", () => {
  assert.equal(wildShapeCatalogNotice({ integrated: true, lacksBeasts: false, mmActive: true }), "none");
});

test("Wild Shape shows no catalog notice on the SRD Baseline", () => {
  assert.equal(wildShapeCatalogNotice({ integrated: false, lacksBeasts: false, mmActive: false }), "none");
  assert.equal(wildShapeCatalogNotice({ integrated: false, lacksBeasts: false, mmActive: true }), "none");
});
