import { getConfig } from "../config/index.js";
import { MODELS, getModelById, getFreeModels } from "./models.js";
export type { ModelSpec, ModelCategory } from "./models.js";
export { MODELS, getModelById, getFreeModels, getModelsByCategory, searchModels } from "./models.js";

const cache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 60_000;
const requestCounts = new Map<string, number>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;

export function listFreeModels(): string[] {
  return getFreeModels().map(m => m.id);
}

export function isModelFree(model: string): boolean {
  return getFreeModels().some(m => m.id === model) || MODELS.some(m => m.id === model && m.free);
}

const personalityTraits: Record<string, string> = {
  "deepseek/r1": "أفكر خطوة بخطوة مع تحليل عميق ومنطقي. أركز على الدقة في البرمجة والرياضيات والاستدلال المعقد",
  "deepseek/v3": "نموذج قوي للمهام التقنية، أداء ممتاز في البرمجة والتحليل",
  "deepseek/chat": "محادثة طبيعية متعددة الأدوار مع تتبع السياق",
  "doubao": "إبداعي وشخصي، أفهم النصوص والصور بعمق. أميل للحلول المبتكرة",
  "qwen": "متعدد اللغات، قوي في البرمجة والفهم البصري والتفكير المنطقي",
  "kimi-vl": "سريع جداً بخبراء 2.8B نشطة فقط، دقة عالية في الرياضيات والرؤية",
  "kimi-k1": "أفهم النصوص الطويلة جداً (مليون رمز)، قوي في المشكلات المعقدة",
  "ernie": "دقيق مع تكامل محرك بحث، أداء معرفي عالٍ",
  "llama-4-maverick": "أقوى نموذج مفتوح! 400B معلمة (17B نشطة)، 256K سياق، متعدد الوسائط",
  "llama-4-scout": "512K سياق (10M نظري)، نشر فعال على الأجهزة المنزلية",
  "nemotron": "محسّن من NVIDIA مع NeMo و FlashAttention، أداء فعال",
  "mistral-small-3.1": "24B مع 96K سياق، دعم JSON، متعدد اللغات مع استدعاء دوال",
  "mistral-small": "سريع وفعال، مناسب للتطبيقات العامة",
  "mistral-medium": "توازن مثالي بين القوة والسرعة",  
  "optimus": "محسّن لاستدعاءات API بكمون منخفض جداً",
  "quasar": "استدلال معرفي مع تحقق وتصحيح ذاتي",
  "deephermes": "متوازن عبر مجالات متعددة مع ضبط دقيق على Llama 3",
};

const arabicPersonality: Record<string, string> = {
  "deepseek/r1": "أفكر خطوة بخطوة مع تحليل عميق ومنطقي. أركز على الدقة في البرمجة والرياضيات والاستدلال المعقد",
  "deepseek/v3": "نموذج قوي للمهام التقنية، أداء ممتاز في البرمجة والتحليل",
  "deepseek/chat": "محادثة طبيعية متعددة الأدوار مع تتبع السياق",
  "doubao": "إبداعي وشخصي، أفهم النصوص والصور بعمق. أميل للحلول المبتكرة",
  "qwen": "متعدد اللغات، قوي في البرمجة والفهم البصري والتفكير المنطقي",
  "kimi-vl": "سريع جداً بخبراء 2.8B نشطة فقط، دقة عالية في الرياضيات والرؤية",
  "kimi-k1": "أفهم النصوص الطويلة جداً (مليون رمز)، قوي في المشكلات المعقدة",
  "ernie": "دقيق مع تكامل محرك بحث، أداء معرفي عالٍ",
  "llama-4-maverick": "أقوى نموذج مفتوح! 400B معلمة (17B نشطة)، 256K سياق، متعدد الوسائط",
  "llama-4-scout": "512K سياق (10M نظري)، نشر فعال على الأجهزة المنزلية",
  "nemotron": "محسّن من NVIDIA مع NeMo و FlashAttention، أداء فعال",
  "mistral-small-3.1": "24B مع 96K سياق، دعم JSON، متعدد اللغات مع استدعاء دوال",
  "mistral-small": "سريع وفعال، مناسب للتطبيقات العامة",
  "mistral-medium": "توازن مثالي بين القوة والسرعة",  
  "optimus": "محسّن لاستدعاءات API بكمون منخفض جداً",
  "quasar": "استدلال معرفي مع تحقق وتصحيح ذاتي",
  "deephermes": "متوازن عبر مجالات متعددة مع ضبط دقيق على Llama 3",
};

function getModelPersonality(modelId: string): { en: string; ar: string } {
  const lower = modelId.toLowerCase();
  for (const [key, val] of Object.entries(personalityTraits)) {
    if (lower.includes(key)) return { en: val, ar: arabicPersonality[key] || val };
  }
  return { en: "Versatile AI model ready to help", ar: "نموذج ذكاء اصطناعي متعدد الاستخدامات" };
}

function buildSimulatedResponse(model: string, prompt: string): string {
  const spec = getModelById(model);
  const vibe = getModelPersonality(model);
  const isArabic = /[\u0600-\u06FF]/.test(prompt);
  const name = spec?.name || model;
  const prefix = isArabic ? "شخصيتي" : "Personality";
  const langLabel = isArabic ? "اللغة" : "Language";

  return isArabic
    ? `── ${name} ── 🔮\n\n${prefix}: ${vibe.ar}\n${langLabel}: العربية\n${spec?.provider ? `المزود: ${spec.provider}\n` : ""}${spec?.params ? `المعلمات: ${spec.params}` : ""}${spec?.paramsActive ? ` (النشط: ${spec.paramsActive})` : ""}\n${spec?.context ? `السياق: ${(spec.context / 1000).toFixed(0)}K رمز\n` : ""}${spec?.description ? `\nالوصف: ${spec.description}\n` : ""}\n\nرسالتك: "${prompt.slice(0, 200)}"\n\n—— هذا رد محاكي ——\n${name} نشط! ${vibe.ar}. كيف أقدر أساعدك؟`
    : `── ${name} ── 🔮\n\n${prefix}: ${vibe.en}\n${langLabel}: English\n${spec?.provider ? `Provider: ${spec.provider}\n` : ""}${spec?.params ? `Parameters: ${spec.params}` : ""}${spec?.paramsActive ? ` (Active: ${spec.paramsActive})` : ""}\n${spec?.context ? `Context: ${(spec.context / 1000).toFixed(0)}K tokens\n` : ""}${spec?.description ? `\nDescription: ${spec.description}\n` : ""}\n\nYour message: "${prompt.slice(0, 200)}"\n\n—— Simulated response ——\n${name} activated! ${vibe.en}. How can I help?`;
}

export async function proxyRequest(model: string, prompt: string): Promise<string> {
  const cacheKey = `${model}:${prompt.length}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const ip = "local";
  const now = Date.now();
  const count = requestCounts.get(ip) || 0;
  if (count >= RATE_LIMIT) {
    throw new Error("Rate limit exceeded. Try again later.");
  }
  requestCounts.set(ip, count + 1);
  setTimeout(() => requestCounts.set(ip, (requestCounts.get(ip) || 1) - 1), RATE_WINDOW);

  const config = getConfig();
  const apiKey = config.apiKey;

  if (apiKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://oh.openhermes.ai",
          "X-Title": "OH - Open Hermes",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are OH (Open Hermes) — a helpful AI assistant." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2048,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const content = data?.choices?.[0]?.message?.content || "No response";
        cache.set(cacheKey, { result: content, timestamp: now });
        return content;
      }
    } catch {
      // Fallback to simulation on error
    }
  }

  const result = buildSimulatedResponse(model, prompt);
  cache.set(cacheKey, { result, timestamp: now });
  return result;
}
