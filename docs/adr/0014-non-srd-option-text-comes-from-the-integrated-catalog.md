# 0014: Non-SRD option text comes from the Integrated Catalog

## Context

ADR 0013 says the shipped application holds only SRD content. The rules engine nevertheless carried paraphrased non-SRD option text written by hand: Totem Warrior animals, Genie kinds, Elemental Disciplines, Divine Soul affinities, 66 Artificer infusions and a few fallback lists. It also duplicated what the scraper already fetched, and where the scraper flattened structured choices into prose, the app re-typed them.

## Decision

1. **No non-SRD descriptive text is bundled.** Option names, descriptions and per-option sources of non-SRD Rule Choices come from the Integrated Catalog. Code keeps only structure and numbers: ids, class and subclass names, levels, labels and curated name-and-number tables for rules that exist only as prose.
2. **Class and subclass features carry `choices`**, mirroring ADR 0003: `choices = { pick, options: [{ name, description, source? }] }`, built by the scraper from the raw `options` entry and its feature references. Spell-driven choices (biomes, affinities, Genie kinds, Giant Power) are lifted into the same shape from `additionalSpells`. Cantrip-list choices keep the scraped filter and are resolved against the Compendium.
3. **A pointer table maps each frozen Rule Choice id** to its owner, feature locator, label, `level` and `effectLevel`. Only choices in the table are surfaced. A small names-only alias table keeps old saved picks resolving.
4. **The Integrated Catalog carries a format number.** A catalog older than the application requires is stale: the affected choices are hidden, saved picks are kept, and Settings asks for a re-sync.
5. **Prose-only rules stay curated** (ki costs, maneuver action types, at-will invocation spells, swap schools), as name-and-number tables with completeness tests. Prose is not parsed, following ADR 0003.

## Consequences

Without an Integrated Catalog, non-SRD choices are not offered at all. Switching a character back to the SRD Baseline keeps its picks but offers nothing new. Adding a choice means adding a pointer row; the scraper alone never adds one. Persisted ids and picked names never change.

Known issue, not decided here: the full scraped dumps under the scraper's data directory are tracked in git and feed the SRD prune script.

## Alternatives considered

- Keep hand-written text as a fallback for offline use. Rejected: it keeps proprietary prose in the repo and drifts from the catalog.
- Surface every scraped `options` feature automatically. Rejected: the engine does not support most of them, so surfacing them would offer choices that do nothing.
- Parse prose for ki costs, action types and at-will spells. Rejected for the reasons in ADR 0003.
