export interface AccentOption {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  border: string;
  glow: string;
  text: string;
}

export const ACCENT_PALETTES: Record<string, AccentOption> = {
  crimson: {
    id: "crimson",
    name: "Crimson Red (Default)",
    primary: "#d91414",
    secondary: "#ff5c5c",
    border: "#ff5c5c",
    glow: "rgba(255, 92, 92, 0.14)",
    text: "#ffffff",
  },
  gold: {
    id: "gold",
    name: "Arcane Gold",
    primary: "#f5b301",
    secondary: "#f5b301",
    border: "#f5b301",
    glow: "rgba(245, 179, 1, 0.14)",
    text: "#231700",
  },
  purple: {
    id: "purple",
    name: "Dragon Purple",
    primary: "#9a3df0",
    secondary: "#bb7bfa",
    border: "#bb7bfa",
    glow: "rgba(187, 123, 250, 0.14)",
    text: "#ffffff",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Green",
    primary: "#0b8051",
    secondary: "#2fd18f",
    border: "#2fd18f",
    glow: "rgba(47, 209, 143, 0.14)",
    text: "#ffffff",
  },
  blue: {
    id: "blue",
    name: "Sapphire Blue",
    primary: "#1f6bf0",
    secondary: "#6aa6ff",
    border: "#6aa6ff",
    glow: "rgba(106, 166, 255, 0.14)",
    text: "#ffffff",
  },
  cyan: {
    id: "cyan",
    name: "Astral Cyan",
    primary: "#06b6d4",
    secondary: "#22c8e6",
    border: "#22c8e6",
    glow: "rgba(34, 200, 230, 0.14)",
    text: "#03222a",
  },
  silver: {
    id: "silver",
    name: "Shadow Silver",
    primary: "#5a7391",
    secondary: "#a3b6cc",
    border: "#a3b6cc",
    glow: "rgba(163, 182, 204, 0.14)",
    text: "#ffffff",
  },
};

export const BASE_DARK_THEME = {
  background: "#0a0a0c",
  surface: "#121216",
  surfaceRaised: "#1b1b22",
  surfaceHighlight: "#24242f",
  border: "#2a2a38",
  borderLight: "#38384a",
  text: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#8b97a8",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#f87171",
  info: "#38bdf8",
  hpGreen: "#10b981",
  tempHpYellow: "#f59e0b",
  cardRadius: 10,
  btnRadius: 8,
  badgeRadius: 6,
};

export function getFullTheme(accentId: string = "crimson") {
  const accent = ACCENT_PALETTES[accentId] || ACCENT_PALETTES.crimson;
  return {
    ...BASE_DARK_THEME,
    accent: accent.primary,
    accentHover: accent.secondary,
    accentBorder: accent.border,
    accentGlow: accent.glow,
    accentText: accent.text,
    accentId: accent.id,
  };
}

export type AppTheme = ReturnType<typeof getFullTheme>;
