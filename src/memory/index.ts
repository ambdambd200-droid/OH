import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";

interface MemoryEntry {
  key: string;
  value: string;
  timestamp: number;
}

interface KnowledgeGraph {
  nodes: Map<string, Set<string>>;
}

const MEMORY_FILE = "memory.json";
const GRAPH_FILE = "graph.json";

function getMemoryPath(): string {
  const dataDir = getConfig().dataDir;
  ensureDir(dataDir);
  return join(dataDir, MEMORY_FILE);
}

function getGraphPath(): string {
  const dataDir = getConfig().dataDir;
  ensureDir(dataDir);
  return join(dataDir, GRAPH_FILE);
}

function readMemory(): MemoryEntry[] {
  const path = getMemoryPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeMemory(entries: MemoryEntry[]): void {
  writeFileSync(getMemoryPath(), JSON.stringify(entries, null, 2), "utf-8");
}

export function memoryStore(key: string, value: string): void {
  const entries = readMemory();
  const existing = entries.findIndex((e) => e.key === key);
  const entry: MemoryEntry = { key, value, timestamp: Date.now() };

  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }

  writeMemory(entries);
}

export function memoryGet(key: string): string | null {
  const entries = readMemory();
  const entry = entries.find((e) => e.key === key);
  return entry ? entry.value : null;
}

export function memorySearch(query: string): MemoryEntry[] {
  const entries = readMemory();
  const q = query.toLowerCase();
  return entries.filter(
    (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)
  );
}

export function memoryClear(): void {
  writeMemory([]);
}

export function graphAddRelation(a: string, b: string): void {
  const path = getGraphPath();
  let graph: Record<string, string[]> = {};
  if (existsSync(path)) {
    graph = JSON.parse(readFileSync(path, "utf-8"));
  }
  if (!graph[a]) graph[a] = [];
  if (!graph[a].includes(b)) graph[a].push(b);
  if (!graph[b]) graph[b] = [];
  if (!graph[b].includes(a)) graph[b].push(a);
  writeFileSync(path, JSON.stringify(graph, null, 2), "utf-8");
}

export function memoryExport(): MemoryEntry[] {
  return readMemory();
}
