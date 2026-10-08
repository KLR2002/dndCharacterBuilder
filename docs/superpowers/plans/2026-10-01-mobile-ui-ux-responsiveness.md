# Mobile UI/UX Responsiveness Specification

## Problem Statement
When viewing the character builder and sheet on mobile devices with narrow viewports (320px–380px, including iPhone SE, compact Android devices, and foldable cover displays), users encounter visual and interactive clipping:
- Modal footers push action buttons past the screen edge or under system gesture navigation bars.
- Builder ability score steppers overflow 2-column card boundaries by 12px on 320px screens.
- Combat stat tiles (AC, Initiative, Speed, Proficiency Bonus, Inspiration) crowd into a single horizontal row that compresses text on narrow displays.
- High-frequency combat toggles (spell slot bubbles, death saves, resource pools) have touch targets as small as 18–24px, causing frequent mis-taps.
- Multiclass cards with long archetype names truncate into unreadable ellipses.
- Dialogs in HomeScreen use unconstrained inline modals without safe area or keyboard avoidance guarantees.

## Solution
Establish a comprehensive mobile-first responsive architecture guaranteeing zero-clipping down to a 320px minimum viewport width. Introduce a centralized `useResponsiveLayout` hook, standardize all app modals on a unified shell with `flexShrink: 1` scroll containers and safe area insets, switch compact ability steppers to full-width rows on `< 380px`, wrap combat stats into a readable grid, equip combat toggles with generous `hitSlop` (≥40px tap zones), enhance the 7-tab bar with horizontal scroll cues, and stack multiclass headers on mobile.

## User Stories

1. As a mobile player on a compact phone (320px width), I want the FirstRun modal and NewCharacter modal to display full-width action buttons that are never cut off at the edge, so that I can configure source books and start playing effortlessly.
2. As a player using modern Android gesture navigation or an iPhone home indicator, I want all modals and floating bars to respect safe area insets, so that bottom buttons never collide with system UI bars.
3. As a player allocating ability scores via Point Buy or Standard Array on a compact screen (<380px), I want each ability score to lay out as a full-width row with 44px stepper buttons, so that stepper controls never overflow the card boundaries.
4. As a player with a larger phone or tablet (≥380px), I want ability scores in the builder to display as a spacious 2-column card grid, so that I can see all attributes simultaneously.
5. As a combatant reviewing my Stats tab on mobile, I want Armor Class, Initiative, Speed, Proficiency Bonus, and Inspiration to wrap into a responsive grid, so that all key combat numbers remain readable without horizontal compression.
6. As a combatant in active battle, I want spell slot checkboxes, death saves, and resource counters to have generous touch hitSlop (at least 40×40px), so that I can accurately tap toggles with one hand.
7. As a multiclass spellcaster, I want the spellcasting profile switcher to display cleanly on small screens without horizontal truncation, so that I can switch between casting classes effortlessly.
8. As a spellcaster, I want the spell slots table (levels 1-9) to format cleanly across all mobile widths, so that remaining and max slots are always aligned and easy to read.
9. As a martial character with weapons and attacks, I want the Actions tab to render each weapon as a full-width tap-friendly card with prominent bonus, damage, and range badges, so that I can quickly read attack rolls during combat.
10. As a dual-wielding character, I want the off-hand bonus action card to display below the primary attacks without overlapping, so that my action economy choices are immediately clear.
11. As a multiclass character with long subclass names (e.g. Arcane Trickster, Oath of Vengeance), I want my class progression cards to stack the subclass selector on mobile, so that archetype titles never truncate into ellipses.
12. As a player browsing the 7 character sheet tabs on mobile, I want visual scroll cues on the horizontal tab bar, so that I know there are additional tabs to the right.
13. As a player managing folders on HomeScreen, I want the folder creation and move-to-folder dialogs to use the unified modal shell, so that they never clip behind the keyboard.
14. As a player reading long compendium text with markdown tables (like dragonborn ancestry or background tables), I want tables to scroll horizontally while paragraphs wrap smoothly, so that wide reference data remains completely legible.
15. As an adventurer reviewing inventory items on mobile, I want equipped and carried items to display as clean cards with weight and quantity steppers, so that inventory management is effortless on phones.

## Implementation Decisions

1. **Centralized Responsive Hook**:
   - Provide a hook exposing `width`, `height`, `isCompact` (< 380px), `isPhone` (< 600px), `isTablet` (≥ 768px), and safe area insets.
   - Use React Native's `useWindowDimensions` and `useSafeAreaInsets` without external dependencies.
2. **Standardized Modal Shell**:
   - Standardize all app modals (including HomeScreen folder modals) on the shared `<Modal>` component.
   - Ensure `flexShrink: 1` on modal scroll bodies, safe area padding on overlays, and stacked full-width button footers on compact screens.
3. **Adaptive Ability Scores Section**:
   - On compact screens (< 380px), render ability scores as full-width horizontal cards: attribute name & modifier on left, point-buy cost badge in center, 44px steppers on right.
   - On screens ≥ 380px, render 2-column card grid.
4. **Responsive Combat Stats Grid**:
   - In `StatsTab`, wrap combat stat tiles (AC, Initiative, Speed, Prof Bonus, Inspiration) into a responsive grid with `flexWrap: "wrap"` so tiles never drop below readable widths.
5. **Combat Toggles & Hit Slop**:
   - In `SpellsTab`, `FeaturesTab`, and `StatsTab`, apply `hitSlop: { top: 8, bottom: 8, left: 8, right: 8 }` to all checkboxes and resource circles to ensure an effective touch area of ≥ 40×40px.
6. **7-Tab Scroll Affordance**:
   - In `character/[id].tsx`, enhance the horizontal tab bar with scroll indicators or subtle edge fading so users intuitively recognize off-screen tabs.
7. **Stacked Multiclass Cards**:
   - In `ClassProgressionSection`, stack subclass selection below the class name and level stepper on compact viewports to accommodate long archetype names.

## Testing Decisions

- **Testing Philosophy**: Test responsive logic, breakpoint calculations, and contract behavior externally. Verify full TypeScript compilation, strict zero-error linting, automated unit test suites, and production web bundle exports.
- **Tested Modules**:
  - `checks/responsiveLayout.test.ts`: Test breakpoint classifications (`compact`, `phone`, `tablet`) across standard device widths (320px, 360px, 375px, 390px, 414px, 768px, 1024px).
  - Existing suite (`checks/*.test.ts`): Ensure all 132 character sheet rules tests pass without regression.
- **Compilation & Bundle Verification**:
  - `npx tsc --noEmit` must pass with 0 errors.
  - `EXPO_NO_TELEMETRY=1 npm run lint` must pass with 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export --platform web` must build cleanly.

## Out of Scope
- Introducing external UI component libraries (NativeBase, Paper, etc.).
- Upgrading or changing 2014 D&D rules calculations.
- Rewriting data scraping or schema formats.

## Further Notes
- ADR 0001 (Mobile Responsive Layout Strategy) and ADR 0002 (Mobile Touch and Card Interaction Patterns) record the architectural decisions and trade-offs.
