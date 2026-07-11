export interface DDACommand {
  action: "run" | "search" | "model" | "delete" | "list" | "create" | "help" | "templates" | "config" | "unknown";
  target?: string;
  raw: string;
  confidence: number;
}

const DDA_PATTERNS: { regex: RegExp; action: DDACommand["action"]; priority: number }[] = [
  // "شغل دا" / "شغل ده" / "شغّل دا" → run this
  { regex: /(?:شغل|شغّل|فعل|نفذ|run)\s*(?:دا|ده|دي|كدا)\s*(.*)/i, action: "run", priority: 10 },
  // "ابحث في دا" / "دور في دا" / "فتش على دا" → search this
  { regex: /(?:ابحث|دور|فتش|search|find)\s*(?:في|على|عن)?\s*(?:دا|ده|دي|كدا)\s*(.*)/i, action: "search", priority: 10 },
  // "شغل ده موديل" / "غير دا موديل" / "بدّل ده موديل" → switch model
  { regex: /(?:شغل|غير|بدّل|حول|حوّل|غير|switch)\s*(?:دا|ده|دي)?\s*(?:موديل|model)\s*(.*)/i, action: "model", priority: 10 },
  // "احذف دا" / "امسح دا" / "delete دا" → delete
  { regex: /(?:احذف|امسح|شيل|delete|remove)\s*(?:دا|ده|دي)\s*(.*)/i, action: "delete", priority: 10 },
  // "اعرض دا" / "وريني دا" / "list دا" → list
  { regex: /(?:اعرض|وريني|ظهر|list|show)\s*(?:دا|ده|دي)\s*(.*)/i, action: "list", priority: 9 },
  // "أسوي دا" / "اعمل دا" / "create دا" → create
  { regex: /(?:اسوي|أسوي|اعمل|أنشئ|create|make)\s*(?:دا|ده|دي)\s*(.*)/i, action: "create", priority: 9 },
  // "ساعدني في دا" / "help دا" → help
  { regex: /(?:ساعد|ساعدني|اعمل)\s*(?:في)?\s*(?:دا|ده|دي)\s*(.*)/i, action: "help", priority: 8 },
  // "عرض القوالب" / "وريني القوالب" → templates
  { regex: /(?:عرض|وريني|أظهر|templates)\s*(?:القوالب|templates)?\s*(?:دا|ده|دي)?/i, action: "templates", priority: 8 },
  // "تغيير الإعدادات" / "config" → config
  { regex: /(?:تغيير|غير|ظبط|ضبط|config|اعدادات|إعدادات)\s*(?:دا|ده|دي)?\s*(.*)/i, action: "config", priority: 7 },
];

// These match individual boundary characters (not positions), so NO ^ or $ anchors
const WORD_BOUNDARY = /[\s\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,\-.\/:;<=>?@[\]^_`{|}~]/;
const NON_WORD = /[\s\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,\-.\/:;<=>?@[\]^_`{|}~]/;

function isStandaloneWord(text: string, word: string): boolean {
  let idx = 0;
  while (true) {
    idx = text.indexOf(word, idx);
    if (idx === -1) return false;
    const beforeOk = idx === 0 ? true : WORD_BOUNDARY.test(text[idx - 1]);
    const afterOk = idx + word.length >= text.length ? true : NON_WORD.test(text[idx + word.length]);
    if (beforeOk && afterOk) return true;
    idx++;
  }
}

const DDA_DEMONSTRATIVES_LIST = ["دا", "ده", "دي", "دول", "كدا"];

export function isDDACommand(text: string): boolean {
  for (const d of DDA_DEMONSTRATIVES_LIST) {
    if (isStandaloneWord(text, d)) return true;
  }
  const cmdWords = ["شغل", "ابحث", "احذف", "اعرض", "وريني", "run", "search", "delete", "list", "show"];
  for (const w of cmdWords) {
    if (isStandaloneWord(text.toLowerCase(), w)) return true;
  }
  return false;
}

export function parseDDACommand(text: string): DDACommand {
  const clean = text.trim();

  for (const { regex, action, priority } of DDA_PATTERNS) {
    const match = clean.match(regex);
    if (match) {
      const target = match[1]?.trim() || undefined;
      return {
        action,
        target: target || extractDDATarget(clean, action),
        raw: clean,
        confidence: 0.7 + (priority / 20),
      };
    }
  }

  return {
    action: "unknown",
    raw: clean,
    confidence: 0.2,
  };
}

function extractDDATarget(text: string, action: DDACommand["action"]): string | undefined {
  const words = text.split(/\s+/);
  const actionWords: Record<string, string[]> = {
    run: ["شغل", "شغّل", "فعل", "نفذ", "run"],
    search: ["ابحث", "دور", "فتش", "search", "find"],
    model: ["شغل", "غير", "بدّل", "موديل", "model", "switch"],
    delete: ["احذف", "امسح", "شيل", "delete", "remove"],
    list: ["اعرض", "وريني", "ظهر", "list", "show"],
    create: ["اسوي", "أسوي", "اعمل", "أنشئ", "create", "make"],
  };

  const actionKeys = actionWords[action] || [];
  for (let i = 0; i < words.length; i++) {
    if (actionKeys.includes(words[i].toLowerCase())) {
      const rest = words.slice(i + 1).filter(w => !DDA_DEMONSTRATIVES_LIST.some(d => w.includes(d))).join(" ");
      if (rest) return rest;
    }
  }
  return undefined;
}

export function formatDDACommand(cmd: DDACommand): string {
  const actionMap: Record<string, string> = {
    run: "تشغيل",
    search: "بحث",
    model: "تبديل موديل",
    delete: "حذف",
    list: "عرض",
    create: "إنشاء",
    help: "مساعدة",
    templates: "قوالب",
    config: "إعدادات",
  };

  const actionAr = actionMap[cmd.action] || cmd.action;
  const target = cmd.target ? ` "${cmd.target}"` : "";
  return `${actionAr}${target}`;
}

export const DDA_HELP_TEXT_AR = `📋 أوامر اللهجة المصرية (ده/دا/دي):

  • شغل دا [اسم]          — تشغيل وكيل
  • ابحث في دا [كلمة]       — بحث في الذاكرة  
  • شغل ده موديل [اسم]      — تبديل الموديل
  • احذف دا [اسم]           — حذف وكيل
  • اعرض دا                 — عرض قائمة
  • أسوي دا [اسم]           — إنشاء وكيل جديد
  • ساعدني في دا            — مساعدة

  أي كلام ب "ده/دا/دي" أو "كدا" — OH يفهمك!`;

export const DDA_HELP_TEXT_EN = `📋 Egyptian Dialect Commands (ده/دا/دي):

  • شغل دا [name]           — Run an agent
  • ابحث في دا [query]      — Search memory
  • شغل ده موديل [name]      — Switch model
  • احذف دا [name]           — Delete agent
  • اعرض دا                 — List items
  • أسوي دا [name]           — Create agent
  • ساعدني في دا            — Help

  Any text with "ده/دا/دي" or "كدا" — OH understands!`;
