# 01: Multi-Mode Movement Speeds Engine and Armor Flight Gating

**What to build:** Pure rules engine in `src/rules/speed.ts` calculating all active movement modes (`walk`, `swim`, `climb`, `fly`, `flyRestricted`, `details`). Evaluates innate racial speeds from race data and traits, dynamically scales relative speeds ("equal to your walking speed") when walking speed increases, and enforces medium/heavy armor restrictions on racial flight.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] In `src/rules/speed.ts`, export `MovementSpeeds` interface and `characterSpeeds(character: Character, opts?: RulesOptions): MovementSpeeds`.
- [x] Preserve `speed(character, opts): number` returning walking speed for 100% backward compatibility.
- [x] Support innate speeds from race objects `{ walk, swim, climb, fly }` (e.g. Triton swim 30 ft, Tabaxi climb 20/30 ft, Aarakocra fly 50 ft).
- [x] Support traits defining speeds "equal to your walking speed" (e.g. Dhampir Spider Climb), dynamically evaluating to `effectiveWalkingSpeed` (including Monk Unarmored Movement, Barbarian Fast Movement, and feats).
- [x] Check equipped armor categories: if medium or heavy armor is equipped and character has racial flight, set `flyRestricted: true` and `fly: 0`.
- [x] Tested via `checks/speeds.test.ts` including positive cases, relative scaling, and armor restriction negative cases.
