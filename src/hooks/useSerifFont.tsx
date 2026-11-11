import React, { createContext, useContext } from "react";
import { useFonts } from "expo-font";
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4/600SemiBold";

/** The bundled Source Serif 4 SemiBold family name, used only for the character's name/class line, step titles and the sheet header. */
export const SERIF_FONT_FAMILY = "SourceSerif4_600";

const SerifFontContext = createContext<string>("serif");

/**
 * Loads the bundled serif at the root layout. Rendering is never gated on it, so first paint is not delayed:
 * until the font is ready the fallback system serif is used.
 */
export function SerifFontProvider({ children }: { children: React.ReactNode }) {
  const [loaded] = useFonts({
    [SERIF_FONT_FAMILY]: SourceSerif4_600SemiBold,
  });
  return <SerifFontContext.Provider value={loaded ? SERIF_FONT_FAMILY : "serif"}>{children}</SerifFontContext.Provider>;
}

/** The font family for the serif voice: the bundled one once loaded, the system serif until then. */
export function useSerifFont(): string {
  return useContext(SerifFontContext);
}
