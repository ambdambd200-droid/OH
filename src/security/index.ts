import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";

const BLOCKED_COMMANDS = ["rm -rf", "del /f", "format", "shutdown", "rd /s"];

export function isSafeCommand(input: string): { safe: boolean; reason?: string } {
  for (const blocked of BLOCKED_COMMANDS) {
    if (input.toLowerCase().includes(blocked)) {
      return { safe: false, reason: `Blocked dangerous command: ${blocked}` };
    }
  }
  return { safe: true };
}

export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function auditLog(action: string, details: string): void {
  const logDir = join(getConfig().dataDir, "audit");
  ensureDir(logDir);
  const logFile = join(logDir, `audit-${new Date().toISOString().split("T")[0]}.log`);
  const entry = `[${new Date().toISOString()}] ${action}: ${details}\n`;
  appendFileSync(logFile, entry, "utf-8");
}

interface Secret {
  key: string;
  value: string;
  createdAt: string;
}

export function storeSecret(key: string, value: string): void {
  const secretsPath = join(getConfig().dataDir, "secrets.json");
  let secrets: Secret[] = [];
  if (existsSync(secretsPath)) {
    secrets = JSON.parse(readFileSync(secretsPath, "utf-8"));
  }
  const existing = secrets.findIndex((s) => s.key === key);
  const entry: Secret = { key, value: hashString(value), createdAt: new Date().toISOString() };
  if (existing >= 0) secrets[existing] = entry;
  else secrets.push(entry);
  writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), "utf-8");
}
