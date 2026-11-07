// The native player for the scenario step fields: the emulator side of the seam that scripts/lib/steps.mjs
// describes. After a scenario's route is launched, it plays `tabs` and `open` as taps on the matching node of
// a uiautomator dump, waits for the ready text (`modal ?? ready` — a modal is the dialog's title string, so
// it is waited for, never tapped), turns `scrollTo` into swipes until the needle is visible, and settles
// briefly before the screenshot. `expect` is not evaluated. Every device interaction goes through the
// injected `dump`, `tap` and `swipe`, so the tests drive it with scripted dumps and a recording fake.
import { describeStep } from "./steps.mjs";
import { centerOf, findNode } from "./uiautomator.mjs";

// The waits, as in the web check: half a second after each tab tap, and a short settle before the
// screenshot, longer for a modal whose open animation needs it.
export const TAB_WAIT_MS = 500;
export const SETTLE_WAIT_MS = 300;
export const MODAL_SETTLE_WAIT_MS = 500;
// scrollTo gives up after this many swipes.
export const MAX_SWIPES = 25;
// One swipe up takes this long.
export const SWIPE_MS = 300;

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

// The match a step taps: the `index`th of the matches (the first by default). The dump lists only what is
// on screen, so `index` counts the visible matches; the web counts every match in the DOM, including the
// ones scrolled off screen.
export function findTarget(nodes, call) {
  return findMatches(nodes, call)[call.index ?? 0] ?? null;
}

// A node counts as visible when its bounds lie fully inside the screen and clear of the status bar (top) and
// the gesture bar (bottom); view is { width, height, topBar, bottomBar } in px, the bars read from the
// device. The dump also lists nodes clipped by a screen edge, and the root containers span the whole screen,
// so a match in the dump is not by itself visible.
export function isVisible(node, view) {
  const b = node.bounds;
  if (!b) return false;
  return b.x1 >= 0 && b.y1 >= view.topBar && b.x2 <= view.width && b.y2 <= view.height - view.bottomBar;
}

// The swipe that scrolls content up (the finger moves up), as `input swipe` arguments: mid-screen, from 70%
// to 30% of the height, kept clear of the bottom gesture bar.
export function swipeUpArgs(view) {
  const x = Math.round(view.width / 2);
  return [x, Math.round(view.height * 0.7), x, Math.round(view.height * 0.3), SWIPE_MS];
}

// Polls the dump until the call's target shows, as long as the ready wait polls. Returns the node, or null
// when the timeout passes.
async function waitForTarget({ dump, call, sleep, now, timeoutMs, pollMs }) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const node = findTarget(dump(), call);
    if (node) return node;
    if (now() >= deadline) return null;
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
  for (const tab of screen.tabs ?? []) {
    // A tab is the web check's getByText(tab, { exact: true }).first(): the exact text, the first match.
    const call = { method: "getByText", arg: tab, options: { exact: true }, index: 0 };
    const node = await waitForTarget({ dump, call, sleep, now, timeoutMs, pollMs });
    if (!node) return `tab "${tab}" did not show within ${seconds} s`;
    const point = centerOf(node);
    if (!point) return `tab "${tab}" matched a node with no bounds`;
    tap(point);
    await sleep(TAB_WAIT_MS);
  }
  for (const step of screen.open ?? []) {
    const call = describeStep(step);
    if (call.name !== undefined) return `open step "${call.name}" has no native form`;
    const what = `open step ${JSON.stringify(step.tap)}`;
    const node = await waitForTarget({ dump, call, sleep, now, timeoutMs, pollMs });
    if (!node) return `${what} did not show within ${seconds} s`;
    const point = centerOf(node);
    if (!point) return `${what} matched a node with no bounds`;
    tap(point);
  }
  // The ready text: a modal scenario waits for the dialog's title string; it is never tapped.
  const ready = screen.modal ?? screen.ready;
  const deadline = now() + timeoutMs;
  for (;;) {
    if (findNode(dump(), ready)) break;
    if (now() >= deadline) return `ready text ${typeof ready === "string" ? `"${ready}"` : ready} did not show within ${seconds} s`;
    await sleep(pollMs);
  }
  if (screen.scrollTo) {
    const needle = screen.scrollTo;
    const visible = () => dump().some((node) => node.text.includes(needle) && isVisible(node, view));
    let swipes = 0;
    while (!visible() && swipes < MAX_SWIPES) {
      swipe(swipeUpArgs(view));
      swipes += 1;
      await sleep(pollMs);
    }
    if (!visible()) return `scrollTo "${needle}" did not become visible within ${MAX_SWIPES} swipes`;
  }
  await sleep(screen.modal ? MODAL_SETTLE_WAIT_MS : SETTLE_WAIT_MS);
  return null;
}
