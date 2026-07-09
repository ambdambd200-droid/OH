import { getConfig } from "../config/index.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";

export type ConnectionStatus = "online" | "reconnecting" | "offline";
export type OfflinePriority = "critical" | "high" | "normal" | "low";

export interface OfflineState {
  status: ConnectionStatus;
  lastOnline: Date | null;
  offlineSince: Date | null;
  queuedActions: QueuedAction[];
  syncProgress: { total: number; completed: number; failed: number };
}

export interface QueuedAction {
  id: string;
  type: string;
  data: any;
  priority: OfflinePriority;
  queuedAt: Date;
  retryCount: number;
  maxRetries: number;
  status: "pending" | "syncing" | "completed" | "failed";
}

export interface LocalModel {
  name: string;
  path: string;
  type: "ollama" | "llama.cpp" | "gpt4all" | "onnx" | "webnn";
  params: string;
  context: number;
  capabilities: string[];
  loaded: boolean;
  quantized?: string;
}

export interface SyncQueue {
  items: QueuedAction[];
  lastSync: Date | null;
  conflictStrategy: "timestamp" | "user-prompt" | "server-wins";
}

const AR_OFFLINE = {
  offline: "غير متصل",
  online: "متصل",
  reconnecting: "إعادة الاتصال...",
};

function offlineDir(): string {
  return join(getConfig().dataDir, "offline");
}

function statePath(): string {
  return join(offlineDir(), "state.json");
}

function queuePath(): string {
  return join(offlineDir(), "queue.json");
}

function dbDir(): string {
  const d = join(offlineDir(), "db");
  if (!existsSync(d)) {
    mkdirSync(d, { recursive: true });
  }
  return d;
}

function ensureOfflineDir(): void {
  const d = offlineDir();
  if (!existsSync(d)) {
    mkdirSync(d, { recursive: true });
  }
}

let _connectionStatus: ConnectionStatus = "online";
let _lastOnlineDate: Date | null = new Date();
let _offlineSinceDate: Date | null = null;
let _stateListeners: ((status: ConnectionStatus) => void)[] = [];

export function checkConnection(): Promise<ConnectionStatus> {
  const timeout = 3000;

  const ping = (url: string): Promise<boolean> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    return fetch(url, { method: "HEAD", signal: ctrl.signal, mode: "no-cors" })
      .then(() => { clearTimeout(timer); return true; })
      .catch(() => { clearTimeout(timer); return false; });
  };

  return Promise.all([
    ping("https://google.com"),
    ping("https://cloudflare.com"),
    ping("https://1.1.1.1"),
  ]).then((results) => {
    const ok = results.filter(Boolean).length;
    if (ok >= 2) return "online" as ConnectionStatus;
    if (ok === 1) return "reconnecting" as ConnectionStatus;
    return "offline" as ConnectionStatus;
  }).catch(() => "offline" as ConnectionStatus);
}

export function getConnectionStatus(): ConnectionStatus {
  return _connectionStatus;
}

export function onConnectionChange(callback: (status: ConnectionStatus) => void): void {
  _stateListeners.push(callback);
}

function setConnectionStatus(status: ConnectionStatus): void {
  const prev = _connectionStatus;
  _connectionStatus = status;
  if (status === "online" && prev !== "online") {
    _lastOnlineDate = new Date();
    _offlineSinceDate = null;
  } else if (status === "offline" && prev !== "offline") {
    _offlineSinceDate = new Date();
  }
  for (const cb of _stateListeners) {
    try { cb(status); } catch { /* noop */ }
  }
}

export function getOfflineState(): OfflineState {
  const total = _queue.length;
  const completed = _queue.filter((i) => i.status === "completed").length;
  const failed = _queue.filter((i) => i.status === "failed").length;
  return {
    status: _connectionStatus,
    lastOnline: _connectionStatus === "online" ? new Date() : _lastOnlineDate,
    offlineSince: _offlineSinceDate,
    queuedActions: _queue,
    syncProgress: { total, completed, failed },
  };
}

export function getOfflineIndicator(): string {
  switch (_connectionStatus) {
    case "online":
      return "🟢 " + (getConfig().lang === "ar" ? AR_OFFLINE.online : "Online");
    case "reconnecting":
      return "🟡 " + (getConfig().lang === "ar" ? AR_OFFLINE.reconnecting : "Reconnecting...");
    case "offline":
      return "🔴 " + (getConfig().lang === "ar" ? AR_OFFLINE.offline : "Offline");
  }
}

export function detectLocalModels(): LocalModel[] {
  const models: LocalModel[] = [];
  const plat = platform();
  const home = homedir();
  const isWin = plat === "win32";

  const ollamaPaths = isWin
    ? [join(home, ".ollama", "models"), join(home, "AppData", "Local", "ollama")]
    : [join(home, ".ollama", "models")];

  for (const p of ollamaPaths) {
    if (existsSync(p)) {
      try {
        const entries = readdirSync(p, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() || e.name.endsWith(".gguf") || e.name.endsWith(".bin")) {
            models.push({
              name: e.name.replace(/\.(gguf|bin)$/, ""),
              path: join(p, e.name),
              type: "ollama",
              params: "unknown",
              context: 4096,
              capabilities: ["chat", "completion"],
              loaded: false,
            });
          }
        }
      } catch {}
    }
  }

  const llamaPaths = isWin
    ? [join(home, "llama.cpp", "models"), join(home, "AppData", "Local", "llama.cpp")]
    : [join(home, "llama.cpp", "models")];

  for (const p of llamaPaths) {
    if (existsSync(p)) {
      try {
        const entries = readdirSync(p, { withFileTypes: true });
        for (const e of entries) {
          if (e.name.endsWith(".gguf")) {
            models.push({
              name: e.name.replace(".gguf", ""),
              path: join(p, e.name),
              type: "llama.cpp",
              params: "unknown",
              context: 2048,
              capabilities: ["chat", "completion", "embedding"],
              loaded: false,
              quantized: e.name.includes("Q4") ? "Q4_K_M" : e.name.includes("Q8") ? "Q8_0" : undefined,
            });
          }
        }
      } catch {}
    }
  }

  const gpt4allPaths = isWin
    ? [
        join(home, "AppData", "Local", "nomic.ai", "GPT4All"),
        join(process.env["PROGRAMFILES"] || "C:\\Program Files", "GPT4All"),
      ]
    : [join(home, ".local", "share", "nomic.ai", "GPT4All")];

  for (const p of gpt4allPaths) {
    if (existsSync(p)) {
      try {
        const entries = readdirSync(p, { withFileTypes: true });
        for (const e of entries) {
          if (e.name.endsWith(".gguf")) {
            models.push({
              name: e.name.replace(".gguf", ""),
              path: join(p, e.name),
              type: "gpt4all",
              params: "unknown",
              context: 2048,
              capabilities: ["chat", "completion"],
              loaded: false,
            });
          }
        }
      } catch {}
    }
  }

  const onnxPaths = isWin
    ? [join(home, "AppData", "Local", "onnx", "models")]
    : [join(home, ".onnx", "models")];

  for (const p of onnxPaths) {
    if (existsSync(p)) {
      try {
        const entries = readdirSync(p, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() || e.name.endsWith(".onnx")) {
            models.push({
              name: e.name.replace(".onnx", ""),
              path: join(p, e.name),
              type: "onnx",
              params: "unknown",
              context: 2048,
              capabilities: ["chat", "completion"],
              loaded: false,
            });
          }
        }
      } catch {}
    }
  }

  return models;
}

let _cachedModels: LocalModel[] | null = null;

export function getLocalModels(): LocalModel[] {
  if (!_cachedModels) {
    _cachedModels = detectLocalModels();
  }
  return _cachedModels;
}

export function refreshLocalModels(): LocalModel[] {
  _cachedModels = detectLocalModels();
  return _cachedModels;
}

export function getBestLocalModel(task: string): LocalModel | null {
  const models = getLocalModels();
  if (models.length === 0) return null;

  const scored = models.map((m) => {
    let score = 0;
    if (m.capabilities.includes(task)) score += 3;
    if (m.type === "ollama") score += 2;
    if (m.quantized) score += 1;
    if (m.context >= 8192) score += 2;
    else if (m.context >= 4096) score += 1;
    score += m.capabilities.length;
    return { model: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.model || null;
}

let _loadedModels: Map<string, LocalModel> = new Map();

export function loadLocalModel(name: string): Promise<boolean> {
  const models = getLocalModels();
  const model = models.find((m) => m.name === name);
  if (!model) return Promise.resolve(false);

  if (_loadedModels.has(name)) {
    model.loaded = true;
    return Promise.resolve(true);
  }

  try {
    if (existsSync(model.path)) {
      model.loaded = true;
      _loadedModels.set(name, model);
      return Promise.resolve(true);
    }
  } catch {}

  return Promise.resolve(false);
}

export function unloadLocalModel(name: string): void {
  const m = _loadedModels.get(name);
  if (m) {
    m.loaded = false;
    _loadedModels.delete(name);
  }
  const all = getLocalModels();
  const found = all.find((x) => x.name === name);
  if (found) found.loaded = false;
}

let _queue: QueuedAction[] = [];
let _actionCounter = 0;

export function queueAction(type: string, data: any, priority: OfflinePriority): QueuedAction {
  const action: QueuedAction = {
    id: `q-${Date.now()}-${++_actionCounter}`,
    type,
    data,
    priority,
    queuedAt: new Date(),
    retryCount: 0,
    maxRetries: 3,
    status: "pending",
  };
  _queue.push(action);
  _queue.sort((a, b) => {
    const order: Record<OfflinePriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });
  _saveQueueToDisk();
  return action;
}

function _saveQueueToDisk(): void {
  try {
    ensureOfflineDir();
    const data: SyncQueue = {
      items: _queue,
      lastSync: _queue.length > 0 ? new Date() : null,
      conflictStrategy: "timestamp",
    };
    writeFileSync(queuePath(), JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

export function getQueue(): QueuedAction[] {
  return [..._queue];
}

export function getQueueSize(): number {
  return _queue.length;
}

export function clearQueue(): void {
  _queue = [];
  try {
    writeFileSync(
      queuePath(),
      JSON.stringify({ items: [], lastSync: null, conflictStrategy: "timestamp" }, null, 2),
      "utf-8"
    );
  } catch {}
}

async function _processQueuedAction(action: QueuedAction): Promise<boolean> {
  try {
    switch (action.type) {
      case "chat":
      case "inference":
      case "completion":
        return !!(action.data?.model && typeof action.data.model === "string" && action.data.model.length > 0);
      case "memory-store":
      case "memory-search":
      case "memory-delete":
        return true;
      case "agent-create":
      case "agent-update":
      case "agent-delete":
        return true;
      case "session-save":
      case "session-export":
        return true;
      default:
        return true;
    }
  } catch {
    return false;
  }
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  const pending = _queue.filter((q) => q.status === "pending" || q.status === "failed");

  for (const action of pending) {
    if (action.retryCount >= action.maxRetries) {
      action.status = "failed";
      failed++;
      _saveQueueToDisk();
      continue;
    }
    action.status = "syncing";
    _saveQueueToDisk();

    try {
      const ok = await _processQueuedAction(action);
      if (ok) {
        action.status = "completed";
        synced++;
      } else {
        action.retryCount++;
        if (action.retryCount >= action.maxRetries) {
          action.status = "failed";
          failed++;
        } else {
          action.status = "pending";
        }
      }
    } catch {
      action.retryCount++;
      if (action.retryCount >= action.maxRetries) {
        action.status = "failed";
        failed++;
      } else {
        action.status = "pending";
      }
    }
    _saveQueueToDisk();
  }

  _queue = _queue.filter((q) => q.status !== "completed");
  _saveQueueToDisk();

  return { synced, failed };
}

export function cancelSync(id: string): boolean {
  const action = _queue.find((q) => q.id === id);
  if (!action || action.status !== "pending") return false;
  action.status = "failed";
  _saveQueueToDisk();
  return true;
}

export async function retrySync(id: string): Promise<boolean> {
  const action = _queue.find((q) => q.id === id);
  if (!action || action.status !== "failed") return false;
  action.retryCount = 0;
  action.status = "pending";
  _saveQueueToDisk();
  const result = await syncQueue();
  return result.synced > 0;
}

export let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startOfflineMonitor(intervalMs = 30000): void {
  if (intervalHandle) return;

  const tick = async () => {
    const result = await checkConnection();
    const prev = _connectionStatus;
    setConnectionStatus(result);

    if (prev === "online" && result === "offline") {
      const localModels = getLocalModels();
      if (localModels.length > 0) {
        for (const m of localModels.slice(0, 1)) {
          await loadLocalModel(m.name);
        }
      }
      initLocalDB();
      saveOfflineState();
    }

    if (prev === "offline" && result === "online") {
      await syncQueue();
      setConnectionStatus("online");
      saveOfflineState();
    }
  };

  tick();
  intervalHandle = setInterval(tick, intervalMs);
}

export function stopOfflineMonitor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function getDegradedFeatures(): { feature: string; online: string; offline: string }[] {
  return [
    { feature: "chat", online: "Full models (cloud)", offline: "Local LLM only (limited)" },
    { feature: "run", online: "API call (remote inference)", offline: "Local inference (slower, queue if unavailable)" },
    { feature: "memory search", online: "Cloud sync & full vector search", offline: "Local SQLite (JSON-based) only" },
    { feature: "create", online: "Full power (any model, any config)", offline: "Template-based (limited options)" },
    { feature: "deploy", online: "Cloud deployment", offline: "Local preview only (queue)" },
    { feature: "search", online: "Web search + local search", offline: "Local + cached results only" },
    { feature: "models", online: "Full model list (cloud + local)", offline: "Local models only" },
    { feature: "platforms", online: "Discord / Telegram / WhatsApp", offline: "Disabled (requires internet)" },
    { feature: "web", online: "Web dashboard (live)", offline: "Disabled (port stays local)" },
    { feature: "tui", online: "Full TUI with live updates", offline: "Reduced TUI (cached data only)" },
    { feature: "session", online: "Cloud sync sessions", offline: "Local sessions only" },
    { feature: "stats", online: "Live analytics", offline: "Cached analytics (last online)" },
    { feature: "update", online: "Check & apply updates", offline: "Disabled (check queued)" },
    { feature: "search-model", online: "Live model search", offline: "Disabled (use cached model list)" },
    { feature: "templates", online: "Live templates (cloud)", offline: "Cached templates only" },
    { feature: "gamification", online: "Live leaderboard & profile", offline: "Local profile (cached)" },
    { feature: "security", online: "Real-time threat intel", offline: "Local rules only" },
    { feature: "export", online: "Full export with cloud data", offline: "Local export only" },
    { feature: "agent", online: "Full agent operations", offline: "Queue agent operations" },
    { feature: "config", online: "Full config (sync)", offline: "Local config only" },
  ];
}

export function saveOfflineState(): void {
  try {
    ensureOfflineDir();
    const state: OfflineState = {
      status: _connectionStatus,
      lastOnline: _lastOnlineDate,
      offlineSince: _offlineSinceDate,
      queuedActions: _queue.map((q) => ({
        ...q,
        queuedAt: q.queuedAt instanceof Date ? q.queuedAt : new Date(q.queuedAt),
      })),
      syncProgress: {
        total: _queue.length,
        completed: _queue.filter((q) => q.status === "completed").length,
        failed: _queue.filter((q) => q.status === "failed").length,
      },
    };
    writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf-8");
    _saveQueueToDisk();
  } catch {}
}

export function loadOfflineState(): void {
  try {
    if (existsSync(statePath())) {
      const raw = readFileSync(statePath(), "utf-8");
      const state: OfflineState = JSON.parse(raw);
      if (state.status) _connectionStatus = state.status;
      if (state.lastOnline) _lastOnlineDate = new Date(state.lastOnline);
      if (state.offlineSince) _offlineSinceDate = new Date(state.offlineSince);
    }
    if (existsSync(queuePath())) {
      const raw = readFileSync(queuePath(), "utf-8");
      const data: SyncQueue = JSON.parse(raw);
      if (data.items) {
        _queue = data.items.map((q) => ({ ...q, queuedAt: new Date(q.queuedAt) }));
      }
    }
  } catch {
    ensureOfflineDir();
  }
}

export interface LocalDB {
  path: string;
  tables: Map<string, any[]>;
}

let _localDB: LocalDB | null = null;

export function initLocalDB(): LocalDB {
  const db: LocalDB = { path: dbDir(), tables: new Map() };
  _localDB = db;
  loadDB();
  return db;
}

export function dbQuery(table: string, filter?: (row: any) => boolean): any[] {
  if (!_localDB) return [];
  const rows = _localDB.tables.get(table);
  if (!rows) return [];
  return filter ? rows.filter(filter) : [...rows];
}

export function dbInsert(table: string, row: any): void {
  if (!_localDB) initLocalDB();
  if (!_localDB!.tables.has(table)) {
    _localDB!.tables.set(table, []);
  }
  const rows = _localDB!.tables.get(table)!;
  const entry = { _id: `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...row };
  rows.push(entry);
}

export function dbUpdate(table: string, id: string, data: any): boolean {
  if (!_localDB) return false;
  const rows = _localDB.tables.get(table);
  if (!rows) return false;
  const idx = rows.findIndex((r: any) => r._id === id);
  if (idx === -1) return false;
  rows[idx] = { ...rows[idx], ...data };
  return true;
}

export function dbDelete(table: string, id: string): boolean {
  if (!_localDB) return false;
  const rows = _localDB.tables.get(table);
  if (!rows) return false;
  const idx = rows.findIndex((r: any) => r._id === id);
  if (idx === -1) return false;
  rows.splice(idx, 1);
  return true;
}

export function dbCount(table: string): number {
  if (!_localDB) return 0;
  const rows = _localDB.tables.get(table);
  return rows ? rows.length : 0;
}

export function saveDB(): void {
  if (!_localDB) return;
  try {
    ensureOfflineDir();
    const data: Record<string, any[]> = {};
    for (const [key, val] of _localDB.tables) {
      data[key] = val;
    }
    writeFileSync(join(_localDB.path, "data.json"), JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

export function loadDB(): void {
  if (!_localDB) return;
  try {
    const dbPath = join(_localDB.path, "data.json");
    if (existsSync(dbPath)) {
      const raw = readFileSync(dbPath, "utf-8");
      const data = JSON.parse(raw);
      _localDB.tables = new Map(Object.entries(data));
    }
  } catch {}
}

loadOfflineState();