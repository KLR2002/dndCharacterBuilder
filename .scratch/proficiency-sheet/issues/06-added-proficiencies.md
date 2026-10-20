# 06: Added Proficiencies (tools and languages)

**What to build:** A player can add a tool or a language by hand. A "+" on the Tool Proficiencies and Languages headings of the Stats tab opens the shared modal with the known list (minus what is already held) and a field for a custom name. Added entries show a small "added" mark and an "×" to remove them. Rule-granted entries show neither. If a rule later grants the same entry, it shows once as rule-granted and the added entry returns, removable, if the rule goes away. Skills, weapons and armor cannot be added by hand. Interface copy is labels only.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Added tools and languages are stored on the character as optional lists, with no migration, and appear on the sheet.
- [ ] A custom name is accepted; a duplicate of something already held is not offered.
- [ ] Removing an added entry works; rule-granted entries have no remove control.
- [ ] A rule-granted duplicate is shown once, as rule-granted; the added entry survives and reappears when the rule goes away.
- [ ] Added tools can be chosen for Expertise (covered in 08).
- [ ] The "+" buttons, the modal and the added rows fit at 320, 360, 393 and 412 px, checked by `npm run layout:check` with a seed that shows them.
- [ ] No explanatory text appears.
- [ ] `npm run check:all` passes.
