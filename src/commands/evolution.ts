import { getConfig, setConfig, ensureDir } from "../config/index.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getModelById, MODELS } from "../proxy/index.js";

export interface EvolutionEvent {
  id: string;
  timestamp: number;
  type: EvolutionEventType;
  data: any;
  outcome?: EvolutionOutcome;
}

export type EvolutionEventType =
  | "user-command"
  | "user-feedback"
  | "error"
  | "performance-degradation"
  | "improvement-suggestion"
  | "usage-pattern"
  | "model-switch"
  | "preference-change"
  | "design-change"
  | "output-analysis";

export interface EvolutionOutcome {
  satisfaction: number;
  timeSpent: number;
  retriesNeeded: number;
  wasHelpful: boolean;
  notes?: string;
}

export interface ImprovementAction {
  id: string;
  type: "adjust-persona-weight" | "update-prompt" | "optimize-model" | "suggest-feature" | "fix-issue" | "apply-preference" | "cache-pattern";
  description: string;
  trigger: string;
  confidence: number;
  appliedAt?: Date;
  rollbackHash?: string;
  status: "pending" | "applied" | "rolled-back" | "failed";
}

export interface LearningProfile {
  userId: string;
  preferences: Record<string, any>;
  commonPatterns: Pattern[];
  skillLevel: Record<string, number>;
  designDNAs: DesignDNA[];
  behaviorHistory: EvolutionEvent[];
  personaWeights: Record<string, number>;
  lastLearningCycle: Date;
}

export interface Pattern {
  id: string;
  trigger: string;
  action: string;
  successRate: number;
  sampleSize: number;
  lastObserved: Date;
}

export interface DesignDNA {
  name: string;
  projectType: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  style: string;
  appliedCount: number;
  userRating: number;
}

function evoDir(): string {
  return join(getConfig().dataDir, "evolution");
}

function snapDir(): string {
  return join(evoDir(), "snapshots");
}

function ensureDirs(): void {
  ensureDir(evoDir());
  ensureDir(snapDir());
}

let _profile: LearningProfile;
let _events: EvolutionEvent[] = [];
let _changelog: ImprovementAction[] = [];

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ===== STORAGE =====
export function getDataDir(): string {
  return evoDir();
}

function profilePath(): string {
  return join(evoDir(), "profile.json");
}

function eventsPath(): string {
  return join(evoDir(), "events.json");
}

function changelogPath(): string {
  return join(evoDir(), "changelog.json");
}

export function loadAll(): void {
  ensureDirs();
  if (existsSync(profilePath())) {
    _profile = JSON.parse(readFileSync(profilePath(), "utf-8"));
  } else {
    _profile = createDefaultProfile();
  }
  if (existsSync(eventsPath())) {
    _events = JSON.parse(readFileSync(eventsPath(), "utf-8"));
  } else {
    _events = [];
  }
  if (existsSync(changelogPath())) {
    _changelog = JSON.parse(readFileSync(changelogPath(), "utf-8"));
  } else {
    _changelog = [];
  }
}

export function saveAll(): void {
  ensureDirs();
  writeFileSync(profilePath(), JSON.stringify(_profile, null, 2), "utf-8");
  writeFileSync(eventsPath(), JSON.stringify(_events, null, 2), "utf-8");
  writeFileSync(changelogPath(), JSON.stringify(_changelog, null, 2), "utf-8");
}

function createDefaultProfile(): LearningProfile {
  return {
    userId: "default",
    preferences: {},
    commonPatterns: [],
    skillLevel: {},
    designDNAs: [],
    behaviorHistory: [],
    personaWeights: {
      architect: 1.0,
      designer: 1.0,
      engineer: 1.0,
      researcher: 1.0,
      writer: 1.0,
      critic: 1.0,
    },
    lastLearningCycle: new Date(0),
  };
}

// ===== EVENT TRACKING =====
export function trackEvent(type: EvolutionEventType, data: any): EvolutionEvent {
  const event: EvolutionEvent = {
    id: randomId(),
    timestamp: Date.now(),
    type,
    data,
  };
  _events.push(event);
  _profile.behaviorHistory.push(event);
  if (_events.length > 10000) _events = _events.slice(-5000);
  if (_profile.behaviorHistory.length > 5000) _profile.behaviorHistory = _profile.behaviorHistory.slice(-2000);
  saveAll();
  return event;
}

export function getEvents(type?: EvolutionEventType, limit?: number): EvolutionEvent[] {
  let result = type ? _events.filter(e => e.type === type) : [..._events];
  if (limit) result = result.slice(-limit);
  return result.reverse();
}

export function getEventsByTimeRange(start: Date, end: Date): EvolutionEvent[] {
  const s = start.getTime();
  const e = end.getTime();
  return _events.filter(ev => ev.timestamp >= s && ev.timestamp <= e).reverse();
}

// ===== FEEDBACK LEARNING =====
export function learnFromFeedback(eventId: string, satisfaction: number, notes?: string): void {
  const event = _events.find(e => e.id === eventId);
  if (!event) return;
  event.outcome = {
    satisfaction,
    timeSpent: 0,
    retriesNeeded: 0,
    wasHelpful: satisfaction > 0,
    notes,
  };
  saveAll();
}

export function getCommonFeedbackPatterns(): { trigger: string; avgSatisfaction: number; count: number }[] {
  const byType: Record<string, { totalSat: number; count: number }> = {};
  for (const ev of _events) {
    if (!ev.outcome) continue;
    const key = ev.type;
    if (!byType[key]) byType[key] = { totalSat: 0, count: 0 };
    byType[key].totalSat += ev.outcome.satisfaction;
    byType[key].count++;
  }
  return Object.entries(byType)
    .map(([trigger, v]) => ({ trigger, avgSatisfaction: v.totalSat / v.count, count: v.count }))
    .sort((a, b) => b.count - a.count);
}

export function getImprovementSuggestions(): ImprovementAction[] {
  const suggestions: ImprovementAction[] = [];
  const feedbackPatterns = getCommonFeedbackPatterns();

  for (const fp of feedbackPatterns) {
    if (fp.avgSatisfaction < -0.3 && fp.count >= 3) {
      suggestions.push({
        id: randomId(),
        type: "update-prompt",
        description: `Low satisfaction (${fp.avgSatisfaction.toFixed(2)}) for "${fp.trigger}" events — consider adjusting prompts`,
        trigger: fp.trigger,
        confidence: Math.min(0.9, 0.3 + fp.count * 0.05),
        status: "pending",
      });
    }
  }

  const modelSuggest = suggestModelOptimization();
  if (modelSuggest) suggestions.push(modelSuggest);

  const cacheSuggest = suggestPatternCaching();
  if (cacheSuggest) suggestions.push(cacheSuggest);

  const featureSuggest = suggestFeatureFromUsage();
  if (featureSuggest) suggestions.push(featureSuggest);

  return suggestions;
}

// ===== PATTERN RECOGNITION =====
export function detectPatterns(): Pattern[] {
  const patterns: Pattern[] = [];
  const grouped: Record<string, { count: number; actions: string[]; successes: number }> = {};

  for (const ev of _events) {
    const trigger = ev.type;
    if (!grouped[trigger]) grouped[trigger] = { count: 0, actions: [], successes: 0 };
    grouped[trigger].count++;
    grouped[trigger].actions.push(JSON.stringify(ev.data));
    if (ev.outcome?.wasHelpful) grouped[trigger].successes++;
  }

  for (const [trigger, info] of Object.entries(grouped)) {
    if (info.count < 2) continue;
    const mostCommonAction = info.actions.sort((a, b) =>
      info.actions.filter(x => x === a).length - info.actions.filter(x => x === b).length
    ).pop() || "";
    patterns.push({
      id: randomId(),
      trigger,
      action: mostCommonAction,
      successRate: info.count > 0 ? info.successes / info.count : 0,
      sampleSize: info.count,
      lastObserved: new Date(),
    });
  }

  return patterns;
}

export function getPattern(id: string): Pattern | undefined {
  return _profile.commonPatterns.find(p => p.id === id);
}

export function confirmPattern(pattern: Pattern): void {
  if (!pattern.sampleSize) return;
  const existing = _profile.commonPatterns.find(p => p.trigger === pattern.trigger);
  if (existing) {
    existing.sampleSize += pattern.sampleSize;
    existing.successRate = (existing.successRate * existing.sampleSize + pattern.successRate * pattern.sampleSize) / (existing.sampleSize + pattern.sampleSize);
    existing.lastObserved = new Date();
  } else {
    _profile.commonPatterns.push(pattern);
  }
  saveAll();
}

// ===== DESIGN DNA =====
export function captureDesignDNA(projectType: string, colors: Record<string, string>, fonts: Record<string, string>, style: string): DesignDNA {
  const existing = _profile.designDNAs.find(d => d.projectType === projectType);
  const dna: DesignDNA = {
    name: `${projectType}-dna`,
    projectType,
    colors,
    fonts,
    style,
    appliedCount: existing ? existing.appliedCount + 1 : 1,
    userRating: 0.5,
  };
  if (existing) {
    Object.assign(existing, dna);
  } else {
    _profile.designDNAs.push(dna);
  }
  saveAll();
  return dna;
}

export function getDesignDNA(projectType: string): DesignDNA | undefined {
  return _profile.designDNAs.find(d => d.projectType === projectType);
}

export function suggestDesignForProject(projectType: string, description: string): DesignDNA | null {
  const exact = getDesignDNA(projectType);
  if (exact) return exact;

  const keywords = description.toLowerCase().split(" ");
  let best: DesignDNA | null = null;
  let bestScore = 0;

  for (const dna of _profile.designDNAs) {
    let score = 0;
    const dt = dna.projectType.toLowerCase();
    for (const kw of keywords) {
      if (dt.includes(kw)) score += 2;
    }
    score += dna.userRating * 3;
    score += dna.appliedCount * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = dna;
    }
  }

  return best;
}

// ===== PERSONA WEIGHT ADJUSTMENT =====
export function adjustPersonaWeight(role: string, delta: number): void {
  const current = _profile.personaWeights[role] ?? 1.0;
  _profile.personaWeights[role] = Math.max(0, Math.min(2, current + delta));
  saveAll();
  trackEvent("preference-change", { role, delta, newWeight: _profile.personaWeights[role] });
}

export function getPersonaWeights(): Record<string, number> {
  return { ..._profile.personaWeights };
}

export function resetPersonaWeights(): void {
  _profile.personaWeights = {
    architect: 1.0,
    designer: 1.0,
    engineer: 1.0,
    researcher: 1.0,
    writer: 1.0,
    critic: 1.0,
  };
  saveAll();
  trackEvent("preference-change", { action: "reset-persona-weights" });
}

// ===== SELF-MODIFICATION =====
export function createSnapshot(): string {
  ensureDirs();
  const hash = randomId();
  const snapshot = {
    timestamp: Date.now(),
    config: { ...getConfig() },
    weights: { ..._profile.personaWeights },
    preferences: { ..._profile.preferences },
    patterns: _profile.commonPatterns.filter(() => true),
  };
  writeFileSync(join(snapDir(), `${hash}.json`), JSON.stringify(snapshot, null, 2), "utf-8");
  return hash;
}

export function rollbackToSnapshot(hash: string): boolean {
  const path = join(snapDir(), `${hash}.json`);
  if (!existsSync(path)) return false;
  try {
    const snapshot = JSON.parse(readFileSync(path, "utf-8"));
    const { persona, preferences } = snapshot;
    if (snapshot.persona) _profile.personaWeights = snapshot.persona;
    if (snapshot.preferences) _profile.preferences = snapshot.preferences;
    saveAll();
    return true;
  } catch {
    return false;
  }
}

export async function selfModify(action: ImprovementAction): Promise<boolean> {
  const snapHash = createSnapshot();
  action.rollbackHash = snapHash;

  try {
    switch (action.type) {
      case "adjust-persona-weight": {
        const match = action.description.match(/(\w+)\s*weight/i);
        if (match) adjustPersonaWeight(match[1].toLowerCase(), 0.1);
        break;
      }
      case "optimize-model": {
        const model = getModelById(getConfig().model);
        if (model && !model.free) {
          const freeModels = MODELS.filter(m => m.free);
          if (freeModels.length > 0) {
            setConfig("model", freeModels[0].id);
          }
        }
        break;
      }
      case "cache-pattern":
        _profile.preferences[`cache_${action.trigger}`] = true;
        break;
      case "apply-preference": {
        const match2 = action.description.match(/set\s+(\w+)\s*=\s*(.+)/i);
        if (match2) {
          _profile.preferences[match2[1]] = match2[2].trim();
        }
        break;
      }
      default:
        break;
    }

    action.status = "applied";
    action.appliedAt = new Date();
    _changelog.push(action);
    saveAll();
    return true;
  } catch {
    action.status = "failed";
    _changelog.push(action);
    saveAll();
    return false;
  }
}

export function getChangeLog(): ImprovementAction[] {
  return [..._changelog];
}

// ===== LEARNING CYCLE =====
export async function runLearningCycle(): Promise<{
  patternsFound: Pattern[];
  improvementsApplied: ImprovementAction[];
  snapshotHash: string;
  duration: number;
}> {
  const start = Date.now();
  const snapshotHash = createSnapshot();
  const patternsFound = detectPatterns();

  for (const p of patternsFound) {
    if (p.sampleSize >= 3) {
      confirmPattern(p);
    }
  }

  const suggestions = getImprovementSuggestions();
  const improvementsApplied: ImprovementAction[] = [];

  for (const s of suggestions) {
    if (s.confidence >= 0.7) {
      const ok = await selfModify(s);
      if (ok) improvementsApplied.push(s);
    }
  }

  _profile.lastLearningCycle = new Date();

  saveAll();

  return {
    patternsFound,
    improvementsApplied,
    snapshotHash,
    duration: Date.now() - start,
  };
}

export function getProfile(): LearningProfile {
  return _profile;
}

// ===== SUGGESTION GENERATION =====
export function suggestModelOptimization(): ImprovementAction | null {
  const currentModel = getConfig().model;
  const currentSpec = getModelById(currentModel);
  if (!currentSpec || currentSpec.free) return null;

  const recentEvents = getEvents("performance-degradation", 10);
  if (recentEvents.length >= 3) {
    return {
      id: randomId(),
      type: "optimize-model",
      description: `Performance degradation detected with ${currentModel} — consider switching to a faster/free model`,
      trigger: "performance-degradation",
      confidence: 0.65,
      status: "pending",
    };
  }
  return null;
}

export function suggestPatternCaching(): ImprovementAction | null {
  const patterns = detectPatterns();
  for (const p of patterns) {
    if (p.sampleSize >= 5) {
      return {
        id: randomId(),
        type: "cache-pattern",
        description: `Frequent pattern "${p.trigger}" (${p.sampleSize}x) — cache results for faster response`,
        trigger: p.trigger,
        confidence: 0.75,
        status: "pending",
      };
    }
  }
  return null;
}

export function suggestFeatureFromUsage(): ImprovementAction | null {
  const feedbacks = getCommonFeedbackPatterns();
  for (const f of feedbacks) {
    if (f.avgSatisfaction < -0.5 && f.count >= 3 && f.trigger === "error") {
      return {
        id: randomId(),
        type: "suggest-feature",
        description: `Users report errors with "${f.trigger}" — suggest new feature or fix`,
        trigger: f.trigger,
        confidence: 0.6,
        status: "pending",
      };
    }
  }
  return null;
}

// ===== INIT =====
export function initEvolutionEngine(): void {
  loadAll();
  trackEvent("usage-pattern", { action: "evolution-engine-initialized" });
}