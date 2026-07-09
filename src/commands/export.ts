import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, extname, basename } from "path";
import { getConfig, ensureDir } from "../config/index.js";
import { randomUUID } from "crypto";

export type ExportFormat =
  | "oh-native" | "json" | "yaml" | "docker" | "zip"
  | "openai-gpt" | "claude-project" | "langchain" | "crewai"
  | "dify" | "n8n" | "zapier" | "make" | "replit" | "github-codespace";

export type ExportScope = "agent" | "memory" | "config" | "project" | "full";

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  agentId?: string;
  includeMemory?: boolean;
  includeConfig?: boolean;
  includeHistory?: boolean;
  includeAssets?: boolean;
  outputPath?: string;
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  scope: ExportScope;
  filePath?: string;
  fileSize: number;
  entriesCount: number;
  warnings: string[];
  errors: string[];
  duration: number;
}

export interface ImportOptions {
  filePath: string;
  format: ExportFormat;
  scope: ExportScope;
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface ImportResult {
  success: boolean;
  format: ExportFormat;
  itemsImported: number;
  itemsSkipped: number;
  conflicts: string[];
  warnings: string[];
  errors: string[];
  duration: number;
}

export interface MigrationPlan {
  source: string;
  target: string;
  steps: string[];
  warnings: string[];
  preserved: string[];
  lost: string[];
}

export const FORMAT_INFO: Record<ExportFormat, { name: string; description: string; useCase: string }> = {
  "oh-native": { name: "OH Native", description: "Full agent + metadata", useCase: "Backup" },
  "json": { name: "JSON", description: "Config + prompts", useCase: "API" },
  "yaml": { name: "YAML", description: "Human-readable config", useCase: "Git" },
  "docker": { name: "Docker", description: "Containerized agent", useCase: "Deploy" },
  "zip": { name: "ZIP", description: "Full project files", useCase: "Share" },
  "openai-gpt": { name: "OpenAI GPT", description: "Instructions + tools", useCase: "ChatGPT" },
  "claude-project": { name: "Claude Project", description: "System prompt + files", useCase: "Claude" },
  "langchain": { name: "LangChain", description: "Chain + tools", useCase: "Python" },
  "crewai": { name: "CrewAI", description: "Crew + tasks", useCase: "Multi-agent" },
  "dify": { name: "Dify", description: "Workflow + nodes", useCase: "No-code" },
  "n8n": { name: "n8n", description: "Workflow JSON", useCase: "Automation" },
  "zapier": { name: "Zapier", description: "Zaps", useCase: "Business" },
  "make": { name: "Make", description: "Scenarios", useCase: "Visual" },
  "replit": { name: "Replit", description: "Repl + config", useCase: "Online" },
  "github-codespace": { name: "GitHub Codespace", description: "Dev container", useCase: "Cloud" },
};

function exportsDir(): string {
  return join(getConfig().dataDir, "exports");
}

function outputPath(options: ExportOptions): string {
  return options.outputPath || join(exportsDir(), `${options.agentId || "export"}.${options.format}`);
}

function loadAgentData(agentId: string): Record<string, any> {
  const dataDir = getConfig().dataDir;
  const agent: Record<string, any> = {};
  const files = ["memory.json", "stats.json", "sessions.json"];
  for (const f of files) {
    const fp = join(dataDir, f);
    if (existsSync(fp)) {
      try {
        agent[f.replace(".json", "")] = JSON.parse(readFileSync(fp, "utf-8"));
      } catch { agent[f.replace(".json", "")] = null; }
    }
  }
  const agentsDir = join(dataDir, "agents");
  if (existsSync(agentsDir)) {
    const entries = readdirSync(agentsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".json")) {
        try {
          agent[e.name.replace(".json", "")] = JSON.parse(readFileSync(join(agentsDir, e.name), "utf-8"));
        } catch {}
      }
    }
  }
  return agent;
}

function collectExportData(agentId: string, options: ExportOptions): Record<string, any> {
  const data: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    format: options.format,
    scope: options.scope,
    agentId,
  };
  if (options.scope === "full" || options.scope === "agent") {
    data.agent = loadAgentData(agentId);
  }
  if (options.scope === "full" || options.scope === "config") {
    data.config = getConfig();
  }
  if (options.scope === "full" || options.scope === "memory") {
    const memPath = join(getConfig().dataDir, "memory.json");
    if (existsSync(memPath)) {
      try { data.memory = JSON.parse(readFileSync(memPath, "utf-8")); } catch { data.memory = []; }
    }
  }
  if (options.scope === "project") {
    const srcDir = join(process.cwd(), "src");
    if (existsSync(srcDir)) {
      data.project = {};
      walkProject(srcDir, data.project, srcDir);
    }
    const pkgPath = join(process.cwd(), "package.json");
    if (existsSync(pkgPath)) {
      try { data.packageJson = JSON.parse(readFileSync(pkgPath, "utf-8")); } catch {}
    }
  }
  return data;
}

function walkProject(dir: string, target: Record<string, any>, baseDir: string): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        target[e.name] = {};
        walkProject(full, target[e.name], baseDir);
      } else if (e.isFile() && /\.(ts|js|json)$/.test(e.name)) {
        try { target[e.name] = readFileSync(full, "utf-8"); } catch {}
      }
    }
  } catch {}
}

function formatOutput(data: Record<string, any>, format: ExportFormat): string {
  switch (format) {
    case "oh-native":
    case "json":
    case "dify":
    case "n8n":
    case "zapier":
    case "make":
    case "langchain":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return jsonToYaml(data);
    case "openai-gpt":
    case "claude-project":
    case "crewai":
    case "replit":
    case "github-codespace":
    case "docker":
      return JSON.stringify(data, null, 2);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function jsonToYaml(obj: any, indent: number = 0): string {
  const pad = "  ".repeat(indent);
  let out = "";
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        out += `${pad}- ${jsonToYaml(item, indent + 1).trimStart()}`;
      } else {
        out += `${pad}- ${formatYamlValue(item)}\n`;
      }
    }
  } else if (obj !== null && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "object" && v !== null) {
        out += `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`;
      } else {
        out += `${pad}${k}: ${formatYamlValue(v)}\n`;
      }
    }
  } else {
    out += `${formatYamlValue(obj)}\n`;
  }
  return out;
}

function formatYamlValue(v: any): string {
  if (typeof v === "string") {
    if (v.includes(":") || v.includes("#") || v.includes("\n")) {
      return `"${v.replace(/"/g, '\\"')}"`;
    }
    return v;
  }
  return String(v);
}

function writeExportFile(content: string, options: ExportOptions): string {
  ensureDir(exportsDir());
  const fp = outputPath(options);
  writeFileSync(fp, content, "utf-8");
  return fp;
}

export async function exportAgent(options: ExportOptions): Promise<ExportResult> {
  const start = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];
  try {
    const data = collectExportData(options.agentId || "", options);
    const content = formatOutput(data, options.format);
    const fp = writeExportFile(content, options);
    const size = statSync(fp).size;
    const entriesCount = Object.keys(data).length;
    return {
      success: true, format: options.format, scope: options.scope,
      filePath: fp, fileSize: size, entriesCount,
      warnings, errors, duration: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false, format: options.format, scope: options.scope,
      fileSize: 0, entriesCount: 0,
      warnings, errors: [(err as Error).message], duration: Date.now() - start,
    };
  }
}

export async function exportToOHNative(agentId: string, outputPath?: string): Promise<ExportResult> {
  return exportAgent({ format: "oh-native", scope: "full", agentId, outputPath });
}

export async function exportToJSON(agentId: string): Promise<string> {
  const data = collectExportData(agentId, { format: "json", scope: "full", agentId });
  return JSON.stringify(data, null, 2);
}

export async function exportToYAML(agentId: string): Promise<string> {
  const data = collectExportData(agentId, { format: "yaml", scope: "full", agentId });
  return jsonToYaml(data);
}

export async function exportToOpenAIGPT(agentId: string): Promise<{ instructions: string; files: Record<string, string> }> {
  const data = loadAgentData(agentId);
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") files[`${k}.txt`] = v;
    else files[`${k}.json`] = JSON.stringify(v, null, 2);
  }
  return {
    instructions: `You are an OH agent (ID: ${agentId}). Use the attached files for context.`,
    files,
  };
}

export async function exportToClaudeProject(agentId: string): Promise<{ systemPrompt: string; files: Record<string, string> }> {
  const data = loadAgentData(agentId);
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    files[`${k}.json`] = JSON.stringify(v, null, 2);
  }
  return {
    systemPrompt: `You are an OH agent (${agentId}). Use the attached project files to understand context, memory, and configuration.`,
    files,
  };
}

export async function exportToLangChain(agentId: string): Promise<string> {
  const data = loadAgentData(agentId);
  const chain = {
    name: agentId,
    type: "openai_functions",
    description: "Exported from OH",
    tools: Object.keys(data).map(k => ({
      name: k,
      description: `Tool: ${k}`,
      parameters: { type: "object", properties: {}, required: [] },
    })),
    memory: data.memory || [],
  };
  return JSON.stringify(chain, null, 2);
}

export async function exportToDify(agentId: string): Promise<string> {
  const workflow = {
    id: randomUUID(),
    name: agentId,
    type: "chatbot",
    nodes: [
      { id: "start", type: "start", data: { variables: [] } },
      { id: "llm_1", type: "llm", data: { model: getConfig().model, prompt: "You are an OH agent." } },
      { id: "end", type: "end", data: {} },
    ],
    edges: [
      { source: "start", target: "llm_1" },
      { source: "llm_1", target: "end" },
    ],
  };
  return JSON.stringify(workflow, null, 2);
}

export async function exportToN8N(agentId: string): Promise<string> {
  const workflow = {
    name: `OH-${agentId}`,
    nodes: [
      { id: "1", name: "Webhook", type: "n8n-nodes-base.webhook", position: [250, 300] },
      { id: "2", name: "OpenAI", type: "n8n-nodes-base.openAi", position: [450, 300] },
      { id: "3", name: "Respond", type: "n8n-nodes-base.respondToWebhook", position: [650, 300] },
    ],
    connections: { "1": { main: [[{ node: "2", type: "main" }]] }, "2": { main: [[{ node: "3", type: "main" }]] } },
  };
  return JSON.stringify(workflow, null, 2);
}

export async function importAgent(options: ImportOptions): Promise<ImportResult> {
  const start = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];
  const conflicts: string[] = [];
  let imported = 0;
  let skipped = 0;
  try {
    if (!existsSync(options.filePath)) {
      return { success: false, format: options.format, itemsImported: 0, itemsSkipped: 0, conflicts, warnings, errors: ["File not found"], duration: Date.now() - start };
    }
    const raw = readFileSync(options.filePath, "utf-8");
    let data: any;
    try { data = JSON.parse(raw); } catch { errors.push("Invalid JSON format"); return { success: false, format: options.format, itemsImported: 0, itemsSkipped: 0, conflicts, warnings, errors, duration: Date.now() - start }; }
    if (options.dryRun) {
      const keys = Object.keys(data);
      return { success: true, format: options.format, itemsImported: keys.length, itemsSkipped: 0, conflicts, warnings, errors, duration: Date.now() - start };
    }
    const dataDir = getConfig().dataDir;
    ensureDir(dataDir);
    for (const [key, value] of Object.entries(data)) {
      if (key === "exportedAt" || key === "format" || key === "scope") continue;
      if (key === "memory" && Array.isArray(value)) {
        const memPath = join(dataDir, "memory.json");
        if (existsSync(memPath) && !options.overwrite) { skipped++; continue; }
        writeFileSync(memPath, JSON.stringify(value, null, 2), "utf-8");
        imported++;
      } else if (key === "config" && typeof value === "object") {
        const cfgPath = join(dataDir, "config.json");
        if (existsSync(cfgPath) && !options.overwrite) { skipped++; continue; }
        writeFileSync(cfgPath, JSON.stringify(value, null, 2), "utf-8");
        imported++;
      } else if (typeof value === "object" && value !== null) {
        const agentsDir = join(dataDir, "agents");
        ensureDir(agentsDir);
        const fp = join(agentsDir, `${key}.json`);
        if (existsSync(fp) && !options.overwrite) { skipped++; conflicts.push(fp); continue; }
        writeFileSync(fp, JSON.stringify(value, null, 2), "utf-8");
        imported++;
      }
    }
    return { success: true, format: options.format, itemsImported: imported, itemsSkipped: skipped, conflicts, warnings, errors, duration: Date.now() - start };
  } catch (err) {
    return { success: false, format: options.format, itemsImported: 0, itemsSkipped: 0, conflicts, warnings, errors: [(err as Error).message], duration: Date.now() - start };
  }
}

export async function importFromOHNative(filePath: string, overwrite: boolean = false): Promise<ImportResult> {
  return importAgent({ filePath, format: "oh-native", scope: "full", overwrite });
}

export async function importFromOpenAI(filePath: string): Promise<ImportResult> {
  return importAgent({ filePath, format: "openai-gpt", scope: "agent", overwrite: false });
}

export async function importFromClaude(filePath: string): Promise<ImportResult> {
  return importAgent({ filePath, format: "claude-project", scope: "agent", overwrite: false });
}

export async function importFromLangChain(filePath: string): Promise<ImportResult> {
  return importAgent({ filePath, format: "langchain", scope: "agent", overwrite: false });
}

export function planMigration(from: string, to: string): MigrationPlan {
  const fromInfo = getFormatInfo(from);
  const toInfo = getFormatInfo(to);
  const steps: string[] = [];
  const warnings: string[] = [];
  const preserved: string[] = [];
  const lost: string[] = [];
  if (fromInfo && toInfo) {
    steps.push(`Read source: ${fromInfo.name}`);
    steps.push(`Transform to ${toInfo.name} format`);
    steps.push(`Validate output`);
    preserved.push("Agent configuration", "Memory data");
    if (fromInfo.useCase !== toInfo.useCase) {
      warnings.push(`Platform target differs: ${fromInfo.useCase} → ${toInfo.useCase}`);
    }
    if (toInfo.useCase === "No-code" && fromInfo.useCase !== "No-code") {
      lost.push("Custom code logic not expressible in visual workflow");
    }
  }
  steps.push("Write target file");
  return { source: from, target: to, steps, warnings, preserved, lost };
}

function getFormatInfo(f: string): { name: string; description: string; useCase: string } | null {
  return FORMAT_INFO[f as ExportFormat] || null;
}

export async function executeMigration(plan: MigrationPlan): Promise<boolean> {
  try {
    const fromInfo = getFormatInfo(plan.source);
    const toInfo = getFormatInfo(plan.target);
    if (!fromInfo || !toInfo) return false;
    return true;
  } catch { return false; }
}

export function getSupportedFormats(): ExportFormat[] {
  return Object.keys(FORMAT_INFO) as ExportFormat[];
}

export function detectFormat(filePath: string): ExportFormat | null {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath).toLowerCase();
  if (ext === ".json") {
    if (name.includes("openai") || name.includes("gpt")) return "openai-gpt";
    if (name.includes("claude")) return "claude-project";
    if (name.includes("langchain")) return "langchain";
    if (name.includes("dify")) return "dify";
    if (name.includes("n8n")) return "n8n";
    if (name.includes("crewai")) return "crewai";
    return "json";
  }
  if (ext === ".yaml" || ext === ".yml") return "yaml";
  if (ext === ".zip") return "zip";
  if (ext === ".dockerfile" || name.includes("docker")) return "docker";
  if (name.includes("replit")) return "replit";
  if (name.includes("codespace") || name.includes("devcontainer")) return "github-codespace";
  return null;
}

export function estimateFileSize(agentId: string, format: ExportFormat): number {
  try {
    const data = collectExportData(agentId, { format, scope: "full", agentId });
    const content = formatOutput(data, format);
    return Buffer.byteLength(content, "utf-8");
  } catch { return 0; }
}
