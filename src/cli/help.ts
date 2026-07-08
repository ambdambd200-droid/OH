import chalk from "chalk";
import { t, getLang } from "../i18n/index.js";

interface HelpSection {
  title: string;
  commands: { cmd: string; desc: string }[];
}

const sections: HelpSection[] = [
  {
    title: "Core",
    commands: [
      { cmd: "oh", desc: "Interactive mode" },
      { cmd: "oh chat <message>", desc: "Chat with OH" },
      { cmd: "oh help", desc: "Show this help" },
    ],
  },
  {
    title: "Models",
    commands: [
      { cmd: "oh model [id]", desc: "Show/switch AI model" },
      { cmd: "oh models [cat]", desc: "List models (chinese/american/all)" },
      { cmd: "oh search-model <q>", desc: "Search models by name/provider" },
    ],
  },
  {
    title: "Agent",
    commands: [
      { cmd: "oh create <name>", desc: "Create a new agent" },
      { cmd: "oh list", desc: "List all agents" },
      { cmd: "oh run <name>", desc: "Run an agent" },
      { cmd: "oh delete <name>", desc: "Delete an agent" },
    ],
  },
  {
    title: "Memory",
    commands: [
      { cmd: "oh memory store <key> <value>", desc: "Store in memory" },
      { cmd: "oh memory get <key>", desc: "Get from memory" },
      { cmd: "oh memory search <query>", desc: "Search memory" },
      { cmd: "oh memory clear", desc: "Clear all memory" },
    ],
  },
  {
    title: "Config",
    commands: [
      { cmd: "oh config set <key> <value>", desc: "Set config" },
      { cmd: "oh config get <key>", desc: "Get config" },
      { cmd: "oh config list", desc: "List all config" },
      { cmd: "oh lang <en|ar>", desc: "Set language" },
    ],
  },
  {
    title: "System",
    commands: [
      { cmd: "oh status", desc: "System status" },
      { cmd: "oh stats", desc: "Usage statistics" },
      { cmd: "oh search <query>", desc: "Search everything" },
      { cmd: "oh system info", desc: "System information" },
      { cmd: "oh doctor", desc: "Run diagnostics" },
      { cmd: "oh clean", desc: "Clean cache" },
      { cmd: "oh version", desc: "Show version" },
    ],
  },
];

export function showHelp(): void {
  const lang = getLang();
  console.log(chalk.hex("#8B5CF6").bold(`\n  ${lang === "ar" ? "الأوامر المتاحة" : "Available Commands"}\n`));
  for (const section of sections) {
    console.log(chalk.hex("#06B6D4").bold(`  ┌─ ${section.title}`));
    for (const cmd of section.commands) {
      console.log(`  │ ${chalk.hex("#F8FAFC")(cmd.cmd.padEnd(30))} ${chalk.hex("#94A3B8")(cmd.desc)}`);
    }
    console.log(`  └${"─".repeat(50)}\n`);
  }
}
