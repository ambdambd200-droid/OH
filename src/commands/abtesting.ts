import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { getConfig, ensureDir } from "../config/index.js";

export interface Experiment {
  id: string;
  name: string;
  agentId: string;
  description: string;
  variants: ExperimentVariant[];
  trafficSplit: number[];
  status: "draft" | "running" | "paused" | "completed";
  metrics: ExperimentMetric[];
  startedAt?: Date;
  completedAt?: Date;
  minSampleSize: number;
  winnerId?: string;
  confidenceLevel: number;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  config: Record<string, any>;
  trafficPercent: number;
  isControl: boolean;
}

export interface ExperimentMetric {
  name: string;
  key: string;
  weight: number;
  higherIsBetter: boolean;
}

export interface ExperimentResult {
  variantId: string;
  variantName: string;
  sampleSize: number;
  metrics: Record<string, number>;
  overallScore: number;
  isWinner: boolean;
  confidence?: number;
}

interface StoredResult {
  experimentId: string;
  variantId: string;
  metric: string;
  value: number;
  userId?: string;
  timestamp: number;
  type: "metric" | "feedback";
}

let _experimentsDir = "";
let _resultsDir = "";

function getDirs(): { experimentsDir: string; resultsDir: string } {
  if (!_experimentsDir) {
    const base = join(getConfig().dataDir, "abtesting");
    _experimentsDir = join(base, "experiments");
    _resultsDir = join(base, "results");
    ensureDir(_experimentsDir);
    ensureDir(_resultsDir);
  }
  return { experimentsDir: _experimentsDir, resultsDir: _resultsDir };
}

function expPath(id: string): string {
  return join(getDirs().experimentsDir, `${id}.json`);
}

function resultsPath(id: string): string {
  return join(getDirs().resultsDir, `${id}.json`);
}

function generateId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadExperiment(id: string): Experiment | null {
  try {
    const p = expPath(id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"), (k, v) => {
      if (k === "startedAt" || k === "completedAt") return v ? new Date(v) : v;
      return v;
    });
  } catch { return null; }
}

function saveExperiment(exp: Experiment): void {
  ensureDir(getDirs().experimentsDir);
  writeFileSync(expPath(exp.id), JSON.stringify(exp, null, 2), "utf-8");
}

function loadResults(experimentId: string): StoredResult[] {
  try {
    const p = resultsPath(experimentId);
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch { return []; }
}

function saveResults(experimentId: string, results: StoredResult[]): void {
  ensureDir(getDirs().resultsDir);
  writeFileSync(resultsPath(experimentId), JSON.stringify(results, null, 2), "utf-8");
}

function hashUserId(userId: string): number {
  const h = createHash("md5").update(userId).digest("hex");
  return parseInt(h.slice(0, 8), 16);
}

export function createExperiment(exp: Omit<Experiment, "id" | "createdAt" | "status" | "winnerId">): Experiment {
  const experiment: Experiment = {
    ...exp,
    id: generateId(),
    status: "draft",
    winnerId: undefined,
    confidenceLevel: exp.confidenceLevel || 0.95,
  };
  saveExperiment(experiment);
  return experiment;
}

export function getExperiment(id: string): Experiment | null {
  return loadExperiment(id);
}

export function listExperiments(status?: Experiment["status"]): Experiment[] {
  try {
    const { experimentsDir } = getDirs();
    if (!existsSync(experimentsDir)) return [];
    const files = readdirSync(experimentsDir).filter(f => f.endsWith(".json"));
    const all = files.map(f => JSON.parse(readFileSync(join(experimentsDir, f), "utf-8")) as Experiment);
    return status ? all.filter(e => e.status === status) : all;
  } catch { return []; }
}

export function updateExperiment(id: string, updates: Partial<Experiment>): boolean {
  const exp = loadExperiment(id);
  if (!exp) return false;
  Object.assign(exp, updates);
  saveExperiment(exp);
  return true;
}

export function deleteExperiment(id: string): boolean {
  try {
    const p = expPath(id);
    if (!existsSync(p)) return false;
    const { rmSync } = require("fs");
    rmSync(p);
    const rp = resultsPath(id);
    if (existsSync(rp)) rmSync(rp);
    return true;
  } catch { return false; }
}

export function startExperiment(id: string): boolean {
  const exp = loadExperiment(id);
  if (!exp || exp.status !== "draft") return false;
  const totalTraffic = exp.trafficSplit.reduce((a, b) => a + b, 0);
  if (totalTraffic !== 100) return false;
  if (exp.variants.length !== exp.trafficSplit.length) return false;
  exp.status = "running";
  exp.startedAt = new Date();
  saveExperiment(exp);
  return true;
}

export function pauseExperiment(id: string): boolean {
  const exp = loadExperiment(id);
  if (!exp || exp.status !== "running") return false;
  exp.status = "paused";
  saveExperiment(exp);
  return true;
}

export function resumeExperiment(id: string): boolean {
  const exp = loadExperiment(id);
  if (!exp || exp.status !== "paused") return false;
  exp.status = "running";
  saveExperiment(exp);
  return true;
}

export function completeExperiment(id: string): ExperimentResult[] {
  const exp = loadExperiment(id);
  if (!exp || exp.status === "draft") return [];
  exp.status = "completed";
  exp.completedAt = new Date();
  const results = getResults(id);
  const winner = getWinner(id);
  if (winner) {
    exp.winnerId = winner.variantId;
  }
  saveExperiment(exp);
  return results;
}

export function getVariantForRequest(experimentId: string, userId?: string): ExperimentVariant {
  const exp = loadExperiment(experimentId);
  if (!exp || exp.variants.length === 0) {
    throw new Error(`Experiment ${experimentId} not found or has no variants`);
  }
  if (exp.winnerId) {
    const winner = exp.variants.find(v => v.id === exp.winnerId);
    if (winner) return winner;
  }
  let bucket: number;
  if (userId) {
    bucket = (hashUserId(userId) % 100) + 1;
  } else {
    bucket = Math.floor(Math.random() * 100) + 1;
  }
  let cumulative = 0;
  for (let i = 0; i < exp.variants.length; i++) {
    cumulative += exp.trafficSplit[i] || 0;
    if (bucket <= cumulative) return exp.variants[i];
  }
  return exp.variants[exp.variants.length - 1];
}

export function recordResult(experimentId: string, variantId: string, metric: string, value: number): void {
  const results = loadResults(experimentId);
  results.push({ experimentId, variantId, metric, value, timestamp: Date.now(), type: "metric" });
  saveResults(experimentId, results);
}

export function recordUserFeedback(experimentId: string, variantId: string, userId: string, rating: number): void {
  const results = loadResults(experimentId);
  results.push({ experimentId, variantId, metric: "user_rating", value: rating, userId, timestamp: Date.now(), type: "feedback" });
  saveResults(experimentId, results);
}

export function getResults(experimentId: string): ExperimentResult[] {
  const exp = loadExperiment(experimentId);
  if (!exp) return [];
  const stored = loadResults(experimentId);
  const variantResults: Record<string, { values: Record<string, number[]>; count: number }> = {};
  for (const v of exp.variants) {
    variantResults[v.id] = { values: {}, count: 0 };
  }
  for (const r of stored) {
    if (!variantResults[r.variantId]) continue;
    if (!variantResults[r.variantId].values[r.metric]) {
      variantResults[r.variantId].values[r.metric] = [];
    }
    variantResults[r.variantId].values[r.metric].push(r.value);
    variantResults[r.variantId].count++;
  }
  return exp.variants.map(v => {
    const vr = variantResults[v.id];
    const metrics: Record<string, number> = {};
    for (const m of exp.metrics) {
      const vals = vr.values[m.key];
      if (vals && vals.length > 0) {
        metrics[m.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
      } else {
        metrics[m.key] = 0;
      }
    }
    let overallScore = 0;
    let totalWeight = 0;
    for (const m of exp.metrics) {
      if (metrics[m.key] !== undefined) {
        overallScore += metrics[m.key] * m.weight;
        totalWeight += m.weight;
      }
    }
    overallScore = totalWeight > 0 ? overallScore / totalWeight : 0;
    return { variantId: v.id, variantName: v.name, sampleSize: vr.count, metrics, overallScore, isWinner: false };
  });
}

export function calculateSignificance(experimentId: string): Record<string, { pValue: number; significant: boolean }> {
  const results = getResults(experimentId);
  const exp = loadExperiment(experimentId);
  if (!exp || results.length < 2) return {};
  const control = results.find(r => {
    const v = exp.variants.find(v => v.id === r.variantId);
    return v?.isControl;
  });
  if (!control) return {};
  const significance: Record<string, { pValue: number; significant: boolean }> = {};
  for (const variant of results) {
    if (variant.variantId === control.variantId) continue;
    const pValue = computePValue(control, variant, exp.metrics);
    significance[variant.variantId] = {
      pValue,
      significant: pValue <= (1 - exp.confidenceLevel),
    };
  }
  return significance;
}

function computePValue(control: ExperimentResult, variant: ExperimentResult, metrics: ExperimentMetric[]): number {
  if (control.sampleSize < 2 || variant.sampleSize < 2) return 1;
  const diffs: number[] = [];
  for (const m of metrics) {
    const cVal = control.metrics[m.key] || 0;
    const vVal = variant.metrics[m.key] || 0;
    diffs.push(vVal - cVal);
  }
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (diffs.length < 2) return 1;
  const variance = diffs.reduce((sum, d) => sum + (d - meanDiff) ** 2, 0) / (diffs.length - 1);
  const stdErr = Math.sqrt(variance / diffs.length);
  if (stdErr === 0) return meanDiff === 0 ? 1 : 0.5;
  const tStat = meanDiff / stdErr;
  const df = Math.min(control.sampleSize, variant.sampleSize) - 1;
  const p = approximatePFromT(Math.abs(tStat), df);
  return Math.min(Math.max(p, 0), 1);
}

function approximatePFromT(t: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + t * t);
  let p = 1 - 0.5 * (1 + Math.sign(t) * (1 - 2 * incompleteBeta(df / 2, 0.5, x)));
  return Math.abs(p);
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return 0;
  if (x === 0 || x === 1) return x;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return bt * continuedFraction(a, b, x) / a;
  }
  return 1 - bt * continuedFraction(b, a, 1 - x) / b;
}

function lgamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function continuedFraction(a: number, b: number, x: number, maxIter: number = 100): number {
  let bj = 1;
  let dj = 1;
  let fj = 1;
  let prev = 0;
  for (let j = 1; j <= maxIter; j++) {
    const m = j % 2 === 0 ? j / 2 : (j - 1) / 2;
    const aj = j % 2 === 0
      ? -(a + m - 1) * (b - m) * x / ((a + 2 * m - 2) * (a + 2 * m - 1))
      : (a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m - 1));
    bj = 1 + aj * bj;
    if (Math.abs(bj) < 1e-30) bj = 1e-30;
    dj = 1 / (1 + aj * dj);
    if (Math.abs(dj) < 1e-30) dj = 1e-30;
    fj *= bj * dj;
    if (Math.abs(fj - prev) < 1e-10) break;
    prev = fj;
  }
  return fj;
}

export function getWinner(experimentId: string): ExperimentResult | null {
  const exp = loadExperiment(experimentId);
  if (!exp) return null;
  const results = getResults(experimentId);
  if (results.length < 2) return null;
  const control = results.find(r => {
    const v = exp.variants.find(v => v.id === r.variantId);
    return v?.isControl;
  });
  if (!control) return null;
  const significance = calculateSignificance(experimentId);
  let best: ExperimentResult | null = null;
  for (const r of results) {
    if (r.variantId === control.variantId) continue;
    const sig = significance[r.variantId];
    if (!sig?.significant) continue;
    const improved = exp.metrics.some(m => {
      if (!m.higherIsBetter) return false;
      return (r.metrics[m.key] || 0) > (control.metrics[m.key] || 0);
    });
    if (!improved) continue;
    if (!best || r.overallScore > best.overallScore) {
      best = { ...r, isWinner: true, confidence: sig.pValue };
    }
  }
  return best;
}

export function autoPromoteWinner(experimentId: string): boolean {
  const exp = loadExperiment(experimentId);
  if (!exp || exp.status !== "running") return false;
  const winner = getWinner(experimentId);
  if (!winner || !winner.confidence) return false;
  const significance = calculateSignificance(experimentId);
  const sig = significance[winner.variantId];
  if (!sig || sig.pValue > (1 - exp.confidenceLevel)) return false;
  exp.winnerId = winner.variantId;
  exp.trafficSplit = exp.variants.map(v => v.id === winner.variantId ? 100 : 0);
  saveExperiment(exp);
  return true;
}

export function getExperimentReport(experimentId: string): string {
  const exp = loadExperiment(experimentId);
  if (!exp) return "Experiment not found.";
  const results = getResults(experimentId);
  const sig = calculateSignificance(experimentId);
  const winner = getWinner(experimentId);
  const lines: string[] = [];
  const sep = "─".repeat(50);
  lines.push(`\n  ╔${sep}╗`);
  lines.push(`  ║  A/B Test Report: ${exp.name.padEnd(27)}║`);
  lines.push(`  ╠${sep}╣`);
  lines.push(`  ║  Status: ${exp.status.padEnd(36)}║`);
  lines.push(`  ║  Agent:  ${exp.agentId.padEnd(36)}║`);
  lines.push(`  ║  Confidence: ${(exp.confidenceLevel * 100).toFixed(0)}%${" ".repeat(29)}║`);
  if (exp.winnerId) {
    const w = exp.variants.find(v => v.id === exp.winnerId);
    lines.push(`  ║  Winner: ${(w?.name || exp.winnerId).padEnd(36)}║`);
  }
  lines.push(`  ╚${sep}╝\n`);
  for (const r of results) {
    const v = exp.variants.find(v => v.id === r.variantId);
    const s = sig[r.variantId];
    lines.push(`  ${v?.isControl ? "◉" : "○"} ${(r.variantName || r.variantId).padEnd(20)} Score: ${r.overallScore.toFixed(4)}  n=${r.sampleSize}`);
    if (s) {
      const sigMark = s.significant ? "✓" : "✗";
      lines.push(`    ${sigMark} p=${s.pValue.toFixed(6)}${s.significant ? " SIGNIFICANT" : " not significant"}`);
    }
    for (const m of exp.metrics) {
      const val = r.metrics[m.key];
      if (val !== undefined) {
        lines.push(`    ${m.key}: ${val.toFixed(4)}${m.higherIsBetter ? " ↑" : " ↓"}`);
      }
    }
    lines.push("");
  }
  if (winner) {
    lines.push(`  Recommended: Promote "${winner.variantName}" to 100% traffic`);
  }
  return lines.join("\n");
}

export function setTrafficSplit(experimentId: string, split: number[]): boolean {
  const exp = loadExperiment(experimentId);
  if (!exp) return false;
  if (split.length !== exp.variants.length) return false;
  const total = split.reduce((a, b) => a + b, 0);
  if (total !== 100) return false;
  exp.trafficSplit = split;
  saveExperiment(exp);
  return true;
}

export async function gradualRollout(experimentId: string, targetSplit: number[], steps: number = 4): Promise<boolean> {
  const exp = loadExperiment(experimentId);
  if (!exp || exp.status !== "running") return false;
  if (targetSplit.length !== exp.variants.length) return false;
  if (targetSplit.reduce((a, b) => a + b, 0) !== 100) return false;
  const currentSplit = [...exp.trafficSplit];
  for (let step = 1; step <= steps; step++) {
    const fraction = step / steps;
    const newSplit = currentSplit.map((c, i) => {
      return Math.round(c + (targetSplit[i] - c) * fraction);
    });
    const diff = 100 - newSplit.reduce((a, b) => a + b, 0);
    if (diff !== 0) newSplit[newSplit.length - 1] += diff;
    exp.trafficSplit = newSplit;
    saveExperiment(exp);
    if (step < steps) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return true;
}

export const EXPERIMENT_TEMPLATES = {
  "model-comparison": {
    metrics: [
      { name: "Response Quality", key: "response_quality", weight: 0.5, higherIsBetter: true },
      { name: "Response Speed", key: "response_speed", weight: 0.2, higherIsBetter: false },
      { name: "Cost Efficiency", key: "cost_efficiency", weight: 0.3, higherIsBetter: true },
    ],
    variants: [
      { id: "control", name: "Control", config: { model: "" }, trafficPercent: 50, isControl: true },
      { id: "test-a", name: "Test A", config: { model: "" }, trafficPercent: 50, isControl: false },
    ],
  },
  "prompt-optimization": {
    metrics: [
      { name: "Relevance", key: "relevance", weight: 0.4, higherIsBetter: true },
      { name: "Accuracy", key: "accuracy", weight: 0.4, higherIsBetter: true },
      { name: "Conciseness", key: "conciseness", weight: 0.2, higherIsBetter: true },
    ],
    variants: [
      { id: "control", name: "Original Prompt", config: { prompt: "" }, trafficPercent: 50, isControl: true },
      { id: "test-a", name: "Optimized Prompt", config: { prompt: "" }, trafficPercent: 50, isControl: false },
    ],
  },
  "tone-testing": {
    metrics: [
      { name: "User Satisfaction", key: "user_satisfaction", weight: 0.5, higherIsBetter: true },
      { name: "Engagement", key: "engagement", weight: 0.3, higherIsBetter: true },
      { name: "Clarity", key: "clarity", weight: 0.2, higherIsBetter: true },
    ],
    variants: [
      { id: "formal", name: "Formal", config: { tone: "formal" }, trafficPercent: 33, isControl: true },
      { id: "casual", name: "Casual", config: { tone: "casual" }, trafficPercent: 33, isControl: false },
      { id: "friendly", name: "Friendly", config: { tone: "friendly" }, trafficPercent: 34, isControl: false },
    ],
  },
};
