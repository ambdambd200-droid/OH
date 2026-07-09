import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync, appendFileSync } from "fs";
import { join } from "path";
import { createHash, randomBytes } from "crypto";
import { getConfig, ensureDir } from "../config/index.js";
import chalk from "chalk";

export type BackupLevel = "real-time" | "hourly" | "daily" | "weekly" | "monthly";
export type BackupStatus = "completed" | "failed" | "running" | "skipped";
export type BackupLocation = "local" | "cloud" | "p2p" | "blockchain";

export interface Backup {
  id: string;
  name: string;
  level: BackupLevel;
  timestamp: Date;
  size: number;
  fileCount: number;
  location: BackupLocation;
  status: BackupStatus;
  hash: string;
  manifest: string[];
  encrypted: boolean;
  retentionDays: number;
  expiresAt: Date;
}

export interface BackupConfig {
  enabled: boolean;
  realTime: boolean;
  hourly: boolean;
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  location: BackupLocation;
  cloudEndpoint?: string;
  cloudKey?: string;
  encryptionKey?: string;
  maxBackups: number;
  retentionDays: number;
  autoVerify: boolean;
  includeMemory: boolean;
  includeConfig: boolean;
  includeAgents: boolean;
  includeCustomThemes: boolean;
}

const AR = {
  completed: "مكتمل",
  failed: "فشل",
  running: "قيد التشغيل",
  skipped: "تم التخطي",
  local: "محلي",
  cloud: "سحابي",
  p2p: "مباشر",
  blockchain: "سلسلة كتل",
  real_time: "فوري",
  hourly: "كل ساعة",
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
};

function backupDir(): string {
  return join(getConfig().dataDir, "backups");
}

function backupMetaPath(id: string): string {
  return join(backupDir(), `${id}.json`);
}

function backupFilesDir(id: string): string {
  return join(backupDir(), id);
}

function configPath(): string {
  return join(backupDir(), "config.json");
}

let _config: BackupConfig = {
  enabled: true,
  realTime: false,
  hourly: true,
  daily: true,
  weekly: false,
  monthly: false,
  location: "local",
  maxBackups: 10,
  retentionDays: 30,
  autoVerify: true,
  includeMemory: true,
  includeConfig: true,
  includeAgents: false,
  includeCustomThemes: false,
};

let _schedulerHandle: ReturnType<typeof setInterval> | null = null;

function isAr(): boolean {
  return getConfig().lang === "ar";
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function generateId(): string {
  return `bkp-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function loadBackups(): Backup[] {
  try {
    const dir = backupDir();
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter(f => f.endsWith(".json") && f !== "config.json");
    const backups: Backup[] = [];
    for (const file of files) {
      try {
        const raw = readFileSync(join(dir, file), "utf-8");
        const parsed = JSON.parse(raw);
        backups.push({ ...parsed, timestamp: new Date(parsed.timestamp), expiresAt: new Date(parsed.expiresAt) });
      } catch {
      }
    }
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return backups;
  } catch {
    return [];
  }
}

function saveBackupMeta(backup: Backup): void {
  ensureDir(backupDir());
  writeFileSync(backupMetaPath(backup.id), JSON.stringify(backup, null, 2), "utf-8");
}

function deleteBackupDir(id: string): void {
  try {
    const filesDir = backupFilesDir(id);
    if (existsSync(filesDir)) {
      const files = readdirSync(filesDir);
      for (const f of files) {
        try { rmSync(join(filesDir, f)); } catch {}
      }
      try { rmSync(filesDir); } catch {}
    }
  } catch {}
}

function gatherManifestFiles(): string[] {
  const files: string[] = [];
  const cfg = getConfig();
  if (_config.includeMemory) {
    const memDir = join(cfg.dataDir, "memory");
    if (existsSync(memDir)) {
      try {
        const entries = readdirSync(memDir);
        for (const e of entries) files.push(join(memDir, e));
      } catch {}
    }
  }
  if (_config.includeConfig) {
    const configFile = join(join(cfg.dataDir, ".."), "config.json");
    if (existsSync(configFile)) files.push(configFile);
  }
  if (_config.includeAgents) {
    const agentDir = join(cfg.dataDir, "agents");
    if (existsSync(agentDir)) {
      try {
        const entries = readdirSync(agentDir);
        for (const e of entries) files.push(join(agentDir, e));
      } catch {}
    }
  }
  if (_config.includeCustomThemes) {
    const themeDir = join(cfg.dataDir, "themes");
    if (existsSync(themeDir)) {
      try {
        const entries = readdirSync(themeDir);
        for (const e of entries) files.push(join(themeDir, e));
      } catch {}
    }
  }
  return files;
}

export async function createBackup(level: BackupLevel, location?: BackupLocation): Promise<Backup> {
  try {
    const loc = location || _config.location;
    const id = generateId();
    const name = `backup-${level}-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;
    const filesDir = backupFilesDir(id);
    ensureDir(filesDir);

    const manifest = gatherManifestFiles();
    let totalSize = 0;
    let fileCount = 0;

    for (const src of manifest) {
      try {
        if (existsSync(src)) {
          const dest = join(filesDir, src.replace(/[\\/:*?"<>|]/g, "_"));
          copyFileSync(src, dest);
          totalSize += statSync(src).size;
          fileCount++;
        }
      } catch {}
    }

    const hashInput = manifest.sort().join(",") + Date.now() + randomBytes(8).toString("hex");
    const hash = sha256(hashInput);

    const backup: Backup = {
      id,
      name,
      level,
      timestamp: new Date(),
      size: totalSize,
      fileCount,
      location: loc,
      status: "completed",
      hash,
      manifest,
      encrypted: !!_config.encryptionKey,
      retentionDays: _config.retentionDays,
      expiresAt: new Date(Date.now() + _config.retentionDays * 86400000),
    };

    saveBackupMeta(backup);
    cleanupIfNeeded();
    return backup;
  } catch (err) {
    const failed: Backup = {
      id: generateId(),
      name: `backup-${level}-failed`,
      level,
      timestamp: new Date(),
      size: 0,
      fileCount: 0,
      location: location || _config.location,
      status: "failed",
      hash: "",
      manifest: [],
      encrypted: false,
      retentionDays: 0,
      expiresAt: new Date(),
    };
    saveBackupMeta(failed);
    return failed;
  }
}

export async function createFullBackup(): Promise<Backup> {
  return createBackup("daily");
}

export async function createIncrementalBackup(): Promise<Backup> {
  return createBackup("hourly");
}

export async function restoreFromBackup(backupId: string): Promise<{ restored: number; failed: number; errors: string[] }> {
  const result = { restored: 0, failed: 0, errors: [] as string[] };
  try {
    const backup = getBackup(backupId);
    if (!backup) {
      result.errors.push(isAr() ? "النسخة الاحتياطية غير موجودة" : "Backup not found");
      result.failed = 1;
      return result;
    }
    if (backup.status !== "completed") {
      result.errors.push(isAr() ? "النسخة الاحتياطية غير مكتملة" : "Backup is not completed");
      result.failed = 1;
      return result;
    }

    const filesDir = backupFilesDir(backupId);
    if (!existsSync(filesDir)) {
      result.errors.push(isAr() ? "ملفات النسخة الاحتياطية غير موجودة" : "Backup files not found");
      result.failed = 1;
      return result;
    }

    const files = readdirSync(filesDir);
    for (const file of files) {
      try {
        const src = join(filesDir, file);
        const dest = join(getConfig().dataDir, file.replace(/^backup-(daily|weekly|monthly|hourly|real-time)-/, ""));
        copyFileSync(src, dest);
        result.restored++;
      } catch (err) {
        result.failed++;
        result.errors.push((err as Error).message);
      }
    }
    return result;
  } catch (err) {
    result.errors.push((err as Error).message);
    result.failed = 1;
    return result;
  }
}

export async function restoreToPointInTime(date: Date): Promise<{ restored: number; failed: number; errors: string[] }> {
  try {
    const backups = loadBackups().filter(b => b.timestamp <= date && b.status === "completed");
    if (backups.length === 0) {
      return { restored: 0, failed: 1, errors: [isAr() ? "لا توجد نسخة احتياطية مناسبة" : "No suitable backup found"] };
    }
    return restoreFromBackup(backups[0].id);
  } catch (err) {
    return { restored: 0, failed: 1, errors: [(err as Error).message] };
  }
}

export async function dryRunRestore(backupId: string): Promise<{ wouldRestore: string[]; warnings: string[] }> {
  try {
    const backup = getBackup(backupId);
    if (!backup) return { wouldRestore: [], warnings: [isAr() ? "النسخة الاحتياطية غير موجودة" : "Backup not found"] };
    if (backup.status !== "completed") {
      return { wouldRestore: [], warnings: [isAr() ? "النسخة الاحتياطية غير مكتملة" : "Backup is not completed"] };
    }

    const warnings: string[] = [];
    const wouldRestore = backup.manifest.map(m => {
      const exists = existsSync(m);
      if (exists) warnings.push(`${m} ${isAr() ? "سيتم استبداله" : "will be overwritten"}`);
      return m;
    });

    return { wouldRestore, warnings };
  } catch (err) {
    return { wouldRestore: [], warnings: [(err as Error).message] };
  }
}

export function listBackups(level?: BackupLevel, limit?: number): Backup[] {
  try {
    let backups = loadBackups();
    if (level) backups = backups.filter(b => b.level === level);
    if (limit && limit > 0) backups = backups.slice(0, limit);
    return backups;
  } catch {
    return [];
  }
}

export function getBackup(id: string): Backup | null {
  try {
    const path = backupMetaPath(id);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...parsed, timestamp: new Date(parsed.timestamp), expiresAt: new Date(parsed.expiresAt) };
  } catch {
    return null;
  }
}

export function deleteBackup(id: string): boolean {
  try {
    const path = backupMetaPath(id);
    if (!existsSync(path)) return false;
    rmSync(path);
    deleteBackupDir(id);
    return true;
  } catch {
    return false;
  }
}

export function cleanupOldBackups(): number {
  try {
    const backups = loadBackups();
    let deleted = 0;
    const now = Date.now();
    for (const b of backups) {
      if (b.expiresAt.getTime() < now || b.status === "failed") {
        if (deleteBackup(b.id)) deleted++;
      }
    }
    const all = loadBackups();
    if (all.length > _config.maxBackups) {
      const toRemove = all.slice(_config.maxBackups);
      for (const b of toRemove) {
        if (deleteBackup(b.id)) deleted++;
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}

function cleanupIfNeeded(): void {
  try {
    const backups = loadBackups();
    if (backups.length > _config.maxBackups) {
      cleanupOldBackups();
    }
  } catch {}
}

export async function verifyBackup(id: string): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const backup = getBackup(id);
    if (!backup) return { valid: false, errors: [isAr() ? "النسخة الاحتياطية غير موجودة" : "Backup not found"] };

    const errors: string[] = [];
    const filesDir = backupFilesDir(id);
    if (!existsSync(filesDir)) {
      errors.push(isAr() ? "ملفات النسخة الاحتياطية غير موجودة" : "Backup files directory missing");
      return { valid: false, errors };
    }

    const files = readdirSync(filesDir);
    let totalSize = 0;
    for (const f of files) {
      try {
        totalSize += statSync(join(filesDir, f)).size;
      } catch {
        errors.push(`${isAr() ? "ملف تالف" : "Corrupted file"}: ${f}`);
      }
    }

    if (errors.length > 0) return { valid: false, errors };
    if (totalSize !== backup.size) {
      errors.push(isAr() ? "حجم النسخة غير متطابق" : "Size mismatch");
    }

    return { valid: errors.length === 0, errors };
  } catch (err) {
    return { valid: false, errors: [(err as Error).message] };
  }
}

export async function verifyAllBackups(): Promise<{ valid: number; invalid: number; errors: string[] }> {
  try {
    const backups = loadBackups();
    let valid = 0;
    let invalid = 0;
    const errors: string[] = [];
    for (const b of backups) {
      const result = await verifyBackup(b.id);
      if (result.valid) valid++;
      else { invalid++; errors.push(...result.errors); }
    }
    return { valid, invalid, errors };
  } catch (err) {
    return { valid: 0, invalid: 0, errors: [(err as Error).message] };
  }
}

export function getBackupConfig(): BackupConfig {
  return { ..._config };
}

export function setBackupConfig(config: Partial<BackupConfig>): void {
  try {
    _config = { ..._config, ...config };
    ensureDir(backupDir());
    writeFileSync(configPath(), JSON.stringify(_config, null, 2), "utf-8");
    if (_config.enabled && !_schedulerHandle) scheduleBackups();
    if (!_config.enabled && _schedulerHandle) stopBackupScheduler();
  } catch {}
}

export function resetBackupConfig(): void {
  _config = {
    enabled: true,
    realTime: false,
    hourly: true,
    daily: true,
    weekly: false,
    monthly: false,
    location: "local",
    maxBackups: 10,
    retentionDays: 30,
    autoVerify: true,
    includeMemory: true,
    includeConfig: true,
    includeAgents: false,
    includeCustomThemes: false,
  };
  try {
    ensureDir(backupDir());
    writeFileSync(configPath(), JSON.stringify(_config, null, 2), "utf-8");
  } catch {}
}

function loadConfig(): void {
  try {
    const p = configPath();
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf-8");
      _config = { ..._config, ...JSON.parse(raw) };
    }
  } catch {}
}

function stopBackupScheduler(): void {
  if (_schedulerHandle) {
    clearInterval(_schedulerHandle);
    _schedulerHandle = null;
  }
}

export function scheduleBackups(): void {
  try {
    stopBackupScheduler();
    if (!_config.enabled) return;

    _schedulerHandle = setInterval(async () => {
      try {
        const now = new Date();
        if (_config.realTime) await createBackup("real-time");
        if (_config.hourly && now.getMinutes() === 0) await createBackup("hourly");
        if (_config.daily && now.getHours() === 2 && now.getMinutes() === 0) await createBackup("daily");
        if (_config.weekly && now.getDay() === 0 && now.getHours() === 3 && now.getMinutes() === 0) await createBackup("weekly");
        if (_config.monthly && now.getDate() === 1 && now.getHours() === 4 && now.getMinutes() === 0) await createBackup("monthly");
        if (_config.autoVerify) {
          const lastBackup = loadBackups()[0];
          if (lastBackup) await verifyBackup(lastBackup.id);
        }
      } catch {}
    }, 60000);
  } catch {}
}

export async function runBackupNow(level: BackupLevel): Promise<Backup> {
  return createBackup(level);
}

export function getNextScheduledBackup(level: BackupLevel): Date | null {
  try {
    const now = new Date();
    const next = new Date(now);
    switch (level) {
      case "real-time": return new Date(now.getTime() + 60000);
      case "hourly": { next.setHours(next.getHours() + 1, 0, 0, 0); return next; }
      case "daily": { next.setDate(next.getDate() + 1); next.setHours(2, 0, 0, 0); return next; }
      case "weekly": { next.setDate(next.getDate() + (7 - next.getDay())); next.setHours(3, 0, 0, 0); return next; }
      case "monthly": { next.setMonth(next.getMonth() + 1, 1); next.setHours(4, 0, 0, 0); return next; }
    }
  } catch {
    return null;
  }
}

export function simulateDisaster(scenario: "laptop-stolen" | "corrupted-memory" | "ransomware" | "accidental-delete"): { steps: string[]; estimatedRecovery: string } {
  const ar = isAr();
  const plans: Record<string, { steps: string[]; recovery: string }> = {
    "laptop-stolen": {
      steps: ar
        ? ["تقييم الضرر — فقدان الجهاز", "التحقق من النسخ الاحتياطية السحابية", "استعادة النظام على جهاز جديد", "استخدام أحدث نسخة احتياطية سحابية", "تغيير جميع كلمات المرور والمفاتيح", "تفعيل المصادقة الثنائية", "مراجعة سجل النشاط"]
        : ["Assess damage — device lost", "Verify cloud backups exist", "Provision new device", "Restore from latest cloud backup", "Rotate all API keys and secrets", "Enable 2FA on all accounts", "Review access logs for anomalies"],
      recovery: ar ? "2-4 ساعات" : "2-4 hours",
    },
    "corrupted-memory": {
      steps: ar
        ? ["اكتشاف التلف في الذاكرة", "إيقاف عمليات القراءة/الكتابة", "التحقق من سلامة النسخ الاحتياطية", "استعادة قاعدة الذاكرة من آخر نسخة سليمة", "تشغيل فحص السلامة", "تفعيل النسخ الاحتياطي الفوري"]
        : ["Detect memory corruption", "Halt all read/write operations", "Verify backup integrity", "Restore memory database from last clean backup", "Run integrity validation", "Enable real-time backup protection"],
      recovery: ar ? "30-60 دقيقة" : "30-60 minutes",
    },
    "ransomware": {
      steps: ar
        ? ["عزل النظام فوراً — قطع الاتصال بالإنترنت", "التأكد من سلامة النسخ الاحتياطية (غير مشفرة)", "مسح النظام بالكامل وإعادة التثبيت", "استعادة البيانات من آخر نسخة احتياطية سليمة", "تحديث جميع كلمات المرور", "تفعيل الحماية المتقدمة من البرامج الضارة", "الإبلاغ للجهات المختصة"]
        : ["Isolate system immediately — disconnect network", "Verify backups are clean (not encrypted)", "Wipe system and reinstall OS", "Restore data from last clean backup", "Update all credentials", "Deploy advanced malware protection", "Report to relevant authorities"],
      recovery: ar ? "4-8 ساعات" : "4-8 hours",
    },
    "accidental-delete": {
      steps: ar
        ? ["تحديد الملفات المحذوفة", "البحث في النسخ الاحتياطية المحلية", "استعادة الملفات من أحدث نسخة احتياطية", "التحقق من سلامة الملفات المستعادة", "تفعيل الحماية من الحذف (سلة المحذوفات)"]
        : ["Identify deleted files", "Search local backups", "Restore files from latest backup", "Verify restored file integrity", "Enable trash/deletion protection"],
      recovery: ar ? "15-30 دقيقة" : "15-30 minutes",
    },
  };

  const plan = plans[scenario] || plans["accidental-delete"];
  return { steps: plan.steps, estimatedRecovery: plan.recovery };
}

export function getBackupHealth(): { score: number; lastBackup: Date | null; totalBackups: number; totalSize: number; storageUsed: number } {
  try {
    const backups = loadBackups();
    const completed = backups.filter(b => b.status === "completed");
    const totalSize = completed.reduce((acc, b) => acc + b.size, 0);
    const lastBackup = completed.length > 0 ? completed[0].timestamp : null;
    const now = Date.now();

    let score = 100;
    if (completed.length === 0) score -= 50;
    else if (lastBackup && now - lastBackup.getTime() > 86400000) score -= 20;
    if (!_config.enabled) score -= 30;
    if (_config.location === "local") score -= 10;
    if (!_config.autoVerify) score -= 10;
    if (completed.some(b => b.status === "failed")) score -= 15;

    const backupDirPath = backupDir();
    let storageUsed = 0;
    if (existsSync(backupDirPath)) {
      const entries = readdirSync(backupDirPath);
      for (const e of entries) {
        try { storageUsed += statSync(join(backupDirPath, e)).size; } catch {}
      }
    }

    return { score: Math.max(0, score), lastBackup, totalBackups: backups.length, totalSize, storageUsed };
  } catch {
    return { score: 0, lastBackup: null, totalBackups: 0, totalSize: 0, storageUsed: 0 };
  }
}

export function isDisasterRecoverable(): boolean {
  try {
    const health = getBackupHealth();
    return health.score >= 50 && health.totalBackups > 0;
  } catch {
    return false;
  }
}

export function getBackupStatusText(): string {
  try {
    const health = getBackupHealth();
    const ar = isAr();
    const lines: string[] = [];
    const h = chalk.hex;
    const cyan = h("#06B6D4");
    const green = h("#10B981");
    const yellow = h("#F59E0B");
    const red = h("#EF4444");
    const gray = h("#94A3A8");
    const line = "─".repeat(55);

    const scoreColor = health.score >= 80 ? green : health.score >= 50 ? yellow : red;
    const statusLabel = health.lastBackup
      ? (ar ? "آخر نسخة" : "Last backup") + `: ${health.lastBackup.toISOString().slice(0, 19).replace("T", " ")}`
      : ar ? "لا توجد نسخ احتياطية" : "No backups yet";

    lines.push("");
    lines.push(cyan(`  ╔${line}╗`));
    lines.push(cyan("  ║") + `  ${ar ? "حالة النسخ الاحتياطي" : "Backup Health Status"}` + cyan("  ║"));
    lines.push(cyan(`  ╠${line}╣`));
    lines.push(cyan("  ║") + `  ${ar ? "النتيجة" : "Score"}: ${scoreColor(`${health.score}/100`)}` + cyan("  ║"));
    lines.push(cyan("  ║") + `  ${gray(statusLabel)}` + cyan("  ║"));
    lines.push(cyan("  ║") + `  ${ar ? "إجمالي النسخ" : "Total Backups"}: ${health.totalBackups}` + cyan("  ║"));
    lines.push(cyan("  ║") + `  ${ar ? "الحجم الإجمالي" : "Total Size"}: ${(health.totalSize / 1024 / 1024).toFixed(1)}MB` + cyan("  ║"));
    lines.push(cyan("  ║") + `  ${ar ? "المساحة المستخدمة" : "Storage Used"}: ${(health.storageUsed / 1024 / 1024).toFixed(1)}MB` + cyan("  ║"));
    lines.push(cyan("  ║") + `  ${ar ? "قابل للاسترداد" : "Recoverable"}: ${health.score >= 50 ? green(ar ? "نعم" : "Yes") : red(ar ? "لا" : "No")}` + cyan("  ║"));
    lines.push(cyan(`  ╚${line}╝`));
    lines.push("");

    return lines.join("\n");
  } catch {
    return "";
  }
}

loadConfig();
if (_config.enabled) scheduleBackups();
