# 11: Check the animation speed on a phone

**What to build:** Nothing to code. The user tries both animations on a real phone and reports whether the frame rate holds; the numbers decide whether an optimisation ticket is needed (the fallbacks are listed in `spec.md`, Open). Try on the lowest-end Android phone at hand, with the release or E2E build: (1) after ticket 07, Tumble with `10d20` and with `d20,d20,d20` (three colours); (2) after ticket 10, Throw with `20d20`, with `2a(d20,d20),d100,4d6`, and a quick succession of three throws. Note for each: does the motion look smooth, does the throw start without a visible freeze (the simulation takes about 20 ms on a desktop), are the numerals readable on the top faces, and does the screen react to taps right after the dice stop.

**Blocked by:** 07, 10

**Status:** done

**Landed:** the user tried both animations on a phone: the SVG dice dropped frames from 5 dice and tore faces. Superseded by `.scratch/canvas-dice/spec.md` and ADR 0022, whose AC-9 repeats the phone test for the canvas dice.

- [x] Tumble result reported (smooth or not, with the device named)
- [x] Throw result reported (smooth or not, with the device named)
- [x] If either is not smooth, a follow-up ticket is written: the canvas dice spec replaces the fallbacks
