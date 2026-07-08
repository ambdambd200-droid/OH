#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { readFileSync } from "fs";
import { showBanner } from "./cli/banner.js";
import { showHelp } from "./cli/help.js";
import { loadConfig, saveConfig, getConfig, setConfig } from "./config/index.js";
import { setLang, getLang, t } from "./i18n/index.js";
import { chat } from "./commands/chat.js";
import { createAgent, listAgents, deleteAgent, runAgent } from "./commands/agent.js";
import { cmdMemoryStore, cmdMemoryGet, cmdMemorySearch, cmdMemoryClear, cmdMemoryExport } from "./commands/memory.js";
import { showStatus } from "./utils/index.js";
import { askQuestion } from "./utils/index.js";
import { auditLog } from "./security/index.js";
import { listFreeModels, MODELS, getModelsByCategory, searchModels, getModelById } from "./proxy/index.js";
import type { ModelCategory } from "./proxy/index.js";
import { startTUI } from "./tui/index.js";
import { startWebServer } from "./web/index.js";
import { createSession, listSessions, getSession, deleteSession, exportSession, importSession } from "./commands/session.js";
import { getTemplates, getTemplate, applyTemplate, searchTemplates } from "./commands/templates.js";
import { showProfile, showLeaderboard, addCommand } from "./game/index.js";
import { getStatsSummary, trackCommand } from "./commands/stats.js";
import { cmdSearch } from "./commands/search.js";
import { systemInfo, checkUpdate, cleanCache, exportAll, doctor } from "./commands/system.js";

loadConfig();
setLang(getConfig().lang);

function main() {
  yargs(hideBin(process.argv))
    .scriptName("oh")
    .version(`2.0.0`)
    .command(
      "$0",
      "Launch interactive mode",
      () => {},
      async () => {
        showBanner();
        console.log(chalk.hex("#A78BFA")(`  ${t().welcome}`));
        await interactiveMode();
      }
    )
    .command("chat [message]", "Chat with OH", (y) =>
      y.positional("message", { type: "string", demandOption: false })
    , (argv) => {
      showBanner();
      if (argv.message) {
        chat(argv.message);
      } else {
        interactiveMode();
      }
    })
    .command("create <name> [description]", "Create an agent", (y) => {
      y.positional("name", { type: "string", demandOption: true });
      y.positional("description", { type: "string", default: "My OH agent" });
    }, (argv) => {
      showBanner();
      createAgent(argv.name as string, argv.description as string);
    })
    .command("list", "List all agents", () => {}, () => {
      showBanner();
      listAgents();
    })
    .command("run <name>", "Run an agent", (y) =>
      y.positional("name", { type: "string", demandOption: true })
    , (argv) => {
      showBanner();
      runAgent(argv.name as string);
    })
    .command("delete <name>", "Delete an agent", (y) =>
      y.positional("name", { type: "string", demandOption: true })
    , (argv) => {
      showBanner();
      deleteAgent(argv.name as string);
    })
    .command("memory", "Memory operations", (y) =>
      y
        .command("store <key> <value>", "Store in memory", () => {}, (argv) => {
          cmdMemoryStore(argv.key as string, argv.value as string);
        })
        .command("get <key>", "Get from memory", () => {}, (argv) => {
          cmdMemoryGet(argv.key as string);
        })
        .command("search <query>", "Search memory", () => {}, (argv) => {
          cmdMemorySearch(argv.query as string);
        })
        .command("clear", "Clear memory", () => {}, () => {
          cmdMemoryClear();
        })
        .command("export", "Export memory", () => {}, () => {
          cmdMemoryExport();
        })
        .demandCommand(1, "Specify a memory subcommand")
    )
    .command("config", "Configuration", (y) =>
      y
        .command("set <key> <value>", "Set config", () => {}, (argv) => {
          setConfig(argv.key as any, argv.value as any);
          console.log(chalk.hex("#10B981")(`  ✅ Config set: ${argv.key} = ${argv.value}`));
        })
        .command("get [key]", "Get config", () => {}, (argv) => {
          const cfg = getConfig();
          if (argv.key) {
            console.log(chalk.hex("#06B6D4")(`  ${argv.key}: ${(cfg as any)[argv.key as string]}`));
          } else {
            console.log(chalk.hex("#8B5CF6").bold("\n  Config:\n"));
            for (const [k, v] of Object.entries(cfg)) {
              console.log(`  ${chalk.hex("#F8FAFC").bold(k)}: ${chalk.hex("#94A3B8")(v)}`);
            }
            console.log();
          }
        })
        .command("list", "List all config", () => {}, () => {
          const cfg = getConfig();
          console.log(chalk.hex("#8B5CF6").bold("\n  Config:\n"));
          for (const [k, v] of Object.entries(cfg)) {
            console.log(`  ${chalk.hex("#F8FAFC").bold(k)}: ${chalk.hex("#94A3B8")(v)}`);
          }
          console.log();
        })
        .demandCommand(1, "Specify a config subcommand")
    )
    .command("lang <language>", "Set language (en/ar)", (y) =>
      y.positional("language", { type: "string", choices: ["en", "ar"] as const, demandOption: true })
    , (argv) => {
      const lang = argv.language as "en" | "ar";
      setLang(lang);
      setConfig("lang", lang);
      showBanner();
      console.log(chalk.hex("#10B981")(`  ✅ Language set to: ${lang === "ar" ? "العربية" : "English"}`));
    })
    .command("model [name]", "Show or switch the active model", (y) =>
      y.positional("name", { type: "string" })
    , (argv) => {
      showBanner();
      const lang = getLang();
      if (argv.name) {
        const model = getModelById(argv.name as string);
        if (!model) {
          console.log(chalk.hex("#F43F5E")(`\n  ❌ ${lang === "ar" ? `موديل "${argv.name}" غير موجود` : `Model "${argv.name}" not found`}\n`));
          return;
        }
        setConfig("model", model.id);
        console.log(chalk.hex("#10B981")(`\n  ✅ ${lang === "ar" ? `تم التبديل إلى ${model.name}` : `Switched to ${model.name}`}\n`));
        console.log(`  ${chalk.hex("#94A3B8")(model.provider)} | ${chalk.hex("#06B6D4")(model.params || "")} ${chalk.hex("#64748B")(model.context ? `| ${(model.context / 1000).toFixed(0)}K context` : "")}`);
        console.log(`  ${chalk.hex("#6B7280")(model.description)}`);
        console.log();
        return;
      }
      const currentId = getConfig().model;
      const current = getModelById(currentId);
      if (current) {
        const catLabel = current.category === "chinese" ? (lang === "ar" ? "صيني" : "Chinese")
          : current.category === "american" ? (lang === "ar" ? "أمريكي" : "American")
          : "OpenRouter";
        console.log(chalk.hex("#8B5CF6").bold(`\n  ${lang === "ar" ? "النموذج الحالي" : "Current Model"}\n`));
        console.log(`  ${chalk.hex("#10B981")("◉")} ${chalk.hex("#F8FAFC").bold(current.name)}`);
        console.log(`    ${chalk.hex("#94A3B8")(current.provider)} | ${chalk.hex("#06B6D4")(catLabel)}${current.free ? chalk.hex("#10B981")(" FREE") : ""}`);
        console.log(`    ${chalk.hex("#64748B")(current.params ? `Parameters: ${current.params}` : "")}${current.paramsActive ? ` (active: ${current.paramsActive})` : ""}`);
        console.log(`    ${chalk.hex("#64748B")(current.context ? `Context: ${(current.context / 1000).toFixed(0)}K tokens` : "")}`);
        console.log(`    ${chalk.hex("#6B7280")(current.description)}`);
        console.log(`    ${chalk.hex("#374151")(`ID: ${current.id}`)}`);
        console.log();
        console.log(`  ${chalk.hex("#64748B")(lang === "ar" ? "🔀 غيّر الموديل: oh model <id>" : "🔀 Switch: oh model <id>")}`);
        console.log(`  ${chalk.hex("#64748B")(lang === "ar" ? "📋 استعرض: oh models" : "📋 Browse: oh models")}\n`);
      }
    })
    .command("models [category]", "List models (chinese / american / openrouter / all)", (y) =>
      y.positional("category", { type: "string", choices: ["chinese", "american", "openrouter", "all", "ar", "en"] as const })
    , (argv) => {
      showBanner();
      const cat = argv.category as string | undefined;
      trackCommand("models");
      let models = MODELS;
      if (cat === "chinese") models = getModelsByCategory("chinese");
      else if (cat === "american") models = getModelsByCategory("american");
      else if (cat === "openrouter") models = getModelsByCategory("openrouter");

      const lang = getLang();
      const catLabel = cat
        ? (cat === "chinese" ? (lang === "ar" ? "صينية" : "Chinese")
          : cat === "american" ? (lang === "ar" ? "أمريكية" : "American")
          : cat === "openrouter" ? (lang === "ar" ? "OpenRouter" : "OpenRouter")
          : lang === "ar" ? "جميع" : "All")
        : (lang === "ar" ? "جميع" : "All");

      const freeCount = models.filter(m => m.free).length;

      console.log(chalk.hex("#8B5CF6").bold(`\n  ${lang === "ar" ? `🧠 النماذج ${catLabel}` : `🧠 ${catLabel} Models`}    (${models.length} ${lang === "ar" ? "نموذج" : "models"}, ${freeCount} ${lang === "ar" ? "مجاني" : "free"})\n`));

      console.log(`  ${chalk.hex("#64748B")(lang === "ar" ? "اختر موديل: oh config set model <id>" : "Set model: oh config set model <id>")}`);
      console.log(`  ${chalk.hex("#64748B")(lang === "ar" ? "تصفّح: oh models chinese | american | openrouter | all" : "Browse: oh models chinese | american | openrouter | all")}\n`);

      const currentModelId = getConfig().model;
      const grouped = new Map<string, typeof MODELS>();
      for (const m of models) {
        const p = grouped.get(m.provider) || [];
        p.push(m);
        grouped.set(m.provider, p);
      }

      for (const [provider, items] of grouped) {
        console.log(`  ${chalk.hex("#06B6D4").bold(provider)}`);
        for (const m of items) {
          const isCurrent = m.id === currentModelId;
          const marker = isCurrent ? chalk.hex("#10B981")("◉") : chalk.hex("#64748B")("○");
          const name = isCurrent ? chalk.hex("#10B981").bold(m.name) : chalk.hex("#F8FAFC")(m.name);
          const freeTag = m.free ? chalk.hex("#10B981")(` ${lang === "ar" ? "مجاناً" : "FREE"}`) : "";
          const specs = [
            m.params ? chalk.hex("#64748B")(m.params) : "",
            m.paramsActive ? chalk.hex("#64748B")(`(active: ${m.paramsActive})`) : "",
            m.context ? chalk.hex("#64748B")(`${(m.context / 1000).toFixed(0)}K`) : "",
          ].filter(Boolean).join(" ");
          console.log(`  ${marker} ${name}${freeTag}`);
          if (specs) console.log(`    ${chalk.hex("#4B5563")("└")} ${specs}`);
          console.log(`    ${chalk.hex("#4B5563")("└")} ${chalk.hex("#6B7280")(m.description.slice(0, 100))}`);
          console.log(`    ${chalk.hex("#4B5563")("└")} ${chalk.hex("#374151")(m.capabilities.join(", "))}`);
        }
        console.log();
      }
      console.log(`  ${chalk.hex("#64748B")(lang === "ar" ? `💡 جرب: oh search-model "${cat || ""}"` : `💡 Try: oh search-model "<name>"`)}\n`);
    })
    .command("search-model <query>", "Search models by name, provider, or keyword", (y) =>
      y.positional("query", { type: "string", demandOption: true })
    , (argv) => {
      showBanner();
      trackCommand("search-model");
      const query = argv.query as string;
      const results = searchModels(query);
      const lang = getLang();
      if (results.length === 0) {
        console.log(chalk.hex("#64748B")(`\n  ${lang === "ar" ? `لا توجد نتائج لـ "${query}"` : `No models found for "${query}"`}\n`));
        return;
      }
      console.log(chalk.hex("#8B5CF6").bold(`\n  ${lang === "ar" ? `نتائج البحث عن "${query}"` : `Search results for "${query}"`} (${results.length})\n`));
      for (const m of results) {
        const catLabel = m.category === "chinese" ? (lang === "ar" ? "صيني" : "Chinese")
          : m.category === "american" ? (lang === "ar" ? "أمريكي" : "American")
          : "OpenRouter";
        const freeTag = m.free ? chalk.hex("#10B981")(` ${lang === "ar" ? "مجاناً" : "FREE"}`) : "";
        console.log(`  ${chalk.hex("#F8FAFC").bold(m.name)}${freeTag}`);
        console.log(`    ${chalk.hex("#94A3B8")(m.provider)} | ${chalk.hex("#06B6D4")(catLabel)}`);
        if (m.params) console.log(`    ${chalk.hex("#64748B")(m.params)}${m.paramsActive ? ` (active: ${m.paramsActive})` : ""}`);
        console.log(`    ${chalk.hex("#6B7280")(m.description)}`);
        console.log(`    ${chalk.hex("#374151")(`ID: ${m.id}`)}`);
        console.log();
      }
      console.log(`  ${chalk.hex("#64748B")(lang === "ar" ? `💡 استخدم: oh config set model ${results[0]?.id || "<id>"}` : `💡 Set it: oh config set model ${results[0]?.id || "<id>"}`)}\n`);
    })
    .command("status", "System status", () => {}, () => {
      showBanner();
      showStatus();
    })
    .command("tui", "Launch Terminal User Interface", () => {}, () => {
      startTUI();
    })
    .command("ui", "Launch Terminal User Interface (alias)", () => {}, () => {
      startTUI();
    })
    .command("web", "Launch web dashboard", () => {}, () => {
      startWebServer();
    })
    .command("dashboard", "Launch web dashboard (alias)", () => {}, () => {
      startWebServer();
    })
    .command("session", "Session management", (y) =>
      y
        .command("create <name>", "Create a new session", () => {}, (argv) => {
          showBanner();
          createSession(argv.name as string);
        })
        .command("list", "List all sessions", () => {}, () => {
          showBanner();
          listSessions();
        })
        .command("export <id>", "Export session as JSON", () => {}, (argv) => {
          showBanner();
          exportSession(argv.id as string);
        })
        .command("import <file>", "Import session from JSON", () => {}, (argv) => {
          showBanner();
          const json = readFileSync(argv.file as string, "utf-8");
          importSession(json);
        })
        .command("delete <id>", "Delete a session", () => {}, (argv) => {
          showBanner();
          deleteSession(argv.id as string);
        })
        .demandCommand(1, "Specify a session subcommand")
    )
    .command("templates", "Agent templates", (y) =>
      y
        .command("$0", "List all templates", () => {}, () => {
          showBanner();
          const templates = getTemplates();
          console.log(chalk.hex("#8B5CF6").bold("\n  Agent Templates:\n"));
          for (const t of templates) {
            console.log(`  ${t.icon} ${chalk.hex("#F8FAFC").bold(t.name)}`);
            console.log(`    ${chalk.hex("#94A3B8")(t.description)}`);
            console.log(`    ${chalk.hex("#64748B")(`ID: ${t.id} | ${t.category}`)}`);
            console.log();
          }
        })
        .command("search <query>", "Search templates", () => {}, (argv) => {
          showBanner();
          const results = searchTemplates(argv.query as string);
          if (results.length === 0) {
            console.log(chalk.hex("#64748B")("  No templates found"));
            return;
          }
          console.log(chalk.hex("#8B5CF6").bold(`\n  Templates matching "${argv.query}":\n`));
          for (const t of results) {
            console.log(`  ${t.icon} ${chalk.hex("#F8FAFC").bold(t.name)}`);
            console.log(`    ${chalk.hex("#64748B")(`ID: ${t.id} | ${t.category}`)}`);
            console.log();
          }
        })
        .command("apply <id> <name>", "Create agent from template", () => {}, (argv) => {
          showBanner();
          applyTemplate(argv.id as string, argv.name as string);
        })
        .demandCommand(0, "")
    )
    .command("profile", "Show your gamification profile", () => {}, () => {
      showBanner();
      showProfile();
    })
    .command("leaderboard", "Show leaderboard", () => {}, () => {
      showBanner();
      showLeaderboard();
    })
    .command("stats", "Show usage statistics", () => {}, () => {
      showBanner();
      trackCommand("stats");
      console.log(getStatsSummary());
    })
    .command("search <query>", "Search everything (memory, agents, templates)", (y) =>
      y.positional("query", { type: "string", demandOption: true })
    , (argv) => {
      showBanner();
      trackCommand("search");
      cmdSearch(argv.query as string);
    })
    .command("system", "System commands", (y) =>
      y
        .command("info", "Show system information", () => {}, () => {
          showBanner();
          trackCommand("system-info");
          console.log(systemInfo());
        })
        .demandCommand(1, "Specify a system subcommand")
    )
    .command("doctor", "Run diagnostics", () => {}, () => {
      showBanner();
      trackCommand("doctor");
      const result = doctor();
      if (result.healthy) {
        console.log(chalk.hex("#10B981")("\n  ✅ All systems healthy\n"));
      } else {
        console.log(chalk.hex("#F43F5E")(`\n  ❌ Found ${result.issues.length} issue(s):\n`));
        for (const issue of result.issues) {
          console.log(`  ${chalk.hex("#F43F5E")("•")} ${chalk.hex("#94A3B8")(issue)}`);
        }
        console.log();
      }
    })
    .command("clean", "Clean cache", () => {}, () => {
      showBanner();
      trackCommand("clean");
      const bytes = cleanCache();
      const mb = (bytes / 1024 / 1024).toFixed(2);
      console.log(chalk.hex("#10B981")(`\n  ✅ Cleaned ${mb} MB\n`));
    })
    .command("help", "Show help", () => {}, () => {
      showBanner();
      showHelp();
    })
    .demandCommand(0, "")
    .strict(false)
    .parse();
}

async function interactiveMode() {
  console.log(chalk.hex("#64748B")(`  ${t().prompt}`));
  console.log(chalk.hex("#64748B")(`  ${getLang() === "ar" ? "اكتب خروج للخروج" : 'Type "exit" to quit'}`));
  console.log();

  while (true) {
    const input = await askQuestion("oh>");
    if (!input) continue;
    if (input.toLowerCase() === "exit" || input === "خروج") {
      console.log(chalk.hex("#8B5CF6")(`\n  ${t().goodbye} 👋\n`));
      break;
    }
    if (input.toLowerCase() === "help" || input === "مساعدة") {
      showHelp();
      continue;
    }
    if (input.toLowerCase() === "status") {
      showStatus();
      continue;
    }
    if (input.toLowerCase() === "stats") {
      console.log(getStatsSummary());
      continue;
    }
    if (input.toLowerCase() === "models" || input === "نماذج") {
      const ll = getLang();
      console.log(chalk.hex("#8B5CF6").bold(`\n  🧠 ${ll === "ar" ? "النماذج المتاحة" : "Available Models"} (${MODELS.length}, ${MODELS.filter(m => m.free).length} ${ll === "ar" ? "مجاني" : "free"})\n`));
      for (const m of MODELS) {
        const isCurrent = m.id === getConfig().model;
        const marker = isCurrent ? chalk.hex("#10B981")("◉") : chalk.hex("#64748B")("○");
        const name = isCurrent ? chalk.hex("#10B981").bold(m.name) : chalk.hex("#F8FAFC")(m.name);
        const flag = m.category === "chinese" ? "🇨🇳" : m.category === "american" ? "🇺🇸" : "🔷";
        console.log(`  ${marker} ${flag} ${name}${m.free ? chalk.hex("#10B981")(" FREE") : ""}`);
        console.log(`    ${chalk.hex("#6B7280")(m.description.slice(0, 80))}`);
      }
      console.log(`  ${chalk.hex("#64748B")(ll === "ar" ? "💡 غيّر: model <id>" : "💡 Switch: model <id>")}`);
      console.log();
      continue;
    }
    if (input.toLowerCase() === "model" || input === "موديل") {
      const currentId = getConfig().model;
      const current = getModelById(currentId);
      const ll = getLang();
      if (current) {
        console.log(chalk.hex("#10B981")(`\n  🧠 ${ll === "ar" ? "النموذج الحالي:" : "Current model:"} ${chalk.bold(current.name)}`));
        console.log(`  ${chalk.hex("#94A3B8")(`${current.provider} | ${current.params || ""} | ${current.context ? `${(current.context / 1000).toFixed(0)}K` : ""}`)}`);
        console.log();
      }
      continue;
    }
    if (input.toLowerCase().startsWith("model ") || input.startsWith("موديل ")) {
      const name = input.startsWith("موديل ") ? input.slice(5).trim() : input.slice(6).trim();
      const ll = getLang();
      const found = getModelById(name);
      if (found) {
        setConfig("model", found.id);
        console.log(chalk.hex("#10B981")(`\n  ✅ ${ll === "ar" ? `تم التبديل إلى ${found.name}` : `Switched to ${found.name}`}\n`));
      } else {
        console.log(chalk.hex("#F43F5E")(`\n  ❌ ${ll === "ar" ? "موديل غير موجود" : "Model not found"}\n`));
      }
      continue;
    }
    if (input.toLowerCase() === "doctor") {
      const result = doctor();
      if (result.healthy) {
        console.log(chalk.hex("#10B981")("\n  ✅ All systems healthy\n"));
      } else {
        console.log(chalk.hex("#F43F5E")(`\n  ❌ Found ${result.issues.length} issue(s):\n`));
        for (const issue of result.issues) {
          console.log(`  ${chalk.hex("#F43F5E")("•")} ${chalk.hex("#94A3B8")(issue)}`);
        }
        console.log();
      }
      continue;
    }
    if (input.toLowerCase() === "clean") {
      const bytes = cleanCache();
      const mb = (bytes / 1024 / 1024).toFixed(2);
      console.log(chalk.hex("#10B981")(`\n  ✅ Cleaned ${mb} MB\n`));
      continue;
    }
    if (input.toLowerCase().startsWith("search ")) {
      const query = input.slice(7);
      cmdSearch(query);
      continue;
    }
    auditLog("INTERACTIVE", input.slice(0, 200));
    chat(input);
  }
}

main();
