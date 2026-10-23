# 02: Totem Warrior options come from the catalog (tracer bullet)

**What to build:** The class scraper emits `choices` on class and subclass features, built from the raw `options` entry and its feature references, and folds the loose option siblings (Bear, Eagle, Wolf, Elk, Tiger at levels 3, 6 and 14) into their parent feature, with a per-option `source`. The pointer table (frozen id to owner, feature locator, label, level, effect level) is introduced and holds the three Totem rows; the Rule Choice reader takes their options and per-option book gate from the catalog. A fixture catalog with invented placeholder text is created. The hand-written Totem option text and the hand-written Bear Totem sentence appended to Rage are deleted. A choice whose options cannot be found in the active Compendium is hidden and the character's saved picks are left untouched. Unmigrated rows keep their current form until their ticket.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge `0938cb8`. Notes: option gating treats an option printed in the row's own book as always offered; the reader reads the catalog unscoped; the scraper fold is generic (every subclass `options` entry), so ticket 09 renders folded options in the Features tab.

- [x] Scraper test: raw-shaped placeholder records produce `choices` on the Totem Spirit, Aspect of the Beast and Totemic Attunement features, with option text and source, and the loose siblings no longer appear as features
- [x] Scraper keeps the existing prose description on the parent feature
- [x] Offered options for the three Totem rows come from the catalog; Elk and Tiger appear only while their book is active
- [x] Totem Spirit 3, Aspect of the Beast 6 and Totemic Attunement 14 keep their frozen ids and the same option names
- [x] A catalog without `choices` hides the Totem choices and keeps saved picks; SRD mode offers none
- [x] The Totem option text and the Bear Totem rage sentence no longer exist in the application code
- [x] Dual-Mode (SRD and integrated) and negative tests exist at the Rule Choice interface seam
- [x] The existing characterization scenarios still pass, run against the fixture catalog
- [x] Existing suite passes (`npm run check:all`)
