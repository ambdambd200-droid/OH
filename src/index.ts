#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
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
    auditLog("INTERACTIVE", input.slice(0, 200));
    chat(input);
  }
}

main();
