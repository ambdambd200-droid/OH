import { proxyRequest, MODELS, getModelById } from "../proxy/index.js";
import { getConfig, setConfig } from "../config/index.js";
import { auditLog } from "../security/index.js";
import { memoryStore } from "../memory/index.js";

export async function startWhatsAppBot(): Promise<void> {
  let Client: any, LocalAuth: any, qrcode: any;

  try {
    const ww = await import("whatsapp-web.js");
    Client = ww.Client;
    LocalAuth = ww.LocalAuth;
    const qr = await import("qrcode-terminal");
    qrcode = qr.default || qr;
  } catch {
    auditLog("WHATSAPP", "Dependencies not installed. Run: npm install whatsapp-web.js qrcode-terminal");
    throw new Error("Missing dependencies: whatsapp-web.js, qrcode-terminal");
  }

  const client = new Client({ authStrategy: new LocalAuth() });

  client.on("qr", (qr: string) => {
    qrcode.generate(qr, { small: true });
    auditLog("WHATSAPP", "QR code generated — scan to authenticate");
  });

  client.on("ready", () => {
    auditLog("WHATSAPP", "Bot started and connected");
  });

  client.on("authenticated", () => {
    auditLog("WHATSAPP", "Authenticated successfully");
  });

  client.on("auth_failure", (msg: string) => {
    auditLog("WHATSAPP", `Auth failure: ${msg}`);
  });

  client.on("disconnected", (reason: string) => {
    auditLog("WHATSAPP", `Disconnected: ${reason}`);
  });

  client.on("message_create", async (msg: any) => {
    if (msg.fromMe || !msg.body.startsWith("!")) return;

    const args = msg.body.slice(1).trim().split(/\s+/);
    const command = args[0]?.toLowerCase();
    const input = args.slice(1).join(" ");
    const key = `whatsapp:msg:${String(msg.id?._serialized || msg.id).replace(/[^a-zA-Z0-9]/g, "_")}`;

    try {
      switch (command) {
        case "chat": {
          if (!input) { await msg.reply("Usage: `!chat <message>`"); return; }
          memoryStore(key, `[${msg.from}] ${input}`);
          auditLog("WHATSAPP_CHAT", `User ${msg.from}: ${input.slice(0, 80)}`);
          const response = await proxyRequest(getConfig().model, input);
          memoryStore(`${key}:response`, response);
          await msg.reply(response.slice(0, 4096));
          break;
        }
        case "model": {
          const cfg = getConfig();
          if (input) {
            const spec = getModelById(input);
            if (!spec) { await msg.reply(`Model not found. Use !models`); return; }
            setConfig("model", input);
            auditLog("WHATSAPP_MODEL", `User ${msg.from} switched to ${input}`);
            await msg.reply(`Switched to model: ${input}`);
          } else {
            await msg.reply(`Current model: ${cfg.model}`);
          }
          break;
        }
        case "models": {
          const lines = [`Available Models (${MODELS.length} total)`];
          for (const m of MODELS) {
            lines.push(`  ${m.id} — ${m.name}${m.free ? " (FREE)" : ""}`);
          }
          for (const chunk of chunkLines(lines, 15)) {
            await msg.reply(chunk);
          }
          break;
        }
        case "help": {
          await msg.reply([
            "OH WhatsApp Bot Commands",
            "!chat <message> — Chat with AI",
            "!model [id] — Show/switch model",
            "!models — List models",
            "!help — Show help",
          ].join("\n"));
          break;
        }
        default: {
          await msg.reply("Unknown command. Try !help");
          break;
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      auditLog("WHATSAPP_ERROR", `Command ${command}: ${errMsg}`);
      await msg.reply(`Error: ${errMsg.slice(0, 500)}`);
    }
  });

  client.initialize().catch((err: any) => {
    auditLog("WHATSAPP", `Init failed: ${err?.message || String(err)}`);
    throw err;
  });
}

function chunkLines(lines: string[], size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size).join("\n"));
  }
  return chunks;
}
