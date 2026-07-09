import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";

export type PluginType = "tool" | "provider" | "theme" | "template" | "integration" | "middleware" | "analyzer";

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  entry: string;
  minOHVersion?: string;
  icon?: string;
  tags?: string[];
  permissions?: string[];
  config?: Record<string, { type: string; default?: any; description: string }>;
}

export interface Plugin {
  manifest: PluginManifest;
  enabled: boolean;
  installedAt: Date;
  config: Record<string, any>;
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
  onConfigChange?: (key: string, value: any) => void;
}

export interface ToolRegistration {
  name: string;
  description: string;
  handler: (args: any, context: any) => Promise<any>;
  schema: Record<string, any>;
}

export interface ProviderRegistration {
  name: string;
  description: string;
  modelPattern: string;
  callFunction: (model: string, messages: any[], options?: any) => Promise<any>;
  config: Record<string, any>;
}

export interface ThemeRegistration {
  name: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  radii: Record<string, string>;
  shadows: Record<string, string>;
}

const plugins: Map<string, Plugin> = new Map();
const tools: Map<string, ToolRegistration> = new Map();
const providers: Map<string, ProviderRegistration> = new Map();
const themes: Map<string, ThemeRegistration> = new Map();

type EventCallback = (data: any) => void;
const eventHandlers: Map<string, EventCallback[]> = new Map();

const PLUGINS_DIR = ".oh/plugins/";

function getPluginsDir(): string {
  return join(getConfig().dataDir, "plugins");
}

function stripJsonComments(json: string): string {
  return json.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function readManifest(path: string): PluginManifest {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(stripJsonComments(raw)) as PluginManifest;
}

function validateManifest(manifest: PluginManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!manifest.name || typeof manifest.name !== "string") errors.push("name is required and must be a string");
  if (!manifest.version || typeof manifest.version !== "string") errors.push("version is required and must be a string");
  if (!manifest.entry || typeof manifest.entry !== "string") errors.push("entry is required and must be a string");
  if (!manifest.description) errors.push("description is required");
  if (!manifest.author) errors.push("author is required");
  if (manifest.type && !["tool", "provider", "theme", "template", "integration", "middleware", "analyzer"].includes(manifest.type)) {
    errors.push(`invalid type: ${manifest.type}`);
  }
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push("version must be semver (x.y.z)");
  }
  return { valid: errors.length === 0, errors };
}

// ===== PLUGIN MANAGEMENT =====

export async function installPlugin(path: string): Promise<Plugin> {
  try {
    const manifestPath = join(path, "oh-plugin.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`ملف البيان غير موجود: oh-plugin.json (Manifest not found at ${manifestPath})`);
    }

    const manifest = readManifest(manifestPath);
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`فشل التحقق من البيان: ${validation.errors.join("; ")}`);
    }

    if (plugins.has(manifest.name)) {
      throw new Error(`البرنامج "${manifest.name}" مثبت مسبقاً (Plugin "${manifest.name}" is already installed)`);
    }

    const pluginsDir = getPluginsDir();
    const targetDir = join(pluginsDir, manifest.name);

    if (existsSync(targetDir)) {
      throw new Error(`البرنامج "${manifest.name}" موجود مسبقاً في مسار التثبيت`);
    }

    ensureDir(pluginsDir);

    const entryPath = join(path, manifest.entry);
    if (!existsSync(entryPath)) {
      throw new Error(`ملف المدخل غير موجود: ${manifest.entry} (Entry point not found)`);
    }

    copyRecursive(path, targetDir);

    const config: Record<string, any> = {};
    if (manifest.config) {
      for (const [key, def] of Object.entries(manifest.config)) {
        config[key] = def.default;
      }
    }

    const plugin: Plugin = {
      manifest,
      enabled: true,
      installedAt: new Date(),
      config,
    };

    try {
      const module = await import(/* @vite-ignore */ join(targetDir, manifest.entry));
      if (typeof module.onLoad === "function") plugin.onLoad = module.onLoad.bind(module);
      if (typeof module.onUnload === "function") plugin.onUnload = module.onUnload.bind(module);
      if (typeof module.onConfigChange === "function") plugin.onConfigChange = module.onConfigChange.bind(module);
    } catch (e: any) {
      throw new Error(`فشل تحميل البرنامج "${manifest.name}": ${e.message}`);
    }

    if (plugin.onLoad) {
      try {
        await plugin.onLoad();
      } catch (e: any) {
        throw new Error(`فشل in onLoad للبرنامج "${manifest.name}": ${e.message}`);
      }
    }

    plugins.set(manifest.name, plugin);
    savePlugins();
    emit("plugin:installed", { name: manifest.name, type: manifest.type });

    return plugin;
  } catch (e: any) {
    throw new Error(`فشل تثبيت البرنامج: ${e.message}`);
  }
}

export async function uninstallPlugin(name: string): Promise<boolean> {
  try {
    const plugin = plugins.get(name);
    if (!plugin) {
      throw new Error(`البرنامج "${name}" غير موجود (Plugin not found)`);
    }

    if (plugin.onUnload) {
      try {
        await plugin.onUnload();
      } catch (e: any) {
        console.error(`تحذير: onUnload فشل للبرنامج "${name}": ${e.message}`);
      }
    }

    plugins.delete(name);
    emit("plugin:uninstalled", { name });

    const pluginDir = join(getPluginsDir(), name);
    if (existsSync(pluginDir)) {
      rmSync(pluginDir, { recursive: true, force: true });
    }

    savePlugins();
    return true;
  } catch (e: any) {
    throw new Error(`فشل إزالة البرنامج: ${e.message}`);
  }
}

export function enablePlugin(name: string): boolean {
  const plugin = plugins.get(name);
  if (!plugin) return false;
  plugin.enabled = true;
  savePlugins();
  emit("plugin:enabled", { name });
  return true;
}

export function disablePlugin(name: string): boolean {
  const plugin = plugins.get(name);
  if (!plugin) return false;
  plugin.enabled = false;
  savePlugins();
  emit("plugin:disabled", { name });
  return true;
}

export function getPlugin(name: string): Plugin | undefined {
  return plugins.get(name);
}

export function listPlugins(type?: PluginType): Plugin[] {
  const all = Array.from(plugins.values());
  if (type) return all.filter((p) => p.manifest.type === type);
  return all;
}

export async function updatePlugin(name: string): Promise<Plugin | null> {
  try {
    const plugin = plugins.get(name);
    if (!plugin) return null;

    const pluginDir = join(getPluginsDir(), name);
    if (!existsSync(pluginDir)) return null;

    const manifestPath = join(pluginDir, "oh-plugin.json");
    if (!existsSync(manifestPath)) return null;

    const manifest = readManifest(manifestPath);
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`فشل التحقق من البيان: ${validation.errors.join("; ")}`);
    }

    if (plugin.onUnload) {
      try { await plugin.onUnload(); } catch {}
    }

    plugin.manifest = manifest;
    const config: Record<string, any> = {};
    if (manifest.config) {
      for (const [key, def] of Object.entries(manifest.config)) {
        config[key] = plugin.config[key] !== undefined ? plugin.config[key] : def.default;
      }
    }
    plugin.config = config;

    try {
      const module = await import(/* @vite-ignore */ join(pluginDir, manifest.entry) + `?t=${Date.now()}`);
      if (typeof module.onLoad === "function") plugin.onLoad = module.onLoad.bind(module);
      if (typeof module.onUnload === "function") plugin.onUnload = module.onUnload.bind(module);
      if (typeof module.onConfigChange === "function") plugin.onConfigChange = module.onConfigChange.bind(module);
    } catch (e: any) {
      throw new Error(`فشل إعادة تحميل البرنامج "${manifest.name}": ${e.message}`);
    }

    if (plugin.onLoad) {
      try { await plugin.onLoad(); } catch (e: any) {
        throw new Error(`فشل in onLoad للبرنامج "${manifest.name}": ${e.message}`);
      }
    }

    savePlugins();
    return plugin;
  } catch (e: any) {
    throw new Error(`فشل تحديث البرنامج: ${e.message}`);
  }
}

export function getPluginConfig(name: string): Record<string, any> {
  const plugin = plugins.get(name);
  if (!plugin) return {};
  return { ...plugin.config };
}

export function setPluginConfig(name: string, key: string, value: any): void {
  const plugin = plugins.get(name);
  if (!plugin) throw new Error(`البرنامج "${name}" غير موجود`);
  plugin.config[key] = value;
  if (plugin.onConfigChange) {
    try { plugin.onConfigChange(key, value); } catch {}
  }
  savePlugins();
}

// ===== TOOL REGISTRATION =====

export function registerTool(
  name: string,
  description: string,
  handler: (args: any, context: any) => Promise<any>,
  schema: Record<string, any>
): void {
  if (tools.has(name)) {
    throw new Error(`الأداة "${name}" مسجلة مسبقاً (Tool already registered)`);
  }
  tools.set(name, { name, description, handler, schema });
}

export function unregisterTool(name: string): void {
  tools.delete(name);
}

export function getTool(name: string): ToolRegistration | undefined {
  return tools.get(name);
}

export function listTools(): ToolRegistration[] {
  return Array.from(tools.values());
}

export async function executeTool(name: string, args: any, context: any): Promise<any> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`الأداة "${name}" غير موجودة (Tool not found)`);
  if (!tool.handler) throw new Error(`الأداة "${name}" ليس لها معالج (No handler)`);
  try {
    const result = await tool.handler(args, context);
    emit("tool:executed", { name, args, result });
    return result;
  } catch (e: any) {
    emit("tool:error", { name, args, error: e.message });
    throw new Error(`فشل تنفيذ الأداة "${name}": ${e.message}`);
  }
}

// ===== PROVIDER REGISTRATION =====

export function registerProvider(
  name: string,
  description: string,
  modelPattern: string,
  callFunction: (model: string, messages: any[], options?: any) => Promise<any>,
  config: Record<string, any>
): void {
  if (providers.has(name)) {
    throw new Error(`الموفر "${name}" مسجل مسبقاً (Provider already registered)`);
  }
  providers.set(name, { name, description, modelPattern, callFunction, config });
}

export function unregisterProvider(name: string): void {
  providers.delete(name);
}

export function getProvider(name: string): ProviderRegistration | undefined {
  return providers.get(name);
}

export function listProviders(): ProviderRegistration[] {
  return Array.from(providers.values());
}

export function matchProvider(modelId: string): ProviderRegistration | undefined {
  for (const provider of providers.values()) {
    const pattern = provider.modelPattern
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    try {
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(modelId)) return provider;
    } catch {}
  }
  return undefined;
}

// ===== THEME REGISTRATION =====

export function registerTheme(
  name: string,
  colors: Record<string, string>,
  fonts: Record<string, string>,
  radii: Record<string, string>,
  shadows: Record<string, string>
): void {
  themes.set(name, { name, colors, fonts, radii, shadows });
}

export function unregisterTheme(name: string): void {
  themes.delete(name);
}

export function getTheme(name: string): ThemeRegistration | undefined {
  return themes.get(name);
}

export function listThemes(): ThemeRegistration[] {
  return Array.from(themes.values());
}

export function applyTheme(name: string): void {
  const theme = themes.get(name);
  if (!theme) throw new Error(`السمة "${name}" غير موجودة (Theme not found)`);

  const cssLines: string[] = [":root {"];

  for (const [key, value] of Object.entries(theme.colors)) {
    cssLines.push(`  --oh-color-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(theme.fonts)) {
    cssLines.push(`  --oh-font-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(theme.radii)) {
    cssLines.push(`  --oh-radius-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(theme.shadows)) {
    cssLines.push(`  --oh-shadow-${key}: ${value};`);
  }

  cssLines.push("}");
  const css = cssLines.join("\n");

  if (typeof document !== "undefined" && document.createElement) {
    const style = document.createElement("style");
    style.id = `oh-theme-${name}`;
    style.textContent = css;
    document.head.appendChild(style);
  }

  if (typeof process !== "undefined" && process.stdout) {
    for (const [key, value] of Object.entries(theme.colors)) {
      process.stdout.write(`\x1b]4;${key};${value}\x07`);
    }
  }

  emit("theme:applied", { name, css });
}

// ===== MARKETPLACE =====

function getMarketplaceUrl(): string {
  const config = getConfig() as any;
  return config.marketplaceUrl || "https://oh.marketplace/api/plugins";
}

export async function publishPlugin(manifest: PluginManifest): Promise<boolean> {
  try {
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`بيان غير صالح: ${validation.errors.join("; ")}`);
    }

    const url = getMarketplaceUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      throw new Error(`فشل النشر: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (e: any) {
    throw new Error(`فشل نشر البرنامج: ${e.message}`);
  }
}

export async function listMarketplace(type?: PluginType): Promise<PluginManifest[]> {
  try {
    const url = getMarketplaceUrl();
    const query = type ? `?type=${type}` : "";
    const response = await fetch(`${url}${query}`);
    if (!response.ok) throw new Error(`فشل جلب السوق: ${response.status}`);
    return await response.json() as PluginManifest[];
  } catch (e: any) {
    throw new Error(`فشل جلب قائمة السوق: ${e.message}`);
  }
}

export async function searchMarketplace(query: string): Promise<PluginManifest[]> {
  try {
    const url = getMarketplaceUrl();
    const response = await fetch(`${url}?search=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`فشل البحث في السوق: ${response.status}`);
    return await response.json() as PluginManifest[];
  } catch (e: any) {
    throw new Error(`فشل البحث في السوق: ${e.message}`);
  }
}

// ===== SCAFFOLDING =====

export function scaffoldPlugin(name: string, type: PluginType, outputDir: string): void {
  const pluginDir = join(outputDir, name);
  if (existsSync(pluginDir)) {
    throw new Error(`المسار "${pluginDir}" موجود مسبقاً (Directory already exists)`);
  }

  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(join(pluginDir, "src"), { recursive: true });

  const manifest: PluginManifest = {
    name,
    version: "1.0.0",
    description: `OH ${type} plugin: ${name}`,
    author: "",
    type,
    entry: "src/index.js",
    minOHVersion: "2.0.0",
    tags: [type],
    config: {},
  };

  writeFileSync(
    join(pluginDir, "oh-plugin.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  const entryTs = `import type { Plugin } from "oh";

export const onLoad: Plugin["onLoad"] = async () => {
  console.log("${name} loaded!");
};

export const onUnload: Plugin["onUnload"] = async () => {
  console.log("${name} unloaded!");
};

export const onConfigChange: Plugin["onConfigChange"] = (key: string, value: any) => {
  console.log("${name} config changed:", key, value);
};
`;

  writeFileSync(join(pluginDir, "src", "index.ts"), entryTs, "utf-8");

  const readme = `# ${name}

OH ${type} plugin.

## Installation

\`\`\`bash
oh plugin install <path>
\`\`\`

## Development

\`\`\`bash
npm install
npm run build
\`\`\`
`;

  writeFileSync(join(pluginDir, "README.md"), readme, "utf-8");

  emit("plugin:scaffolded", { name, type, path: pluginDir });
}

export function validatePlugin(dir: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(dir)) {
    errors.push("المسار غير موجود (Directory does not exist)");
    return { valid: false, errors, warnings };
  }

  const manifestPath = join(dir, "oh-plugin.json");
  if (!existsSync(manifestPath)) {
    errors.push("oh-plugin.json غير موجود (Manifest not found)");
    return { valid: false, errors, warnings };
  }

  let manifest: PluginManifest;
  try {
    manifest = readManifest(manifestPath);
  } catch (e: any) {
    errors.push(`البيان غير صالح: ${e.message}`);
    return { valid: false, errors, warnings };
  }

  const validation = validateManifest(manifest);
  errors.push(...validation.errors);

  if (manifest.tags && manifest.tags.length > 10) {
    warnings.push("عدد الوسوم كبير جداً (يُفضل أقل من 10) (Too many tags, prefer < 10)");
  }
  if (manifest.permissions && manifest.permissions.length > 20) {
    warnings.push("عدد الصلاحيات كبير جداً (يُفضل أقل من 20) (Too many permissions)");
  }
  if (manifest.description && manifest.description.length > 200) {
    warnings.push("الوصف طويل جداً (يُفضل أقل من 200 حرف) (Description too long)");
  }

  const entryPath = join(dir, manifest.entry);
  if (!existsSync(entryPath)) {
    errors.push(`ملف المدخل غير موجود: ${manifest.entry} (Entry point not found)`);
  }

  if (manifest.icon && !existsSync(join(dir, manifest.icon))) {
    warnings.push(`الأيقونة غير موجودة: ${manifest.icon} (Icon not found)`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ===== EVENTS =====

export function on(event: string, callback: EventCallback): void {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, []);
  }
  eventHandlers.get(event)!.push(callback);
}

export function emit(event: string, data: any): void {
  const handlers = eventHandlers.get(event);
  if (handlers) {
    for (const handler of handlers) {
      try { handler(data); } catch (e: any) {
        console.error(`خطأ في معالج الحدث "${event}": ${e.message}`);
      }
    }
  }
}

export function off(event: string, callback: EventCallback): void {
  const handlers = eventHandlers.get(event);
  if (handlers) {
    const idx = handlers.indexOf(callback);
    if (idx >= 0) handlers.splice(idx, 1);
  }
}

// ===== STORAGE =====

function savePlugins(): void {
  try {
    const pluginsDir = getPluginsDir();
    ensureDir(pluginsDir);
    const data = Array.from(plugins.values()).map((p) => ({
      manifest: p.manifest,
      enabled: p.enabled,
      installedAt: p.installedAt.toISOString(),
      config: p.config,
    }));
    writeFileSync(join(pluginsDir, "plugins.json"), JSON.stringify(data, null, 2), "utf-8");
  } catch (e: any) {
    console.error(`فشل حفظ البرامج: ${e.message}`);
  }
}

function copyRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

(async () => {
  try { await loadPlugins(); } catch {}
})();

async function loadPlugins(): Promise<void> {
  try {
    const pluginsDir = getPluginsDir();
    const dataPath = join(pluginsDir, "plugins.json");
    if (!existsSync(dataPath)) return;

    const raw = readFileSync(dataPath, "utf-8");
    const data = JSON.parse(raw) as Array<{
      manifest: PluginManifest;
      enabled: boolean;
      installedAt: string;
      config: Record<string, any>;
    }>;

    for (const item of data) {
      const plugin: Plugin = {
        manifest: item.manifest,
        enabled: item.enabled,
        installedAt: new Date(item.installedAt),
        config: item.config,
      };

      const pluginDir = join(pluginsDir, item.manifest.name);
      if (existsSync(join(pluginDir, item.manifest.entry))) {
        try {
          const module = await loadPluginModule(join(pluginDir, item.manifest.entry));
          if (typeof module.onLoad === "function") plugin.onLoad = module.onLoad.bind(module);
          if (typeof module.onUnload === "function") plugin.onUnload = module.onUnload.bind(module);
          if (typeof module.onConfigChange === "function") plugin.onConfigChange = module.onConfigChange.bind(module);
        } catch (e: any) {
          console.error(`تحذير: فشل تحميل البرنامج "${item.manifest.name}": ${e.message}`);
        }
      }

      plugins.set(item.manifest.name, plugin);
    }
  } catch (e: any) {
    console.error(`فشل تحميل سجل البرامج: ${e.message}`);
  }
}

async function loadPluginModule(modulePath: string): Promise<any> {
  const url = new URL(`file://${modulePath.replace(/\\/g, "/")}`).href;
  try {
    return await import(url);
  } catch {
    return await import(/* @vite-ignore */ modulePath);
  }
}
