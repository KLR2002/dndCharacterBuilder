# 0021 Dice Throws Are Simulated Before They Are Drawn

## Context
The Throw Dice Animation (GLOSSARY.md) sends solid dice across the screen, and the face that lands on top is the result. The Roll Log, the totals and the follow-ups (critical damage after a kept natural 20) need every face the moment a Roll is made, and every Roll source (the tray, roll badges, attacks, the Hit Points roll) builds its Roll in one synchronous call.

## Decision
- A Throw is simulated to the end in one go (about 20 ms for 20 dice) before anything is drawn. The faces are read from the settled dice, the Roll is built from them, and the recorded motion is then played back. The animation can never disagree with the total.
- Roll sources hand the roll seam a function `make(random)` instead of a finished Roll. The seam runs it once with a recording random source to learn the sides of every die in request order, simulates the thrown dice, then runs it again with a source that returns the settled faces for the thrown dice and the generator for the rest. This needs every `make` to request its dice in an order that does not depend on any face value.
- The physics is our own: a floor, the screen edges as walls, dice colliding as spheres, and a settling pull toward the nearest face once a die slows down. The dice are drawn as projected polygons with `react-native-svg`, which the app already has.
- Only the six standard dice and a d100 (a tens die and a units die) are thrown, up to 20 solids per Throw. Every other die, and any die past the cap, is decided by the generator and shown as a number.

## Considered Options
- Live physics that reads the faces when the dice stop: rejected, every caller would wait for the result and the follow-ups could not be built synchronously.
- Drawing the result first and steering the simulation to it: rejected, the face on top would no longer be the result, which is the point of the mode.
- A physics engine (cannon-es, about 150 KB) or a 3D renderer (three.js with expo-gl, about 600 KB plus a native module that F-Droid would have to build): rejected, flat-shaded polygons and a floor with walls give the look at a fraction of the weight.

## Consequences
A Roll source that changes how many dice it rolls depending on an earlier face would break the recording pass; none does today, and a test guards the seam. The frame rate with about 20 dice on a low-end phone is not known until it is measured on a device. If it is too low, the fallbacks, cheapest first, are: draw numerals only on the top face while a die moves; draw only the visible faces and fewer shading steps; play the Throw back at 30 fps; lower the Throw cap; pre-rendered sprite frames; a canvas renderer such as Skia.
