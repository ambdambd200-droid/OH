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

const cannedResponses: Array<{ pattern: RegExp; en: string; ar: string }> = [
  { pattern: /\b(hi|hello|hey|مرحبا|اهلا|سلام)\b/i, en: "Hello! I'm OH, your AI agent platform. I can build agents, search memory, write code, and more. Try asking me to create something!", ar: "مرحباً! أنا OH، منصة الذكاء الاصطناعي الخاصة بك. أقدر أصنع وكلاء، أبحث في الذاكرة، أكتب كود، وأكثر. جرب تطلب مني أصنع شي!" },
  { pattern: /\b(how are you|كيفك|كيف حالك|عامل ايه)\b/i, en: "I'm running smoothly! Ready to help you build and deploy. What can I do for you today?", ar: "أنا تمام! جاهز أساعدك تبني وتنشر. وش تباني أسوي لك؟" },
  { pattern: /\b(who are you|what are you|شنو انت|من انت|what can you do)\b/i, en: "I'm OH (Open Hermes) v2.0 — a no-code AI agent platform with 42 models, 25+ built-in systems, Arabic-first CLI, and a real-time web dashboard. I can create agents, search memory, generate code, translate, summarize, and much more!", ar: "أنا OH (Open Hermes) v2.0 — منصة وكلاء ذكاء اصطناعي بدون كود. عندي 42 موديل، 25+ نظام مدمج، ودعم كامل للعربية. أقدر أصنع وكلاء، أبحث في الذاكرة، أكتب كود، أترجم، وألخص!" },
  { pattern: /\b(code|كود|برمجة|python|javascript|typescript|function)\b/i, en: "I can help you write code in Python, JavaScript, TypeScript, and more. What would you like to build?", ar: "أقدر أساعدك تكتب كود بـ Python, JavaScript, TypeScript, وغيرها. وش تبني؟" },
  { pattern: /\b(translate|ترجم|ترجمة)\b/i, en: "I can translate between English and Arabic. Send me the text you want translated!", ar: "أقدر أترجم بين العربية والإنجليزية. أرسل النص اللي تبي أترجمه!" },
  { pattern: /\b(create|build|make|construct|أنشئ|صنع|ابني)\b/i, en: "I can create custom AI agents for you. Just tell me what kind of agent you need and what it should do!", ar: "أقدر أصنع لك وكيل ذكاء اصطناعي حسب طلبك. قلي شنو نوع الوكيل اللي تبي ووش يسوي!" },
  { pattern: /\b(model|موديل|model|gpt|deepseek|llama|claude)\b/i, en: "We have 42 models: Chinese models (DeepSeek, Qwen, GLM, Yi, Baichuan, InternLM, Minimax) and American models (GPT-4, Claude, Gemini, Llama, Mistral, Grok). Use `oh models` to browse or `oh model <id>` to switch.", ar: "عندنا 42 موديل: نماذج صينية (DeepSeek, Qwen, GLM, Yi, Baichuan, InternLM, Minimax) وأمريكية (GPT-4, Claude, Gemini, Llama, Mistral, Grok). استخدم `models` للعرض أو `model <id>` للتبديل." },
  { pattern: /\b(help|مساعدة|ساعدني|الأوامر|commands)\b/i, en: "Try these commands: `help` for help, `models` to list models, `model <id>` to switch, `status` for system status, `search <q>` to search memory, or just type anything to chat!", ar: "جرب هالأوامر: `مساعدة` للمساعدة، `نماذج` لعرض الموديلات، `موديل <id>` للتبديل، `status` لحالة النظام، `search <q>` للبحث، أو اكتب أي شيء للدردشة!" },
  { pattern: /\b(شكرا|thanks|thank you|thx)\b/i, en: "You're welcome! Happy to help. Let me know what you need next.", ar: "العفو! دايماً حاضر. قلي وش تبي بعد." },
];

function buildSimulatedResponse(model: string, prompt: string): string {
  const spec = getModelById(model);
  const vibe = getModelPersonality(model);
  const isArabic = /[\u0600-\u06FF]/.test(prompt);
  const name = spec?.name || model;

  for (const cr of cannedResponses) {
    if (cr.pattern.test(prompt)) {
      return isArabic ? cr.ar : cr.en;
    }
  }

  const defaultEn = `I'm running on ${name}. ${vibe.en}. How can I help you today?`;
  const defaultAr = `أنا شغال على ${name}. ${vibe.ar}. كيف أقدر أساعدك؟`;
  return isArabic ? defaultAr : defaultEn;
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
