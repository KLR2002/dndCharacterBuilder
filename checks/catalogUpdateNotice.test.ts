import { test } from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_CATALOG_FORMAT } from "../src/services/compendiumStorage.ts";
import { shouldShowCatalogUpdateNotice } from "../src/services/catalogUpdateNotice.ts";

const staleIntegrated = { integrated: true, stale: true, isFirstRun: false };

test("a stale Integrated Catalog that was never informed shows the notice", () => {
  assert.equal(shouldShowCatalogUpdateNotice({ ...staleIntegrated, informedFormat: undefined }), true);
});

test("a stale Integrated Catalog informed of an older required format shows the notice again", () => {
  assert.equal(shouldShowCatalogUpdateNotice({ ...staleIntegrated, informedFormat: REQUIRED_CATALOG_FORMAT - 1 }), true);
});

test("a stale Integrated Catalog informed of the required format shows no notice", () => {
  assert.equal(shouldShowCatalogUpdateNotice({ ...staleIntegrated, informedFormat: REQUIRED_CATALOG_FORMAT }), false);
});

test("a current Integrated Catalog shows no notice", () => {
  assert.equal(shouldShowCatalogUpdateNotice({ integrated: true, stale: false, informedFormat: undefined, isFirstRun: false }), false);
});

test("the SRD Baseline shows no notice", () => {
  assert.equal(shouldShowCatalogUpdateNotice({ integrated: false, stale: false, informedFormat: undefined, isFirstRun: false }), false);
});

test("the notice never shows during first run", () => {
  assert.equal(shouldShowCatalogUpdateNotice({ ...staleIntegrated, informedFormat: undefined, isFirstRun: true }), false);
});
