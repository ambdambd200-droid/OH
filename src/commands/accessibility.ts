import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getConfig } from "../config/index.js";

export type AccessibilityMode = "standard" | "high-contrast" | "dyslexia-friendly" | "color-blind";
export type ColorBlindType = "none" | "deuteranopia" | "protanopia" | "tritanopia";
export type MotionPreference = "no-preference" | "reduce" | "none";

export interface AccessibilitySettings {
  mode: AccessibilityMode;
  colorBlindType: ColorBlindType;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
  keyboardNav: boolean;
  focusIndicatorSize: "small" | "medium" | "large";
  focusIndicatorColor: string;
  showFocusRing: boolean;
  ariaLabels: boolean;
  skipLinks: boolean;
  announcementMode: "polite" | "assertive" | "off";
  dyslexiaFriendly: boolean;
  plainLanguage: boolean;
  stepByStepMode: boolean;
  extendedTimeouts: boolean;
  confirmDestructive: boolean;
}

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  mode: "standard",
  colorBlindType: "none",
  fontSize: 16,
  fontFamily: "'Inter', sans-serif",
  lineHeight: 1.5,
  letterSpacing: 0,
  reducedMotion: false,
  highContrast: false,
  screenReader: true,
  keyboardNav: true,
  focusIndicatorSize: "medium",
  focusIndicatorColor: "#8B5CF6",
  showFocusRing: true,
  ariaLabels: true,
  skipLinks: true,
  announcementMode: "polite",
  dyslexiaFriendly: false,
  plainLanguage: false,
  stepByStepMode: false,
  extendedTimeouts: false,
  confirmDestructive: true,
};

let settings: AccessibilitySettings = { ...DEFAULT_ACCESSIBILITY };

function getDataDir(): string {
  const config = getConfig();
  const dir = join(config.dataDir, "accessibility");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function save(): void {
  try {
    const dir = getDataDir();
    writeFileSync(join(dir, "settings.json"), JSON.stringify(settings, null, 2), "utf-8");
  } catch {
    // Silently fail — settings are not critical for operation
  }
}

function load(): void {
  try {
    const dir = getDataDir();
    const path = join(dir, "settings.json");
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      settings = { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(raw) };
    }
  } catch {
    settings = { ...DEFAULT_ACCESSIBILITY };
  }
}

// ===== SETTINGS MANAGEMENT =====

export function getAccessibilitySettings(): AccessibilitySettings {
  load();
  return { ...settings };
}

export function setAccessibilitySetting<K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]): void {
  load();
  settings[key] = value;
  save();
}

export function resetAccessibilitySettings(): void {
  settings = { ...DEFAULT_ACCESSIBILITY };
  save();
}

export function applyPreset(mode: AccessibilityMode): void {
  load();
  switch (mode) {
    case "high-contrast":
      applyHighContrastPreset();
      break;
    case "dyslexia-friendly":
      applyDyslexiaFriendlyPreset();
      break;
    case "color-blind":
      applyColorBlindPreset(settings.colorBlindType);
      break;
    case "standard":
    default:
      settings = { ...DEFAULT_ACCESSIBILITY };
      break;
  }
  settings.mode = mode;
  save();
}

// ===== HIGH CONTRAST =====

export function getHighContrastColors(): Record<string, string> {
  return {
    background: "#000000",
    foreground: "#FFFFFF",
    primary: "#FFFF00",
    secondary: "#00FFFF",
    accent: "#FF00FF",
    success: "#00FF00",
    warning: "#FFA500",
    error: "#FF4444",
    info: "#87CEEB",
    link: "#88DDFF",
    border: "#FFFFFF",
    disabled: "#888888",
    focus: "#FFFF00",
    selected: "#FFFFFF",
    visitedLink: "#FFB6C1",
    code: "#00FF00",
    muted: "#CCCCCC",
    overlay: "rgba(0, 0, 0, 0.85)",
    highlight: "#000000",
    highlightText: "#FFFF00",
  };
}

export function generateHighContrastCSS(): string {
  const c = getHighContrastColors();
  return [
    `* { background-color: ${c.background} !important; color: ${c.foreground} !important; border-color: ${c.border} !important; }`,
    `a, a:link { color: ${c.link} !important; text-decoration: underline !important; }`,
    `a:visited { color: ${c.visitedLink} !important; }`,
    `a:hover, a:focus { color: ${c.primary} !important; }`,
    `button, input, select, textarea { border: 2px solid ${c.border} !important; }`,
    `button:focus, input:focus, select:focus, textarea:focus { outline: 3px solid ${c.focus} !important; outline-offset: 2px; }`,
    `::selection { background: ${c.highlight} !important; color: ${c.highlightText} !important; }`,
    `.error, [role="alert"] { color: ${c.error} !important; border-left: 4px solid ${c.error} !important; }`,
    `.success { color: ${c.success} !important; }`,
    `.warning { color: ${c.warning} !important; }`,
    `[aria-disabled="true"], .disabled { color: ${c.disabled} !important; }`,
    `code, pre { color: ${c.code} !important; }`,
    `img { filter: contrast(1.5) brightness(1.2) !important; }`,
    `hr { border-top: 2px solid ${c.border} !important; }`,
    `table, th, td { border: 2px solid ${c.border} !important; }`,
    `th { background: ${c.foreground} !important; color: ${c.background} !important; }`,
  ].join("\n");
}

// ===== COLOR BLIND =====

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, "0")).join("");
}

export function simulateColorBlindness(type: ColorBlindType, hexColor: string): string {
  if (type === "none") return hexColor;
  const { r, g, b } = hexToRgb(hexColor);

  let nr = r, ng = g, nb = b;

  switch (type) {
    case "protanopia":
      nr = 0.567 * r + 0.433 * g;
      ng = 0.558 * r + 0.442 * g;
      nb = b;
      break;
    case "deuteranopia":
      nr = 0.625 * r + 0.375 * g;
      ng = 0.7 * r + 0.3 * g;
      nb = b;
      break;
    case "tritanopia":
      nr = r;
      ng = 0.95 * g + 0.05 * b;
      nb = 0.05 * g + 0.95 * b;
      break;
  }

  return rgbToHex(nr, ng, nb);
}

export function getColorBlindPalette(type: ColorBlindType): Record<string, string> {
  const base: Record<string, string> = {
    background: "#FFFFFF",
    foreground: "#000000",
    primary: "#0077BB",
    secondary: "#EE7733",
    accent: "#009988",
    success: "#33BB33",
    warning: "#CCBB44",
    error: "#BB3333",
    info: "#66CCEE",
    link: "#2255AA",
    border: "#555555",
  };

  if (type === "none") return base;

  const result: Record<string, string> = {};
  for (const [key, color] of Object.entries(base)) {
    result[key] = simulateColorBlindness(type, color);
  }
  return result;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(rs) + 0.7152 * linearize(gs) + 0.0722 * linearize(bs);
}

function parseColor(color: string): { r: number; g: number; b: number } {
  const c = color.trim();
  if (c.startsWith("#")) return hexToRgb(c);
  if (c.startsWith("rgb")) {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  }
  const named: Record<string, string> = {
    black: "#000000", white: "#FFFFFF", red: "#FF0000", green: "#008000",
    blue: "#0000FF", yellow: "#FFFF00", orange: "#FFA500", purple: "#800080",
    gray: "#808080", grey: "#808080", navy: "#000080", teal: "#008080",
    maroon: "#800000", lime: "#00FF00", aqua: "#00FFFF", fuchsia: "#FF00FF",
    silver: "#C0C0C0",
  };
  const lower = c.toLowerCase();
  if (named[lower]) return hexToRgb(named[lower]);
  return { r: 0, g: 0, b: 0 };
}

export function checkColorContrast(foreground: string, background: string): { ratio: number; passesAA: boolean; passesAAA: boolean } {
  try {
    const fg = parseColor(foreground);
    const bg = parseColor(background);
    const l1 = relativeLuminance(fg.r, fg.g, fg.b);
    const l2 = relativeLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    return {
      ratio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7.0,
    };
  } catch {
    return { ratio: 0, passesAA: false, passesAAA: false };
  }
}

export function suggestContrastFix(foreground: string, background: string): { suggestedFG: string; suggestedBG: string } {
  try {
    const fg = parseColor(foreground);
    const bg = parseColor(background);
    const l1 = relativeLuminance(fg.r, fg.g, fg.b);
    const l2 = relativeLuminance(bg.r, bg.g, bg.b);

    if (l1 > l2) {
      if ((l1 + 0.05) / (l2 + 0.05) >= 7) {
        return { suggestedFG: foreground, suggestedBG: background };
      }
      const newBgR = Math.max(0, bg.r - 40);
      const newBgG = Math.max(0, bg.g - 40);
      const newBgB = Math.max(0, bg.b - 40);
      return { suggestedFG: foreground, suggestedBG: rgbToHex(newBgR, newBgG, newBgB) };
    } else {
      if ((l2 + 0.05) / (l1 + 0.05) >= 7) {
        return { suggestedFG: foreground, suggestedBG: background };
      }
      const newFgR = Math.min(255, fg.r + 40);
      const newFgG = Math.min(255, fg.g + 40);
      const newFgB = Math.min(255, fg.b + 40);
      return { suggestedFG: rgbToHex(newFgR, newFgG, newFgB), suggestedBG: background };
    }
  } catch {
    return { suggestedFG: foreground, suggestedBG: background };
  }
}

// ===== SCREEN READER =====

export function generateARIALabel(element: string, purpose: string, state?: string): string {
  let label = `${element}: ${purpose}`;
  if (state) label += ` (${state})`;
  return label;
}

export function getLiveRegionConfig(type: "status" | "alert" | "log" | "timer"): { role: string; ariaLive: string; ariaAtomic: boolean; ariaRelevant: string } {
  switch (type) {
    case "status":
      return { role: "status", ariaLive: "polite", ariaAtomic: true, ariaRelevant: "additions text" };
    case "alert":
      return { role: "alert", ariaLive: "assertive", ariaAtomic: true, ariaRelevant: "additions" };
    case "log":
      return { role: "log", ariaLive: "polite", ariaAtomic: false, ariaRelevant: "additions" };
    case "timer":
      return { role: "timer", ariaLive: "polite", ariaAtomic: true, ariaRelevant: "text" };
  }
}

export function announceToScreenReader(message: string, mode: "polite" | "assertive" = "polite"): void {
  if (!settings.screenReader || settings.announcementMode === "off") return;
  const config = getLiveRegionConfig(mode === "assertive" ? "alert" : "status");
  const announcerId = "oh-announcer";
  let el = document?.getElementById(announcerId);
  if (!el) {
    el = document?.createElement("div");
    if (el) {
      el.id = announcerId;
      el.setAttribute("role", config.role);
      el.setAttribute("aria-live", config.ariaLive);
      el.setAttribute("aria-atomic", String(config.ariaAtomic));
      el.setAttribute("aria-relevant", config.ariaRelevant);
      el.style.position = "absolute";
      el.style.width = "1px";
      el.style.height = "1px";
      el.style.overflow = "hidden";
      el.style.clip = "rect(0, 0, 0, 0)";
      el.style.whiteSpace = "nowrap";
      el.style.border = "0";
      document?.body?.appendChild(el);
    }
  }
  if (el) {
    el.textContent = "";
    setTimeout(() => {
      if (el) el.textContent = message;
    }, 50);
  }
}

// ===== KEYBOARD NAVIGATION =====

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
  category: string;
}

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { key: "k", ctrl: true, action: "command-palette", description: "Quick action palette", category: "general" },
  { key: "/", ctrl: true, action: "show-shortcuts", description: "Show all shortcuts", category: "general" },
  { key: "n", ctrl: true, action: "new-agent", description: "New agent", category: "agents" },
  { key: "d", ctrl: true, action: "deploy", description: "Deploy", category: "agents" },
  { key: "m", ctrl: true, action: "memory-search", description: "Memory search", category: "memory" },
  { key: "t", ctrl: true, action: "terminal-focus", description: "Terminal focus", category: "terminal" },
  { key: "Escape", action: "close-modal", description: "Close modal / Cancel", category: "general" },
  { key: "Enter", action: "activate", description: "Activate focused element", category: "general" },
  { key: " ", action: "activate", description: "Activate focused element", category: "general" },
  { key: "ArrowUp", action: "navigate-up", description: "Navigate up", category: "navigation" },
  { key: "ArrowDown", action: "navigate-down", description: "Navigate down", category: "navigation" },
  { key: "ArrowLeft", action: "navigate-left", description: "Navigate left", category: "navigation" },
  { key: "ArrowRight", action: "navigate-right", description: "Navigate right", category: "navigation" },
  { key: "Tab", action: "next-element", description: "Next focusable element", category: "navigation" },
  { key: "Tab", shift: true, action: "prev-element", description: "Previous focusable element", category: "navigation" },
];

let shortcuts: KeyboardShortcut[] = [...DEFAULT_SHORTCUTS];

export function getKeyboardShortcuts(category?: string): KeyboardShortcut[] {
  if (category) return shortcuts.filter(s => s.category === category);
  return [...shortcuts];
}

export function registerShortcut(shortcut: KeyboardShortcut): void {
  shortcuts.push(shortcut);
}

export function matchShortcut(event: { key: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }): KeyboardShortcut | null {
  return shortcuts.find(s => {
    if (s.key.toLowerCase() !== event.key.toLowerCase()) return false;
    if (s.ctrl && !event.ctrlKey) return false;
    if (s.shift && !event.shiftKey) return false;
    if (s.alt && !event.altKey) return false;
    if (s.meta && !event.metaKey) return false;
    return true;
  }) || null;
}

export function getShortcutDescriptions(): string {
  const categorized: Record<string, string[]> = {};
  for (const s of shortcuts) {
    if (!categorized[s.category]) categorized[s.category] = [];
    const mods = [];
    if (s.ctrl) mods.push("Ctrl");
    if (s.alt) mods.push("Alt");
    if (s.shift) mods.push("Shift");
    if (s.meta) mods.push("Meta");
    const keyLabel = s.key === " " ? "Space" : s.key;
    const combo = [...mods, keyLabel].join("+");
    categorized[s.category].push(`  ${combo.padEnd(20)} ${s.description}`);
  }
  const lines: string[] = [];
  for (const [cat, entries] of Object.entries(categorized)) {
    lines.push(`\n${cat.toUpperCase()}:`);
    lines.push(...entries);
  }
  return lines.join("\n").trim();
}

// ===== FOCUS MANAGEMENT =====

export function getFocusRingStyle(size: "small" | "medium" | "large", color: string): string {
  const widths = { small: "2px", medium: "3px", large: "4px" };
  const offsets = { small: "1px", medium: "2px", large: "3px" };
  return `outline: ${widths[size]} solid ${color}; outline-offset: ${offsets[size]};`;
}

export function isTabIndexValid(index: number): boolean {
  return Number.isInteger(index) && index >= -1 && index <= 32767;
}

export function getLogicalTabOrder(elements: string[]): string[] {
  const readingOrder = [...elements];
  readingOrder.sort((a, b) => {
    const getPos = (s: string) => {
      const m = s.match(/:(\d+)/);
      return m ? parseInt(m[1]) : 0;
    };
    return getPos(a) - getPos(b);
  });
  return readingOrder;
}

// ===== COGNITIVE ACCESSIBILITY =====

const SIMPLE_WORDS: Record<string, string> = {
  utilize: "use",
  terminate: "end",
  commence: "start",
  initiate: "start",
  implement: "use",
  configure: "set up",
  navigate: "move",
  authenticate: "log in",
  authorize: "allow",
  allocate: "assign",
  aggregate: "combine",
  facilitate: "help",
  prioritize: "rank",
  subsequent: "next",
  previous: "prior",
  sufficient: "enough",
  approximately: "about",
  demonstrate: "show",
  communicate: "tell",
  obtain: "get",
  acquire: "get",
  additional: "more",
  alternative: "other",
  collaborate: "work together",
  consolidate: "merge",
  deactivate: "turn off",
  deploy: "launch",
  designate: "name",
  encounter: "find",
  establish: "set up",
  evaluate: "check",
  identify: "find",
  indicate: "show",
  perceive: "see",
  proficient: "skilled",
  redundant: "extra",
  regarding: "about",
  replicate: "copy",
  resolve: "resolve",
  retain: "keep",
  select: "choose",
  specify: "name",
  transition: "move",
  verify: "check",
  considerably: "very",
  frequently: "often",
  generally: "mostly",
  occasionally: "sometimes",
  predominantly: "mostly",
  previously: "before",
  subsequently: "after",
};

function replaceHardWords(text: string): string {
  let result = text;
  for (const [hard, simple] of Object.entries(SIMPLE_WORDS)) {
    const re = new RegExp(`\\b${hard}\\b`, "gi");
    result = result.replace(re, simple);
  }
  return result;
}

function splitLongSentences(text: string): string {
  return text.replace(/([.,;])\s+/g, ".\n");
}

function simplifyForGrade(text: string, level: "simple" | "simpler" | "simplest"): string {
  let result = replaceHardWords(text);
  result = result.replace(/\.\.\./g, ". ");
  if (level !== "simple") {
    result = result.replace(/which is /gi, "");
    result = result.replace(/that are /gi, "");
    result = result.replace(/in order to /gi, "to ");
    result = result.replace(/with the exception of /gi, "except ");
  }
  if (level === "simplest") {
    result = result.replace(/([.!?])\s*/g, "$1\n");
    result = result.replace(/,\s*/g, ". ");
    result = result.replace(/\b(very|really|quite|extremely|absolutely)\b/gi, "");
    result = result.replace(/\s{2,}/g, " ");
  }
  return result;
}

export function simplifyText(text: string, level: "simple" | "simpler" | "simplest"): string {
  try {
    return simplifyForGrade(text, level).trim();
  } catch {
    return text;
  }
}

export function breakIntoSteps(content: string): string[] {
  const steps: string[] = [];
  const lines = content.split(/\n+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const numbered = trimmed.replace(/^\d+[.)\s]+/, "");
    steps.push(numbered);
  }
  return steps;
}

export function addConfirmations(content: string, destructive: boolean): string {
  if (destructive) {
    return `${content}\n\n⚠️ Are you sure you want to continue? This action cannot be undone. Type "yes" to confirm or "no" to cancel.`;
  }
  return `${content}\n\nWould you like to continue? Type "yes" to proceed or "no" to cancel.`;
}

export function getExtendedTimeout(operation: string): number {
  const baseTimeouts: Record<string, number> = {
    "api-call": 30000,
    "file-operation": 10000,
    "build": 120000,
    "deploy": 300000,
    "search": 15000,
    "default": 10000,
  };
  const base = baseTimeouts[operation] || baseTimeouts["default"];
  if (settings.extendedTimeouts) return base * 2.5;
  return base;
}

// ===== MOTION & ANIMATION =====

export function getReducedMotionCSS(): string {
  return [
    `* { animation-duration: 0s !important; animation-delay: 0s !important; }`,
    `* { transition-duration: 0s !important; transition-delay: 0s !important; }`,
    `* { scroll-behavior: auto !important; }`,
    `*::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
  ].join("\n");
}

export function isAnimationSafe(duration: number): boolean {
  if (settings.reducedMotion) return duration === 0;
  return duration >= 0;
}

export function getSafeTransition(duration: number): string {
  return settings.reducedMotion ? "0s" : `${duration}ms`;
}

// ===== VALIDATION =====

export function validateAccessibility(css: string, html?: string): { errors: string[]; warnings: string[]; score: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  if (html) {
    const hasAlt = /alt\s*=/gi.test(html);
    if (!hasAlt) { warnings.push("No alt attributes found on images"); score -= 10; }

    const hasAria = /aria-/gi.test(html);
    if (!hasAria) { warnings.push("No ARIA attributes found"); score -= 10; }

    const hasRole = /role\s*=/gi.test(html);
    if (!hasRole) { warnings.push("No ARIA roles found"); score -= 5; }

    const hasSkipLink = /skip[- ]?to[- ]?content|skip[- ]?nav/i.test(html);
    if (!hasSkipLink) { warnings.push("No skip-to-content link found"); score -= 5; }

    const hasLabel = /(aria-label|aria-labelledby|for\s*=)/gi.test(html);
    if (!hasLabel) { warnings.push("No form labels found"); score -= 10; }

    const headings = html.match(/<h[1-6][^>]*>/gi);
    if (headings) {
      const levels = headings.map(h => parseInt(h.match(/<h([1-6])/)?.[1] || "0"));
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) {
          errors.push(`Heading level skipped from h${levels[i-1]} to h${levels[i]}`);
          score -= 10;
        }
      }
    } else {
      warnings.push("No heading elements found"); score -= 5;
    }
  }

  const hasFocusOutline = /outline\s*[:=]/i.test(css) || /:focus\s*\{/i.test(css);
  if (!hasFocusOutline) { errors.push("No focus outline styles defined"); score -= 15; }

  score = Math.max(0, Math.min(100, score + 50));

  return { errors, warnings, score };
}

export function auditPage(title: string, elements: { tag: string; attributes: Record<string, string>; text: string }[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  const total = elements.length;
  if (total === 0) return { score: 0, issues: ["No elements to audit"] };

  let labeled = 0;
  let focusable = 0;
  let hasContrastIssue = 0;

  for (const el of elements) {
    const attrs = Object.keys(el.attributes);
    const hasLabel = attrs.some(a => /^aria-/.test(a)) || attrs.includes("label") || attrs.includes("alt");
    if (hasLabel) labeled++;
    if (attrs.includes("tabindex") || /^(button|a|input|select|textarea)$/i.test(el.tag)) focusable++;
  }

  const labeledPct = labeled / total;
  if (labeledPct < 0.5) { issues.push(`Only ${labeled}/${total} elements have accessible labels`); score -= 20; }
  else if (labeledPct < 0.9) { issues.push(`Only ${labeled}/${total} elements have accessible labels`); score -= 10; }

  if (focusable === 0) { issues.push("No focusable interactive elements found"); score -= 15; }

  title = title || "Untitled";
  if (!title.trim()) { issues.push("Page has no title"); score -= 10; }

  score = Math.max(0, score);
  return { score, issues };
}

// ===== PRESETS =====

export function applyHighContrastPreset(): void {
  settings.highContrast = true;
  settings.mode = "high-contrast";
  settings.focusIndicatorColor = "#FFFF00";
  settings.focusIndicatorSize = "large";
  settings.showFocusRing = true;
  settings.reducedMotion = false;
  settings.fontSize = 18;
  settings.lineHeight = 1.8;
  settings.announcementMode = "polite";
}

export function applyDyslexiaFriendlyPreset(): void {
  settings.dyslexiaFriendly = true;
  settings.mode = "dyslexia-friendly";
  settings.fontFamily = "'Open Dyslexic', 'Lexend', sans-serif";
  settings.fontSize = 18;
  settings.lineHeight = 1.8;
  settings.letterSpacing = 0.35;
  settings.highContrast = true;
  settings.plainLanguage = true;
  settings.stepByStepMode = true;
  settings.extendedTimeouts = true;
  settings.focusIndicatorSize = "large";
  settings.announcementMode = "polite";
}

export function applyColorBlindPreset(type: ColorBlindType): void {
  settings.colorBlindType = type || "deuteranopia";
  settings.mode = "color-blind";
  settings.highContrast = true;
  settings.focusIndicatorColor = "#FFFF00";
  settings.focusIndicatorSize = "large";
  settings.showFocusRing = true;
}

export function applyScreenReaderPreset(): void {
  settings.screenReader = true;
  settings.ariaLabels = true;
  settings.showFocusRing = true;
  settings.focusIndicatorSize = "large";
  settings.skipLinks = true;
  settings.announcementMode = "assertive";
  settings.extendedTimeouts = true;
}

export function applyKeyboardOnlyPreset(): void {
  settings.keyboardNav = true;
  settings.showFocusRing = true;
  settings.focusIndicatorSize = "large";
  settings.focusIndicatorColor = "#FF6600";
  settings.screenReader = false;
  settings.reducedMotion = true;
  settings.skipLinks = true;
  settings.announcementMode = "off";
}

export function applyCognitivePreset(): void {
  settings.plainLanguage = true;
  settings.stepByStepMode = true;
  settings.extendedTimeouts = true;
  settings.confirmDestructive = true;
  settings.fontSize = 18;
  settings.lineHeight = 1.8;
  settings.dyslexiaFriendly = true;
  settings.reducedMotion = true;
  settings.announcementMode = "polite";
}

// ===== ADAPTATIONS =====

export function getArabicAdaptations(): { font: string; lineHeight: number; letterSpacing: number; direction: "rtl"; textAlign: "right" } {
  return {
    font: "'Noto Naskh Arabic', 'Amiri', serif",
    lineHeight: 1.8,
    letterSpacing: 0,
    direction: "rtl",
    textAlign: "right",
  };
}

export function getFontSizeScale(base: number): Record<string, number> {
  const scale: Record<string, number> = {};
  const sizes = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"];
  const ratios = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 2];
  for (let i = 0; i < sizes.length; i++) {
    scale[sizes[i]] = Math.round(base * ratios[i]);
  }
  return scale;
}