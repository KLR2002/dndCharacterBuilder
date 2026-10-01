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
    primary: "#dc2626",
    secondary: "#ef4444",
    border: "#991b1b",
    glow: "rgba(220, 38, 38, 0.25)",
    text: "#ffffff",
  },
  gold: {
    id: "gold",
    name: "Arcane Gold",
    primary: "#d97706",
    secondary: "#f59e0b",
    border: "#92400e",
    glow: "rgba(217, 119, 6, 0.25)",
    text: "#ffffff",
  },
  purple: {
    id: "purple",
    name: "Dragon Purple",
    primary: "#9333ea",
    secondary: "#a855f7",
    border: "#6b21a8",
    glow: "rgba(147, 51, 234, 0.25)",
    text: "#ffffff",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Green",
    primary: "#059669",
    secondary: "#10b981",
    border: "#065f46",
    glow: "rgba(5, 150, 105, 0.25)",
    text: "#ffffff",
  },
  blue: {
    id: "blue",
    name: "Sapphire Blue",
    primary: "#2563eb",
    secondary: "#3b82f6",
    border: "#1e40af",
    glow: "rgba(37, 99, 235, 0.25)",
    text: "#ffffff",
  },
  cyan: {
    id: "cyan",
    name: "Astral Cyan",
    primary: "#0891b2",
    secondary: "#06b6d4",
    border: "#155e75",
    glow: "rgba(8, 145, 178, 0.25)",
    text: "#ffffff",
  },
  silver: {
    id: "silver",
    name: "Shadow Silver",
    primary: "#64748b",
    secondary: "#94a3b8",
    border: "#475569",
    glow: "rgba(100, 116, 139, 0.25)",
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
  textMuted: "#64748b",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
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
