# 02: Subrace variant identification

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Every subrace the catalog marks as a variant is flagged as such, including all thirteen that the previous exact-name check missed.
- [ ] The source-data naming prefix is stripped from subrace names, so a variant is labelled by its descent.
- [ ] All ancestry-variant checks read the flag; no check compares against a subrace name string.
- [ ] A test asserts that selecting each variant ancestry produces the same variant handling, covering Tiefling, Human and Half-Orc variants that previously did not.
- [ ] A test asserts a subrace label contains no source-data naming prefix.
