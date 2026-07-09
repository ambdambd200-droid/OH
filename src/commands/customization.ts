import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";
import chalk from "chalk";

export type LayoutDensity = "compact" | "comfortable" | "spacious";
export type AnimationSpeed = "instant" | "fast" | "normal" | "slow";
export type OutputVerbosity = "minimal" | "standard" | "detailed";
export type CodeStyle = "compact" | "readable" | "documented";
export type AutoDeploy = "always" | "ask" | "never";
export type NotificationLevel = "all" | "important" | "critical";

export const AR_UI: Record<string, string> = {
  customization: "التخصيص",
  theme: "السمة",
  themes: "السمات",
  preferences: "التفضيلات",
  preset: "الإعداد المسبق",
  presets: "الإعدادات المسبقة",
  apply: "تطبيق",
  saved: "تم الحفظ",
  deleted: "تم الحذف",
  reset: "إعادة تعيين",
  exportLabel: "تصدير",
  importLabel: "استيراد",
  density: "الكثافة",
  animation: "الحركة",
  language: "اللغة",
  fontSize: "حجم الخط",
  highContrast: "تباين عالي",
  reducedMotion: "حركة مخفضة",
  colorBlindMode: "وضع عمى الألوان",
  fontLigatures: "ربط الحروف",
  codeStyle: "نمط الكود",
  outputVerbosity: "تفاصيل الإخراج",
  autoDeploy: "نشر تلقائي",
  notificationLevel: "مستوى الإشعارات",
  soundEnabled: "الصوت مفعل",
  terminalBackground: "خلفية الطرفية",
  terminalPromptColor: "لون المطالبة",
  showLineNumbers: "إظهار أرقام الأسطر",
  wordWrap: "التفاف النص",
  tabSize: "حجم الجدولة",
  themeApplied: "تم تطبيق السمة بنجاح",
  presetApplied: "تم تطبيق الإعداد المسبق",
  preferencesReset: "تم إعادة تعيين التفضيلات",
  customThemeCreated: "تم إنشاء سمة مخصصة",
  customThemeDeleted: "تم حذف السمة المخصصة",
  invalidJson: "JSON غير صالح",
  preferencesImported: "تم استيراد التفضيلات",
  noSuchTheme: "السمة غير موجودة",
  noSuchPreset: "الإعداد المسبق غير موجود",
};

export interface UserTheme {
  name: string;
  colors: {
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
  };
  fonts: {
    display: string;
    body: string;
    mono: string;
    arabic: string;
    displayWeight: number;
    bodyWeight: number;
    monoWeight: number;
  };
  radii: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    glow: string;
  };
}

export interface UserPreferences {
  theme: string;
  customTheme?: UserTheme;
  density: LayoutDensity;
  animationSpeed: AnimationSpeed;
  soundEnabled: boolean;
  language: string;
  outputVerbosity: OutputVerbosity;
  codeStyle: CodeStyle;
  autoDeploy: AutoDeploy;
  notificationLevel: NotificationLevel;
  fontSize: number;
  fontLigatures: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  dyslexiaFriendly: boolean;
  colorBlindMode: "none" | "deuteranopia" | "protanopia" | "tritanopia";
  terminalBackground: string;
  terminalPromptColor: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  lastModified: Date;
}

const SHARED_FONTS = {
  display: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
  arabic: "'Noto Sans Arabic', sans-serif",
  displayWeight: 600,
  bodyWeight: 400,
  monoWeight: 400,
};

const SHARED_RADII = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  full: "9999px",
};

export const BUILTIN_THEMES: Record<string, UserTheme> = {
  "deep-space": {
    name: "Deep Space",
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
    },
    fonts: { ...SHARED_FONTS },
    radii: { ...SHARED_RADII },
    shadows: {
      sm: "0 2px 8px rgba(0,0,0,0.2)",
      md: "0 4px 16px rgba(0,0,0,0.25)",
      lg: "0 8px 32px rgba(0,0,0,0.3)",
      glow: "0 0 20px rgba(139,92,246,0.3)",
    },
  },
  light: {
    name: "Light",
    colors: {
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
    },
    fonts: { ...SHARED_FONTS },
    radii: { ...SHARED_RADII },
    shadows: {
      sm: "0 2px 8px rgba(0,0,0,0.08)",
      md: "0 4px 16px rgba(0,0,0,0.1)",
      lg: "0 8px 32px rgba(0,0,0,0.12)",
      glow: "0 0 20px rgba(124,58,237,0.2)",
    },
  },
  ocean: {
    name: "Ocean",
    colors: {
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
    },
    fonts: { ...SHARED_FONTS },
    radii: { ...SHARED_RADII },
    shadows: {
      sm: "0 2px 8px rgba(0,0,0,0.2)",
      md: "0 4px 16px rgba(0,0,0,0.25)",
      lg: "0 8px 32px rgba(0,0,0,0.3)",
      glow: "0 0 20px rgba(59,130,246,0.3)",
    },
  },
  sunset: {
    name: "Sunset",
    colors: {
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
    },
    fonts: { ...SHARED_FONTS },
    radii: { ...SHARED_RADII },
    shadows: {
      sm: "0 2px 8px rgba(0,0,0,0.2)",
      md: "0 4px 16px rgba(0,0,0,0.25)",
      lg: "0 8px 32px rgba(0,0,0,0.3)",
      glow: "0 0 20px rgba(249,115,22,0.3)",
    },
  },
  forest: {
    name: "Forest",
    colors: {
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
    },
    fonts: { ...SHARED_FONTS },
    radii: { ...SHARED_RADII },
    shadows: {
      sm: "0 2px 8px rgba(0,0,0,0.2)",
      md: "0 4px 16px rgba(0,0,0,0.25)",
      lg: "0 8px 32px rgba(0,0,0,0.3)",
      glow: "0 0 20px rgba(5,150,105,0.3)",
    },
  },
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "deep-space",
  density: "comfortable",
  animationSpeed: "normal",
  soundEnabled: false,
  language: "en",
  outputVerbosity: "standard",
  codeStyle: "readable",
  autoDeploy: "ask",
  notificationLevel: "important",
  fontSize: 16,
  fontLigatures: true,
  reducedMotion: false,
  highContrast: false,
  dyslexiaFriendly: false,
  colorBlindMode: "none",
  terminalBackground: "#0B1120",
  terminalPromptColor: "#8B5CF6",
  showLineNumbers: true,
  wordWrap: true,
  tabSize: 2,
  lastModified: new Date(),
};

let prefs: UserPreferences = { ...DEFAULT_PREFERENCES, lastModified: new Date(DEFAULT_PREFERENCES.lastModified) };

function getPrefsPath(): string {
  return join(getConfig().dataDir, "user", "preferences.json");
}

function getThemesDir(): string {
  return join(getConfig().dataDir, "user", "themes");
}

function save(): void {
  const path = getPrefsPath();
  ensureDir(join(getConfig().dataDir, "user"));
  writeFileSync(path, JSON.stringify({ ...prefs, lastModified: new Date().toISOString() }, null, 2), "utf-8");
}

function load(): void {
  const path = getPrefsPath();
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);
      prefs = { ...DEFAULT_PREFERENCES, ...parsed, lastModified: new Date(parsed.lastModified || Date.now()) };
    } catch {
      prefs = { ...DEFAULT_PREFERENCES, lastModified: new Date() };
    }
  }
}

// ===== THEME MANAGEMENT =====

export function getAvailableThemes(): UserTheme[] {
  const themes: UserTheme[] = Object.values(BUILTIN_THEMES);
  const dir = getThemesDir();
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const theme = JSON.parse(readFileSync(join(dir, file), "utf-8")) as UserTheme;
        themes.push(theme);
      } catch { }
    }
  }
  return themes;
}

export function getTheme(name: string): UserTheme | undefined {
  const builtin = BUILTIN_THEMES[name];
  if (builtin) return builtin;
  const dir = getThemesDir();
  const path = join(dir, `${name}.json`);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as UserTheme;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function applyTheme(name: string): { cssVars: Record<string, string>; terminalColors: string[] } {
  const theme = getTheme(name);
  if (!theme) {
    throw new Error(`${AR_UI.noSuchTheme}: "${name}"`);
  }
  prefs.theme = name;
  save();
  const cssVars = themeToCssVars(theme);
  const terminalColors = themeToTerminalSequences(theme);
  return { cssVars, terminalColors };
}

export function createCustomTheme(themeName: string, base?: string): UserTheme {
  const source = base ? getTheme(base) : BUILTIN_THEMES["deep-space"];
  const baseColors = source ? source.colors : BUILTIN_THEMES["deep-space"].colors;
  const baseFonts = source ? source.fonts : BUILTIN_THEMES["deep-space"].fonts;
  const baseRadii = source ? source.radii : BUILTIN_THEMES["deep-space"].radii;
  const baseShadows = source ? source.shadows : BUILTIN_THEMES["deep-space"].shadows;
  const theme: UserTheme = {
    name: themeName,
    colors: { ...baseColors },
    fonts: { ...baseFonts },
    radii: { ...baseRadii },
    shadows: { ...baseShadows },
  };
  saveCustomTheme(theme);
  return theme;
}

export function saveCustomTheme(theme: UserTheme): void {
  const dir = getThemesDir();
  ensureDir(dir);
  writeFileSync(join(dir, `${theme.name}.json`), JSON.stringify(theme, null, 2), "utf-8");
  load();
}

export function deleteCustomTheme(name: string): boolean {
  if (BUILTIN_THEMES[name]) return false;
  const dir = getThemesDir();
  const path = join(dir, `${name}.json`);
  if (existsSync(path)) {
    try {
      rmSync(path);
      if (prefs.theme === name) {
        prefs.theme = "deep-space";
        save();
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ===== PREFERENCES =====

export function getPreferences(): UserPreferences {
  load();
  return { ...prefs, lastModified: new Date(prefs.lastModified) };
}

export function setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
  load();
    (prefs as unknown as Record<string, unknown>)[key] = value;
  prefs.lastModified = new Date();
  save();
}

export function resetPreferences(): void {
  prefs = { ...DEFAULT_PREFERENCES, lastModified: new Date() };
  save();
}

export function resetTheme(): void {
  prefs.theme = DEFAULT_PREFERENCES.theme;
  prefs.customTheme = undefined;
  prefs.lastModified = new Date();
  save();
}

export function exportPreferences(): string {
  load();
  return JSON.stringify({ ...prefs, lastModified: prefs.lastModified.toISOString() }, null, 2);
}

export function importPreferences(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return false;
    prefs = { ...DEFAULT_PREFERENCES, ...parsed, lastModified: new Date(parsed.lastModified || Date.now()) };
    save();
    return true;
  } catch {
    return false;
  }
}

// ===== PRESETS =====

export interface Preset {
  name: string;
  description: string;
  preferences: Partial<UserPreferences>;
}

export const PRESETS: Preset[] = [
  { name: "Performance", description: "Minimal UI, instant animations, compact layout", preferences: { density: "compact", animationSpeed: "instant", outputVerbosity: "minimal", reducedMotion: true } },
  { name: "Accessibility", description: "Large text, high contrast, reduced motion", preferences: { fontSize: 20, highContrast: true, reducedMotion: true, density: "spacious" } },
  { name: "Developer", description: "Code-friendly, detailed output, tab size 4", preferences: { codeStyle: "documented", outputVerbosity: "detailed", tabSize: 4, showLineNumbers: true, fontLigatures: true } },
  { name: "Minimal", description: "Clean, quiet, essential only", preferences: { density: "compact", outputVerbosity: "minimal", soundEnabled: false, notificationLevel: "critical", animationSpeed: "instant" } },
];

export function applyPreset(name: string): boolean {
  const preset = PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!preset) return false;
  load();
  for (const [key, value] of Object.entries(preset.preferences)) {
  (prefs as unknown as Record<string, unknown>)[key] = value;
  }
  prefs.lastModified = new Date();
  save();
  return true;
}

// ===== GENERATE CSS =====

function themeToCssVars(theme: UserTheme): Record<string, string> {
  const c = theme.colors;
  const f = theme.fonts;
  const r = theme.radii;
  const s = theme.shadows;
  return {
    "--oh-color-primary": c.primary,
    "--oh-color-primary-light": c.primaryLight,
    "--oh-color-secondary": c.secondary,
    "--oh-color-accent": c.accent,
    "--oh-color-accent-light": c.accentLight,
    "--oh-color-success": c.success,
    "--oh-color-warning": c.warning,
    "--oh-color-error": c.error,
    "--oh-color-text-primary": c.textPrimary,
    "--oh-color-text-secondary": c.textSecondary,
    "--oh-color-text-muted": c.textMuted,
    "--oh-color-surface": c.surface,
    "--oh-color-surface-dark": c.surfaceDark,
    "--oh-color-border": c.border,
    "--oh-font-display": f.display,
    "--oh-font-body": f.body,
    "--oh-font-mono": f.mono,
    "--oh-font-arabic": f.arabic,
    "--oh-font-display-weight": String(f.displayWeight),
    "--oh-font-body-weight": String(f.bodyWeight),
    "--oh-font-mono-weight": String(f.monoWeight),
    "--oh-radius-sm": r.sm,
    "--oh-radius-md": r.md,
    "--oh-radius-lg": r.lg,
    "--oh-radius-xl": r.xl,
    "--oh-radius-full": r.full,
    "--oh-shadow-sm": s.sm,
    "--oh-shadow-md": s.md,
    "--oh-shadow-lg": s.lg,
    "--oh-shadow-glow": s.glow,
  };
}

export function generateCSS(theme?: UserTheme): string {
  const t = theme || getTheme(prefs.theme) || BUILTIN_THEMES["deep-space"];
  const vars = themeToCssVars(t);
  const lines = [":root {"];
  for (const [key, value] of Object.entries(vars)) {
    lines.push(`  ${key}: ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function themeToTerminalSequences(theme: UserTheme): string[] {
  const c = theme.colors;
  const bg = prefs.terminalBackground || c.surfaceDark;
  const fg = c.textPrimary;
  return [
    `\x1b]4;0;rgb:00/00/00\x1b\\`,
    `\x1b]4;1;${c.error}\x1b\\`.replace("#", "rgb:").replace(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/, "$1/$2/$3"),
    `\x1b]4;2;${c.success}\x1b\\`.replace("#", "rgb:").replace(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/, "$1/$2/$3"),
    `\x1b]4;3;${c.warning}\x1b\\`.replace("#", "rgb:").replace(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/, "$1/$2/$3"),
    `\x1b]4;4;${c.primary}\x1b\\`.replace("#", "rgb:").replace(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/, "$1/$2/$3"),
    `\x1b]4;5;${c.accent}\x1b\\`.replace("#", "rgb:").replace(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/, "$1/$2/$3"),
    `\x1b]4;6;${c.accentLight}\x1b\\`.replace("#", "rgb:").replace(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/, "$1/$2/$3"),
    `\x1b]4;7;${fg}\x1b\\`.replace("#", "rgb:").replace(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/, "$1/$2/$3"),
    `\x1b]10;${fg}\x1b\\`,
    `\x1b]11;${bg}\x1b\\`,
    `\x1b]12;${c.primary}\x1b\\`,
  ];
}

export function generateTerminalTheme(theme?: UserTheme): string {
  const t = theme || getTheme(prefs.theme) || BUILTIN_THEMES["deep-space"];
  const seqs = themeToTerminalSequences(t);
  return seqs.join("");
}


