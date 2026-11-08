// The native player for the scenario step fields: the emulator side of the seam that scripts/lib/steps.mjs
// describes. After a scenario's route is launched, it plays `tabs` and `open` as taps on the matching node of
// a uiautomator dump, waits for the ready text (`modal ?? ready` — a modal is the dialog's title string, so
// it is waited for, never tapped), turns `scrollTo` into swipes until the needle is visible, and settles
// briefly before the screenshot. A target that starts off the screen is revealed by swiping what the dump
// says (a clipped match steers the swipe), bounded by a number of swipes rather than a clock reading;
// a target the dump does not point at on the step's axis is searched by scrolling the page vertically
// toward the top first, so a tab bar scrolled above the viewport is reached from any scroll position. An
// absent `scrollTo` needle warns instead of failing, as the web check's scrollIntoView does nothing when its
// text is absent. `expect` is not evaluated. Every device interaction goes through the injected `dump`,
// `tap` and `swipe`, so the tests drive it with scripted dumps and a recording fake.
import { describeStep } from "./steps.mjs";
import { centerOf, findNode, hasPositiveArea } from "./uiautomator.mjs";

// The waits, as in the web check: half a second after each tab tap, and a short settle before the
// screenshot, longer for a modal whose open animation needs it.
export const TAB_WAIT_MS = 500;
export const SETTLE_WAIT_MS = 300;
export const MODAL_SETTLE_WAIT_MS = 500;
// scrollTo gives up after this many swipes, and so does the reveal of a step target or the ready text:
// the bound is a swipe count, not a clock reading, so it does not depend on how long a dump takes.
export const MAX_SWIPES = 25;
// One scrollTo swipe takes this long.
export const SWIPE_MS = 300;
// A reveal swipe is slow, so the finger release gives little or no fling. Measured on the emulator
// (720x1280, density 320) on the Class tab page: `input swipe 360 1085 360 685 800` (finger 400 px up,
// 800 ms) moved the content 418 px, 600 px @ 800 ms moved 620 px, 500 px @ 900 ms moved 523 px — a slow
// swipe moves the content about as far as the finger travels. The same swipes at 300 ms moved 1.2-1.4x as
// far (400 px @ 300 ms moved 548 px), the fling that skips over a narrow window where the target is listed.
export const REVEAL_SWIPE_MS = 800;
// The fixed step of a reveal swipe when the dump shows no clipped match for the target.
export const REVEAL_STEP_PX = 600;
// The margin added to the distance computed from a clipped target, so the target lands fully on screen.
export const REVEAL_MARGIN_PX = 120;
// The finger stays this far inside a scroller's bounds.
const SWIPE_PAD_PX = 8;
// ... and at least this far from every screen edge: a swipe that starts in an edge zone is a system
// gesture, not an app swipe. Measured on the emulator (720x1280): a horizontal swipe starting 60 px from
// a side edge fired the back gesture and left the app, 64 px did not; a vertical swipe starting 56-80 px
// above the bottom fired home, 80 px did not. 96 px clears all of those zones with room to spare.
const EDGE_GUARD_PX = 96;

// The value a locator call matches against: the element's text, or its accessibility label, which on Android
// is the node's content-desc attribute in the dump.
function matchedValue(node, call) {
  return call.method === "getByLabel" ? node.contentDesc : node.text;
}

// The Playwright semantics the described call mirrors: a RegExp is tested as is; a string with `exact` is a
// full-string match; without `exact` it is a case-insensitive substring match.
export function matchesCall(node, call) {
  if (call.arg instanceof RegExp) return call.arg.test(matchedValue(node, call));
  const value = matchedValue(node, call);
  return call.options?.exact ? value === call.arg : value.toLowerCase().includes(String(call.arg).toLowerCase());
}

// Every node matching the call, in dump order.
export function findMatches(nodes, call) {
  return nodes.filter((node) => matchesCall(node, call));
}

// The match a step taps: the `index`th of the on-screen matches (the first by default). The dump also
// lists nodes scrolled out of the viewport, with clipped bounds of no positive area, so a match counts
// as a tap target only when its visible part is on the screen (with a view; without one, any box of
// positive area); the web counts every match in the DOM, including the ones scrolled off screen.
export function findTarget(nodes, call, view) {
  const matches = findMatches(nodes, call).filter((node) => centerOf(node, view) !== null);
  return matches[call.index ?? 0] ?? null;
}

// A node counts as visible when its bounds have positive area and lie fully inside the screen and clear
// of the status bar (top) and the gesture bar (bottom); view is { width, height, topBar, bottomBar } in
// px, the bars read from the device. The dump also lists nodes clipped out of the viewport — their
// bounds come back inverted, with no positive area — and the root containers span the whole screen, so
// a match in the dump is not by itself visible.
export function isVisible(node, view) {
  const b = node.bounds;
  if (!hasPositiveArea(b)) return false;
  return b.x1 >= 0 && b.y1 >= view.topBar && b.x2 <= view.width && b.y2 <= view.height - view.bottomBar;
}

// The swipe that scrolls content up (the finger moves up), as `input swipe` arguments: mid-screen, from 70%
// to 30% of the height, kept clear of the bottom gesture bar. Down is its mirror.
export function swipeUpArgs(view) {
  const x = Math.round(view.width / 2);
  return [x, Math.round(view.height * 0.7), x, Math.round(view.height * 0.3), SWIPE_MS];
}

export function swipeDownArgs(view) {
  const x = Math.round(view.width / 2);
  return [x, Math.round(view.height * 0.3), x, Math.round(view.height * 0.7), SWIPE_MS];
}

// The direction and finger-travel distance a clipped match calls for. A match the dump lists only as a
// clipped node (inverted bounds, no positive area) is scrolled out of the viewport, so its y1 against
// the visible bottom (or its y2 against the visible top) says which way and roughly how far to scroll;
// horizontally, its x1 against the right edge or its x2 against the left edge. Returns null when the
// clipped match says nothing (clipped at a scroller's inner edge, say).
function clippedGuidance(bounds, view, horizontalOnly) {
  if (!bounds) return null;
  if (horizontalOnly) {
    if (bounds.x1 >= view.width) return { direction: "left", distance: bounds.x1 - view.width + REVEAL_MARGIN_PX };
    if (bounds.x2 <= 0) return { direction: "right", distance: -bounds.x2 + REVEAL_MARGIN_PX };
    return null;
  }
  const visibleBottom = view.height - view.bottomBar;
  if (bounds.y1 >= visibleBottom) return { direction: "up", distance: bounds.y1 - visibleBottom + REVEAL_MARGIN_PX };
  if (bounds.y2 <= view.topBar) return { direction: "down", distance: view.topBar - bounds.y2 + REVEAL_MARGIN_PX };
  return null;
}

// The reveal swipe inside one of the dump's scrollers, along the given axis and direction, over `distance`
// px of finger travel and REVEAL_SWIPE_MS ms: for a vertical ScrollView up (the finger moves up, the
// content moves up, revealing what is below) or down; for a HorizontalScrollView left (items clipped at
// the right edge come into view) or right. The finger stays SWIPE_PAD_PX inside the scroller's bounds and
// EDGE_GUARD_PX away from the screen's edges, so the swipe is an app swipe, never a system gesture; the
// travel is clamped to what fits inside that.
export function revealSwipeArgs(scroller, horizontalOnly, direction, distance, view) {
  const b = scroller.bounds;
  const xLow = Math.max(b.x1 + SWIPE_PAD_PX, EDGE_GUARD_PX);
  const xHigh = Math.min(b.x2 - SWIPE_PAD_PX, view.width - EDGE_GUARD_PX);
  const yLow = Math.max(b.y1 + SWIPE_PAD_PX, EDGE_GUARD_PX);
  const yHigh = Math.min(b.y2 - SWIPE_PAD_PX, view.height - EDGE_GUARD_PX);
  if (horizontalOnly) {
    const y = Math.round(Math.max(yLow, Math.min(yHigh, (b.y1 + b.y2) / 2)));
    const travel = Math.max(1, Math.min(distance, xHigh - xLow));
    const from = direction === "left" ? xHigh : xLow;
    return [Math.round(from), y, Math.round(direction === "left" ? from - travel : from + travel), y, REVEAL_SWIPE_MS];
  }
  const x = Math.round(Math.max(xLow, Math.min(xHigh, (b.x1 + b.x2) / 2)));
  const travel = Math.max(1, Math.min(distance, yHigh - yLow));
  const from = direction === "up" ? yHigh : yLow;
  return [x, Math.round(from), x, Math.round(direction === "up" ? from - travel : from + travel), REVEAL_SWIPE_MS];
}

// The geometry of a dump (the bounds of its nodes): two dumps with the same geometry did not scroll.
function geometryOf(nodes) {
  return nodes.map((n) => (n.bounds ? `${n.bounds.x1},${n.bounds.y1},${n.bounds.x2},${n.bounds.y2}` : "")).join(";");
}

const FLIP = { up: "down", down: "up", left: "right", right: "left" };

// Polls the dump until `find` matches, swiping the dump's scrollers when the target is missing (the web
// click scrolls its target into view). A match the dump lists only as a clipped node (`findClipped`)
// steers the swipe — which way, and by about the gap plus REVEAL_MARGIN_PX, in one slow swipe — so the
// target lands on screen; without one, a fixed REVEAL_STEP_PX goes in the current direction. The direction
// flips when a swipe moves nothing (two dumps with the same geometry), so a target on the other side is
// found too. The search is bounded by MAX_SWIPES swipes — a count, not a clock reading, so it does not
// depend on how long a dump takes; the deadline applies only while the dump has no scroller at all, i.e.
// while the screen has not rendered yet and there is nothing to scroll. Tabs swipe the horizontal tab
// bars, other steps the vertical scrollers — and when the dump does not point at the target on that
// axis (the target is absent entirely, or clipped across the page rather than inside a bar), the page
// itself is scrolled vertically toward the top first (the tab bars sit there), because the bar's
// scroller may be scrolled out of the dump altogether; that page swipe is a slow swipe inside the
// dump's vertical scrollers (mid-screen when there is none) and counts against the same swipe bound.
// Returns { found, bound }: the match with bound null, or null with bound "swipes" or "timeout".
async function pollRevealing({ dump, swipe, find, findClipped, view, sleep, now, deadline, pollMs, horizontalOnly = false }) {
  let direction = horizontalOnly ? "left" : "up";
  // The page fallback starts toward the top of the page, where the tab bars are.
  let pageDirection = "down";
  let previous = null;
  let swipes = 0;
  for (;;) {
    const nodes = dump();
    const found = find(nodes);
    if (found) return { found, bound: null };
    const scrollable = nodes.filter((n) => n.scrollable && n.bounds);
    const scrollers = scrollable.filter((n) =>
      horizontalOnly ? n.className.includes("HorizontalScrollView") : !n.className.includes("HorizontalScrollView"),
    );
    if (scrollable.length === 0) {
      if (now() >= deadline) return { found: null, bound: "timeout" };
      await sleep(pollMs);
      continue;
    }
    if (swipes >= MAX_SWIPES) return { found: null, bound: "swipes" };
    const geometry = geometryOf(nodes);
    if (previous === geometry) {
      direction = FLIP[direction];
      pageDirection = FLIP[pageDirection];
    }
    previous = geometry;
    const clipped = findClipped ? findClipped(nodes) : null;
    const guidance = clipped ? clippedGuidance(clipped.bounds, view, horizontalOnly) : null;
    // One swipe, counted against the bound: never more than MAX_SWIPES in total.
    const swipeBounded = (args) => {
      if (swipes >= MAX_SWIPES) return;
      swipe(args);
      swipes += 1;
    };
    // The page is searched vertically when the dump does not point at the target along the step's own
    // axis: a tab absent from the dump may sit in a bar that is scrolled above the viewport, and a
    // step target with no vertical scroller in the dump may sit below or above the page.
    const pageSearch = horizontalOnly ? !clipped || guidance === null : scrollers.length === 0;
    if (pageSearch) {
      const vertical = scrollable.filter((n) => !n.className.includes("HorizontalScrollView"));
      if (vertical.length > 0) {
        for (const scroller of vertical) swipeBounded(revealSwipeArgs(scroller, false, pageDirection, REVEAL_STEP_PX, view));
      } else {
        swipeBounded(pageDirection === "down" ? swipeDownArgs(view) : swipeUpArgs(view));
      }
    }
    for (const scroller of scrollers) {
      swipeBounded(revealSwipeArgs(scroller, horizontalOnly, guidance?.direction ?? direction, guidance?.distance ?? REVEAL_STEP_PX, view));
    }
    await sleep(pollMs);
  }
}

// Plays one scenario's step fields in the order the web check plays them: each `tabs` entry as a tap on the
// first node whose text equals the tab name, then TAB_WAIT_MS; each `open` step in order as a tap on its
// described target; then the ready text (`screen.modal ?? screen.ready`); then `scrollTo` as swipes until
// the needle is visible; then the settle wait (500 ms with a modal, 300 ms without). A step target or the
// ready text that starts off the screen is revealed by swiping, bounded by MAX_SWIPES swipes. Returns
// { error, warnings }: error is null when the screen is ready for its screenshot, else a message naming the
// step that failed; warnings lists what the run should say without failing (an absent scrollTo needle).
export async function playScreen({ screen, dump, tap, swipe, view, sleep, now, timeoutMs, pollMs }) {
  const seconds = Math.round(timeoutMs / 1000);
  const deadlineFor = () => now() + timeoutMs;
  const warnings = [];
  const boundText = (bound) => (bound === "timeout" ? `within ${seconds} s` : `within ${MAX_SWIPES} swipes`);
  // The match of `call` that is in the dump but not on screen (clipped or off the viewport): it steers
  // the reveal swipe.
  const clippedMatch = (call) => (nodes) => findMatches(nodes, call).find((n) => n.bounds && centerOf(n, view) === null) ?? null;
  for (const tab of screen.tabs ?? []) {
    // A tab is the web check's getByText(tab, { exact: true }).first(): the exact text, the first match.
    // Tabs sit in the horizontal tab bars, so the reveal swipes there stay horizontal — after the page
    // fallback has scrolled the page back up to the bars when they are not in the dump.
    const call = { method: "getByText", arg: tab, options: { exact: true }, index: 0 };
    const { found, bound } = await pollRevealing({
      dump,
      swipe,
      find: (nodes) => findTarget(nodes, call, view),
      findClipped: clippedMatch(call),
      view,
      sleep,
      now,
      deadline: deadlineFor(),
      pollMs,
      horizontalOnly: true,
    });
    if (!found) return { error: `tab "${tab}" did not show ${boundText(bound)}`, warnings };
    const point = centerOf(found, view);
    if (!point) return { error: `tab "${tab}" matched a node with no on-screen bounds`, warnings };
    tap(point);
    await sleep(TAB_WAIT_MS);
  }
  for (const step of screen.open ?? []) {
    const call = describeStep(step);
    if (call.name !== undefined) return { error: `open step "${call.name}" has no native form`, warnings };
    const what = `open step ${JSON.stringify(step.tap)}`;
    const { found, bound } = await pollRevealing({
      dump,
      swipe,
      find: (nodes) => findTarget(nodes, call, view),
      findClipped: clippedMatch(call),
      view,
      sleep,
      now,
      deadline: deadlineFor(),
      pollMs,
    });
    if (!found) return { error: `${what} did not show ${boundText(bound)}`, warnings };
    const point = centerOf(found, view);
    if (!point) return { error: `${what} matched a node with no on-screen bounds`, warnings };
    tap(point);
  }
  // The ready text: a modal scenario waits for the dialog's title string; it is never tapped. Ready means
  // present in the dump at any scroll position, as on the web, where waitFor({ state: "visible" }) needs a
  // bounding box, not a viewport intersection — so a ready text that is only clipped out of the viewport
  // still counts. When it is not in the dump at all (the open steps may have left the page scrolled
  // mid-page), it is looked for by swiping in both directions, bounded by MAX_SWIPES swipes.
  const ready = screen.modal ?? screen.ready;
  const { found: readyNode, bound: readyBound } = await pollRevealing({
    dump,
    swipe,
    find: (nodes) => findNode(nodes, ready),
    view,
    sleep,
    now,
    deadline: deadlineFor(),
    pollMs,
  });
  if (!readyNode) return { error: `ready text ${typeof ready === "string" ? `"${ready}"` : ready} did not show ${boundText(readyBound)}`, warnings };
  if (screen.scrollTo) {
    const needle = screen.scrollTo;
    // scrollTo swipes mid-screen until the needle is visible; the direction flips when a swipe moves
    // nothing, so a needle above the current position is reached too. Bounded by MAX_SWIPES swipes.
    let swipes = 0;
    let direction = "up";
    let previous = null;
    for (;;) {
      const nodes = dump();
      if (nodes.some((node) => node.text.includes(needle) && isVisible(node, view))) break;
      if (swipes >= MAX_SWIPES) {
        // No scroll position shows the needle: the web check's scrollIntoView does nothing when its
        // element is absent, so the scenario does not fail — warn, leave the page at the top, and take
        // the screenshot where it is.
        warnings.push(
          `scrollTo "${needle}" is not shown at any scroll position within ${MAX_SWIPES} swipes; scenario "${screen.name}" is screenshotted where the page is, as the web check's scrollIntoView does nothing when its text is absent`,
        );
        if (swipes > 0) {
          let prev = null;
          for (let i = 0; i < MAX_SWIPES; i++) {
            const geometry = geometryOf(dump());
            if (geometry === prev) break;
            prev = geometry;
            swipe(swipeDownArgs(view));
            await sleep(pollMs);
          }
        }
        break;
      }
      const geometry = geometryOf(nodes);
      if (previous === geometry) direction = direction === "up" ? "down" : "up";
      previous = geometry;
      swipe(direction === "up" ? swipeUpArgs(view) : swipeDownArgs(view));
      swipes += 1;
      await sleep(pollMs);
    }
  }
  await sleep(screen.modal ? MODAL_SETTLE_WAIT_MS : SETTLE_WAIT_MS);
  return { error: null, warnings };
}
