import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";
import chalk from "chalk";

export interface CostRecord {
  id: string;
  timestamp: Date;
  agentId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  duration: number;
  operation: string;
  cached: boolean;
  userId?: string;
}

export interface CostSummary {
  total: number;
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
  byDay: Record<string, number>;
  byOperation: Record<string, number>;
  periodStart: Date;
  periodEnd: Date;
  cacheSavings: number;
  routingSavings: number;
  averageCostPerRequest: number;
}

export interface Budget {
  id: string;
  name: string;
  period: "daily" | "weekly" | "monthly" | "custom";
  limit: number;
  spent: number;
  alerts: BudgetAlert[];
  status: "active" | "exceeded" | "paused";
  startDate: Date;
  endDate?: Date;
}

export interface BudgetAlert {
  threshold: number;
  action: "notify" | "pause" | "warn";
  triggered: boolean;
  triggeredAt?: Date;
}

export interface OptimizationSuggestion {
  type: "model-switch" | "caching" | "batching" | "local-model";
  description: string;
  estimatedSavings: number;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
}

export interface CostSettings {
  currency: string;
  budgetNotifications: boolean;
  autoOptimize: boolean;
  trackPerRequest: boolean;
  monthlyBudgetLimit: number;
  alertThresholds: number[];
}

const AR = {
  total: "الإجمالي",
  byAgent: "حسب الوكيل",
  byModel: "حسب النموذج",
  byDay: "حسب اليوم",
  byOperation: "حسب العملية",
  cacheSavings: "توفير التخزين المؤقت",
  routingSavings: "توفير التوجيه",
  avgCost: "متوسط التكلفة",
  active: "نشط",
  exceeded: "تجاوز",
  paused: "متوقف",
  notify: "إشعار",
  pause: "إيقاف",
  warn: "تحذير",
  day: "يومي",
  week: "أسبوعي",
  month: "شهري",
  custom: "مخصص",
  noRecords: "لا توجد سجلات تكلفة",
};

function costDir(): string {
  return join(getConfig().dataDir, "cost");
}

function recordsPath(): string {
  return join(costDir(), "records.json");
}

function budgetsPath(): string {
  return join(costDir(), "budgets.json");
}

function settingsPath(): string {
  return join(costDir(), "settings.json");
}

function isAr(): boolean {
  return getConfig().lang === "ar";
}

function generateId(): string {
  return `cst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MODEL_COST_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-4": { in: 0.03, out: 0.06 },
  "gpt-4-turbo": { in: 0.01, out: 0.03 },
  "gpt-3.5-turbo": { in: 0.0005, out: 0.0015 },
  "claude-3-opus": { in: 0.015, out: 0.075 },
  "claude-3-sonnet": { in: 0.003, out: 0.015 },
  "claude-3-haiku": { in: 0.00025, out: 0.00125 },
  "claude-3-5-sonnet": { in: 0.003, out: 0.015 },
  "gemini-pro": { in: 0.0005, out: 0.0015 },
  "gemini-ultra": { in: 0.01, out: 0.03 },
  "llama-3-70b": { in: 0.0008, out: 0.0012 },
  "llama-3-8b": { in: 0.0001, out: 0.0002 },
  "mistral-large": { in: 0.002, out: 0.006 },
  "mixtral-8x7b": { in: 0.0003, out: 0.001 },
  "deepseek-coder": { in: 0.00014, out: 0.00028 },
  "command-r-plus": { in: 0.003, out: 0.015 },
  default: { in: 0.001, out: 0.002 },
};

function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COST_PER_1K[model] || MODEL_COST_PER_1K.default;
  return (tokensIn / 1000) * rates.in + (tokensOut / 1000) * rates.out;
}

const _defaultSettings: CostSettings = {
  currency: "USD",
  budgetNotifications: true,
  autoOptimize: false,
  trackPerRequest: true,
  monthlyBudgetLimit: 50,
  alertThresholds: [50, 80, 100],
};

let _settings: CostSettings = { ..._defaultSettings };

function loadSettings(): void {
  try {
    const p = settingsPath();
    if (existsSync(p)) {
      _settings = { ..._defaultSettings, ...JSON.parse(readFileSync(p, "utf-8")) };
    }
  } catch {}
}

function saveSettings(): void {
  try {
    ensureDir(costDir());
    writeFileSync(settingsPath(), JSON.stringify(_settings, null, 2), "utf-8");
  } catch {}
}

function loadCostRecords(): CostRecord[] {
  try {
    const p = recordsPath();
    if (!existsSync(p)) return [];
    const raw = readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).map((r: any) => ({
      ...r,
      timestamp: new Date(r.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveCostRecords(records: CostRecord[]): void {
  try {
    ensureDir(costDir());
    writeFileSync(recordsPath(), JSON.stringify(records, null, 2), "utf-8");
  } catch {}
}

function loadBudgets(): Budget[] {
  try {
    const p = budgetsPath();
    if (!existsSync(p)) return [];
    const raw = readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).map((b: any) => ({
      ...b,
      startDate: new Date(b.startDate),
      endDate: b.endDate ? new Date(b.endDate) : undefined,
      alerts: b.alerts.map((a: any) => ({ ...a, triggeredAt: a.triggeredAt ? new Date(a.triggeredAt) : undefined })),
    }));
  } catch {
    return [];
  }
}

function saveBudgetsData(budgets: Budget[]): void {
  try {
    ensureDir(costDir());
    writeFileSync(budgetsPath(), JSON.stringify(budgets, null, 2), "utf-8");
  } catch {}
}

export function recordCost(opts: Omit<CostRecord, "id" | "timestamp">): CostRecord {
  try {
    const record: CostRecord = {
      id: generateId(),
      timestamp: new Date(),
      agentId: opts.agentId,
      model: opts.model,
      tokensIn: opts.tokensIn,
      tokensOut: opts.tokensOut,
      cost: opts.cost >= 0 ? opts.cost : calculateCost(opts.model, opts.tokensIn, opts.tokensOut),
      duration: opts.duration,
      operation: opts.operation,
      cached: opts.cached,
      userId: opts.userId,
    };

    const records = loadCostRecords();
    records.push(record);
    saveCostRecords(records);
    return record;
  } catch (err) {
    throw err;
  }
}

export function getCosts(options: { agentId?: string; model?: string; startDate?: Date; endDate?: Date; limit?: number }): CostRecord[] {
  try {
    let records = loadCostRecords();
    if (options.agentId) records = records.filter(r => r.agentId === options.agentId);
    if (options.model) records = records.filter(r => r.model === options.model);
    if (options.startDate) records = records.filter(r => r.timestamp >= options.startDate!);
    if (options.endDate) records = records.filter(r => r.timestamp <= options.endDate!);
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    if (options.limit && options.limit > 0) records = records.slice(0, options.limit);
    return records;
  } catch {
    return [];
  }
}

export function getCostSummary(startDate: Date, endDate: Date): CostSummary {
  try {
    const records = getCosts({ startDate, endDate });
    const total = records.reduce((sum, r) => sum + r.cost, 0);
    const byAgent: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    let cacheSavings = 0;
    let routingSavings = 0;

    for (const r of records) {
      byAgent[r.agentId] = (byAgent[r.agentId] || 0) + r.cost;
      byModel[r.model] = (byModel[r.model] || 0) + r.cost;
      byOperation[r.operation] = (byOperation[r.operation] || 0) + r.cost;
      const dayKey = r.timestamp.toISOString().slice(0, 10);
      byDay[dayKey] = (byDay[dayKey] || 0) + r.cost;
      if (r.cached) cacheSavings += r.cost;
    }

    const estimatedWithoutRouting = records.reduce((sum, r) => {
      const rates = MODEL_COST_PER_1K[r.model] || MODEL_COST_PER_1K.default;
      return sum + (r.tokensIn / 1000) * rates.in + (r.tokensOut / 1000) * rates.out;
    }, 0);
    routingSavings = Math.max(0, estimatedWithoutRouting - total);

    return {
      total,
      byAgent,
      byModel,
      byDay,
      byOperation,
      periodStart: startDate,
      periodEnd: endDate,
      cacheSavings,
      routingSavings,
      averageCostPerRequest: records.length > 0 ? total / records.length : 0,
    };
  } catch {
    return {
      total: 0, byAgent: {}, byModel: {}, byDay: {}, byOperation: {},
      periodStart: startDate, periodEnd: endDate,
      cacheSavings: 0, routingSavings: 0, averageCostPerRequest: 0,
    };
  }
}

export function getCostByAgent(agentId: string, startDate: Date, endDate: Date): { records: CostRecord[]; total: number } {
  try {
    const records = getCosts({ agentId, startDate, endDate });
    const total = records.reduce((sum, r) => sum + r.cost, 0);
    return { records, total };
  } catch {
    return { records: [], total: 0 };
  }
}

export function getCostByModel(model: string, startDate: Date, endDate: Date): { records: CostRecord[]; total: number } {
  try {
    const records = getCosts({ model, startDate, endDate });
    const total = records.reduce((sum, r) => sum + r.cost, 0);
    return { records, total };
  } catch {
    return { records: [], total: 0 };
  }
}

export function getTodayCost(): number {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const records = getCosts({ startDate: today, endDate: tomorrow });
    return records.reduce((sum, r) => sum + r.cost, 0);
  } catch {
    return 0;
  }
}

export function getThisMonthCost(): number {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const records = getCosts({ startDate: start, endDate: end });
    return records.reduce((sum, r) => sum + r.cost, 0);
  } catch {
    return 0;
  }
}

export function createBudget(opts: Omit<Budget, "id" | "spent" | "status">): Budget {
  try {
    const budget: Budget = {
      id: generateId(),
      name: opts.name,
      period: opts.period,
      limit: opts.limit,
      spent: 0,
      alerts: opts.alerts.map(a => ({ ...a, triggered: false })),
      status: "active",
      startDate: opts.startDate,
      endDate: opts.endDate,
    };

    const budgets = loadBudgets();
    budgets.push(budget);
    saveBudgetsData(budgets);
    return budget;
  } catch (err) {
    throw err;
  }
}

export function getBudget(id: string): Budget | null {
  try {
    const budgets = loadBudgets();
    return budgets.find(b => b.id === id) || null;
  } catch {
    return null;
  }
}

export function listBudgets(): Budget[] {
  try {
    return loadBudgets();
  } catch {
    return [];
  }
}

export function updateBudget(id: string, updates: Partial<Budget>): boolean {
  try {
    const budgets = loadBudgets();
    const idx = budgets.findIndex(b => b.id === id);
    if (idx === -1) return false;
    budgets[idx] = { ...budgets[idx], ...updates };
    saveBudgetsData(budgets);
    return true;
  } catch {
    return false;
  }
}

export function deleteBudget(id: string): boolean {
  try {
    const budgets = loadBudgets();
    const idx = budgets.findIndex(b => b.id === id);
    if (idx === -1) return false;
    budgets.splice(idx, 1);
    saveBudgetsData(budgets);
    return true;
  } catch {
    return false;
  }
}

export function checkBudgets(): BudgetAlert[] {
  try {
    const budgets = loadBudgets();
    const triggeredAlerts: BudgetAlert[] = [];
    const now = Date.now();

    for (const budget of budgets) {
      if (budget.status === "paused") continue;

      let periodCost = 0;
      const periodStart = new Date(budget.startDate);
      let periodEnd = budget.endDate ? new Date(budget.endDate) : new Date();

      switch (budget.period) {
        case "daily": {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          periodStart.setTime(today.getTime());
          periodEnd = new Date(today.getTime() + 86400000);
          break;
        }
        case "weekly": {
          const startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          periodStart.setTime(startOfWeek.getTime());
          periodEnd = new Date(startOfWeek.getTime() + 7 * 86400000);
          break;
        }
        case "monthly": {
          const now2 = new Date();
          periodStart.setFullYear(now2.getFullYear(), now2.getMonth(), 1);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(now2.getFullYear(), now2.getMonth() + 1, 1);
          break;
        }
      }

      const records = getCosts({ startDate: periodStart, endDate: periodEnd });
      periodCost = records.reduce((sum, r) => sum + r.cost, 0);
      budget.spent = periodCost;

      for (const alert of budget.alerts) {
        if (alert.triggered) continue;
        const percentage = budget.limit > 0 ? (periodCost / budget.limit) * 100 : 0;
        if (percentage >= alert.threshold) {
          alert.triggered = true;
          alert.triggeredAt = new Date();
          triggeredAlerts.push(alert);

          if (alert.action === "pause") {
            budget.status = "paused";
          } else if (percentage >= 100) {
            budget.status = "exceeded";
          }
        }
      }
    }

    saveBudgetsData(budgets);
    return triggeredAlerts;
  } catch {
    return [];
  }
}

export function getOptimizationSuggestions(): OptimizationSuggestion[] {
  try {
    const suggestions: OptimizationSuggestion[] = [];
    const records = loadCostRecords();
    if (records.length === 0) return suggestions;

    const monthAgo = new Date(Date.now() - 30 * 86400000);
    const recentRecords = records.filter(r => r.timestamp >= monthAgo);
    const totalCost = recentRecords.reduce((sum, r) => sum + r.cost, 0);

    const modelUsage: Record<string, { count: number; cost: number }> = {};
    for (const r of recentRecords) {
      if (!modelUsage[r.model]) modelUsage[r.model] = { count: 0, cost: 0 };
      modelUsage[r.model].count++;
      modelUsage[r.model].cost += r.cost;
    }

    const expensiveModels = Object.entries(modelUsage)
      .filter(([_, v]) => v.cost > totalCost * 0.3)
      .sort(([, a], [, b]) => b.cost - a.cost);

    for (const [model, usage] of expensiveModels) {
      const cheaperAlt = getCheaperAlternative(model);
      if (cheaperAlt) {
        const savings = usage.cost * 0.4;
        suggestions.push({
          type: "model-switch",
          description: isAr()
            ? `التبديل من ${model} إلى ${cheaperAlt} (أرخص بنسبة ~40%)`
            : `Switch from ${model} to ${cheaperAlt} (~40% cheaper)`,
          estimatedSavings: Math.round(savings * 100) / 100,
          effort: "low",
          impact: "high",
        });
      }
    }

    const cacheRate = recentRecords.filter(r => r.cached).length / recentRecords.length;
    if (cacheRate < 0.3) {
      suggestions.push({
        type: "caching",
        description: isAr()
          ? "تفعيل التخزين المؤقت للطلبات المتكررة — توفير يصل إلى 60%"
          : "Enable caching for frequent requests — up to 60% savings",
        estimatedSavings: Math.round(totalCost * 0.3 * 100) / 100,
        effort: "medium",
        impact: "high",
      });
    }

    const highFrequencyModels = Object.entries(modelUsage)
      .filter(([_, v]) => v.count > 50 && v.cost > totalCost * 0.1);
    if (highFrequencyModels.length > 0) {
      suggestions.push({
        type: "batching",
        description: isAr()
          ? "تجميع الطلبات الصغيرة في دفعات — تقليل التكلفة بنسبة 20-30%"
          : "Batch small requests together — reduce cost by 20-30%",
        estimatedSavings: Math.round(totalCost * 0.15 * 100) / 100,
        effort: "medium",
        impact: "medium",
      });
    }

    const localModelPossibility = recentRecords.filter(r =>
      ["chat", "completion", "summarize"].includes(r.operation)
    ).length;
    if (localModelPossibility > recentRecords.length * 0.5) {
      suggestions.push({
        type: "local-model",
        description: isAr()
          ? "استخدام نموذج محلي للمهام البسيطة — توفير كامل للتكلفة"
          : "Use local model for simple tasks — eliminate API cost",
        estimatedSavings: Math.round(totalCost * 0.5 * 100) / 100,
        effort: "high",
        impact: "high",
      });
    }

    return suggestions;
  } catch {
    return [];
  }
}

function getCheaperAlternative(model: string): string | null {
  const alternatives: Record<string, string> = {
    "gpt-4": "gpt-4-turbo",
    "gpt-4-turbo": "gpt-3.5-turbo",
    "claude-3-opus": "claude-3-sonnet",
    "claude-3-sonnet": "claude-3-haiku",
    "gemini-ultra": "gemini-pro",
    "llama-3-70b": "llama-3-8b",
    "mistral-large": "mixtral-8x7b",
    "command-r-plus": "command-r",
    "deepseek-coder": "deepseek-chat",
  };
  return alternatives[model] || null;
}

export function generateCostReport(period: "day" | "week" | "month"): string {
  try {
    const now = new Date();
    let start: Date;
    switch (period) {
      case "day": { start = new Date(now); start.setHours(0, 0, 0, 0); break; }
      case "week": { start = new Date(now); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0); break; }
      case "month": { start = new Date(now.getFullYear(), now.getMonth(), 1); break; }
    }

    const summary = getCostSummary(start, now);
    const suggestions = getOptimizationSuggestions();
    const ar = isAr();
    const h = chalk.hex;
    const cyan = h("#06B6D4");
    const green = h("#10B981");
    const yellow = h("#F59E0B");
    const red = h("#EF4444");
    const gray = h("#94A3A8");
    const white = h("#F8FAFC");
    const line = "─".repeat(55);

    let out = "\n";
    out += cyan(`  ╔${line}╗\n`);
    out += cyan("  ║") + `  ${ar ? "تقرير التكاليف" : "Cost Report"} — ${period.toUpperCase()}` + cyan("  ║\n");
    out += cyan(`  ╠${line}╣\n`);
    out += cyan("  ║") + `  ${ar ? "الإجمالي" : "Total"}: ${summary.total > 10 ? red : summary.total > 5 ? yellow : green}($${summary.total.toFixed(4)})` + cyan("  ║\n");
    out += cyan("  ║") + `  ${ar ? "متوسط التكلفة لكل طلب" : "Avg cost/request"}: ${gray(`$${summary.averageCostPerRequest.toFixed(6)}`)}` + cyan("  ║\n");
    out += cyan("  ║") + `  ${ar ? "توفير التخزين المؤقت" : "Cache savings"}: ${green(`$${summary.cacheSavings.toFixed(4)}`)}` + cyan("  ║\n");
    out += cyan("  ║") + `  ${ar ? "توفير التوجيه" : "Routing savings"}: ${green(`$${summary.routingSavings.toFixed(4)}`)}` + cyan("  ║\n");

    const topModels = Object.entries(summary.byModel).sort(([, a], [, b]) => b - a).slice(0, 3);
    if (topModels.length > 0) {
      out += cyan(`  ║${" ".repeat(55)}║\n`);
      out += cyan("  ║") + `  ${ar ? "أعلى النماذج تكلفة" : "Top Models"}:` + cyan("  ║\n");
      for (const [model, cost] of topModels) {
        out += cyan("  ║") + `    • ${model}: ${yellow(`$${cost.toFixed(4)}`)}` + cyan("  ║\n");
      }
    }

    if (suggestions.length > 0) {
      out += cyan(`  ║${" ".repeat(55)}║\n`);
      out += cyan("  ║") + `  ${ar ? "اقتراحات التحسين" : "Optimizations"}:` + cyan("  ║\n");
      for (const s of suggestions.slice(0, 3)) {
        const impactColor = s.impact === "high" ? green : s.impact === "medium" ? yellow : gray;
        out += cyan("  ║") + `    • ${s.description.slice(0, 48)} ${impactColor(`-$${s.estimatedSavings.toFixed(2)}/mo`)}` + cyan("  ║\n");
      }
    }

    out += cyan(`  ╚${line}╝\n`);
    return out;
  } catch {
    return "";
  }
}

export function getCostTrend(days: number): { date: string; cost: number }[] {
  try {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    const records = getCosts({ startDate: start, endDate: end });
    const dailyMap: Record<string, number> = {};

    for (const r of records) {
      const dayKey = r.timestamp.toISOString().slice(0, 10);
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + r.cost;
    }

    const trend: { date: string; cost: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      trend.unshift({ date: key, cost: dailyMap[key] || 0 });
    }
    return trend;
  } catch {
    return [];
  }
}

export function isFreeTier(): boolean {
  try {
    const cfg = getConfig();
    return cfg.provider === "free";
  } catch {
    return true;
  }
}

export function getFreeTierUsage(): { used: number; limit: number; remaining: number; resetsAt: Date } {
  try {
    const dailyLimit = 100;
    const used = getTodayCost();
    const resetDate = new Date();
    resetDate.setDate(resetDate.getDate() + 1);
    resetDate.setHours(0, 0, 0, 0);
    return {
      used,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - used),
      resetsAt: resetDate,
    };
  } catch {
    return { used: 0, limit: 100, remaining: 100, resetsAt: new Date() };
  }
}

export function getCostSettings(): CostSettings {
  return { ..._settings };
}

export function setCostSettings(settings: Partial<CostSettings>): void {
  _settings = { ..._settings, ...settings };
  saveSettings();
}

loadSettings();
