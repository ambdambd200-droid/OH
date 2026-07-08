import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { t } from "../i18n/index.js";
import { getConfig, ensureDir } from "../config/index.js";

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: { role: string; content: string }[];
}

const SESSIONS_FILE = "sessions.json";

function getSessionsPath(): string {
  const dataDir = getConfig().dataDir;
  ensureDir(dataDir);
  return join(dataDir, SESSIONS_FILE);
}

function readSessions(): Session[] {
  const path = getSessionsPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeSessions(sessions: Session[]): void {
  writeFileSync(getSessionsPath(), JSON.stringify(sessions, null, 2), "utf-8");
}

export function createSession(name: string): Session {
  const sessions = readSessions();
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session: Session = {
    id,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  sessions.push(session);
  writeSessions(sessions);
  console.log(chalk.hex("#10B981")(`  ✅ Session created: ${chalk.bold(name)} (${id})`));
  return session;
}

export function listSessions(): Session[] {
  const sessions = readSessions();
  if (sessions.length === 0) {
    console.log(chalk.hex("#64748B")("  No sessions yet. Use 'oh session create <name>' to create one."));
    return [];
  }
  console.log(chalk.hex("#8B5CF6").bold("\n  Sessions:\n"));
  for (const s of sessions) {
    const msgCount = s.messages.length;
    console.log(`  ${chalk.hex("#F8FAFC").bold(s.name)}`);
    console.log(`    ${chalk.hex("#94A3B8")(`ID: ${s.id}`)}`);
    console.log(`    ${chalk.hex("#64748B")(`Messages: ${msgCount} | Updated: ${s.updatedAt.slice(0, 10)}`)}`);
    console.log();
  }
  return sessions;
}

export function getSession(id: string): Session | null {
  const sessions = readSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export function deleteSession(id: string): void {
  const sessions = readSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) {
    console.log(chalk.hex("#F43F5E")(`  ❌ Session not found: ${id}`));
    return;
  }
  sessions.splice(idx, 1);
  writeSessions(sessions);
  console.log(chalk.hex("#10B981")(`  ✅ Session deleted: ${id}`));
}

export function addMessage(sessionId: string, role: string, content: string): void {
  const sessions = readSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    console.log(chalk.hex("#F43F5E")(`  ❌ Session not found: ${sessionId}`));
    return;
  }
  session.messages.push({ role, content });
  session.updatedAt = new Date().toISOString();
  writeSessions(sessions);
}

export function exportSession(id: string): string {
  const sessions = readSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session) {
    console.log(chalk.hex("#F43F5E")(`  ❌ Session not found: ${id}`));
    return "";
  }
  const json = JSON.stringify(session, null, 2);
  console.log(chalk.hex("#06B6D4")(json));
  return json;
}

export function importSession(json: string): Session {
  const session: Session = JSON.parse(json);
  if (!session.id || !session.name || !Array.isArray(session.messages)) {
    throw new Error("Invalid session JSON");
  }
  const sessions = readSessions();
  const existing = sessions.findIndex((s) => s.id === session.id);
  if (existing >= 0) {
    sessions[existing] = session;
  } else {
    sessions.push(session);
  }
  writeSessions(sessions);
  console.log(chalk.hex("#10B981")(`  ✅ Session imported: ${chalk.bold(session.name)}`));
  return session;
}
