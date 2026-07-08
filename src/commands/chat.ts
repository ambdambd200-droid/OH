import chalk from "chalk";
import { t, getLang } from "../i18n/index.js";
import { memoryStore, memorySearch } from "../memory/index.js";
import { auditLog } from "../security/index.js";
import { trackChat, trackCommand } from "./stats.js";
import { detectIntent, isArabic, extractAgentName } from "./arabic.js";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const sessions = new Map<string, ChatMessage[]>();

function getOrCreateSession(sessionId = "default"): ChatMessage[] {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId)!;
}

function buildContext(sessionId: string, message: string): string {
  const history = getOrCreateSession(sessionId);
  const memories = memorySearch(message);
  const parts: string[] = [];

  if (memories.length > 0) {
    const topMemories = memories.slice(0, 3).map((m) => m.value).join(", ");
    parts.push(`${chalk.hex("#64748B")("📎 Related:")} ${chalk.hex("#94A3B8")(topMemories)}`);
  }

  if (history.length > 0) {
    const last = history[history.length - 1];
    parts.push(`${chalk.hex("#64748B")("💬 Previous:")} ${chalk.hex("#94A3B8")(last.content.slice(0, 60))}`);
  }

  return parts.length > 0 ? `\n  ${parts.join("\n  ")}` : "";
}

function querySummary(message: string): string | null {
  const lower = message.toLowerCase();

  if (lower.includes("summarize") || lower.includes("لخص") || lower.includes("تلخيص")) {
    return getLang() === "ar"
      ? "بسألك عن شنو بالضبط تبي تلخص؟"
      : "What would you like me to summarize?";
  }

  if (lower.includes("translate") || lower.includes("ترجم") || lower.includes("ترجمة")) {
    return getLang() === "ar"
      ? "أرسل لي النص اللي تبي أترجمه"
      : "Send me the text you want translated";
  }

  if (lower.includes("code") || lower.includes("كود") || lower.includes("برمجة")) {
    return getLang() === "ar"
      ? `أقدر أساعدك في كتابة كود. وش تبي تسوي؟`
      : "I can help you write code. What language?";
  }

  return null;
}

export function chat(message: string, sessionId = "default"): void {
  const history = getOrCreateSession(sessionId);

  history.push({ role: "user", content: message, timestamp: Date.now() });
  memoryStore(`chat:${Date.now()}`, message);
  trackChat();

  const lang = getLang();
  const arabic = isArabic(message);
  const intent = detectIntent(message);

  auditLog("CHAT", `User: ${message.slice(0, 100)}`);

  if (intent.action === "create" && intent.confidence > 0.5) {
    const name = extractAgentName(message) || "agent";
    trackCommand("create");
    const response = lang === "ar"
      ? `تم! خلينا نشتغل على وكيل "${name}".`
      : `Got it! Let me build agent "${name}".`;
    history.push({ role: "assistant", content: response, timestamp: Date.now() });
    const ctx = buildContext(sessionId, message);
    console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}${ctx}`);
    console.log();
    return;
  }

  if (intent.action === "search") {
    trackCommand("search");
    const results = memorySearch(message);
    if (results.length === 0) {
      const response = lang === "ar" ? "ما لقيت شي بهذا الخصوص." : "No results found.";
      history.push({ role: "assistant", content: response, timestamp: Date.now() });
      console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}`);
      console.log();
      return;
    }
    const response = lang === "ar" ? "لقيت هالنتايج:" : "Here's what I found:";
    history.push({ role: "assistant", content: response, timestamp: Date.now() });
    console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}`);
    for (const r of results.slice(0, 5)) {
      console.log(`    ${chalk.hex("#06B6D4")("•")} ${chalk.hex("#F8FAFC")(r.key)}: ${chalk.hex("#94A3B8")(r.value.slice(0, 80))}`);
    }
    console.log();
    return;
  }

  if (intent.action === "help") {
    trackCommand("help");
    const response = lang === "ar"
      ? "أقدر أساعدك في: إنشاء وكلاء (create)، بحث (search)، ترجمة (translate)، تلخيص (summarize)، وكتابة كود (code). جرب تكتب أمر!"
      : "I can help with: create agents, search memory, translate, summarize, and code generation. Try a command!";
    history.push({ role: "assistant", content: response, timestamp: Date.now() });
    const ctx = buildContext(sessionId, message);
    console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}${ctx}`);
    console.log();
    return;
  }

  const summaryResponse = querySummary(message);
  if (summaryResponse) {
    trackCommand("chat");
    history.push({ role: "assistant", content: summaryResponse, timestamp: Date.now() });
    const ctx = buildContext(sessionId, message);
    console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(summaryResponse)}${ctx}`);
    console.log();
    return;
  }

  const greeting = arabic || lang === "ar"
    ? "مرحبًا! كيف أقدر أساعدك اليوم؟"
    : "Hello! How can I help you today?";

  const response = history.length <= 2
    ? greeting
    : lang === "ar"
      ? `فكرة ممتازة! قلت: "${message.slice(0, 100)}". خلينا نشتغل عليها.`
      : `Great! You said: "${message.slice(0, 100)}". Let's work on it.`;

  history.push({ role: "assistant", content: response, timestamp: Date.now() });

  trackCommand("chat");
  const ctx = buildContext(sessionId, message);
  console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}${ctx}`);
  console.log();
}

export function clearHistory(sessionId = "default"): void {
  sessions.delete(sessionId);
}
