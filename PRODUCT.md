# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

D&D 5e players, in two situations:

- **Preparing**, away from the table and often on a bigger screen: building a character, levelling up, choosing spells and equipment. They have time and attention, and they want the choices laid out in a sensible order.
- **Playing**, at the table on a phone: reading the sheet, rolling, tracking hit points, spell slots and feature uses. Their attention is on the game, so every lookup and roll has to be quick.

## Product Purpose

Character Builder builds a 2014 D&D 5e character and then serves as its sheet during play. It works out the derived numbers (armor class, attacks, proficiencies, spell slots, level-up progression) so the player doesn't have to. It succeeds when a player gets from an idea for a character to a correct, playable sheet without a rulebook open, and can run that character at the table from a phone.

## Positioning

- **Free, no ads, offline.** No accounts, no ads, no paid features. Characters live on the device and the app works without a connection; only the optional catalog sync needs the internet.
- **Phone-first.** Built for a phone held at the table. The web version uses the same design.

## Operating Context

- Distributed as an Android APK through GitHub Releases and as a static web build (characterbuilder5e.expo.app).
- Used alongside the sourcebooks the player owns, and next to dice, a DM and a table. The app is a reference and helper, not a replacement for the books.
- Screens from 320px phones up to desktop web (ADR 0001).

## Capabilities and Constraints

- Rules: the 2014 5e ruleset only (`GLOSSARY.md`).
- Content: the SRD ships with the app. Anything beyond it comes from a catalog the player syncs from inside the app, and no non-SRD text lives in the code (ADR 0014).
- Character data stays on the device.
- Stack: Expo and React Native, one codebase for Android and web.
- In progress: a guided Creation Flow and Level-Up Flow, and dice rolling (`.scratch/app-redesign/spec.md`).

## Brand Commitments

- Name: Character Builder.
- An unofficial fan project, not affiliated with or endorsed by Wizards of the Coast. The disclaimer in `README.md` stays true wherever the product describes itself.

## Evidence on Hand

- App icon and splash: a d20 (`assets/images/dice-twenty-faces-twenty.png`, `dice-twenty-faces-twenty-red.png`).
- No testimonials, user counts or reviews exist. Do not invent any.

## Product Principles

1. **The table comes first.** In play, the next roll or lookup is one tap away and readable at a glance.
2. **Guide the build, don't quiz the player.** Choices arrive in the order a character is imagined, and only the ones that apply are shown.
3. **The app does the arithmetic.** Every derived number is computed and its source can be shown. The player never adds up a modifier by hand.
4. **Nothing leaves the device unless the player asks.** No accounts, no tracking, no ads.

## Accessibility & Inclusion

- WCAG AA contrast in every theme: 4.5:1 for text, 3:1 for UI elements and large text.
- Touch targets of at least 44×44pt (48dp on Android), and every screen usable at 320px wide.
- Honour the system's reduced-motion setting.
