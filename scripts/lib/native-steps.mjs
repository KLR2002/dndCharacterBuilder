// The native player for the scenario step fields: the emulator side of the seam that scripts/lib/steps.mjs
// describes. After a scenario's route is launched, it plays `tabs` and `open` as taps on the matching node of
// a uiautomator dump, waits for the ready text (`modal ?? ready` — a modal is the dialog's title string, so
// it is waited for, never tapped), turns `scrollTo` into swipes until the needle is visible, and settles
// briefly before the screenshot. `expect` is not evaluated. Every device interaction goes through the
// injected `dump`, `tap` and `swipe`, so the tests drive it with scripted dumps and a recording fake.
import { describeStep } from "./steps.mjs";
import { centerOf, findNode, hasPositiveArea } from "./uiautomator.mjs";

// The waits, as in the web check: half a second after each tab tap, and a short settle before the
// screenshot, longer for a modal whose open animation needs it.
export const TAB_WAIT_MS = 500;
export const SETTLE_WAIT_MS = 300;
export const MODAL_SETTLE_WAIT_MS = 500;
// scrollTo gives up after this many swipes.
export const MAX_SWIPES = 25;
// One swipe takes this long.
export const SWIPE_MS = 300;
// Swipes per scroller between two dumps while revealing a step target: a dump takes about two seconds on
// the emulator, so only a few fit in the ready timeout, and each must cover real ground.
export const REVEAL_SWIPES_PER_POLL = 2;

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

// The swipe inside one of the dump's scrollers, along its orientation and the given direction: for a
// vertical ScrollView up (the finger moves from 85% to 15% of it, content moves up) or down; for a
// HorizontalScrollView left (items clipped at the right edge come into view) or right. The scroller's
// bounds already end at the gesture bar, so the swipe stays inside it.
export function scrollerSwipeArgs(node, direction) {
  const b = node.bounds;
  if (node.className.includes("HorizontalScrollView")) {
    const y = Math.round((b.y1 + b.y2) / 2);
    const [from, to] = direction.horizontal === "left" ? [0.85, 0.15] : [0.15, 0.85];
    return [Math.round(b.x1 + (b.x2 - b.x1) * from), y, Math.round(b.x1 + (b.x2 - b.x1) * to), y, SWIPE_MS];
  }
  const x = Math.round((b.x1 + b.x2) / 2);
  const [from, to] = direction.vertical === "up" ? [0.85, 0.15] : [0.15, 0.85];
  return [x, Math.round(b.y1 + (b.y2 - b.y1) * from), x, Math.round(b.y1 + (b.y2 - b.y1) * to), SWIPE_MS];
}

// The geometry of a dump (the bounds of its nodes): two dumps with the same geometry did not scroll.
function geometryOf(nodes) {
  return nodes.map((n) => (n.bounds ? `${n.bounds.x1},${n.bounds.y1},${n.bounds.x2},${n.bounds.y2}` : "")).join(";");
}

// Polls the dump until `find` matches, as long as the ready wait polls. The dump lists only what is on
// screen, while the web click scrolls its target into view, so a target missing from the dump is revealed
// by swiping inside the dump's scrollers first (tabs only in the horizontal tab bars, other steps in every
// scroller). The direction flips when a swipe moves nothing, i.e. the scroller is at that end, so a target
// above the current position is found too. Returns the match, or null when the timeout passes.
async function pollRevealing({ dump, swipe, find, sleep, now, deadline, pollMs, horizontalOnly = false }) {
  let direction = { vertical: "up", horizontal: "left" };
  let previous = null;
  for (;;) {
    const nodes = dump();
    const found = find(nodes);
    if (found) return found;
    if (now() >= deadline) return null;
    let scrollers = nodes.filter((n) => n.scrollable && n.bounds);
    if (horizontalOnly) scrollers = scrollers.filter((n) => n.className.includes("HorizontalScrollView"));
    const geometry = geometryOf(nodes);
    if (previous === geometry) {
      direction = {
        vertical: direction.vertical === "up" ? "down" : "up",
        horizontal: direction.horizontal === "left" ? "right" : "left",
      };
    }
    previous = geometry;
    for (let repeat = 0; repeat < REVEAL_SWIPES_PER_POLL; repeat++) {
      for (const scroller of scrollers) swipe(scrollerSwipeArgs(scroller, direction));
    }
    await sleep(pollMs);
  }
}

// Plays one scenario's step fields in the order the web check plays them: each `tabs` entry as a tap on the
// first node whose text equals the tab name, then TAB_WAIT_MS; each `open` step in order as a tap on its
// described target; then the ready text (`screen.modal ?? screen.ready`); then `scrollTo` as swipes until
// the needle is visible; then the settle wait (500 ms with a modal, 300 ms without). Returns null when the
// screen is ready for its screenshot, or a message naming the step that failed.
export async function playScreen({ screen, dump, tap, swipe, view, sleep, now, timeoutMs, pollMs }) {
  const seconds = Math.round(timeoutMs / 1000);
  const deadlineFor = () => now() + timeoutMs;
  for (const tab of screen.tabs ?? []) {
    // A tab is the web check's getByText(tab, { exact: true }).first(): the exact text, the first match.
    // Tabs sit in the horizontal tab bars, so the reveal swipes there stay horizontal.
    const call = { method: "getByText", arg: tab, options: { exact: true }, index: 0 };
    const node = await pollRevealing({
      dump,
      swipe,
      find: (nodes) => findTarget(nodes, call, view),
      sleep,
      now,
      deadline: deadlineFor(),
      pollMs,
      horizontalOnly: true,
    });
    if (!node) return `tab "${tab}" did not show within ${seconds} s`;
    const point = centerOf(node, view);
    if (!point) return `tab "${tab}" matched a node with no on-screen bounds`;
    tap(point);
    await sleep(TAB_WAIT_MS);
  }
  for (const step of screen.open ?? []) {
    const call = describeStep(step);
    if (call.name !== undefined) return `open step "${call.name}" has no native form`;
    const what = `open step ${JSON.stringify(step.tap)}`;
    const node = await pollRevealing({
      dump,
      swipe,
      find: (nodes) => findTarget(nodes, call, view),
      sleep,
      now,
      deadline: deadlineFor(),
      pollMs,
    });
    if (!node) return `${what} did not show within ${seconds} s`;
    const point = centerOf(node, view);
    if (!point) return `${what} matched a node with no on-screen bounds`;
    tap(point);
  }
  // The ready text: a modal scenario waits for the dialog's title string; it is never tapped. Ready means
  // present in the dump, as on the web, where waitFor({ state: "visible" }) needs a bounding box, not a
  // viewport intersection — so a ready text that is only clipped out of the viewport still counts, and
  // the scrollTo step afterwards is what brings the needle on screen for the screenshot.
  const ready = screen.modal ?? screen.ready;
  const readyNode = await pollRevealing({
    dump,
    swipe,
    find: (nodes) => findNode(nodes, ready),
    sleep,
    now,
    deadline: deadlineFor(),
    pollMs,
  });
  if (!readyNode) return `ready text ${typeof ready === "string" ? `"${ready}"` : ready} did not show within ${seconds} s`;
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
      if (swipes >= MAX_SWIPES) return `scrollTo "${needle}" did not become visible within ${MAX_SWIPES} swipes`;
      const geometry = geometryOf(nodes);
      if (previous === geometry) direction = direction === "up" ? "down" : "up";
      previous = geometry;
      swipe(direction === "up" ? swipeUpArgs(view) : swipeDownArgs(view));
      swipes += 1;
      await sleep(pollMs);
    }
  }
  await sleep(screen.modal ? MODAL_SETTLE_WAIT_MS : SETTLE_WAIT_MS);
  return null;
}
