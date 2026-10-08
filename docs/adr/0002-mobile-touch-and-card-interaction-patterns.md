# 0002 Mobile Touch and Card Interaction Patterns

## Context
Compact mobile displays (< 380px width) suffer from horizontal stepper button clipping in 2-column grids and high mis-tap rates when interactive combat elements (spell slots, death save bubbles, resource pools) are rendered at small visual dimensions. Long archetype titles (e.g. Arcane Trickster Rogue) also suffer from aggressive text truncation in single-line headers.

## Decision
1. **Dynamic Stepper Grid vs. Row Layout**: On compact viewports (`< 380px`), builder ability score cards convert from a 2-column card grid to full-width horizontal rows with 44pt touch steppers. On larger screens (`≥ 380px`), the 2-column card grid is preserved.
2. **Generous Hit Slop for Compact Combat Elements**: High-frequency toggles (spell slot bubbles, death save circles, hit dice checkboxes) maintain their compact visual size (18–24px) but are equipped with `hitSlop: { top: 8, bottom: 8, left: 8, right: 8 }` ensuring a 40×40pt effective touch zone.
3. **Scroll Affordance on Tabs**: The 7-tab horizontal navigation bar receives subtle visual edge indicators so that unviewed tabs are visibly indicated on narrow viewports.
4. **Stacked Multiclass Cards**: Multiclass entries stack subclass selectors below the primary class/level row on mobile to ensure complete visibility of archetype titles.
