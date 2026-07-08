import chalk from "chalk";
import { t } from "../i18n/index.js";
import { memoryStore, memoryGet, memorySearch, memoryClear, memoryExport } from "../memory/index.js";

export function cmdMemoryStore(key: string, value: string): void {
  memoryStore(key, value);
  console.log(chalk.hex("#10B981")(`  ✅ ${t().memory.stored}: ${chalk.bold(key)}`));
}

export function cmdMemoryGet(key: string): void {
  const value = memoryGet(key);
  if (value === null) {
    console.log(chalk.hex("#F59E0B")(`  ⚠ Key not found: ${key}`));
    return;
  }
  console.log(chalk.hex("#06B6D4")(`  ${chalk.bold(key)}: ${value}`));
}

export function cmdMemorySearch(query: string): void {
  const results = memorySearch(query);
  if (results.length === 0) {
    console.log(chalk.hex("#64748B")("  No results found"));
    return;
  }
  console.log(chalk.hex("#8B5CF6").bold(`\n  Memory results for "${query}":\n`));
  for (const r of results) {
    console.log(`  ${chalk.hex("#F8FAFC").bold(r.key)}: ${chalk.hex("#94A3B8")(r.value.slice(0, 100))}`);
  }
  console.log();
}

export function cmdMemoryClear(): void {
  memoryClear();
  console.log(chalk.hex("#10B981")(`  ✅ ${t().memory.cleared}`));
}

export function cmdMemoryExport(): void {
  const data = memoryExport();
  console.log(chalk.hex("#06B6D4")(JSON.stringify(data, null, 2)));
}
