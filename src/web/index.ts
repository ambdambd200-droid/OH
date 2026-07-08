import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { join, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { getConfig, setConfig } from "../config/index.js";
import { getLang, setLang } from "../i18n/index.js";
import { memoryExport, memorySearch } from "../memory/index.js";
import { chat } from "../commands/chat.js";
import { listFreeModels, MODELS, getModelById } from "../proxy/index.js";
import { auditLog } from "../security/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = existsSync(join(__dirname, "public"))
  ? join(__dirname, "public")
  : join(__dirname, "..", "src", "web", "public");
const promptPath = existsSync(join(__dirname, "..", "prompt", "claude-fable-5.md"))
  ? join(__dirname, "..", "prompt", "claude-fable-5.md")
  : join(__dirname, "..", "src", "prompt", "claude-fable-5.md");

export function startWebServer(port = 3456) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());
  app.use(express.static(publicDir));

  const systemPrompt = readFileSync(promptPath, "utf-8");

  app.get("/api/system-prompt", (_req, res) => {
    res.json({ prompt: systemPrompt });
  });

  app.get("/api/status", (_req, res) => {
    res.json({
      status: "healthy",
      lang: getLang(),
      version: "2.0.0",
      uptime: process.uptime(),
    });
  });

  app.get("/api/models", (_req, res) => {
    res.json({ models: MODELS, current: getConfig().model });
  });

  app.get("/api/models/:category", (req, res) => {
    const cat = req.params.category;
    const filtered = cat === "all" ? MODELS : MODELS.filter(m => m.category === cat);
    res.json({ models: filtered, category: cat, total: filtered.length });
  });

  app.get("/api/agents", (_req, res) => {
    res.json({ agents: [] });
  });

  app.post("/api/chat", (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });
    chat(message);
    res.json({ response: "OK" });
  });

  app.get("/api/memory", (_req, res) => {
    res.json({ entries: memoryExport() });
  });

  app.get("/api/stats", (_req, res) => {
    res.json({
      agents: 0,
      memory: memoryExport().length,
      models: listFreeModels().length,
      uptime: process.uptime(),
    });
  });

  app.get("/api/config", (_req, res) => {
    res.json(getConfig());
  });

  app.post("/api/config", (req, res) => {
    const { key, value } = req.body;
    if (key && value !== undefined) {
      setConfig(key, value);
      if (key === "lang") setLang(value);
      res.json({ success: true, config: getConfig() });
    } else {
      res.status(400).json({ error: "key and value required" });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "chat") {
          auditLog("WEB_CHAT", `User: ${data.message.slice(0, 100)}`);
          const memories = memorySearch(data.message);
          const context = memories.length > 0
            ? `\nRelated memories: ${memories.slice(0, 2).map((m) => m.value).join(", ")}`
            : "";
          const lang = getLang();
          const lower = data.message.toLowerCase();
          let response: string;

          if (lower.includes("hello") || lower.includes("hi") || lower.includes("مرحبا") || lower.includes("اهلا")) {
            response = lang === "ar" ? "مرحبًا! كيف أقدر أساعدك اليوم؟" : "Hello! How can I help you today?";
          } else if (lower.includes("create") || lower.includes("build") || lower.includes("bot") || lower.includes("وكيل") || lower.includes("إنشاء")) {
            const words = data.message.split(" ");
            const nameIndex = Math.max(
              words.indexOf("called"), words.indexOf("named"),
              words.indexOf("اسمه"), words.indexOf("إسمه")
            );
            const name = nameIndex >= 0 && words[nameIndex + 1] ? words[nameIndex + 1].replace(/[""']/g, "") : "my-agent";
            response = `Sure! I'll create an agent called "${name}". ${lang === "ar" ? "تم البدء في إنشاء الوكيل..." : "Starting to build it now..."}`;
          } else {
            response = lang === "ar"
              ? `فكرة رائعة! قلت: "${data.message.slice(0, 100)}". خلينا نشتغل عليها!`
              : `Great idea! You said: "${data.message.slice(0, 100)}". Let's work on it!`;
          }

          ws.send(JSON.stringify({ type: "response", message: response, context }));
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid request" }));
      }
    });
  });

  server.listen(port, () => {
    console.log(`🌐 OH Web Dashboard: http://localhost:${port}`);
  });
}
