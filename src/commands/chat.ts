import chalk from "chalk";
import { t, getLang } from "../i18n/index.js";
import { memoryStore, memorySearch } from "../memory/index.js";
import { auditLog } from "../security/index.js";
import { trackChat, trackCommand } from "./stats.js";
import { detectIntent, isArabic, extractAgentName } from "./arabic.js";
import { proxyRequest } from "../proxy/index.js";
import { getConfig } from "../config/index.js";

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

export async function chat(message: string, sessionId = "default"): Promise<void> {
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
    return;
  }

  if (intent.action === "search") {
    trackCommand("search");
    const results = memorySearch(message);
    if (results.length === 0) {
      const response = lang === "ar" ? "ما لقيت شي بهذا الخصوص." : "No results found.";
      history.push({ role: "assistant", content: response, timestamp: Date.now() });
      console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}`);
      return;
    }
    const response = lang === "ar" ? "لقيت هالنتايج:" : "Here's what I found:";
    history.push({ role: "assistant", content: response, timestamp: Date.now() });
    console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}`);
    for (const r of results.slice(0, 5)) {
      console.log(`    ${chalk.hex("#06B6D4")("•")} ${chalk.hex("#F8FAFC")(r.key)}: ${chalk.hex("#94A3B8")(r.value.slice(0, 80))}`);
    }
    return;
  }

  const modelId = getConfig().model;
  console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#64748B")(lang === "ar" ? "بفكر..." : "Thinking...")}`);

  try {
    const response = await proxyRequest(modelId, message);
    history.push({ role: "assistant", content: response, timestamp: Date.now() });
    const ctx = buildContext(sessionId, message);
    console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}${ctx}`);
  } catch (err: any) {
    const fallback = lang === "ar"
      ? "عفواً، صار خطأ. تأكد من الإعدادات أو جرب مرة ثانية."
      : "Sorry, something went wrong. Check your config or try again.";
    history.push({ role: "assistant", content: fallback, timestamp: Date.now() });
    console.log(`\n  ${chalk.hex("#F43F5E").bold("OH:")} ${chalk.hex("#F8FAFC")(fallback)}`);
  }
}

export function clearHistory(sessionId = "default"): void {
  sessions.delete(sessionId);
}
