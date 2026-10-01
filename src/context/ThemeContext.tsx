import React, { createContext, useContext, useEffect, useState } from "react";
import { ACCENT_PALETTES, AppTheme, getFullTheme } from "../constants/theme";
import { loadSettings, saveSettings } from "../services/storage";

interface ThemeContextValue {
  theme: AppTheme;
  accentId: string;
  setAccentId: (id: string) => Promise<void>;
  availableAccents: typeof ACCENT_PALETTES;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accentId, setAccentIdState] = useState<string>("crimson");

  useEffect(() => {
    loadSettings().then((s) => {
      if (s.themeAccentId) {
        setAccentIdState(s.themeAccentId);
      }
    });
  }, []);

  const setAccentId = async (newId: string) => {
    setAccentIdState(newId);
    const settings = await loadSettings();
    await saveSettings({ ...settings, themeAccentId: newId });
  };

  const theme = getFullTheme(accentId);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accentId,
        setAccentId,
        availableAccents: ACCENT_PALETTES,
      }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const fallbackTheme = getFullTheme("crimson");
    return {
      theme: fallbackTheme,
      accentId: "crimson",
      setAccentId: async () => {},
      availableAccents: ACCENT_PALETTES,
    };
  }
  return ctx;
}
