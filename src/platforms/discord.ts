import { proxyRequest, MODELS, getModelById } from "../proxy/index.js";
import { getConfig, setConfig } from "../config/index.js";
import { auditLog } from "../security/index.js";
import { memoryStore } from "../memory/index.js";
import { createAgent } from "../commands/agent.js";

export async function startDiscordBot(token: string): Promise<void> {
  const { Client, GatewayIntentBits } = await import("discord.js");

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", () => {
    const user = client.user!;
    auditLog("DISCORD", `Bot started as ${user.tag}`);
    user.setActivity("!help | OH Platform");
  });

  client.on("messageCreate", async (msg: any) => {
    if (msg.author.bot || !msg.content.startsWith("!")) return;

    const args = msg.content.slice(1).trim().split(/\s+/);
    const command = args[0]?.toLowerCase();
    const input = args.slice(1).join(" ");
    const key = `discord:msg:${msg.id}`;

    try {
      switch (command) {
        case "chat": {
          if (!input) { await msg.reply("Usage: `!chat <message>`"); return; }
          memoryStore(key, `[${msg.author.tag}] ${input}`);
          auditLog("DISCORD_CHAT", `User ${msg.author.tag}: ${input.slice(0, 80)}`);
          const response = await proxyRequest(getConfig().model, input);
          memoryStore(`${key}:response`, response);
          await msg.reply(response.slice(0, 2000));
          break;
        }
        case "model": {
          await msg.reply(`Current model: \`${getConfig().model}\``);
          break;
        }
        case "models": {
          const lines = [`**Available Models (${MODELS.length} total)**`];
          for (const m of MODELS) {
            lines.push(`  \`${m.id}\` — ${m.name}${m.free ? " (FREE)" : ""}`);
          }
          for (const chunk of chunkLines(lines, 15)) {
            if (msg.channel?.send) await msg.channel.send(chunk);
          }
          break;
        }
        case "create": {
          if (!input) { await msg.reply("Usage: `!create <name>`"); return; }
          createAgent(input, `Discord agent created by ${msg.author.tag}`);
          auditLog("DISCORD_CREATE", `User ${msg.author.tag} created agent: ${input}`);
          await msg.reply(`Agent \`${input}\` created!`);
          break;
        }
        case "help": {
          await msg.reply([
            "**OH Discord Bot Commands**",
            "`!chat <message>` — Chat with AI",
            "`!model` — Show current model",
            "`!models` — List all models",
            "`!create <name>` — Create agent",
            "`!help` — Show help",
          ].join("\n"));
          break;
        }
        default: {
          await msg.reply("Unknown command. Try `!help`.");
          break;
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      auditLog("DISCORD_ERROR", `Command ${command}: ${errMsg}`);
      await msg.reply(`Error: ${errMsg.slice(0, 500)}`);
    }
  });

  client.login(token).catch((err: any) => {
    auditLog("DISCORD", `Login failed: ${err?.message || String(err)}`);
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
