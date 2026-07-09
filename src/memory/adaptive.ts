import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getConfig } from "../config/index.js";

export interface MemoryEntry {
  id: string;
  content: string;
  type: "working" | "short-term" | "long-term" | "knowledge-graph" | "procedural";
  metadata: {
    timestamp: number;
    lastAccessed: number;
    accessCount: number;
    context: string;
    outcome: number;
    tags: string[];
    projectId?: string;
  };
  confidence: number;
  embedding?: number[];
}

export interface MemoryQuery {
  text: string;
  type?: MemoryEntry["type"];
  limit?: number;
  minConfidence?: number;
  context?: string;
}

export interface MemoryGraph {
  nodes: Map<string, Set<string>>;
  edges: Map<string, { target: string; weight: number }[]>;
}

const LAYERS: MemoryEntry["type"][] = ["working", "short-term", "long-term", "knowledge-graph", "procedural"];

const WORKING_SIZE = 20;
const SHORT_TERM_DAYS = 7;
const LONG_TERM_DECAY_DAYS = 90;
const CONFIDENCE_DECAY = 0.05;

const store: Map<string, MemoryEntry[]> = new Map();
const layerCache: Map<string, Date | null> = new Map();

function getLayerPath(type: MemoryEntry["type"]): string {
  const dataDir = getConfig().dataDir;
  const dir = join(dataDir, "memory");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, `${type}.json`);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calcConfidence(entry: MemoryEntry): number {
  const frequency = Math.min(entry.metadata.accessCount / 100, 1);
  const recency = Math.max(0, 1 - (Date.now() - entry.metadata.lastAccessed) / (90 * 24 * 60 * 60 * 1000));
  const rating = (entry.metadata.outcome + 1) / 2;
  const complexity = Math.min(entry.content.length / 5000, 1);
  return (frequency * 0.3 + recency * 0.3 + rating * 0.3) / (1 + complexity * 0.1);
}

function stringSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function initMemory(): void {
  for (const layer of LAYERS) {
    const path = getLayerPath(layer);
    if (!existsSync(path)) {
      writeFileSync(path, "[]", "utf-8");
    }
    store.set(layer, []);
    layerCache.set(layer, null);
  }
}

export function loadMemory(type: MemoryEntry["type"]): MemoryEntry[] {
  const cached = store.get(type);
  if (cached && cached.length > 0) return cached;

  const path = getLayerPath(type);
  if (!existsSync(path)) {
    const empty: MemoryEntry[] = [];
    store.set(type, empty);
    return empty;
  }
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as MemoryEntry[];
    const restored = data.map(e => ({
      ...e,
      metadata: {
        ...e.metadata,
        tags: e.metadata.tags || [],
      },
    }));
    store.set(type, restored);
    layerCache.set(type, new Date());
    return restored;
  } catch {
    const empty: MemoryEntry[] = [];
    store.set(type, empty);
    return empty;
  }
}

export function saveMemory(type: MemoryEntry["type"]): void {
  const entries = store.get(type);
  if (!entries) return;
  const path = getLayerPath(type);
  writeFileSync(path, JSON.stringify(entries, null, 2), "utf-8");
}

export function storeMemory(entry: Omit<MemoryEntry, "id" | "confidence" | "metadata">): MemoryEntry {
  const id = generateId();
  const newEntry: MemoryEntry = {
    id,
    content: entry.content,
    type: entry.type,
    metadata: {
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      context: "",
      outcome: 0,
      tags: [],
      ...(entry as any).metadata,
    },
    confidence: 0.5,
  };
  newEntry.confidence = calcConfidence(newEntry);

  const layer = entry.type;
  loadMemory(layer);
  const entries = store.get(layer)!;
  entries.push(newEntry);

  const limit = layer === "working" ? WORKING_SIZE : layer === "short-term" ? 500 : layer === "long-term" ? 5000 : 1000;
  if (entries.length > limit) {
    entries.sort((a, b) => calcConfidence(a) - calcConfidence(b));
    entries.shift();
  }

  saveMemory(layer);
  return newEntry;
}

export function recallMemory(query: MemoryQuery): MemoryEntry[] {
  const layers = query.type ? [query.type] : LAYERS;
  const results: MemoryEntry[] = [];

  for (const layer of layers) {
    const entries = loadMemory(layer);
    for (const entry of entries) {
      if (query.minConfidence !== undefined && entry.confidence < query.minConfidence) continue;

      const frequency = Math.min(entry.metadata.accessCount / 100, 1);
      const recency = Math.max(0, 1 - (Date.now() - entry.metadata.lastAccessed) / (90 * 24 * 60 * 60 * 1000));
      const rating = (entry.metadata.outcome + 1) / 2;
      const relevance = query.text ? stringSimilarity(entry.content, query.text) : 0.5;
      const complexity = Math.min(entry.content.length / 5000, 1);

      let contextBoost = 1;
      if (query.context && entry.metadata.context === query.context) {
        contextBoost = 1.5;
      }

      const score = ((frequency + recency + rating) / 3) * relevance * contextBoost / (1 + complexity * 0.1);

      if (score > 0) {
        results.push({ ...entry, confidence: score });
      }
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  const limit = query.limit || 10;
  return results.slice(0, limit);
}

export function recallPerfect(query: string): MemoryEntry | null {
  let best: MemoryEntry | null = null;
  let bestScore = 0;

  for (const layer of LAYERS) {
    const entries = loadMemory(layer);
    for (const entry of entries) {
      const score = stringSimilarity(entry.content, query);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }

  if (best && best.confidence >= 0.5) {
    reinforceMemory(best.id);
    return best;
  }
  return null;
}

export function searchMemory(text: string, type?: MemoryEntry["type"]): MemoryEntry[] {
  const layers = type ? [type] : LAYERS;
  const results: MemoryEntry[] = [];

  for (const layer of layers) {
    const entries = loadMemory(layer);
    for (const entry of entries) {
      const semantic = stringSimilarity(entry.content, text);
      const keyword = entry.content.toLowerCase().includes(text.toLowerCase()) ? 0.5 : 0;
      const tagMatch = entry.metadata.tags.some(t => t.toLowerCase().includes(text.toLowerCase())) ? 0.3 : 0;
      const score = Math.max(semantic, keyword, tagMatch);

      if (score > 0) {
        results.push({ ...entry, confidence: score });
      }
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, 20);
}

export function consolidateMemory(): { removed: number; merged: number } {
  let removed = 0;
  let merged = 0;

  for (const layer of LAYERS) {
    const entries = loadMemory(layer);
    if (entries.length === 0) continue;

    const toRemove = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      if (toRemove.has(entries[i].id)) continue;
      for (let j = i + 1; j < entries.length; j++) {
        if (toRemove.has(entries[j].id)) continue;
        const sim = stringSimilarity(entries[i].content, entries[j].content);
        if (sim > 0.7) {
          if (entries[i].confidence >= entries[j].confidence) {
            entries[i].metadata.tags = [...new Set([...entries[i].metadata.tags, ...entries[j].metadata.tags])];
            entries[i].metadata.accessCount += entries[j].metadata.accessCount;
            toRemove.add(entries[j].id);
          } else {
            entries[j].metadata.tags = [...new Set([...entries[j].metadata.tags, ...entries[i].metadata.tags])];
            entries[j].metadata.accessCount += entries[i].metadata.accessCount;
            toRemove.add(entries[i].id);
          }
          merged++;
        }
      }
    }

    const filtered = entries.filter(e => !toRemove.has(e.id));
    removed += entries.length - filtered.length;
    store.set(layer, filtered);
    saveMemory(layer);
  }

  return { removed, merged };
}

export function reinforceMemory(id: string): void {
  let found = false;
  for (const layer of LAYERS) {
    const entries = store.get(layer);
    if (!entries) continue;
    const entry = entries.find(e => e.id === id);
    if (entry) {
      entry.metadata.accessCount++;
      entry.metadata.lastAccessed = Date.now();
      entry.confidence = calcConfidence(entry);
      saveMemory(entry.type);
      found = true;
      break;
    }
  }
  if (!found) {
    for (const layer of LAYERS) {
      const entries = loadMemory(layer);
      const entry = entries.find(e => e.id === id);
      if (entry) {
        entry.metadata.accessCount++;
        entry.metadata.lastAccessed = Date.now();
        entry.confidence = calcConfidence(entry);
        saveMemory(layer);
        break;
      }
    }
  }
}

export function decayMemory(): number {
  let archived = 0;
  const now = Date.now();
  const shortTermMs = SHORT_TERM_DAYS * 24 * 60 * 60 * 1000;
  const longTermMs = LONG_TERM_DECAY_DAYS * 24 * 60 * 60 * 1000;

  for (const layer of LAYERS) {
    const entries = loadMemory(layer);
    if (entries.length === 0) continue;

    let changed = false;
    for (const entry of entries) {
      const daysSinceAccess = (now - entry.metadata.lastAccessed) / (24 * 60 * 60 * 1000);
      entry.confidence *= (1 - CONFIDENCE_DECAY * daysSinceAccess);
      entry.confidence = Math.max(0, Math.min(1, entry.confidence));
      changed = true;
    }

    if (layer === "short-term") {
      const keep = entries.filter(e => now - e.metadata.lastAccessed < shortTermMs);
      archived += entries.length - keep.length;
      const moved = entries.filter(e => now - e.metadata.lastAccessed >= shortTermMs);
      for (const m of moved) {
        m.type = "long-term";
        m.confidence = calcConfidence(m);
        const lt = loadMemory("long-term");
        lt.push(m);
        saveMemory("long-term");
      }
      store.set("short-term", keep);
      saveMemory("short-term");
    }

    if (layer === "long-term") {
      const keep = entries.filter(e => now - e.metadata.lastAccessed < longTermMs || e.confidence > 0.3);
      archived += entries.length - keep.length;
      store.set("long-term", keep);
      saveMemory("long-term");
    }

    if (changed) {
      saveMemory(layer);
    }
  }

  return archived;
}

export function forgetMemory(id: string): boolean {
  for (const layer of LAYERS) {
    const entries = loadMemory(layer);
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      entries.splice(idx, 1);
      store.set(layer, entries);
      saveMemory(layer);
      return true;
    }
  }
  return false;
}

export function getMemoryStats() {
  let total = 0;
  const perLayer: Record<string, number> = {};
  let totalConfidence = 0;
  let oldest = Date.now();
  let newest = 0;

  for (const layer of LAYERS) {
    const entries = loadMemory(layer);
    const count = entries.length;
    perLayer[layer] = count;
    total += count;

    for (const e of entries) {
      totalConfidence += e.confidence;
      if (e.metadata.timestamp < oldest) oldest = e.metadata.timestamp;
      if (e.metadata.timestamp > newest) newest = e.metadata.timestamp;
    }
  }

  return {
    total,
    perLayer,
    avgConfidence: total > 0 ? totalConfidence / total : 0,
    oldestEntry: new Date(oldest),
    newestEntry: new Date(newest),
  };
}

export function clearMemory(type?: MemoryEntry["type"]): number {
  if (type) {
    const entries = loadMemory(type);
    const count = entries.length;
    store.set(type, []);
    saveMemory(type);
    return count;
  }

  let total = 0;
  for (const layer of LAYERS) {
    const entries = loadMemory(layer);
    total += entries.length;
    store.set(layer, []);
    saveMemory(layer);
  }
  return total;
}

export function buildKnowledgeGraph(): MemoryGraph {
  const nodes = new Map<string, Set<string>>();
  const edges = new Map<string, { target: string; weight: number }[]>();

  const allEntries: MemoryEntry[] = [];
  for (const layer of LAYERS) {
    if (layer === "knowledge-graph") continue;
    allEntries.push(...loadMemory(layer));
  }

  for (const entry of allEntries) {
    const words = entry.content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = [...new Set(words)];

    for (const word of uniqueWords) {
      if (!nodes.has(word)) nodes.set(word, new Set());
      for (const other of uniqueWords) {
        if (word !== other) {
          nodes.get(word)!.add(other);
        }
      }
    }
  }

  for (const [word, related] of nodes) {
    const edgeList: { target: string; weight: number }[] = [];
    for (const target of related) {
      let weight = 0;
      for (const entry of allEntries) {
        const words = entry.content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (words.includes(word) && words.includes(target)) {
          weight++;
        }
      }
      edgeList.push({ target, weight });
    }
    edgeList.sort((a, b) => b.weight - a.weight);
    edges.set(word, edgeList);
  }

  const kg: MemoryGraph = { nodes, edges };
  const serialized: any[] = [];
  for (const [concept, related] of nodes) {
    serialized.push({
      id: generateId(),
      content: concept,
      type: "knowledge-graph",
      metadata: {
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        context: "knowledge-graph",
        outcome: 0,
        tags: ["graph", ...related],
      },
      confidence: 1.0,
    });
  }

  store.set("knowledge-graph", serialized);
  saveMemory("knowledge-graph");

  return kg;
}

export function learnFromOutcome(id: string, outcome: number): void {
  outcome = Math.max(-1, Math.min(1, outcome));

  for (const layer of LAYERS) {
    const entries = loadMemory(layer);
    const entry = entries.find(e => e.id === id);
    if (entry) {
      entry.metadata.outcome = (entry.metadata.outcome + outcome) / 2;
      entry.confidence = calcConfidence(entry);

      if (entry.metadata.outcome < -0.5) {
        entry.metadata.tags.push("review");
      }

      saveMemory(layer);
      return;
    }
  }
}
