import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getConfig } from "../config/index.js";
import chalk from "chalk";

export interface SearchResult {
  type: 'memory' | 'agent' | 'template' | 'command';
  title: string;
  description: string;
  relevance: number;
}

interface MemoryEntry {
  key: string;
  value: string;
  timestamp: number;
}

interface AgentEntry {
  name: string;
  description: string;
  model: string;
  status: string;
}

const COMMANDS = [
  { cmd: "chat", desc: "Chat with OH" },
  { cmd: "create", desc: "Create an agent" },
  { cmd: "list", desc: "List agents" },
  { cmd: "run", desc: "Run an agent" },
  { cmd: "delete", desc: "Delete an agent" },
  { cmd: "memory store", desc: "Store in memory" },
  { cmd: "memory get", desc: "Get from memory" },
  { cmd: "memory search", desc: "Search memory" },
  { cmd: "memory clear", desc: "Clear memory" },
  { cmd: "config set", desc: "Set config value" },
  { cmd: "config get", desc: "Get config value" },
  { cmd: "config list", desc: "List all config" },
  { cmd: "lang", desc: "Set language" },
  { cmd: "models", desc: "List free models" },
  { cmd: "status", desc: "System status" },
  { cmd: "tui", desc: "Launch TUI" },
  { cmd: "search", desc: "Unified search" },
  { cmd: "stats", desc: "Usage statistics" },
  { cmd: "system info", desc: "System information" },
  { cmd: "doctor", desc: "Run diagnostics" },
  { cmd: "clean", desc: "Clean cache" },
];

const TEMPLATES = [
  { name: "chat-bot", desc: "General purpose chatbot" },
  { name: "code-assistant", desc: "Code generation and review" },
  { name: "translator", desc: "Translation agent" },
  { name: "summarizer", desc: "Text summarization" },
  { name: "data-analyzer", desc: "Data analysis and insights" },
];

function relevanceScore(text: string, query: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;

  if (t === q) return 1;
  if (t.includes(q)) score += 0.5;
  if (q.includes(t)) score += 0.3;

  const queryWords = q.split(/\s+/);
  const textWords = t.split(/\s+/);
  const matches = queryWords.filter((w) => textWords.includes(w)).length;
  score += matches / Math.max(queryWords.length, 1) * 0.5;

  return Math.min(score, 1);
}

function searchMemory(query: string, results: SearchResult[]): void {
  if (!getConfig) return;
  const memPath = join(getConfig().dataDir, "memory.json");
  if (!existsSync(memPath)) return;

  try {
    const entries: MemoryEntry[] = JSON.parse(readFileSync(memPath, "utf-8"));
    for (const entry of entries) {
      const relevance = Math.max(
        relevanceScore(entry.key, query),
        relevanceScore(entry.value, query)
      );
      if (relevance > 0.2) {
        results.push({
          type: "memory",
          title: entry.key,
          description: entry.value.slice(0, 120),
          relevance,
        });
      }
    }
  } catch { }
}

function searchAgents(query: string, results: SearchResult[]): void {
  const agentsPath = join(homedir(), ".oh", "agents.json");
  if (!existsSync(agentsPath)) return;

  try {
    const entries: Record<string, AgentEntry> = JSON.parse(readFileSync(agentsPath, "utf-8"));
    for (const [, agent] of Object.entries(entries)) {
      const relevance = Math.max(
        relevanceScore(agent.name, query),
        relevanceScore(agent.description, query)
      );
      if (relevance > 0.2) {
        results.push({
          type: "agent",
          title: agent.name,
          description: agent.description.slice(0, 120),
          relevance,
        });
      }
    }
  } catch { }
}

function searchTemplates(query: string, results: SearchResult[]): void {
  for (const tmpl of TEMPLATES) {
    const relevance = Math.max(
      relevanceScore(tmpl.name, query),
      relevanceScore(tmpl.desc, query)
    );
    if (relevance > 0.2) {
      results.push({
        type: "template",
        title: tmpl.name,
        description: tmpl.desc,
        relevance,
      });
    }
  }
}

function searchCommands(query: string, results: SearchResult[]): void {
  for (const cmd of COMMANDS) {
    const relevance = Math.max(
      relevanceScore(cmd.cmd, query),
      relevanceScore(cmd.desc, query)
    );
    if (relevance > 0.2) {
      results.push({
        type: "command",
        title: cmd.cmd,
        description: cmd.desc,
        relevance,
      });
    }
  }
}

export function unifiedSearch(query: string): SearchResult[] {
  const results: SearchResult[] = [];

  searchMemory(query, results);
  searchAgents(query, results);
  searchTemplates(query, results);
  searchCommands(query, results);

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 20);
}

export function cmdSearch(query: string): void {
  const results = unifiedSearch(query);

  if (results.length === 0) {
    console.log(chalk.hex("#64748B")("\n  No results found.\n"));
    return;
  }

  console.log(chalk.hex("#8B5CF6").bold(`\n  Search results for "${query}":\n`));

  const typeColors: Record<string, string> = {
    memory: "#06B6D4",
    agent: "#10B981",
    template: "#F59E0B",
    command: "#A78BFA",
  };

  for (const r of results) {
    const color = typeColors[r.type] || "#94A3B8";
    const badge = r.type.charAt(0).toUpperCase() + r.type.slice(1);
    console.log(`  ${chalk.hex(color)(`■ ${badge}`)} ${chalk.hex("#F8FAFC").bold(r.title)}`);
    console.log(`    ${chalk.hex("#94A3B8")(r.description)}`);
    console.log(`    ${chalk.hex("#64748B")(`relevance: ${(r.relevance * 100).toFixed(0)}%`)}\n`);
  }
}
