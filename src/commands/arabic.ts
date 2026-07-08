export interface ArabicIntent {
  action: 'create' | 'search' | 'chat' | 'help' | 'delete' | 'list' | 'run' | 'config' | 'translate' | 'summarize' | 'unknown';
  target?: string;
  confidence: number;
  originalText: string;
}

const ARABIC_KEYWORDS: Record<string, string[]> = {
  create: ['إنشاء', 'إنشئ', 'أسوي', 'أبي', 'ابي', 'build', 'make', 'create', 'construct'],
  search: ['بحث', 'دور', 'فتش', 'search', 'find', 'look'],
  delete: ['حذف', 'مسح', 'إزالة', 'delete', 'remove', 'clear'],
  list: ['عرض', 'أظهر', 'list', 'show', 'display'],
  run: ['شغل', 'نفذ', 'فعل', 'run', 'start', 'execute', 'launch'],
  help: ['مساعدة', 'ساعد', 'help', 'aid', 'assist'],
  translate: ['ترجمة', 'ترجم', 'translate'],
  summarize: ['لخص', 'تلخيص', 'summarize', 'summary'],
};

const AGENT_PATTERNS = [
  /(?:اسمه|اسم|إسم|اسمها|named|called)\s*[""]?(\w+)[""]?/i,
  /(?:وكيل|agent|bot|بوت)\s+[""]?(\w+)[""]?/i,
];

const ALEF_PATTERNS = /[أإآا]/g;
const TA_MARBOTA = /ة/g;
const ALIF_MAQSURA = /ى/g;
const DIACRITICS = /[\u064B-\u065F]/g;

export function isArabic(text: string): boolean {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicCount > text.length * 0.3;
}

export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function normalizeArabic(text: string): string {
  return text
    .replace(ALEF_PATTERNS, 'ا')
    .replace(TA_MARBOTA, 'ه')
    .replace(ALIF_MAQSURA, 'ي')
    .replace(DIACRITICS, '');
}

export function detectIntent(text: string): ArabicIntent {
  const normalized = normalizeArabic(text.toLowerCase().trim());

  for (const [action, keywords] of Object.entries(ARABIC_KEYWORDS)) {
    for (const kw of keywords) {
      const kwNorm = normalizeArabic(kw.toLowerCase());
      if (normalized.includes(kwNorm)) {
        let target: string | undefined;
        if (action === 'create' || action === 'delete' || action === 'run') {
          target = extractAgentName(text) || undefined;
        }
        return {
          action: action as ArabicIntent['action'],
          target,
          confidence: 0.8 + (containsArabic(kw) ? 0.1 : 0),
          originalText: text,
        };
      }
    }
  }

  return {
    action: 'chat',
    confidence: 0.4,
    originalText: text,
  };
}

export function extractAgentName(text: string): string | null {
  for (const pattern of AGENT_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/[""']/g, '');
    }
  }
  return null;
}
