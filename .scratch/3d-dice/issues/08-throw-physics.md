# 08: Throw physics

**What to build:** A pure module `src/rules/diceThrow.ts`, lifted from the `m-phys` script of the prototype and built on `diceMath.ts` and `diceSolids.ts`: `launchSpecs(dice, size, world, origin, random)` gives each die a start position near `origin`, a height, a velocity toward a random point of the screen, an orientation and a spin; `simulateThrow(specs, world, random)` runs the whole throw at 120 steps a second (gravity, bounce, floor friction with rolling coupling, walls, sphere collisions between dice, a settling pull toward the nearest face once a die slows) and returns, per die, the value on top and its 60 fps frames (x, y, height, orientation) in a `Float32Array`, all dice padded to the same frame count; the run stops when every die has settled or after 6.5 seconds, after which the dice are finished aligned. The random source is injected (the app passes `Math.random`); the physical constants are named in one place.

**Blocked by:** 05

**Status:** done

**Landed:** feature/3d-dice @ d77a70a. check:all (2315 app, 312 scraper tests) and the full layout:check at 320, 393, 768 and 1280 are green; the Android parts were checked by hand on the emulator (tray field, Tumble and Throw drawn, no crash), not through layout:android scenarios, and the last review repair was not re-checked on a device.

- [x] `checks/diceThrow.test.ts`, written first, with a seeded generator so it is deterministic: the same seed gives the same throw; every die settles within 6.5 s; every die's position stays inside the world at every frame; the reported value is the readable on top in the last frame (the top direction within 0.01 rad of vertical); 2000 seeded throws of one d6 give every face between 12% and 22% of the results, and 800 of a d20 give every face at least 1.5%; a throw of 20 dice completes
- [x] The module imports nothing from React Native; `npm run check:all` passes
