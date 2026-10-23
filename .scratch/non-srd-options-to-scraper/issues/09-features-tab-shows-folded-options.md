# 09: Features tab shows folded choice options

**What to build:** Ticket 02 made the scraper fold the loose option features of any subclass `options` entry (Totem Warrior, but also Storm Herald, Hunter's Prey, Kensei, Drunken Master, Psi Warrior, Soulknife, Genie's Vessel) into `choices` on the parent feature. Nothing reads `choices` outside the Rule Choice reader, so after a re-sync the Features tab would lose the option names and text of every folded feature. The Features tab shows each feature's folded options (name, description, and the book when it differs from the feature's) beneath the feature, so no player-visible text is lost by the fold.

**Blocked by:** 02

**Status:** done

**Landed:** merge `c39af2f`. Notes: options list no source label (the owner's book is used for gating); a feature whose options are all hidden renders unchanged.

- [x] A feature with `choices.options` lists each option's name and description under the feature in the Features tab, class and subclass features alike
- [x] A feature without `choices` renders exactly as before
- [x] Options from a book that is not active are not listed
- [x] The option count line reflects the pick count ("Choose 1")
- [x] Tests cover a class feature, a subclass feature, an inactive-book option and a feature with no choices (Dual-Mode: SRD features render unchanged)
- [x] Existing suite passes (`npm run check:all`)
