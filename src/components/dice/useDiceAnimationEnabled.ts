import { useEffect, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { useCharacters } from "../../context/CharacterContext";
import { resolveDiceAnimationEnabled } from "../../rules/diceAnimation.ts";

// The reduced-motion media query, subscribed the React way: the snapshot functions guard `window`,
// so a statically exported page can prerender (no `window`) and hydrate without a mismatch, and the
// query is never read during a render that has no `window`.
function subscribeReduceMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReduceMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The system's reduced-motion preference, live: `AccessibilityInfo` on native, `matchMedia` on web
 * (react-native-web's AccessibilityInfo does not report it reliably).
 */
function useSystemReduceMotion(): boolean {
  const [nativeReduceMotion, setNativeReduceMotion] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setNativeReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => setNativeReduceMotion(enabled));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  const webReduceMotion = useSyncExternalStore(subscribeReduceMotion, getReduceMotionSnapshot, () => false);
  return Platform.OS === "web" ? webReduceMotion : nativeReduceMotion;
}

/**
 * Whether the 2.5D dice animation runs: the saved 3D dice setting when there is one, otherwise on
 * unless the system asks for reduced motion. The renderer is loaded only while this is true.
 */
export function useDiceAnimationEnabled(): boolean {
  const { dice3dEnabled } = useCharacters();
  const reduceMotion = useSystemReduceMotion();
  return resolveDiceAnimationEnabled(dice3dEnabled, reduceMotion);
}
