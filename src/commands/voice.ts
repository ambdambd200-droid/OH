import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getConfig } from "../config/index.js";

export type VoiceStatus = "idle" | "listening" | "processing" | "speaking" | "error";

export interface VoiceConfig {
  enabled: boolean;
  wakeWord: string;
  alwaysListening: boolean;
  voiceSpeed: number;
  voiceType: "professional" | "friendly" | "energetic";
  sttProvider: "whisper" | "browser" | "mock";
  ttsProvider: "elevenlabs" | "piper" | "mock";
  noiseCancellation: boolean;
  accentAdaptation: boolean;
  language: string;
}

export interface VoiceCommand {
  text: string;
  confidence: number;
  intent: string;
  parameters: Record<string, string>;
  timestamp: number;
  isWakeWord: boolean;
}

export interface VoiceShortcut {
  phrase: string;
  command: string;
  description: string;
  language: string;
}

export interface VoiceConversation {
  id: string;
  turns: { user: string; oh: string; timestamp: number }[];
  context: Record<string, any>;
  completed: boolean;
}

const defaultConfig: VoiceConfig = {
  enabled: true,
  wakeWord: "Hey OH",
  alwaysListening: false,
  voiceSpeed: 1.0,
  voiceType: "professional",
  sttProvider: "mock",
  ttsProvider: "mock",
  noiseCancellation: false,
  accentAdaptation: false,
  language: "en",
};

export const DEFAULT_SHORTCUTS: VoiceShortcut[] = [
  { phrase: "status", command: "oh status", description: "Check system status", language: "en" },
  { phrase: "حالة النظام", command: "oh status", description: "فحص حالة النظام", language: "ar" },
  { phrase: "deploy my bot", command: "oh deploy", description: "Deploy current agent", language: "en" },
  { phrase: "انشر البوت", command: "oh deploy", description: "نشر الوكيل الحالي", language: "ar" },
  { phrase: "what did I build yesterday", command: "oh memory recall yesterday", description: "Recall recent work", language: "en" },
  { phrase: "شنو سويت أمس", command: "oh memory recall yesterday", description: "استرجاع العمل السابق", language: "ar" },
  { phrase: "create agent", command: "oh create", description: "Start creating an agent", language: "en" },
  { phrase: "أسوي وكيل", command: "oh create", description: "بدء إنشاء وكيل", language: "ar" },
];

let voiceConfig: VoiceConfig = { ...defaultConfig };
let voiceStatus: VoiceStatus = "idle";
let listening = false;
let speaking = false;
let commandCallback: ((cmd: VoiceCommand) => void) | null = null;
const shortcuts: VoiceShortcut[] = [...DEFAULT_SHORTCUTS];
const conversations = new Map<string, VoiceConversation>();

function getStoreDir(): string {
  return join(getConfig().dataDir, "voice");
}

function ensureStoreDir(): void {
  const dir = getStoreDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadConfig(): void {
  const path = join(getStoreDir(), "config.json");
  if (existsSync(path)) {
    try {
      voiceConfig = { ...defaultConfig, ...JSON.parse(readFileSync(path, "utf-8")) };
    } catch {
      voiceConfig = { ...defaultConfig };
    }
  }
}

function saveConfig(): void {
  ensureStoreDir();
  const path = join(getStoreDir(), "config.json");
  writeFileSync(path, JSON.stringify(voiceConfig, null, 2), "utf-8");
}

function saveConversations(): void {
  ensureStoreDir();
  const path = join(getStoreDir(), "conversations.json");
  writeFileSync(path, JSON.stringify(Array.from(conversations.values()), null, 2), "utf-8");
}

function loadConversations(): void {
  const path = join(getStoreDir(), "conversations.json");
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      for (const c of raw) {
        conversations.set(c.id, c);
      }
    } catch {}
  }
}

export function getVoiceConfig(): VoiceConfig {
  loadConfig();
  return { ...voiceConfig };
}

export function setVoiceConfig(config: Partial<VoiceConfig>): void {
  loadConfig();
  voiceConfig = { ...voiceConfig, ...config };
  saveConfig();
}

export function isVoiceSupported(): boolean {
  return true;
}

export function checkWakeWord(text: string): boolean {
  const wake = voiceConfig.wakeWord.toLowerCase();
  return text.toLowerCase().includes(wake);
}

export function setWakeWord(word: string): void {
  loadConfig();
  voiceConfig.wakeWord = word;
  saveConfig();
}

export async function startListening(): Promise<VoiceCommand | null> {
  loadConfig();
  if (!voiceConfig.enabled) return null;
  voiceStatus = "listening";
  listening = true;
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (!listening) {
        clearInterval(check);
        voiceStatus = "idle";
        resolve(null);
      }
    }, 100);
    setTimeout(() => {
      clearInterval(check);
      if (listening) {
        voiceStatus = "idle";
        listening = false;
        resolve(null);
      }
    }, 30000);
  });
}

export function stopListening(): void {
  listening = false;
  voiceStatus = "idle";
}

export function getVoiceStatus(): VoiceStatus {
  return voiceStatus;
}

export function onVoiceCommand(callback: (cmd: VoiceCommand) => void): void {
  commandCallback = callback;
}

export async function speak(text: string, language?: string): Promise<void> {
  speaking = true;
  voiceStatus = "speaking";
  const lang = language || voiceConfig.language;
  const duration = Math.max(500, text.length * 30 / voiceConfig.voiceSpeed);
  await new Promise(resolve => setTimeout(resolve, duration));
  speaking = false;
  voiceStatus = "idle";
}

export function stopSpeaking(): void {
  speaking = false;
  voiceStatus = "idle";
}

export function isSpeaking(): boolean {
  return speaking;
}

export function addShortcut(shortcut: VoiceShortcut): void {
  shortcuts.push(shortcut);
}

export function getShortcuts(language?: string): VoiceShortcut[] {
  if (language) return shortcuts.filter(s => s.language === language);
  return [...shortcuts];
}

export function matchShortcut(text: string): VoiceShortcut | null {
  const normalized = text.toLowerCase().trim();
  for (const s of shortcuts) {
    if (normalized.includes(s.phrase.toLowerCase())) return s;
  }
  return null;
}

export function startVoiceConversation(): VoiceConversation {
  const conv: VoiceConversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    turns: [],
    context: {},
    completed: false,
  };
  conversations.set(conv.id, conv);
  saveConversations();
  return conv;
}

export function addVoiceTurn(convId: string, userText: string, ohResponse: string): void {
  const conv = conversations.get(convId);
  if (!conv) return;
  conv.turns.push({ user: userText, oh: ohResponse, timestamp: Date.now() });
  saveConversations();
}

export function getVoiceConversation(convId: string): VoiceConversation | null {
  loadConversations();
  return conversations.get(convId) || null;
}

export function endVoiceConversation(convId: string): void {
  const conv = conversations.get(convId);
  if (!conv) return;
  conv.completed = true;
  saveConversations();
}

export function interpretVoiceCommand(text: string): VoiceCommand {
  const trimmed = text.trim();
  const hasWake = checkWakeWord(trimmed);
  const cleanText = hasWake
    ? trimmed.replace(new RegExp(voiceConfig.wakeWord, "gi"), "").trim()
    : trimmed;

  const shortcut = matchShortcut(trimmed);
  if (shortcut) {
    const parts = shortcut.command.split(" ");
    return {
      text: cleanText,
      confidence: 0.95,
      intent: parts[1] || shortcut.command,
      parameters: { action: parts[1] || "", full: shortcut.command, target: parts.slice(2).join(" ") },
      timestamp: Date.now(),
      isWakeWord: hasWake,
    };
  }

  const arabicPatterns: [RegExp, string][] = [
    [/انشر|نشر|deploy|publish/gi, "deploy"],
    [/حالة|status/gi, "status"],
    [/أنشئ|إنشاء|create/gi, "create"],
    [/ابحث|بحث|search/gi, "search"],
    [/احذف|حذف|delete|remove/gi, "delete"],
    [/ساعد|مساعدة|help/gi, "help"],
    [/config|إعدادات|ضبط/gi, "config"],
  ];

  for (const [pattern, intent] of arabicPatterns) {
    if (pattern.test(trimmed)) {
      const params: Record<string, string> = {};
      const words = cleanText.replace(pattern, "").trim().split(/\s+/).filter(Boolean);
      if (words.length > 0) params.target = words.join(" ");
      return {
        text: cleanText,
        confidence: 0.8,
        intent,
        parameters: params,
        timestamp: Date.now(),
        isWakeWord: hasWake,
      };
    }
  }

  return {
    text: cleanText,
    confidence: 0.4,
    intent: "unknown",
    parameters: {},
    timestamp: Date.now(),
    isWakeWord: hasWake,
  };
}
