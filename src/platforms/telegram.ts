import { proxyRequest, MODELS, getModelById } from "../proxy/index.js";
import { getConfig, setConfig } from "../config/index.js";
import { auditLog } from "../security/index.js";
import { memoryStore } from "../memory/index.js";
import { createAgent } from "../commands/agent.js";

export async function startTelegramBot(token: string): Promise<void> {
  const { default: TelegramBot } = await import("node-telegram-bot-api");
  const bot = new TelegramBot(token, { polling: true });

  bot.on("polling_error", (err: any) => {
    auditLog("TELEGRAM", `Polling error: ${err?.message || String(err)}`);
  });

  bot.onText(/^\/chat (.+)/, async (msg: any, match: any) => {
    if (!match) return;
    const chatId = msg.chat.id;
    const input = match[1].trim();
    const key = `telegram:msg:${msg.message_id}`;

    try {
      memoryStore(key, `[${msg.from?.username ?? msg.from?.id}] ${input}`);
      auditLog("TELEGRAM_CHAT", `User ${msg.from?.id}: ${input.slice(0, 80)}`);
      bot.sendChatAction(chatId, "typing").catch(() => {});
      const response = await proxyRequest(getConfig().model, input);
      memoryStore(`${key}:response`, response);
      await bot.sendMessage(chatId, response.slice(0, 4096), { parse_mode: "Markdown" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      auditLog("TELEGRAM_ERROR", `chat: ${errMsg}`);
      await bot.sendMessage(chatId, `Error: ${errMsg.slice(0, 500)}`);
    }
  });

  bot.onText(/^\/model(\s+.+)?$/, async (msg: any, match: any) => {
    if (!match) return;
    const chatId = msg.chat.id;
    const input = match[1]?.trim();

    try {
      if (input) {
        const spec = getModelById(input);
        if (!spec) {
          await bot.sendMessage(chatId, `Model not found. Use /models to see available models.`);
          return;
        }
        setConfig("model", input);
        auditLog("TELEGRAM_MODEL", `User ${msg.from?.id} switched to ${input}`);
        await bot.sendMessage(chatId, `Switched to model: \`${input}\``, { parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(chatId, `Current model: \`${getConfig().model}\``, { parse_mode: "Markdown" });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      auditLog("TELEGRAM_ERROR", `model: ${errMsg}`);
      await bot.sendMessage(chatId, `Error: ${errMsg.slice(0, 500)}`);
    }
  });

  bot.onText(/^\/models$/, async (msg: any) => {
    const chatId = msg.chat.id;
    try {
      const lines = [`*Available Models (${MODELS.length} total)*`];
      for (const m of MODELS) {
        lines.push(`  \`${m.id}\` — ${m.name}${m.free ? " (FREE)" : ""}`);
      }
      for (const chunk of chunkLines(lines, 15)) {
        await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      auditLog("TELEGRAM_ERROR", `models: ${errMsg}`);
      await bot.sendMessage(chatId, `Error: ${errMsg.slice(0, 500)}`);
    }
  });

  bot.onText(/^\/create (.+)/, async (msg: any, match: any) => {
    if (!match) return;
    const chatId = msg.chat.id;
    const name = match[1].trim();

    try {
      createAgent(name, `Telegram agent created by ${msg.from?.username ?? msg.from?.id}`);
      auditLog("TELEGRAM_CREATE", `User ${msg.from?.id} created agent: ${name}`);
      await bot.sendMessage(chatId, `Agent \`${name}\` created!`, { parse_mode: "Markdown" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      auditLog("TELEGRAM_ERROR", `create: ${errMsg}`);
      await bot.sendMessage(chatId, `Error: ${errMsg.slice(0, 500)}`);
    }
  });

  bot.onText(/^\/help$/, async (msg: any) => {
    const chatId = msg.chat.id;
    try {
      await bot.sendMessage(chatId, [
        "*OH Telegram Bot Commands*",
        "`/chat <message>` — Chat with AI",
        "`/model` — Show current model",
        "`/model <id>` — Switch model",
        "`/models` — List all models",
        "`/create <name>` — Create agent",
        "`/help` — Show help",
      ].join("\n"), { parse_mode: "Markdown" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      auditLog("TELEGRAM_ERROR", `help: ${errMsg}`);
    }
  });

  auditLog("TELEGRAM", "Bot started (polling mode)");
}

function chunkLines(lines: string[], size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size).join("\n"));
  }
  return chunks;
}
