# 01: Fix the overlapping rows in the builder (ASI/feat rows, language choice heading)

**What to build:** Three phone screenshots show two layout bugs in the Builder. (a) In "Selected Ability Improvements & Feats", the title ("Ability Score Improvement", "Strike of the Giants") overlaps the Change/Info/Remove buttons. (b) The language choice heading ("Half-Elf (Moon Elf or Sun Elf Descent): Languages") runs into the "Picked 1 / 1" counter and is clipped at the right edge. Both rows must be fluid: text wraps or shrinks, and buttons wrap beneath it when there is no room. The screenshots are at `/home/krzysztof/.t3/userdata/attachments/167851d8-7004-4408-9e02-d967219586d5-8c397116-d347-447a-81f1-ab599a360bb0.jpg`, `...-8e29c9dc-9f65-4d68-a463-5586ba1c3948.jpg` and `...-8efaf524-6234-43f7-98c2-8424f6be3809.jpg`. The `layout:check` seed characters did not show these rows, which is why the check missed them, so the seeds gain a character that shows them.

**Blocked by:** None (can start immediately)

**Status:** done
**Landed:** d6452d8, check:all passed (811 app, 85 scraper) and layout:check green in SRD mode on the merged tree; the implementer also ran --integrated. The language heading only reproduces through the native-style emulation the check now uses. Native clipping not yet seen on a phone.

- [x] `npm run layout:check` seeds a character with an ability score improvement, a feat (with its Info button) and a Half-Elf with a language choice, and checks the Builder rows containing them.
- [x] With the new seeds and without the fix, `layout:check` reports the overlap; with the fix it is green at 320, 360, 393 and 412 px in both SRD and `--integrated` modes.
- [x] The rows follow `CODING_STANDARDS.md` section 7: no fixed widths, wrapping, `minWidth: 0` on text.
- [x] Every other row in the same Builder cards that mixes a title with buttons or a counter is checked for the same flaw and fixed if it has it.
- [x] No new explanatory text is added (CODING_STANDARDS section 8).
- [x] `npm run check:all` passes.
