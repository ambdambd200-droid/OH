const FREE_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "claude-3-haiku",
  "claude-3.5-sonnet",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "mistral-small",
  "mistral-medium",
  "llama-3.1-8b",
  "llama-3.1-70b",
  "phi-3-medium",
  "gemma-2-9b",
];

const cache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 60_000;
const requestCounts = new Map<string, number>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

export function listFreeModels(): string[] {
  return [...FREE_MODELS];
}

export function isModelFree(model: string): boolean {
  return FREE_MODELS.includes(model);
}

export async function proxyRequest(model: string, prompt: string): Promise<string> {
  const cacheKey = `${model}:${prompt}`;
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

  const mockResponse = `[${model} simulated response]: "${prompt.slice(0, 50)}..." — This is a free proxy response. Connect your API key for full power.`;

  cache.set(cacheKey, { result: mockResponse, timestamp: now });
  return mockResponse;
}
