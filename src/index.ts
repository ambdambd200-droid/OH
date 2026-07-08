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
import { listFreeModels } from "./proxy/index.js";
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
    .command("models", "List free models", () => {}, () => {
      showBanner();
      console.log(chalk.hex("#8B5CF6").bold("\n  Free Models:\n"));
      for (const model of listFreeModels()) {
        console.log(`  ${chalk.hex("#F8FAFC")("•")} ${chalk.hex("#94A3B8")(model)}`);
      }
      console.log();
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
