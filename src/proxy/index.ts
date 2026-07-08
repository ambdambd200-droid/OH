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
  "deepseek": "تحليل عميق ومنطقي، تفكير خطوة بخطوة، دقة في البرمجة والرياضيات",
  "doubao": "إبداعي وشخصي، فهم قوي للصور والنصوص",
  "qwen": "متعدد اللغات، قوي في البرمجة والفهم البصري",
  "kimi": "ذكي في الرياضيات والمسائل المعقدة، فهم نصوص طويلة",
  "ernie": "دقيق ومتكامل مع محرك البحث، أداء عالٍ",
  "llama": "مفتوح المصدر، تفكير متعدد الوسائط، سياق طويل جداً",
  "nemotron": "محسّن من NVIDIA، أداء فعال، استدلال سريع",
  "mistral": "متعدد اللغات، دعم JSON، كفاءة في النشر",
  "optimus": "محسّن لـ API، استجابات سريعة، استهلاك منخفض",
  "quasar": "استدلال معرفي، تحقق ذاتي، منطق متسق",
  "deephermes": "متوازن، متعدد المجالات، ضبط دقيق على Llama 3",
};

const arabicTraits: Record<string, string> = {
  "deepseek": "تحليل عميق ومنطقي، تفكير خطوة بخطوة، دقة في البرمجة والرياضيات",
  "doubao": "إبداعي وشخصي، فهم قوي للصور والنصوص",
  "qwen": "متعدد اللغات، قوي في البرمجة والفهم البصري",
  "kimi": "ذكي في الرياضيات والمسائل المعقدة، فهم نصوص طويلة",
  "ernie": "دقيق ومتكامل مع محرك البحث، أداء عالٍ",
  "llama": "مفتوح المصدر، تفكير متعدد الوسائط، سياق طويل جداً",
  "nemotron": "محسّن من NVIDIA، أداء فعال، استدلال سريع",
  "mistral": "متعدد اللغات، دعم JSON، كفاءة في النشر",
  "optimus": "محسّن لـ API، استجابات سريعة، استهلاك منخفض",
  "quasar": "استدلال معرفي، تحقق ذاتي، منطق متسق",
  "deephermes": "متوازن، متعدد المجالات، ضبط دقيق على Llama 3",
};

function getModelVibe(modelId: string, isArabic: boolean): string {
  const lower = modelId.toLowerCase();
  const traits = isArabic ? arabicTraits : personalityTraits;
  for (const [key, val] of Object.entries(traits)) {
    if (lower.includes(key)) return val;
  }
  return isArabic ? "نموذج ذكاء اصطناعي متعدد الاستخدامات" : "General-purpose AI model";
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

  const spec = getModelById(model);
  const vibe = getModelVibe(model, /[\u0600-\u06FF]/.test(prompt));
  const modelName = spec?.name || model;

  const lang = /[\u0600-\u06FF]/.test(prompt) ? "ar" : "en";

  const response = lang === "ar"
    ? `[${modelName}] تفعيل ${spec?.params ? `(${spec.params}` : ""}${spec?.paramsActive ? `، نشط: ${spec.paramsActive}` : ""}${spec?.params ? ")" : ""} 🔮

🧠 شخصيتي: ${vibe}
📏 السياق: ${spec?.context ? `${(spec.context / 1000).toFixed(0)}K رمز` : "غير محدد"}
🏷️ المزوّد: ${spec?.provider || "غير معروف"}
🔗 الفئة: ${spec?.category === "chinese" ? "صيني" : spec?.category === "american" ? "أمريكي" : "مفتوح"}

رسالتك: "${prompt.slice(0, 150)}${prompt.length > 150 ? "..." : ""}"

—— هذا رد محاكي من ${modelName} ——
OH يعمل حالياً كوسيط محاكاة. للحصول على ردود حقيقية، يمكنك ربط API key عبر الإعدادات.
أنا الآن ${modelName}، و${vibe}. أقدر أساعدك في أي شيء!`
    : `[${modelName}] Activated ${spec?.params ? `(${spec.params}` : ""}${spec?.paramsActive ? `, active: ${spec.paramsActive}` : ""}${spec?.params ? ")" : ""} 🔮

🧠 Personality: ${vibe}
📏 Context: ${spec?.context ? `${(spec.context / 1000).toFixed(0)}K tokens` : "N/A"}
🏷️ Provider: ${spec?.provider || "Unknown"}
🔗 Category: ${spec?.category || "General"}

Your message: "${prompt.slice(0, 150)}${prompt.length > 150 ? "..." : ""}"

—— This is a simulated response from ${modelName} ——
OH is currently acting as a simulation proxy. For real API responses, connect a provider via config.
I'm now running as ${modelName}, and ${vibe}. How can I help you?`;

  cache.set(cacheKey, { result: response, timestamp: now });
  return response;
}
