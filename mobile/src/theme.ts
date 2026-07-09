import React, { createContext, useContext } from "react";

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  accentLight: string;
  success: string;
  warning: string;
  error: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  surface: string;
  surfaceDark: string;
  border: string;
  card: string;
  inputBg: string;
  headerBg: string;
  tabBar: string;
  statusBar: "light" | "dark";
}

export interface ThemeFonts {
  display: string;
  body: string;
  mono: string;
  displayWeight: number;
  bodyWeight: number;
  monoWeight: number;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeRadii {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface ThemeShadows {
  sm: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  md: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  lg: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  glow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
  shadows: ThemeShadows;
  isDark: boolean;
}

const SPACING: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const RADII: ThemeRadii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

const FONTS: ThemeFonts = {
  display: "System",
  body: "System",
  mono: "System",
  displayWeight: 600,
  bodyWeight: 400,
  monoWeight: 400,
};

const buildTheme = (name: string, colors: Partial<ThemeColors>, isDark: boolean): Theme => ({
  name,
  colors: {
    primary: "#8B5CF6",
    primaryLight: "#A78BFA",
    secondary: "#0F172A",
    accent: "#06B6D4",
    accentLight: "#67E8F9",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#F43F5E",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    surface: "#1E293B",
    surfaceDark: "#0B1120",
    border: "rgba(255,255,255,0.08)",
    card: "#1E293B",
    inputBg: "#0F172A",
    headerBg: "#0B1120",
    tabBar: "#0F172A",
    statusBar: "light",
    ...colors,
  },
  fonts: FONTS,
  spacing: SPACING,
  radii: RADII,
  shadows: {
    sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
    md: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 5 },
    lg: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 32, elevation: 8 },
    glow: { shadowColor: "#8B5CF6", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 6 },
  },
  isDark,
});

export const themes: Record<string, Theme> = {
  "deep-space": buildTheme("Deep Space", {
    primary: "#8B5CF6",
    primaryLight: "#A78BFA",
    secondary: "#0F172A",
    accent: "#06B6D4",
    accentLight: "#67E8F9",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#F43F5E",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    surface: "#1E293B",
    surfaceDark: "#0B1120",
    border: "rgba(255,255,255,0.08)",
    card: "#1E293B",
    inputBg: "#0F172A",
    headerBg: "#0B1120",
    tabBar: "#0F172A",
    statusBar: "light",
  }, true),
  light: buildTheme("Light", {
    primary: "#7C3AED",
    primaryLight: "#A78BFA",
    secondary: "#F8FAFC",
    accent: "#0891B2",
    accentLight: "#67E8F9",
    success: "#059669",
    warning: "#D97706",
    error: "#DC2626",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    surface: "#FFFFFF",
    surfaceDark: "#F1F5F9",
    border: "rgba(0,0,0,0.08)",
    card: "#FFFFFF",
    inputBg: "#F1F5F9",
    headerBg: "#FFFFFF",
    tabBar: "#FFFFFF",
    statusBar: "dark",
  }, false),
  ocean: buildTheme("Ocean", {
    primary: "#3B82F6",
    primaryLight: "#60A5FA",
    secondary: "#0F172A",
    accent: "#06B6D4",
    accentLight: "#67E8F9",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#F43F5E",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    surface: "#1E3A5F",
    surfaceDark: "#0C2038",
    border: "rgba(59,130,246,0.2)",
    card: "#1E3A5F",
    inputBg: "#0C2038",
    headerBg: "#0C2038",
    tabBar: "#0F172A",
    statusBar: "light",
  }, true),
  sunset: buildTheme("Sunset", {
    primary: "#F97316",
    primaryLight: "#FB923C",
    secondary: "#1C1917",
    accent: "#EC4899",
    accentLight: "#F9A8D4",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#DC2626",
    textPrimary: "#FFEDD5",
    textSecondary: "#FDBA74",
    textMuted: "#92400E",
    surface: "#292524",
    surfaceDark: "#1C1917",
    border: "rgba(249,115,22,0.2)",
    card: "#292524",
    inputBg: "#1C1917",
    headerBg: "#1C1917",
    tabBar: "#1C1917",
    statusBar: "light",
  }, true),
  forest: buildTheme("Forest", {
    primary: "#059669",
    primaryLight: "#34D399",
    secondary: "#0F172A",
    accent: "#10B981",
    accentLight: "#6EE7B7",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#DC2626",
    textPrimary: "#ECFDF5",
    textSecondary: "#A7F3D0",
    textMuted: "#6B7280",
    surface: "#1E293B",
    surfaceDark: "#0B1120",
    border: "rgba(5,150,105,0.2)",
    card: "#1E293B",
    inputBg: "#0B1120",
    headerBg: "#0B1120",
    tabBar: "#0F172A",
    statusBar: "light",
  }, true),
};

interface ThemeContextType {
  theme: Theme;
  themeName: string;
  setTheme: (name: string) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: themes["deep-space"],
  themeName: "deep-space",
  setTheme: () => {},
});

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
