# 04: Dynamic Scaling Combat Dice and Combat Automation

**What to build:** Characters with scaling combat features (Bardic Inspiration, Rogue Sneak Attack, Monk Martial Arts) see their dynamic dice automatically calculated and integrated into the character sheet. Monk unarmed strikes and monk weapons scale their damage dice and substitute DEX, Monk bonus actions are generated, and Rogues receive Sneak Attack action cards and weapon badges.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Pure rules module `src/rules/combatDice.ts` calculates active dice:
  - Bardic Inspiration: `1d6` (1–4), `1d8` (5–9), `1d10` (10–14), `1d12` (15–20).
  - Sneak Attack: $\lceil \text{Rogue Level} / 2 \rceil \text{d6}$.
  - Martial Arts: `1d4` (1–4), `1d6` (5–10), `1d8` (11–16), `1d10` (17–20).
- [x] Features tab: Bardic Inspiration resource counter displays the active die in its title (e.g. `Bardic Inspiration [1d8 die]`).
- [x] Stats tab: Combat overview displays an active Class Dice summary strip.
- [x] Actions tab:
  - Monk Unarmed Strike automatically scales damage die to Martial Arts die if higher, and uses DEX instead of STR if DEX > STR.
  - Monk Weapons (shortswords, non-heavy/two-handed simple melee weapons) automatically adopt the Martial Arts die if higher than base damage, and use DEX if DEX > STR.
  - Monk automatically gains *"Bonus Action: Martial Arts Strike"* and *"Bonus Action: Flurry of Blows (1 Ki)"*.
  - Rogue displays a *"Sneak Attack (Xd6)"* Action card detailing rules and conditions.
  - Rogue equipped weapon attack cards for finesse and ranged weapons display `[Sneak Attack Eligible: +Xd6]`.
  - Bard displays a *"Bardic Inspiration (XdX)"* Bonus Action card.
- [x] Tested via `checks/combatDice.test.ts`.
