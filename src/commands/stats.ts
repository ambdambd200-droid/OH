import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { ensureDir } from "../config/index.js";
import chalk from "chalk";

export interface Stats {
  totalCommands: number;
  totalChats: number;
  totalAgents: number;
  totalMemoryEntries: number;
  totalTokens: number;
  sessionsToday: number;
  commandsByType: Record<string, number>;
  dailyStats: Record<string, { commands: number; chats: number }>;
  uptime: number;
  lastStarted: string;
}

const STATS_PATH = join(homedir(), ".oh", "data", "stats.json");
const startTime = Date.now();

function readStats(): Stats {
  if (!existsSync(STATS_PATH)) {
    const initial: Stats = {
      totalCommands: 0,
      totalChats: 0,
      totalAgents: 0,
      totalMemoryEntries: 0,
      totalTokens: 0,
      sessionsToday: 0,
      commandsByType: {},
      dailyStats: {},
      uptime: 0,
      lastStarted: new Date().toISOString(),
    };
    return initial;
  }
  return JSON.parse(readFileSync(STATS_PATH, "utf-8"));
}

function writeStats(stats: Stats): void {
  ensureDir(join(homedir(), ".oh", "data"));
  writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), "utf-8");
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function trackCommand(command: string): void {
  const stats = readStats();
  stats.totalCommands++;
  stats.commandsByType[command] = (stats.commandsByType[command] || 0) + 1;
  const today = getTodayKey();
  if (!stats.dailyStats[today]) stats.dailyStats[today] = { commands: 0, chats: 0 };
  stats.dailyStats[today].commands++;
  writeStats(stats);
}

export function trackChat(): void {
  const stats = readStats();
  stats.totalChats++;
  const today = getTodayKey();
  if (!stats.dailyStats[today]) stats.dailyStats[today] = { commands: 0, chats: 0 };
  stats.dailyStats[today].chats++;
  writeStats(stats);
}

export function trackToken(count: number): void {
  const stats = readStats();
  stats.totalTokens += count;
  writeStats(stats);
}

export function getStats(): Stats {
  const stats = readStats();
  stats.uptime = Date.now() - startTime;
  return stats;
}

export function getStatsSummary(): string {
  const stats = getStats();
  const uptimeMs = stats.uptime;
  const uptimeStr = uptimeMs < 60000
    ? `${Math.floor(uptimeMs / 1000)}s`
    : uptimeMs < 3600000
      ? `${Math.floor(uptimeMs / 60000)}m ${Math.floor((uptimeMs % 60000) / 1000)}s`
      : `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`;

  const topCmds = Object.entries(stats.commandsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const lines: string[] = [];
  lines.push(chalk.hex("#8B5CF6").bold("\n  Usage Statistics\n"));
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} Commands:     ${chalk.hex("#F8FAFC")(String(stats.totalCommands))}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} Chats:        ${chalk.hex("#F8FAFC")(String(stats.totalChats))}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} Agents:       ${chalk.hex("#F8FAFC")(String(stats.totalAgents))}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} Memory:       ${chalk.hex("#F8FAFC")(String(stats.totalMemoryEntries))} entries`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} Tokens:       ${chalk.hex("#F8FAFC")(String(stats.totalTokens))}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} Uptime:       ${chalk.hex("#F8FAFC")(uptimeStr)}`);

  if (topCmds.length > 0) {
    lines.push(`\n  ${chalk.hex("#8B5CF6").bold("Top Commands:")}`);
    for (const [cmd, count] of topCmds) {
      lines.push(`    ${chalk.hex("#94A3B8")(cmd)}: ${chalk.hex("#F8FAFC")(String(count))}`);
    }
  }

  const today = getTodayKey();
  const td = stats.dailyStats[today];
  if (td) {
    lines.push(`\n  ${chalk.hex("#8B5CF6").bold("Today:")}`);
    lines.push(`    ${chalk.hex("#94A3B8")("Commands:")} ${chalk.hex("#F8FAFC")(String(td.commands))}`);
    lines.push(`    ${chalk.hex("#94A3B8")("Chats:")}    ${chalk.hex("#F8FAFC")(String(td.chats))}`);
  }

  lines.push(`\n  ${chalk.hex("#64748B")(`Last started: ${stats.lastStarted.slice(0, 19).replace("T", " ")}`)}\n`);
  return lines.join("\n");
}
