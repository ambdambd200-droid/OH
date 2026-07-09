export * from "./adaptive.js";

// Backward-compatible aliases for commands/memory.ts
import { storeMemory, searchMemory, clearMemory, loadMemory } from "./adaptive.js";

export function memoryStore(key: string, value: string): void {
  storeMemory({
    content: JSON.stringify({ key, value }),
    type: "long-term",
  });
}

export function memoryGet(key: string): string | null {
  const results = searchMemory(key);
  for (const r of results) {
    try {
      const parsed = JSON.parse(r.content);
      if (parsed.key === key) return parsed.value;
    } catch {
      continue;
    }
  }
  return null;
}

export function memorySearch(query: string): { key: string; value: string; timestamp: number }[] {
  return searchMemory(query).map(r => {
    try {
      const parsed = JSON.parse(r.content);
      return { key: parsed.key || r.id, value: parsed.value || r.content, timestamp: r.metadata.timestamp };
    } catch {
      return { key: r.id, value: r.content, timestamp: r.metadata.timestamp };
    }
  });
}

export function memoryClear(): void {
  clearMemory();
}

export function memoryExport(): { key: string; value: string; timestamp: number }[] {
  return loadMemory("long-term").map(r => {
    try {
      const parsed = JSON.parse(r.content);
      return { key: parsed.key || r.id, value: parsed.value || r.content, timestamp: r.metadata.timestamp };
    } catch {
      return { key: r.id, value: r.content, timestamp: r.metadata.timestamp };
    }
  });
}

export function graphAddRelation(a: string, b: string): void {
  const entries = loadMemory("knowledge-graph");
  const existing = entries.find(e => e.content === a);
  if (existing) {
    if (!existing.metadata.tags.includes(b)) existing.metadata.tags.push(b);
  } else {
    storeMemory({ content: a, type: "knowledge-graph" });
  }
}
