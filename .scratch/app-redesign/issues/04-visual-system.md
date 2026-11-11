# 04: Visual system

**Type:** grilling

**Blocked by:** 03

**Status:** resolved

## Question

Which visual system does the redesign commit to in `DESIGN.md`: the existing dark base and accent palettes adjusted to AA (the user keeps the current themes; the Character Select pick was for its layout), which accents stay, type, spacing and radius, the bottom-sheet modal on phones, how the AA contrast check is enforced across every accent, and how the chosen Creation Flow layout (variant B of ticket 03: step chips, choice list, identity sheet) and the sheet adapt at tablet and desktop widths instead of stretching a phone column?

## Answer

The app keeps its existing world (dark base, user-chosen accent) and fixes it for AA. `DESIGN.md` is written from the built result at the finish (Impeccable's documenter); until then these values are the reference.

**Accents: two tones each.** A saturated fill with a label colour chosen per accent, and a brighter ink of the same hue. All 7 accents stay; crimson stays the default; the d20 app icon keeps its red.

| Accent | Fill (`primary`) | Label on fill (`text`) | Ink (`secondary`) | Label on fill | Ink on lightest surface |
|---|---|---|---|---|---|
| Crimson | `#d91414` | `#ffffff` | `#ff5c5c` | 5.2 | 5.1 |
| Gold | `#f5b301` | `#231700` | `#f5b301` | 9.5 | 8.3 |
| Purple | `#9a3df0` | `#ffffff` | `#bb7bfa` | 4.9 | 5.4 |
| Emerald | `#0b8051` | `#ffffff` | `#2fd18f` | 5.0 | 7.8 |
| Blue | `#1f6bf0` | `#ffffff` | `#6aa6ff` | 4.8 | 6.2 |
| Cyan | `#06b6d4` | `#03222a` | `#22c8e6` | 6.8 | 7.7 |
| Silver | `#5a7391` | `#ffffff` | `#a3b6cc` | 4.9 | 7.4 |

The selection tint (`glow`) is the ink at about 14% opacity; the accent border (`border`) is the ink.

**Where the tones go.** Fill: the one primary action per screen, and the dice button's selected state. Ink: the selected choice (border plus tint), the current step chip, links, accent icons. Body text and headings stay neutral.

**Base.** Unchanged except `textMuted` `#64748b` → `#8b97a8` (5.2:1 on `surfaceHighlight`) and `danger` `#ef4444` → `#f87171` (5.5:1). Errors and destructive actions always carry an icon and a word, so colour is never the only signal (this covers crimson ≈ danger).

**Type.** One bundled serif weight, Source Serif 4 SemiBold, only for the character's name, step titles and the sheet header. The system sans for everything else, on Android's type roles in sp; numbers tabular.

**Shape.** The existing radii stay: cards 10, buttons 8, badges 6. One hairline border weight.

**Modals.** Phones: a bottom sheet with a drag handle (also the screen-reader Close), closing on swipe down, a tap outside, or Android Back; no ✕. Wide screens and web: a centred dialog, at most about 560px, closing on a tap outside, Escape or ✕.

**Wide screens (≥768px).** Creation Flow: the step chips become a vertical step list on the left, the choices sit in the middle (capped about 640px), and the identity panel is always shown on the right instead of in a bottom sheet. Character sheet: the tab bar becomes a left navigation rail, content capped about 960px, two columns where the content allows (abilities beside skills on Stats). At ≥1200px the whole layout is capped and centred.

**Contrast check.** For every accent, on `background`, `surface`, `surfaceRaised` and `surfaceHighlight`: `text`, `textSecondary`, `textMuted`, `success`, `warning`, `danger`, `info` and the ink reach 4.5:1; the label on the fill reaches 4.5:1. Hairline borders are decoration and not tested.

The user's verbatim answers: round 1 "1 and 2 - i feel like proposed colors are less expressive, especially new crimson that is not even red or silver that is super close to white. Could you propose some more distinct tones that still pases on metrics?, 3 - yes, 4 - yes, 5 - a, 6 - yes, 7 - yes, 8 - yes"; round 2 "yes to both".
