# 38: Every pick card on the Class tab can be hidden

**What to build:** Owner follow-up to ticket 37. The Class tab's "Class & Subclass Choices" card and the "Expertise" card have no hide option; only the Skills card does. Every card on the Class tab that holds pickers gets the same collapsible header.

**Blocked by:** 37

**Status:** ready-for-agent

## Design notes

- Reuse `src/components/ui/CollapsibleCard.tsx`. These cards carry a subtitle line (and `renderChoiceCard` a badge), so give `CollapsibleCard` an optional `subtitle` (shown under the title in the muted 11 px style the cards use today, in both states, so a collapsed card still says what it is) and an optional `badge` (the `Badge` the title row shows today, to the left of the chevron). Do not add a second collapsible component.
- Cards to convert in `src/components/builder/ClassProgressionSection.tsx`: every card `renderChoiceCard` returns (Fighting Styles, Battle Master Maneuvers, Pact Boon & Eldritch Invocations, Infusions Known, Class & Subclass Choices), the Expertise card, and the "Optional & Replacement Class Features" card. Leave cards that hold no picker as they are (Granted Class Tools, Multiclassing Rules, the class list, the subclass-change card).
- Open by default; state local to the card. Keep the copy unchanged (`CODING_STANDARDS.md` section 8).
- The Expertise card also shows a warning block and the milestone pickers; both stay inside the collapsible body.
- Check the Race and Background tabs for any other card that holds pickers without a collapsible header (the ancestry Rule Choices card has no title today). Do not convert them; list them in the report.
- Layout: extend the existing collapsed-state layout scenario (the integrated Knowledge Cleric + Rogue one) to cover a collapsed "Class & Subclass Choices" and a collapsed "Expertise" card at 320 and 393. Iterate with `ONLY=skill WIDTHS=320`, run the full layout check once at the end (both modes).

## Acceptance criteria

- [ ] "Class & Subclass Choices", the other choice cards, "Expertise" and "Optional & Replacement Class Features" collapse to a title row (subtitle and badge still shown) and expand again.
- [ ] Both states fit at 320 px.
- [ ] A rules-free change: no rule module is touched.
- [ ] Screenshots at 320 and 393 px are reviewed by the main session; `npm run layout:check` passes in both modes.
- [ ] `npm run check:all` passes.
