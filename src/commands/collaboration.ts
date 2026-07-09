import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getConfig } from "../config/index.js";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer" | "commenter";
  color: string;
  joinedAt: Date;
  lastActive: Date;
  cursor?: { file: string; line: number; column: number };
  isOnline: boolean;
}

export interface CollaborationSession {
  id: string;
  agentId: string;
  name: string;
  owner: string;
  collaborators: Collaborator[];
  createdAt: Date;
  lastActivity: Date;
  permissions: { inherit: boolean; allowCopy: boolean; allowExport: boolean };
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  targetFile: string;
  targetLine: number;
  content: string;
  resolved: boolean;
  createdAt: Date;
  replies: Comment[];
}

export interface CollaborationEvent {
  type: "cursor" | "edit" | "comment" | "join" | "leave" | "deploy" | "sync";
  userId: string;
  data: any;
  timestamp: number;
}

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1",
];

const sessions = new Map<string, CollaborationSession>();
const comments = new Map<string, Comment[]>();
const events = new Map<string, CollaborationEvent[]>();

function getStoreDir(): string {
  return join(getConfig().dataDir, "collaboration");
}

function ensureStoreDir(): void {
  const dir = getStoreDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function persistSessions(): void {
  ensureStoreDir();
  const path = join(getStoreDir(), "sessions.json");
  writeFileSync(path, JSON.stringify(Array.from(sessions.values()), null, 2), "utf-8");
}

function loadSessions(): void {
  const path = join(getStoreDir(), "sessions.json");
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      for (const s of raw) {
        s.createdAt = new Date(s.createdAt);
        s.lastActivity = new Date(s.lastActivity);
        for (const c of s.collaborators) {
          c.joinedAt = new Date(c.joinedAt);
          c.lastActive = new Date(c.lastActive);
        }
        sessions.set(s.id, s);
      }
    } catch {}
  }
}

function persistComments(sessionId: string): void {
  ensureStoreDir();
  const path = join(getStoreDir(), `${sessionId}_comments.json`);
  writeFileSync(path, JSON.stringify(comments.get(sessionId) || [], null, 2), "utf-8");
}

function loadComments(sessionId: string): void {
  const path = join(getStoreDir(), `${sessionId}_comments.json`);
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      function reviveDates(c: Comment): void {
        c.createdAt = new Date(c.createdAt);
        for (const r of c.replies) reviveDates(r);
      }
      for (const c of raw) reviveDates(c);
      comments.set(sessionId, raw);
    } catch {}
  }
}

function persistEvents(sessionId: string): void {
  ensureStoreDir();
  const path = join(getStoreDir(), `${sessionId}_events.json`);
  writeFileSync(path, JSON.stringify(events.get(sessionId) || [], null, 2), "utf-8");
}

function loadEvents(sessionId: string): void {
  const path = join(getStoreDir(), `${sessionId}_events.json`);
  if (existsSync(path)) {
    try {
      events.set(sessionId, JSON.parse(readFileSync(path, "utf-8")));
    } catch {}
  }
}

let colorIndex = 0;
function nextColor(): string {
  return COLORS[colorIndex++ % COLORS.length];
}

export function createSession(agentId: string, name: string, ownerId: string): CollaborationSession {
  loadSessions();
  const session: CollaborationSession = {
    id: `${agentId}_${Date.now()}`,
    agentId,
    name,
    owner: ownerId,
    collaborators: [{
      id: ownerId,
      name: ownerId,
      email: "",
      role: "owner",
      color: nextColor(),
      joinedAt: new Date(),
      lastActive: new Date(),
      isOnline: true,
    }],
    createdAt: new Date(),
    lastActivity: new Date(),
    permissions: { inherit: true, allowCopy: false, allowExport: false },
  };
  sessions.set(session.id, session);
  persistSessions();
  comments.set(session.id, []);
  events.set(session.id, []);
  return session;
}

export function inviteCollaborator(sessionId: string, email: string, role: Collaborator["role"]): boolean {
  loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (session.collaborators.some(c => c.email === email)) return false;
  session.collaborators.push({
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: email.split("@")[0],
    email,
    role,
    color: nextColor(),
    joinedAt: new Date(),
    lastActive: new Date(),
    isOnline: false,
  });
  session.lastActivity = new Date();
  persistSessions();
  return true;
}

export function removeCollaborator(sessionId: string, userId: string): boolean {
  loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return false;
  const idx = session.collaborators.findIndex(c => c.id === userId);
  if (idx === -1) return false;
  if (session.collaborators[idx].role === "owner") return false;
  session.collaborators.splice(idx, 1);
  session.lastActivity = new Date();
  persistSessions();
  return true;
}

export function changeRole(sessionId: string, userId: string, role: Collaborator["role"]): boolean {
  loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return false;
  const collab = session.collaborators.find(c => c.id === userId);
  if (!collab) return false;
  if (collab.role === "owner") return role === "owner";
  collab.role = role;
  session.lastActivity = new Date();
  persistSessions();
  return true;
}

export function getSession(sessionId: string): CollaborationSession | null {
  loadSessions();
  return sessions.get(sessionId) || null;
}

export function listSessions(): CollaborationSession[] {
  loadSessions();
  return Array.from(sessions.values());
}

export function updatePresence(sessionId: string, userId: string, cursor?: { file: string; line: number; column: number }): void {
  loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return;
  const collab = session.collaborators.find(c => c.id === userId);
  if (!collab) return;
  collab.lastActive = new Date();
  collab.isOnline = true;
  if (cursor) collab.cursor = cursor;
  session.lastActivity = new Date();
  persistSessions();
}

export function addComment(sessionId: string, userId: string, file: string, line: number, content: string): Comment {
  loadComments(sessionId);
  const session = sessions.get(sessionId);
  const authorName = session?.collaborators.find(c => c.id === userId)?.name || userId;
  const comment: Comment = {
    id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    authorId: userId,
    authorName,
    targetFile: file,
    targetLine: line,
    content,
    resolved: false,
    createdAt: new Date(),
    replies: [],
  };
  const list = comments.get(sessionId) || [];
  list.push(comment);
  comments.set(sessionId, list);
  persistComments(sessionId);
  return comment;
}

export function replyToComment(sessionId: string, commentId: string, userId: string, content: string): Comment | null {
  loadComments(sessionId);
  const list = comments.get(sessionId);
  if (!list) return null;
  const session = sessions.get(sessionId);
  const authorName = session?.collaborators.find(c => c.id === userId)?.name || userId;
  function findParent(c: Comment): Comment | null {
    if (c.id === commentId) return c;
    for (const r of c.replies) {
      const found = findParent(r);
      if (found) return found;
    }
    return null;
  }
  for (const c of list) {
    const parent = findParent(c);
    if (parent) {
      const reply: Comment = {
        id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        authorId: userId,
        authorName,
        targetFile: parent.targetFile,
        targetLine: parent.targetLine,
        content,
        resolved: false,
        createdAt: new Date(),
        replies: [],
      };
      parent.replies.push(reply);
      persistComments(sessionId);
      return reply;
    }
  }
  return null;
}

export function resolveComment(sessionId: string, commentId: string, userId: string): boolean {
  loadComments(sessionId);
  const list = comments.get(sessionId);
  if (!list) return false;
  function findAndResolve(c: Comment): boolean {
    if (c.id === commentId) {
      c.resolved = true;
      return true;
    }
    for (const r of c.replies) {
      if (findAndResolve(r)) return true;
    }
    return false;
  }
  for (const c of list) {
    if (findAndResolve(c)) {
      persistComments(sessionId);
      return true;
    }
  }
  return false;
}

export function getComments(sessionId: string, file?: string): Comment[] {
  loadComments(sessionId);
  const list = comments.get(sessionId) || [];
  if (file) return list.filter(c => c.targetFile === file);
  return list;
}

export function deleteComment(sessionId: string, commentId: string): boolean {
  loadComments(sessionId);
  const list = comments.get(sessionId);
  if (!list) return false;
  const idx = list.findIndex(c => c.id === commentId);
  if (idx !== -1) {
    list.splice(idx, 1);
    persistComments(sessionId);
    return true;
  }
  for (const c of list) {
    const ridx = c.replies.findIndex(r => r.id === commentId);
    if (ridx !== -1) {
      c.replies.splice(ridx, 1);
      persistComments(sessionId);
      return true;
    }
  }
  return false;
}

export function trackCollaborationEvent(sessionId: string, event: Omit<CollaborationEvent, "timestamp">): void {
  loadEvents(sessionId);
  const list = events.get(sessionId) || [];
  list.push({ ...event, timestamp: Date.now() });
  events.set(sessionId, list);
  persistEvents(sessionId);
}

export function getActivityFeed(sessionId: string, limit: number = 50): CollaborationEvent[] {
  loadEvents(sessionId);
  const list = events.get(sessionId) || [];
  return list.slice(-limit).reverse();
}

export function getOnlineUsers(sessionId: string): Collaborator[] {
  loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.collaborators.filter(c => c.isOnline);
}

export function syncSession(sessionId: string): { changes: string[]; conflicts: string[] } {
  loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return { changes: [], conflicts: [] };
  const changes: string[] = [];
  const conflicts: string[] = [];
  for (const c of session.collaborators) {
    if (c.isOnline && c.cursor) {
      changes.push(`User ${c.name} at ${c.cursor.file}:${c.cursor.line}`);
    }
  }
  const online = session.collaborators.filter(c => c.isOnline);
  if (online.length > 1) {
    conflicts.push("Multiple editors online — potential merge conflicts");
  }
  return { changes, conflicts };
}

export function getPresenceSummary(sessionId: string): string {
  loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return "";
  const parts: string[] = [];
  for (const c of session.collaborators) {
    if (!c.isOnline) continue;
    if (c.cursor) {
      parts.push(`${c.name} (editing)`);
    } else {
      parts.push(`${c.name} (viewing)`);
    }
  }
  const idle = session.collaborators.filter(c => !c.isOnline && c.lastActive);
  if (idle.length > 0) {
    parts.push(`${idle.length > 1 ? `${idle.length} users` : idle[0].name} (idle)`);
  }
  return parts.join(", ");
}

export function shareAgent(agentId: string, options: { withName?: string; public?: boolean; expiresIn?: number }): { url: string; code: string } {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const base = options.public ? "https://oh.pub" : "https://oh.share";
  const url = `${base}/${agentId}?share=${code}${options.expiresIn ? `&expires=${Date.now() + options.expiresIn * 1000}` : ""}`;
  return { url, code };
}
