# 05: "New character" tapped before the characters load throws

**What to build:** On a cold start, tapping the Home header's add button (`home-header-add`) before `CharacterContext` has finished loading calls `createCharacter` (`src/app/index.tsx:98`), whose `requireReady` (`src/context/CharacterContext.tsx:122`) throws "Load characters successfully before editing. Retry initialization or restore your backup." The promise is not caught, so web shows the Uncaught Error overlay and no draft opens. Reproduce: `ONLY="New character draft" WIDTHS=393 npm run layout:check` on a fresh server fails with that overlay (the scenario passes inside the full suite only because the server is warm by then). Seen on `refactor/feat-slot` 301c9ac and `refactor/class-choices-view`; check whether `master` has it too.

Fix it at the seam: either the add action waits for initialization (the context already holds an `initialization` promise) or it is disabled until the characters have loaded; a load that failed keeps today's error path. Pick the one that matches how other Home actions handle the not-ready state, and say which.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge da96b4f (32cb246). `createCharacter` awaits the pending `initialization` promise before `requireReady()`; a failed load still leaves `ready` false and throws as before. Waiting was chosen over disabling the button because Home has no loading state to follow. `master` has the same bug. Two tests in `checks/context.test.ts`; the scenario was red alone on a fresh server (`did not show "Choose Your Class:"`, the Expo log showing the `requireReady` error) and green after; check:all passed. The other writers (`updateCharacter`, `createFolder`, `deleteCharacter`) still throw if used before the load; no cold-start path reaches them that we know of.

- [x] The scenario above passes on a fresh server, run alone, at 393 (paste the red run first).
- [x] `npm run check:all` passes.
