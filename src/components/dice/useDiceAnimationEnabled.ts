import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { useCharacters } from "../../context/CharacterContext";
import { resolveDiceAnimationEnabled } from "../../rules/diceAnimation.ts";

/**
 * The system's reduced-motion preference, live: `AccessibilityInfo` on native, `matchMedia` on web
 * (react-native-web's AccessibilityInfo does not report it reliably).
 */
function useSystemReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(() =>
    Platform.OS === "web" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  useEffect(() => {
    if (Platform.OS === "web") {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = () => setReduceMotion(query.matches);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => setReduceMotion(enabled));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
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
