import chalk from "chalk";
import { t, getLang } from "../i18n/index.js";
import { memoryStore, memorySearch } from "../memory/index.js";
import { auditLog } from "../security/index.js";

const history: { role: "user" | "assistant"; content: string }[] = [];

export function chat(message: string): void {
  history.push({ role: "user", content: message });
  memoryStore(`chat:${Date.now()}`, message);

  const memories = memorySearch(message);
  const context = memories.length > 0
    ? `\n  ${chalk.hex("#64748B")("Related memories:")} ${memories.slice(0, 2).map((m) => m.value).join(", ")}`
    : "";

  const response = generateResponse(message);
  history.push({ role: "assistant", content: response });

  auditLog("CHAT", `User: ${message.slice(0, 100)}`);
  console.log(`\n  ${chalk.hex("#8B5CF6").bold("OH:")} ${chalk.hex("#F8FAFC")(response)}${context}`);
  console.log();
}

function generateResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("create") || lower.includes("build") || lower.includes("bot") || lower.includes("وكيل") || lower.includes("إنشاء") || lower.includes("بوت")) {
    // Extract agent name
    const words = input.split(" ");
    const nameIndex = Math.max(
      words.indexOf("called"),
      words.indexOf("named"),
      words.indexOf("اسمه"),
      words.indexOf("إسمه")
    );
    const name = nameIndex >= 0 && words[nameIndex + 1] ? words[nameIndex + 1].replace(/[""']/g, "") : "my-agent";

    return `Sure! I'll create an agent called "${name}". ${getLang() === "ar" ? "تم البدء في إنشاء الوكيل..." : "Starting to build it now..."}`;
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("مرحبا") || lower.includes("اهلا")) {
    return getLang() === "ar" ? "مرحبًا! كيف أقدر أساعدك اليوم؟" : "Hello! How can I help you today?";
  }

  if (lower.includes("help") || lower.includes("مساعدة") || lower.includes("what can")) {
    return getLang() === "ar"
      ? 'أقدر أساعدك في: إنشاء وكلاء ذكية، إدارة الذاكرة، البحث عن أدوات، والتحدث بالعربية أو الإنجليزية. جرب كتابة "create" أو "build" أو اسأل سؤال!'
      : 'I can help you: create AI agents, manage memory, search tools, and chat in Arabic or English. Try typing "create", "build", or ask me a question!';
  }

  return getLang() === "ar"
    ? `فكرة رائعة! قلت: "${input.slice(0, 100)}". خلينا نشتغل عليها!`
    : `Great idea! You said: "${input.slice(0, 100)}". Let's work on it!`;
}
