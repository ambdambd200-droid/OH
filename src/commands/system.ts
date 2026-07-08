import { execSync } from "child_process";
import { cpus, totalmem, freemem, platform, release, hostname, uptime, homedir } from "os";
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { getConfig } from "../config/index.js";
import chalk from "chalk";
import { readFile } from "fs/promises";

export function systemInfo(): string {
  const memTotal = (totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const memFree = (freemem() / 1024 / 1024 / 1024).toFixed(1);
  const cpuModel = cpus()[0]?.model || "unknown";
  const cpuCores = cpus().length;
  const sysUptime = Math.floor(uptime());

  const days = Math.floor(sysUptime / 86400);
  const hours = Math.floor((sysUptime % 86400) / 3600);
  const mins = Math.floor((sysUptime % 3600) / 60);

  const lines: string[] = [];
  lines.push(chalk.hex("#8B5CF6").bold("\n  System Information\n"));
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("Hostname:")}    ${chalk.hex("#F8FAFC")(hostname())}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("Platform:")}    ${chalk.hex("#F8FAFC")(`${platform()} ${release()}`)}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("CPU:")}          ${chalk.hex("#F8FAFC")(cpuModel)} (${cpuCores} cores)`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("Memory:")}      ${chalk.hex("#F8FAFC")(`${memFree}GB / ${memTotal}GB free`)}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("Uptime:")}      ${chalk.hex("#F8FAFC")(`${days}d ${hours}h ${mins}m`)}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("Home:")}        ${chalk.hex("#F8FAFC")(homedir())}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("Node:")}        ${chalk.hex("#F8FAFC")(process.version)}`);
  lines.push(`  ${chalk.hex("#06B6D4")("▸")} ${chalk.hex("#94A3B8")("Data Dir:")}    ${chalk.hex("#F8FAFC")(getConfig().dataDir)}`);
  lines.push("\n");
  return lines.join("\n");
}

export async function checkUpdate(): Promise<{ current: string; latest: string; hasUpdate: boolean }> {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
  const current = pkg.version;

  let latest = current;
  let hasUpdate = false;

  try {
    const result = execSync("npm view oh version 2>nul || echo 0", { encoding: "utf-8" }).trim();
    if (result && result !== "0") {
      latest = result;
      hasUpdate = result !== current;
    }
  } catch {
    latest = current;
  }

  return { current, latest, hasUpdate };
}

export function cleanCache(): number {
  const dataDir = getConfig().dataDir;
  let cleaned = 0;

  const cacheDir = join(dataDir, "cache");
  if (existsSync(cacheDir)) {
    const files = readdirSync(cacheDir);
    for (const file of files) {
      const fpath = join(cacheDir, file);
      try {
        const stat = readFileSync(fpath);
        cleaned += stat.length;
        rmSync(fpath);
      } catch { }
    }
  }

  const proxyCache = join(dataDir, "proxy-cache.json");
  if (existsSync(proxyCache)) {
    cleaned += readFileSync(proxyCache).length;
    writeFileSync(proxyCache, JSON.stringify({}), "utf-8");
  }

  return cleaned;
}

export function exportAll(): string {
  const dataDir = getConfig().dataDir;
  const data: Record<string, unknown> = {};

  const files = ["memory.json", "config.json", "graph.json", "secrets.json", "stats.json"];
  for (const file of files) {
    const fpath = join(dataDir, file);
    if (existsSync(fpath)) {
      try {
        data[file.replace(".json", "")] = JSON.parse(readFileSync(fpath, "utf-8"));
      } catch {
        data[file.replace(".json", "")] = null;
      }
    }
  }

  data["system"] = {
    platform: platform(),
    release: release(),
    hostname: hostname(),
    node: process.version,
    uptime: uptime(),
    memory: { total: totalmem(), free: freemem() },
  };

  return JSON.stringify(data, null, 2);
}

export function doctor(): { healthy: boolean; issues: string[] } {
  const issues: string[] = [];

  try {
    const { getConfig: cfg } = require("../config/index.js");
    cfg();
  } catch {
    issues.push("Config module failed to load");
  }

  const dataDir = getConfig().dataDir;
  if (!existsSync(dataDir)) {
    issues.push(`Data directory missing: ${dataDir}`);
  }

  const memPath = join(dataDir, "memory.json");
  if (!existsSync(memPath)) {
    issues.push("Memory store is empty (no data found)");
  }

  const nodeMajor = parseInt(process.version.slice(1).split(".")[0], 10);
  if (nodeMajor < 18) {
    issues.push(`Node.js ${process.version} is below minimum required v18`);
  }

  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    for (const dep of Object.keys(pkg.dependencies || {})) {
      try {
        require.resolve(dep, { paths: [process.cwd()] });
      } catch {
        issues.push(`Dependency missing: ${dep}`);
      }
    }
  } catch {
    issues.push("Cannot read package.json");
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}
