import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTags } from "../src/parser/tag-cleaner.ts";

test("name|source tags resolve to the name, never to the source", () => {
  assert.equal(cleanTags("{@variantrule Opportunity Attack|XPHB}", "plain"), "Opportunity Attack");
  assert.equal(cleanTags("{@variantrule Cover|PHB}", "plain"), "Cover");
  assert.equal(cleanTags("{@itemMastery Slow|XPHB}", "plain"), "Slow");
});

test("name|source|displayText tags prefer the display text", () => {
  assert.equal(cleanTags("{@variantrule Hit Points|XPHB|HP}", "plain"), "HP");
});

test("existing tag formats keep their output", () => {
  assert.equal(cleanTags("{@scaledamage 8d6|3-9|1d6}", "plain"), "1d6");
  assert.equal(cleanTags("{@spell Bane|XPHB}", "plain"), "Bane");
});
