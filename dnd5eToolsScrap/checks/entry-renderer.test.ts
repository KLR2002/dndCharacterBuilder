import test from "node:test";
import assert from "node:assert/strict";
import { renderEntries } from "../src/parser/entry-renderer.ts";

test("renderEntries formats refSubclassFeature, refClassFeature, and refOptionalfeature within lists and blocks", () => {
  const armorerGuardianEntry = {
    type: "list",
    items: [
      {
        type: "refSubclassFeature",
        subclassFeature: "Thunder Gauntlets|Artificer|TCE|Armorer|TCE|3",
      },
      {
        type: "refSubclassFeature",
        subclassFeature: "Defensive Field|Artificer|TCE|Armorer|TCE|3",
      },
    ],
  };

  const renderedMarkdown = renderEntries(armorerGuardianEntry, "markdown");
  assert.equal(
    renderedMarkdown,
    "- **Thunder Gauntlets**\n- **Defensive Field**",
    "Should render subclass feature names as bold markdown list items",
  );

  const renderedPlain = renderEntries(armorerGuardianEntry, "plain");
  assert.equal(
    renderedPlain,
    "- Thunder Gauntlets\n- Defensive Field",
    "Should render subclass feature names as plain text list items",
  );
});

test("renderEntries handles refClassFeature and refOptionalfeature", () => {
  const sampleEntries = [
    {
      type: "refClassFeature",
      classFeature: "Fighting Style|Fighter||1",
    },
    {
      type: "refOptionalfeature",
      optionalfeature: "Blessed Strikes|Cleric|TCE|8",
    },
  ];

  const rendered = renderEntries(sampleEntries, "markdown");
  assert.equal(
    rendered,
    "- **Fighting Style**\n- **Blessed Strikes**",
    "Should format class feature and optional feature references",
  );
});

test("renderEntries handles ref entries with explicit name attribute", () => {
  const namedEntry = {
    type: "refSubclassFeature",
    name: "Custom Name",
    subclassFeature: "Thunder Gauntlets|Artificer|TCE|Armorer|TCE|3",
  };

  const rendered = renderEntries(namedEntry, "markdown");
  assert.equal(rendered, "- **Custom Name**");
});
