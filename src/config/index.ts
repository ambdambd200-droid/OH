import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { Lang } from "../i18n/index.js";

export interface Config {
  lang: Lang;
  theme: "dark" | "light";
  provider: "free" | "openai" | "anthropic" | "openrouter";
  model: string;
  dataDir: string;
  debug: boolean;
  apiKey?: string;
}

const CONFIG_DIR = join(homedir(), ".oh");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const defaults: Config = {
  lang: "en",
  theme: "dark",
  provider: "free",
  model: "meta-llama/llama-4-maverick:free",
  dataDir: join(CONFIG_DIR, "data"),
  debug: false,
};

let config: Config = { ...defaults };

export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureDir(CONFIG_DIR);
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      config = { ...defaults, ...JSON.parse(raw) };
    } catch {
      config = { ...defaults };
    }
  }
  return config;
}

export function saveConfig(): void {
  ensureDir(CONFIG_DIR);
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfig(): Config {
  return config;
}

export function setConfig<K extends keyof Config>(key: K, value: Config[K]): void {
  config[key] = value;
  saveConfig();
}

export function resetConfig(): void {
  config = { ...defaults };
  saveConfig();
}
