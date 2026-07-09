import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { getConfig, ensureDir } from "../config/index.js";
import chalk from "chalk";

export interface HealthReport {
  timestamp: Date;
  overall: HealthStatus;
  score: number;
  checks: HealthCheck[];
  autoActions: AutoAction[];
  warnings: string[];
  critical: string[];
}

export type HealthStatus = "healthy" | "degraded" | "critical";

export interface HealthCheck {
  name: string;
  category: "code" | "dependencies" | "memory" | "security" | "performance" | "storage" | "network";
  status: "passed" | "warning" | "failed";
  details: string;
  value?: string | number;
  threshold?: string | number;
  autoFixAvailable?: boolean;
  autoFixApplied?: boolean;
}

export interface AutoAction {
  action: string;
  result: "success" | "failed" | "skipped";
  details: string;
  duration: number;
}

function healthDir(): string {
  return join(getConfig().dataDir, "health");
}

function reportsPath(): string {
  return join(healthDir(), "reports.json");
}

export async function runFullHealthCheck(): Promise<HealthReport> {
  const checks = await Promise.all([
    checkCodeQuality(),
    checkDependencies(),
    checkMemoryHealth(),
    checkSecurity(),
    checkPerformance(),
    checkStorage(),
    checkNetwork(),
  ]);

  const warnings: string[] = [];
  const critical: string[] = [];
  let passed = 0;
  let totalScore = 0;

  for (const c of checks) {
    if (c.status === "passed") passed++;
    if (c.status === "warning") warnings.push(c.details);
    if (c.status === "failed") critical.push(c.details);
    totalScore += c.status === "passed" ? 100 : c.status === "warning" ? 60 : 20;
  }

  const score = Math.round(totalScore / checks.length);
  let overall: HealthStatus = "healthy";
  if (critical.length > 0) overall = "critical";
  else if (warnings.length > 0) overall = "degraded";

  let autoActions: AutoAction[] = [];
  const cfg = getConfig() as any;
  if (cfg.autoFix !== false) {
    autoActions = await autoFixIssues({ timestamp: new Date(), overall, score, checks, autoActions: [], warnings, critical });
  }

  const report: HealthReport = {
    timestamp: new Date(),
    overall,
    score,
    checks,
    autoActions,
    warnings,
    critical,
  };

  saveReport(report);
  return report;
}

export async function checkCodeQuality(): Promise<HealthCheck> {
  try {
    const srcDir = join(process.cwd(), "src");
    if (!existsSync(srcDir)) return { name: "Code Quality", category: "code", status: "passed", details: "No src/ directory" };

    const findings: string[] = [];
    const deprecatedPatterns = [
      { pattern: /require\(/g, hint: "Use import instead of require()" },
      { pattern: /any\s*\)/g, hint: "Avoid 'any' types — use proper typing" },
      { pattern: /console\.log\(/g, hint: "Replace console.log with proper logging" },
      { pattern: /eval\(/g, hint: "Avoid eval() — security risk" },
    ];

    function walkDir(dir: string): void {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          walkDir(full);
        } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
          const content = readFileSync(full, "utf-8");
          for (const { pattern, hint } of deprecatedPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              findings.push(`${hint} (${matches.length}x) — ${full.replace(process.cwd() + "\\", "")}`);
            }
          }
        }
      }
    }
    walkDir(srcDir);

    if (findings.length === 0) {
      return { name: "Code Quality", category: "code", status: "passed", details: "No issues found in src/" };
    }
    return {
      name: "Code Quality",
      category: "code",
      status: findings.length > 5 ? "failed" : "warning",
      details: `${findings.length} code quality issue${findings.length > 1 ? "s" : ""} found`,
      value: findings.length,
      threshold: "5",
      autoFixAvailable: false,
    };
  } catch (err) {
    return { name: "Code Quality", category: "code", status: "failed", details: `Check error: ${(err as Error).message}` };
  }
}

export async function checkDependencies(): Promise<HealthCheck> {
  try {
    const pkgPath = join(process.cwd(), "package.json");
    if (!existsSync(pkgPath)) return { name: "Dependencies", category: "dependencies", status: "passed", details: "No package.json" };

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const total = Object.keys(allDeps).length;
    let outdated = 0;
    let criticalVulns = 0;

    try {
      const auditOut = execSync("npm audit --json 2>nul", { encoding: "utf-8", timeout: 15000 });
      const audit = JSON.parse(auditOut);
      if (audit.vulnerabilities) {
        for (const vuln of Object.values(audit.vulnerabilities) as any[]) {
          if (vuln.severity === "critical" || vuln.severity === "high") criticalVulns++;
        }
      }
    } catch {}

    try {
      const outdateOut = execSync("npm outdated --json 2>nul", { encoding: "utf-8", timeout: 15000 });
      if (outdateOut && outdateOut !== "{}") {
        const outdatedJson = JSON.parse(outdateOut);
        outdated = Object.keys(outdatedJson).length;
      }
    } catch {}

    if (criticalVulns === 0 && outdated === 0) {
      return { name: "Dependencies", category: "dependencies", status: "passed", details: `${total} dependencies up to date` };
    }
    const issues: string[] = [];
    if (criticalVulns > 0) issues.push(`${criticalVulns} critical/high vulnerabilities`);
    if (outdated > 0) issues.push(`${outdated} outdated packages`);
    const status = criticalVulns > 0 ? "failed" : "warning";
    return {
      name: "Dependencies", category: "dependencies", status, details: issues.join("; "),
      value: criticalVulns + outdated, threshold: "0", autoFixAvailable: true,
    };
  } catch (err) {
    return { name: "Dependencies", category: "dependencies", status: "failed", details: `Check error: ${(err as Error).message}` };
  }
}

export async function checkMemoryHealth(): Promise<HealthCheck> {
  try {
    const dataDir = getConfig().dataDir;
    if (!existsSync(dataDir)) return { name: "Memory Health", category: "memory", status: "passed", details: "No data directory" };

    const jsonFiles = ["memory.json", "graph.json", "secrets.json", "stats.json", "sessions.json"];
    let corrupted = 0;
    let staleCount = 0;
    let totalEntries = 0;
    const now = Date.now();

    for (const f of jsonFiles) {
      const fp = join(dataDir, f);
      if (!existsSync(fp)) continue;
      try {
        const raw = readFileSync(fp, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          totalEntries += parsed.length;
          staleCount += parsed.filter((e: any) => e.timestamp && now - new Date(e.timestamp).getTime() > 7 * 86400000).length;
        } else if (typeof parsed === "object" && parsed !== null) {
          totalEntries += Object.keys(parsed).length;
        }
      } catch {
        corrupted++;
      }
    }

    const status = corrupted > 0 ? "failed" : staleCount > 100 ? "warning" : "passed";
    const details = corrupted > 0
      ? `${corrupted} corrupted file(s)`
      : staleCount > 0
        ? `${staleCount} stale entries (older than 7 days)`
        : `${totalEntries} entries healthy`;

    return {
      name: "Memory Health", category: "memory", status, details,
      value: corrupted || staleCount || totalEntries,
      threshold: "0 corrupted, <100 stale", autoFixAvailable: staleCount > 0,
    };
  } catch (err) {
    return { name: "Memory Health", category: "memory", status: "failed", details: `Check error: ${(err as Error).message}` };
  }
}

export async function checkSecurity(): Promise<HealthCheck> {
  try {
    const issues: string[] = [];

    const envPath = join(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf-8");
      if (envContent.includes("=")) issues.push(".env file present — ensure not committed");
    }

    const gitignorePath = join(process.cwd(), ".gitignore");
    if (existsSync(gitignorePath)) {
      const gi = readFileSync(gitignorePath, "utf-8");
      if (!gi.includes(".env")) issues.push(".env not listed in .gitignore");
    }

    const apiKeyPatterns = [
      /sk-[a-zA-Z0-9]{20,}/g,
      /AIza[0-9A-Za-z_-]{35}/g,
      /ghp_[a-zA-Z0-9]{36}/g,
      /xox[bpr]-[a-zA-Z0-9-]{10,}/g,
      /AKIA[0-9A-Z]{16}/g,
    ];

    function scanDir(dir: string): string[] {
      const found: string[] = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") {
          found.push(...scanDir(full));
        } else if (entry.isFile() && /\.(ts|js|tsx|jsx|json|yml|yaml|env)$/.test(entry.name)) {
          const content = readFileSync(full, "utf-8");
          for (const pattern of apiKeyPatterns) {
            if (pattern.test(content)) {
              found.push(full.replace(process.cwd() + "\\", ""));
              break;
            }
          }
        }
      }
      return found;
    }

    const srcDir = join(process.cwd(), "src");
    if (existsSync(srcDir)) {
      const keyMatches = scanDir(srcDir);
      if (keyMatches.length > 0) issues.push(`Possible API keys in ${keyMatches.length} source file(s)`);
    }

    if (issues.length === 0) {
      return { name: "Security", category: "security", status: "passed", details: "No security issues detected" };
    }
    return {
      name: "Security", category: "security", status: "failed", details: issues.join("; "),
      value: issues.length, threshold: "0", autoFixAvailable: false,
    };
  } catch (err) {
    return { name: "Security", category: "security", status: "failed", details: `Check error: ${(err as Error).message}` };
  }
}

export async function checkPerformance(): Promise<HealthCheck> {
  try {
    const mem = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

    let startupMs = 0;
    const startMarkerPath = join(healthDir(), "startup.txt");
    if (existsSync(startMarkerPath)) {
      try {
        const lastStart = parseInt(readFileSync(startMarkerPath, "utf-8").trim(), 10);
        startupMs = Date.now() - lastStart;
      } catch {}
    }
    writeFileSync(startMarkerPath, String(Date.now()), "utf-8");

    const cmdSampleMs = await measureCommandTime();

    const issues: string[] = [];
    if (heapMB > 200) issues.push(`High heap usage: ${heapMB}MB`);
    if (cmdSampleMs > 2000) issues.push(`Slow command execution: ${cmdSampleMs}ms`);
    if (rssMB > 500) issues.push(`High RSS: ${rssMB}MB`);

    const status = issues.length === 0 ? "passed" : issues.length > 1 ? "warning" : "warning";
    const details = issues.length > 0
      ? issues.join("; ")
      : `Heap: ${heapMB}MB/${heapTotalMB}MB, RSS: ${rssMB}MB, Cmd: ${cmdSampleMs}ms`;

    return {
      name: "Performance", category: "performance", status, details,
      value: `${heapMB}MB heap`,
      threshold: "<200MB heap, <2000ms cmd",
    };
  } catch (err) {
    return { name: "Performance", category: "performance", status: "failed", details: `Check error: ${(err as Error).message}` };
  }
}

async function measureCommandTime(): Promise<number> {
  const start = Date.now();
  try {
    execSync("node -e ''", { timeout: 5000 });
  } catch {}
  return Date.now() - start;
}

export async function checkStorage(): Promise<HealthCheck> {
  try {
    const dataDir = getConfig().dataDir;
    if (!existsSync(dataDir)) return { name: "Storage", category: "storage", status: "passed", details: "No data directory" };

    let totalSize = 0;
    let fileCount = 0;
    let cacheCount = 0;
    const largest: { name: string; size: number }[] = [];

    function walkDir(dir: string): void {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "cache") {
            const cacheFiles = readdirSync(full);
            cacheCount += cacheFiles.length;
            for (const cf of cacheFiles) {
              try {
                totalSize += statSync(join(full, cf)).size;
                fileCount++;
              } catch {}
            }
          } else {
            walkDir(full);
          }
        } else {
          try {
            const s = statSync(full);
            totalSize += s.size;
            fileCount++;
            largest.push({ name: full.replace(dataDir + "\\", ""), size: s.size });
          } catch {}
        }
      }
    }
    walkDir(dataDir);
    largest.sort((a, b) => b.size - a.size);

    const totalMB = (totalSize / 1024 / 1024).toFixed(1);
    const topFiles = largest.slice(0, 3).map(f => `${f.name} (${(f.size / 1024).toFixed(0)}KB)`).join(", ");

    const status = parseFloat(totalMB) > 500 ? "warning" : "passed";
    return {
      name: "Storage", category: "storage", status,
      details: `${totalMB}MB used, ${fileCount} files, ${cacheCount} cache files`,
      value: `${totalMB}MB`,
      threshold: "<500MB",
      autoFixAvailable: cacheCount > 0,
    };
  } catch (err) {
    return { name: "Storage", category: "storage", status: "failed", details: `Check error: ${(err as Error).message}` };
  }
}

export async function checkNetwork(): Promise<HealthCheck> {
  try {
    const endpoints = [
      { name: "npm registry", url: "https://registry.npmjs.org/" },
      { name: "GitHub API", url: "https://api.github.com/" },
      { name: "OpenRouter", url: "https://openrouter.ai/api/v1/auth/key" },
    ];

    let reachable = 0;
    let maxMs = 0;

    for (const ep of endpoints) {
      try {
        const start = Date.now();
        const resp = await fetch(ep.url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        const ms = Date.now() - start;
        if (resp.ok || resp.status === 401 || resp.status === 403) {
          reachable++;
          if (ms > maxMs) maxMs = ms;
        }
      } catch {}
    }

    const status = reachable === endpoints.length ? "passed" : reachable > 0 ? "warning" : "failed";
    const details = reachable === endpoints.length
      ? `All ${endpoints.length} endpoints reachable (max ${maxMs}ms)`
      : `${reachable}/${endpoints.length} endpoints reachable`;

    return {
      name: "Network", category: "network", status, details,
      value: `${maxMs}ms`,
      threshold: "<5000ms",
    };
  } catch (err) {
    return { name: "Network", category: "network", status: "failed", details: `Check error: ${(err as Error).message}` };
  }
}

export function generateReportText(report: HealthReport): string {
  const { overall, score, checks, autoActions, warnings, critical } = report;
  const isAr = getConfig().lang === "ar";
  const dateStr = new Date(report.timestamp).toISOString().slice(0, 19).replace("T", " ");

  const statusIcon = overall === "healthy" ? "🟢" : overall === "degraded" ? "🟡" : "🔴";
  const statusLabel = isAr
    ? (overall === "healthy" ? "سليم" : overall === "degraded" ? "منخفض" : "خطير")
    : overall;

  const passed = checks.filter(c => c.status === "passed").length;
  const warns = checks.filter(c => c.status === "warning").length;
  const failed = checks.filter(c => c.status === "failed").length;

  const h = chalk.hex;
  const cyan = h("#06B6D4");
  const gray = h("#94A3B8");
  const green = h("#10B981");
  const yellow = h("#F59E0B");
  const red = h("#EF4444");
  const white = h("#F8FAFC");
  const dim = h("#64748B");

  const line = "─".repeat(57);

  let out = "\n";
  out += cyan(`  ╔${line}╗\n`);
  out += cyan("  ║") + `  ${isAr ? "تقرير الصحة اليومي" : "OH Daily Health Report"} — ${dateStr}` + cyan("  ║\n");
  out += cyan(`  ╠${line}╣\n`);
  out += cyan("  ║") + `  ${statusIcon} ${isAr ? "الحالة" : "Status"}: ${overall === "healthy" ? green : overall === "degraded" ? yellow : red(statusLabel)} (${isAr ? "النتيجة" : "Score"}: ${overall === "healthy" ? green(score + "/100") : overall === "degraded" ? yellow(score + "/100") : red(score + "/100")})` + cyan("  ║\n");
  out += cyan(`  ║${" ".repeat(57)}║\n`);
  out += cyan("  ║") + `  ✅ ${isAr ? "ناجح" : "All Clear"} (${passed})` + (warns > 0 ? `    ⚠️  ${isAr ? "تحذيرات" : "Warnings"} (${warns})` : "") + (failed > 0 ? `    ❌ ${isAr ? "حرجة" : "Critical"} (${failed})` : "") + cyan("  ║\n");

  if (warnings.length > 0) {
    out += cyan(`  ║${" ".repeat(57)}║\n`);
    for (const w of warnings) {
      out += cyan("  ║") + `  ${yellow("⚠")} ${w.slice(0, 54)}` + cyan("  ║\n");
    }
  }

  if (critical.length > 0) {
    out += cyan(`  ║${" ".repeat(57)}║\n`);
    for (const c of critical) {
      out += cyan("  ║") + `  ${red("✖")} ${c.slice(0, 54)}` + cyan("  ║\n");
    }
  }

  if (autoActions.length > 0) {
    out += cyan(`  ║${" ".repeat(57)}║\n`);
    out += cyan("  ║") + `  ${isAr ? "الإجراءات التلقائية" : "Auto-Actions Taken"}:` + cyan("  ║\n");
    for (const act of autoActions) {
      const icon = act.result === "success" ? green("•") : act.result === "failed" ? red("•") : gray("•");
      out += cyan("  ║") + `  ${icon} ${act.action} — ${act.result === "success" ? green(act.result) : act.result === "failed" ? red(act.result) : gray(act.result)} (${act.duration}ms)` + cyan("  ║\n");
    }
  }

  out += cyan(`  ╚${line}╝\n`);
  return out;
}

export async function autoFixIssues(report: HealthReport): Promise<AutoAction[]> {
  const actions: AutoAction[] = [];

  const storageCheck = report.checks.find(c => c.category === "storage");
  if (storageCheck?.autoFixAvailable) {
    actions.push(await autoFixCache());
  }

  const memoryCheck = report.checks.find(c => c.category === "memory");
  if (memoryCheck?.autoFixAvailable) {
    actions.push(await autoFixMemory());
  }

  const depsCheck = report.checks.find(c => c.category === "dependencies");
  if (depsCheck?.autoFixAvailable) {
    actions.push(await autoFixDependencies());
  }

  return actions;
}

export async function autoFixCache(): Promise<AutoAction> {
  const start = Date.now();
  try {
    const dataDir = getConfig().dataDir;
    const cacheDir = join(dataDir, "cache");
    let cleaned = 0;
    let count = 0;

    if (existsSync(cacheDir)) {
      const files = readdirSync(cacheDir);
      for (const file of files) {
        const fp = join(cacheDir, file);
        try {
          cleaned += statSync(fp).size;
          rmSync(fp);
          count++;
        } catch {}
      }
    }

    const proxyCache = join(dataDir, "proxy-cache.json");
    if (existsSync(proxyCache)) {
      try {
        const size = statSync(proxyCache).size;
        cleaned += size;
        writeFileSync(proxyCache, JSON.stringify({}), "utf-8");
        count++;
      } catch {}
    }

    return {
      action: `Cleaned ${count} cache files (${(cleaned / 1024).toFixed(0)}KB)`,
      result: "success",
      details: `Removed ${count} cache entries`,
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      action: "Clean cache",
      result: "failed",
      details: (err as Error).message,
      duration: Date.now() - start,
    };
  }
}

export async function autoFixMemory(): Promise<AutoAction> {
  const start = Date.now();
  try {
    const dataDir = getConfig().dataDir;
    const memPath = join(dataDir, "memory.json");
    let removed = 0;

    if (existsSync(memPath)) {
      const raw = readFileSync(memPath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        const now = Date.now();
        const filtered = data.filter((e: any) => {
          if (e.timestamp && now - new Date(e.timestamp).getTime() > 30 * 86400000) {
            removed++;
            return false;
          }
          return true;
        });
        writeFileSync(memPath, JSON.stringify(filtered, null, 2), "utf-8");
      }
    }

    return {
      action: `Removed ${removed} stale memory entries`,
      result: "success",
      details: `Trimmed memory store (older than 30 days)`,
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      action: "Optimize memory",
      result: "failed",
      details: (err as Error).message,
      duration: Date.now() - start,
    };
  }
}

export async function autoFixDependencies(): Promise<AutoAction> {
  const start = Date.now();
  try {
    execSync("npm audit fix --production 2>nul", { encoding: "utf-8", timeout: 60000 });
    return {
      action: "Ran npm audit fix",
      result: "success",
      details: "Auto-fixed dependency vulnerabilities",
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      action: "Fix dependencies",
      result: "failed",
      details: (err as Error).message,
      duration: Date.now() - start,
    };
  }
}

export function scheduleDailyHealth(time?: string): void {
  const schedulePath = join(healthDir(), "schedule.txt");
  const scheduledTime = time || "03:00";
  ensureDir(healthDir());
  writeFileSync(schedulePath, scheduledTime, "utf-8");
}

export async function runHealthNow(): Promise<HealthReport> {
  const report = await runFullHealthCheck();
  console.log(generateReportText(report));
  return report;
}

export function getLastReport(): HealthReport | null {
  try {
    const reports = loadReports();
    return reports.length > 0 ? reports[reports.length - 1] : null;
  } catch {
    return null;
  }
}

export function getReportHistory(limit?: number): HealthReport[] {
  try {
    const reports = loadReports();
    return limit ? reports.slice(-limit) : reports;
  } catch {
    return [];
  }
}

function saveReport(report: HealthReport): void {
  try {
    ensureDir(healthDir());
    const reports = loadReports();
    reports.push(report);
    writeFileSync(reportsPath(), JSON.stringify(reports, null, 2), "utf-8");
  } catch {}
}

function loadReports(): HealthReport[] {
  try {
    if (!existsSync(reportsPath())) return [];
    const raw = readFileSync(reportsPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
