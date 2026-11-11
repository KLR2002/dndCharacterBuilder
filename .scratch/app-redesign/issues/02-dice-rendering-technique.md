# 02: Dice rendering technique

**Type:** research

**Blocked by:** None (can start immediately)

**Status:** resolved

## Question

Which technique draws rolling dice in this Expo app on web and Android at the lowest cost in bundle size, CPU and battery, while dice can take the current accent colour and the text result never waits on the animation? Candidates: real 3D with physics (three.js or react-three-fiber over expo-gl, cannon-es or another physics engine), precomputed 3D animations, or 2.5D sprites and Reanimated transforms. The user prefers the faster, lighter option.

## Answer

2.5D dice with Reanimated transforms. Each die is a View (d6) or an SVG face (other dice, adding `react-native-svg`), tweened with rotate and scale transforms to a pose showing the face the app's random source already chose, filled from the current accent. It is gated by the dice setting, by `AccessibilityInfo.isReduceMotionEnabled` on native and by `prefers-reduced-motion` through `matchMedia` on web. It needs no WebGL context, adds almost nothing to the bundle, runs on web and Android, and lands on the predetermined face exactly. The trade-off: flat tumbling faces, no lighting, shadows or physics. Scripted 3D (three.js and expo-gl, no physics) is the upgrade path if the look proves too flat. Physics 3D, Skia and Dice Box rank below (cost, fragile forced results, no Android).

Open before building: measure the real bundle delta with `npx expo export`; confirm Reanimated 4.5.1 against the SDK 57 bundled-library list.

Findings with sources: `.scratch/app-redesign/research/02-dice-rendering-technique.md` on branch `research/dice-rendering-technique` (commit `d035317`, pushed, no PR).
