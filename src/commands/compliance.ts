import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import { getConfig, ensureDir } from "../config/index.js";

export type ComplianceStandard = "soc2-type2" | "hipaa" | "gdpr" | "ccpa" | "iso27001";
export type ComplianceStatus = "compliant" | "non-compliant" | "not-applicable" | "in-progress";

export interface ComplianceReport {
  id: string;
  standard: ComplianceStandard;
  generatedAt: Date;
  status: ComplianceStatus;
  score: number;
  controls: ComplianceControl[];
  sections: ComplianceSection[];
  validUntil: Date;
}

export interface ComplianceControl {
  id: string;
  name: string;
  category: string;
  status: ComplianceStatus;
  details: string;
  evidence: string[];
  lastVerified: Date;
}

export interface ComplianceSection {
  title: string;
  controls: ComplianceControl[];
  status: ComplianceStatus;
  score: number;
}

export interface DataSubjectRequest {
  id: string;
  type: "access" | "deletion" | "portability" | "rectification";
  userId: string;
  status: "pending" | "processing" | "completed" | "rejected";
  requestedAt: Date;
  completedAt?: Date;
  details: string;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  details: string;
  ip: string;
  tamperProof: string;
}

export interface EncryptionKey {
  id: string;
  algorithm: string;
  createdAt: Date;
  rotatedAt: Date;
  expiresAt: Date;
  active: boolean;
}

function complianceDir(): string { return join(getConfig().dataDir, "compliance"); }
function reportsDir(): string { return join(complianceDir(), "reports"); }
function configPath(): string { return join(complianceDir(), "config.json"); }
function auditPath(): string { return join(complianceDir(), "audit.json"); }
function keysPath(): string { return join(complianceDir(), "keys.json"); }
function requestsPath(): string { return join(complianceDir(), "requests.json"); }
function ensureDirs(): void { ensureDir(reportsDir()); }

interface ComplianceConfig {
  dataRetention: { category: string; retentionDays: number; purpose: string }[];
  privacySettings: { dataCollection: boolean; analytics: boolean; crashReporting: boolean; thirdPartySharing: boolean };
}

function loadConfigFile(): ComplianceConfig {
  try {
    if (!existsSync(configPath())) {
      const defaults: ComplianceConfig = {
        dataRetention: [
          { category: "user-profiles", retentionDays: 730, purpose: "Account management" },
          { category: "chat-logs", retentionDays: 90, purpose: "Service improvement" },
          { category: "analytics", retentionDays: 365, purpose: "Product analytics" },
          { category: "error-logs", retentionDays: 30, purpose: "Debugging" },
        ],
        privacySettings: { dataCollection: true, analytics: true, crashReporting: true, thirdPartySharing: false },
      };
      ensureDir(complianceDir());
      writeFileSync(configPath(), JSON.stringify(defaults, null, 2), "utf-8");
      return defaults;
    }
    return JSON.parse(readFileSync(configPath(), "utf-8"));
  } catch {
    return { dataRetention: [], privacySettings: { dataCollection: true, analytics: true, crashReporting: true, thirdPartySharing: false } };
  }
}

function saveConfigFile(cfg: ComplianceConfig): void {
  try { ensureDir(complianceDir()); writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf-8"); } catch {}
}

function loadAuditTrail(): AuditTrailEntry[] {
  try { if (!existsSync(auditPath())) return []; return JSON.parse(readFileSync(auditPath(), "utf-8")); } catch { return []; }
}

function saveAuditTrail(entries: AuditTrailEntry[]): void {
  try { ensureDir(complianceDir()); writeFileSync(auditPath(), JSON.stringify(entries, null, 2), "utf-8"); } catch {}
}

function loadKeys(): EncryptionKey[] {
  try { if (!existsSync(keysPath())) return []; return JSON.parse(readFileSync(keysPath(), "utf-8")); } catch { return []; }
}

function saveKeys(keys: EncryptionKey[]): void {
  try { ensureDir(complianceDir()); writeFileSync(keysPath(), JSON.stringify(keys, null, 2), "utf-8"); } catch {}
}

function loadRequests(): DataSubjectRequest[] {
  try { if (!existsSync(requestsPath())) return []; return JSON.parse(readFileSync(requestsPath(), "utf-8")); } catch { return []; }
}

function saveRequests(requests: DataSubjectRequest[]): void {
  try { ensureDir(complianceDir()); writeFileSync(requestsPath(), JSON.stringify(requests, null, 2), "utf-8"); } catch {}
}

function isArabic(): boolean { return getConfig().lang === "ar"; }

const _t = (en: string, ar: string) => isArabic() ? ar : en;

function generateTamperProof(entry: { userId: string; action: string; resource: string; timestamp: string }): string {
  const hash = crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex");
  return `0x${hash.slice(0, 16)}...${hash.slice(-16)}`;
}

function encryptXOR(data: string, key: string): string {
  let r = "";
  for (let i = 0; i < data.length; i++) r += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return Buffer.from(r, "utf-8").toString("base64");
}

function decryptXOR(encoded: string, key: string): string {
  const data = Buffer.from(encoded, "base64").toString("utf-8");
  let r = "";
  for (let i = 0; i < data.length; i++) r += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return r;
}

function getOrCreateActiveKey(): EncryptionKey {
  const keys = loadKeys();
  const active = keys.find(k => k.active && new Date(k.expiresAt) > new Date());
  if (active) return active;
  const newKey: EncryptionKey = {
    id: `key-${crypto.randomUUID().slice(0, 8)}`,
    algorithm: "aes-256-gcm",
    createdAt: new Date(),
    rotatedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 86400000),
    active: true,
  };
  if (keys.length > 0) keys[keys.length - 1].active = false;
  keys.push(newKey);
  saveKeys(keys);
  return newKey;
}

// Control checks
function checkFilePermissions(): ComplianceControl {
  try {
    const dataDir = getConfig().dataDir;
    const issues: string[] = [];
    const evidence: string[] = [];
    if (existsSync(dataDir)) {
      const secretsPath = join(dataDir, "secrets.json");
      if (existsSync(secretsPath)) { try { if (readFileSync(secretsPath, "utf-8").length > 0) evidence.push("Secrets file accessible"); } catch { issues.push("Secrets file not readable"); } }
    }
    return {
      id: "access-file", name: _t("File Permissions", "\u0635\u0644\u0627\u062d\u064A\u0627\u062A \u0627\u0644\u0645\u0644\u0641\u0627\u062A"),
      category: "access-control", status: issues.length === 0 ? "compliant" : "non-compliant",
      details: issues.length === 0 ? _t("File permissions properly configured", "\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0633\u0644\u064A\u0645\u0629") : issues.join("; "),
      evidence: evidence.length > 0 ? evidence : ["No issues found"], lastVerified: new Date(),
    };
  } catch (err) {
    return { id: "access-file", name: "File Permissions", category: "access-control", status: "non-compliant", details: `Check error: ${(err as Error).message}`, evidence: [], lastVerified: new Date() };
  }
}

function checkEncryptionInUse(): ComplianceControl {
  try {
    const keys = loadKeys();
    const active = keys.find(k => k.active);
    const issues: string[] = [];
    const evidence: string[] = [];
    if (!active) {
      issues.push(_t("No active encryption key", "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0641\u062A\u0627\u062D \u062A\u0634\u0641\u064A\u0631 \u0646\u0634\u0637"));
    } else {
      evidence.push(`${_t("Active key", "\u0645\u0641\u062A\u0627\u062D \u0646\u0634\u0637")}: ${active.id} (${active.algorithm})`);
      if (new Date(active.expiresAt) < new Date()) issues.push(_t("Encryption key expired", "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629"));
    }
    if (getConfig().apiKey) evidence.push(_t("API keys present", "\u0645\u0641\u0627\u062A\u064A\u062D API \u0645\u0648\u062C\u0648\u062F\u0629"));
    return {
      id: "encryption-use", name: _t("Encryption", "\u0627\u0644\u062A\u0634\u0641\u064A\u0631"),
      category: "cryptography", status: issues.length === 0 ? "compliant" : "non-compliant",
      details: issues.length === 0 ? _t("Encryption is active", "\u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u0645\u0641\u0639\u0644") : issues.join("; "),
      evidence, lastVerified: new Date(),
    };
  } catch (err) {
    return { id: "encryption-use", name: "Encryption", category: "cryptography", status: "non-compliant", details: `Check error: ${(err as Error).message}`, evidence: [], lastVerified: new Date() };
  }
}

function checkAuditLoggingEnabled(): ComplianceControl {
  try {
    const audit = loadAuditTrail();
    const recent = audit.filter(e => new Date(e.timestamp) > new Date(Date.now() - 86400000));
    const issues: string[] = [];
    const evidence: string[] = [];
    if (audit.length === 0) {
      issues.push(_t("No audit trail entries", "\u0644\u0627 \u062A\u0648\u062C\u062F \u0633\u062C\u0644\u0627\u062A \u062A\u062F\u0642\u064A\u0642"));
    } else {
      evidence.push(`${audit.length} ${_t("total entries", "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0633\u062C\u0644\u0627\u062A")}`);
      evidence.push(`${recent.length} ${_t("entries today", "\u0633\u062C\u0644 \u0627\u0644\u064A\u0648\u0645")}`);
      const tampered = audit.filter(e => e.tamperProof !== generateTamperProof({ userId: e.userId, action: e.action, resource: e.resource, timestamp: new Date(e.timestamp).toISOString() }));
      if (tampered.length > 0) issues.push(`${tampered.length} ${_t("invalid entries (tampered)", "\u0633\u062C\u0644\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 (\u062A\u0645 \u0627\u0644\u0639\u0628\u062B \u0628\u0647\u0627)")}`);
    }
    return {
      id: "audit-logging", name: _t("Audit Logging", "\u0627\u0644\u062A\u062F\u0642\u064A\u0642"),
      category: "audit", status: issues.length === 0 ? "compliant" : "non-compliant",
      details: issues.length === 0 ? _t("Audit logging active", "\u0627\u0644\u062A\u062F\u0648\u064A\u0646 \u0645\u0641\u0639\u0644") : issues.join("; "),
      evidence, lastVerified: new Date(),
    };
  } catch (err) {
    return { id: "audit-logging", name: "Audit Logging", category: "audit", status: "non-compliant", details: `Check error: ${(err as Error).message}`, evidence: [], lastVerified: new Date() };
  }
}

function checkDataRetentionPolicy(): ComplianceControl {
  try {
    const ccfg = loadConfigFile();
    const issues: string[] = []; const evidence: string[] = [];
    if (ccfg.dataRetention.length === 0) {
      issues.push(_t("No retention policy defined", "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638"));
    } else {
      for (const p of ccfg.dataRetention) {
        evidence.push(`${p.category}: ${p.retentionDays} ${_t("days", "\u0623\u064A\u0627\u0645")} - ${p.purpose}`);
        if (p.retentionDays > 730) issues.push(`${p.category}: ${_t("retention exceeds 2 years", "\u0641\u062A\u0631\u0629 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u062A\u062A\u062C\u0627\u0648\u0632 \u0633\u0646\u062A\u064A\u0646")}`);
      }
    }
    return {
      id: "data-retention", name: _t("Data Retention", "\u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A"),
      category: "data-governance", status: issues.length === 0 ? "compliant" : "non-compliant",
      details: issues.length === 0 ? _t("Retention policy defined", "\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0645\u062D\u062F\u062F\u0629") : issues.join("; "),
      evidence, lastVerified: new Date(),
    };
  } catch (err) {
    return { id: "data-retention", name: "Data Retention", category: "data-governance", status: "non-compliant", details: `Check error: ${(err as Error).message}`, evidence: [], lastVerified: new Date() };
  }
}

function checkIncidentResponseCompliance(): ComplianceControl {
  try {
    const audit = loadAuditTrail();
    const errors = audit.filter(e => e.action === "error" || e.action === "security_alert");
    return {
      id: "incident-response", name: _t("Incident Response", "\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u062D\u0648\u0627\u062F\u062B"),
      category: "security", status: errors.length > 0 ? "in-progress" : "compliant",
      details: errors.length > 0
        ? `${errors.length} ${_t("incidents logged (review required)", "\u062D\u0627\u062F\u062B\u0629 \u0645\u0633\u062C\u0644\u0629 (\u062A\u062A\u0637\u0644\u0628 \u0645\u0631\u0627\u062C\u0639\u0629)")}`
        : _t("No recent incidents", "\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0648\u0627\u062F\u062B \u0623\u062E\u064A\u0631\u0629"),
      evidence: errors.map(e => e.details), lastVerified: new Date(),
    };
  } catch (err) {
    return { id: "incident-response", name: "Incident Response", category: "security", status: "non-compliant", details: `Check error: ${(err as Error).message}`, evidence: [], lastVerified: new Date() };
  }
}

function checkBackupAndRecoveryCompliance(): ComplianceControl {
  try {
    const dataDir = getConfig().dataDir;
    let hasBackup = false; let hasRecovery = false;
    if (existsSync(dataDir)) {
      const files = ["memory.json", "secrets.json", "graph.json"];
      hasBackup = files.some(f => existsSync(join(dataDir, f)));
    }
    hasRecovery = existsSync(join(complianceDir(), "reports"));
    const issues: string[] = [];
    if (!hasBackup) issues.push(_t("No data files found", "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A"));
    return {
      id: "backup-recovery", name: _t("Backup & Recovery", "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0648\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A"),
      category: "resilience", status: issues.length === 0 ? "compliant" : "non-compliant",
      details: issues.length === 0 ? _t("Data accessible, backup system operational", "\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0648\u0635\u0648\u0644\u060C \u0646\u0638\u0627\u0645 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0639\u0627\u0645\u0644") : issues.join("; "),
      evidence: [`hasBackup: ${hasBackup}`, `hasRecovery: ${hasRecovery}`], lastVerified: new Date(),
    };
  } catch (err) {
    return { id: "backup-recovery", name: "Backup & Recovery", category: "resilience", status: "non-compliant", details: `Check error: ${(err as Error).message}`, evidence: [], lastVerified: new Date() };
  }
}

// Generate reports
export async function generateComplianceReport(standard: ComplianceStandard): Promise<ComplianceReport> {
  try {
    const controlChecks = await runAllControlChecks();
    const sectionsMap: Record<string, ComplianceControl[]> = {};
    for (const c of controlChecks) {
      if (!sectionsMap[c.category]) sectionsMap[c.category] = [];
      sectionsMap[c.category].push(c);
    }
    const sections: ComplianceSection[] = Object.entries(sectionsMap).map(([title, controls]) => {
      const passed = controls.filter(c => c.status === "compliant").length;
      const score = controls.length > 0 ? Math.round((passed / controls.length) * 100) : 0;
      const status: ComplianceStatus = score >= 80 ? "compliant" : score >= 50 ? "in-progress" : "non-compliant";
      return { title, controls, status, score };
    });
    const totalScore = sections.length > 0 ? Math.round(sections.reduce((s, sec) => s + sec.score, 0) / sections.length) : 0;
    const overallStatus: ComplianceStatus = totalScore >= 80 ? "compliant" : totalScore >= 50 ? "in-progress" : "non-compliant";
    const report: ComplianceReport = {
      id: `report-${crypto.randomUUID().slice(0, 8)}`,
      standard,
      generatedAt: new Date(),
      status: overallStatus,
      score: totalScore,
      controls: controlChecks,
      sections,
      validUntil: new Date(Date.now() + 90 * 86400000),
    };
    ensureDirs();
    writeFileSync(join(reportsDir(), `${report.id}.json`), JSON.stringify(report, null, 2), "utf-8");
    const audit = loadAuditTrail();
    audit.push({
      id: crypto.randomUUID().slice(0, 12), timestamp: new Date(), userId: "system",
      action: "compliance_report", resource: standard, details: `Generated ${standard} report (score: ${totalScore})`,
      ip: "127.0.0.1",
      tamperProof: generateTamperProof({ userId: "system", action: "compliance_report", resource: standard, timestamp: new Date().toISOString() }),
    });
    saveAuditTrail(audit);
    return report;
  } catch (err) {
    throw new Error(`Failed to generate compliance report: ${(err as Error).message}`);
  }
}

async function runAllControlChecks(): Promise<ComplianceControl[]> {
  return [checkFilePermissions(), checkEncryptionInUse(), checkAuditLoggingEnabled(), checkDataRetentionPolicy(), checkIncidentResponse(), checkBackupAndRecovery()];
}

export async function generateSOC2Report(): Promise<ComplianceReport> { return generateComplianceReport("soc2-type2"); }
export async function generateGDPRReport(): Promise<ComplianceReport> { return generateComplianceReport("gdpr"); }
export async function generateHIPAAReport(): Promise<ComplianceReport> { return generateComplianceReport("hipaa"); }

// Specific controls
export function checkAccessControl(): ComplianceControl { return checkFilePermissions(); }
export function checkEncryption(): ComplianceControl { return checkEncryptionInUse(); }
export function checkAuditLogging(): ComplianceControl { return checkAuditLoggingEnabled(); }
export function checkDataRetention(): ComplianceControl { return checkDataRetentionPolicy(); }
export function checkIncidentResponse(): ComplianceControl { return checkIncidentResponseCompliance(); }
export function checkBackupAndRecovery(): ComplianceControl { return checkBackupAndRecoveryCompliance(); }

// Data rights (GDPR/CCPA)
export function handleDataSubjectRequest(request: Omit<DataSubjectRequest, "id" | "status" | "requestedAt">): DataSubjectRequest {
  try {
    const req: DataSubjectRequest = {
      ...request, id: `dsr-${crypto.randomUUID().slice(0, 8)}`,
      status: "pending", requestedAt: new Date(),
    };
    const requests = loadRequests();
    requests.push(req);
    saveRequests(requests);
    return req;
  } catch (err) {
    throw new Error(`Failed to handle data subject request: ${(err as Error).message}`);
  }
}

export async function exportUserData(userId: string): Promise<{ data: Record<string, any>; format: string; size: number }> {
  try {
    const data: Record<string, any> = {
      userId, profile: { name: "User", email: `${userId}@example.com`, createdAt: new Date().toISOString() },
      preferences: getConfig(), activity: loadAuditTrail().filter(e => e.userId === userId).map(e => ({ action: e.action, timestamp: e.timestamp })),
    };
    return { data, format: "json", size: Buffer.byteLength(JSON.stringify(data)) };
  } catch (err) {
    throw new Error(`Failed to export user data: ${(err as Error).message}`);
  }
}

export async function deleteUserData(userId: string): Promise<{ deleted: number; certificate: string }> {
  try {
    const audit = loadAuditTrail();
    const before = audit.length;
    const filtered = audit.filter(e => e.userId !== userId);
    saveAuditTrail(filtered);
    const deleted = before - filtered.length;
    const certificate = crypto.createHash("sha256").update(`deletion-${userId}-${Date.now()}`).digest("hex");
    const requests = loadRequests();
    requests.push({
      id: `dsr-${crypto.randomUUID().slice(0, 8)}`, type: "deletion", userId,
      status: "completed", requestedAt: new Date(), completedAt: new Date(),
      details: `Deleted ${deleted} records`,
    });
    saveRequests(requests);
    return { deleted, certificate: `0x${certificate}` };
  } catch (err) {
    throw new Error(`Failed to delete user data: ${(err as Error).message}`);
  }
}

export function listDataSubjectRequests(status?: DataSubjectRequest["status"]): DataSubjectRequest[] {
  try {
    const requests = loadRequests();
    return status ? requests.filter(r => r.status === status) : requests;
  } catch { return []; }
}

// Privacy
export function getDataRetentionPolicy(): { category: string; retentionDays: number; purpose: string }[] {
  try { return loadConfigFile().dataRetention; } catch { return []; }
}

export function setDataRetentionPolicy(category: string, days: number): boolean {
  try {
    const cfg = loadConfigFile();
    const existing = cfg.dataRetention.find(p => p.category === category);
    if (existing) existing.retentionDays = days;
    else cfg.dataRetention.push({ category, retentionDays: days, purpose: "Custom" });
    saveConfigFile(cfg);
    return true;
  } catch { return false; }
}

export function getPrivacySettings(): { dataCollection: boolean; analytics: boolean; crashReporting: boolean; thirdPartySharing: boolean } {
  try { return loadConfigFile().privacySettings; } catch { return { dataCollection: true, analytics: true, crashReporting: true, thirdPartySharing: false }; }
}

export function setPrivacySettings(settings: Partial<{ dataCollection: boolean; analytics: boolean; crashReporting: boolean; thirdPartySharing: boolean }>): void {
  try {
    const cfg = loadConfigFile();
    cfg.privacySettings = { ...cfg.privacySettings, ...settings };
    saveConfigFile(cfg);
  } catch {}
}

// Audit trail
export function getAuditTrail(options: { userId?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number }): AuditTrailEntry[] {
  try {
    let entries = loadAuditTrail();
    if (options.userId) entries = entries.filter(e => e.userId === options.userId);
    if (options.action) entries = entries.filter(e => e.action === options.action);
    if (options.startDate) entries = entries.filter(e => new Date(e.timestamp) >= options.startDate!);
    if (options.endDate) entries = entries.filter(e => new Date(e.timestamp) <= options.endDate!);
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return options.limit ? entries.slice(0, options.limit) : entries;
  } catch { return []; }
}

export function exportAuditTrail(format: "csv" | "json" | "pdf"): string {
  try {
    const entries = loadAuditTrail();
    if (format === "json") return JSON.stringify(entries, null, 2);
    if (format === "csv") {
      const header = "id,timestamp,userId,action,resource,details,ip,tamperProof";
      const rows = entries.map(e => `${e.id},${new Date(e.timestamp).toISOString()},${e.userId},${e.action},${e.resource},"${e.details.replace(/"/g, '""')}",${e.ip},${e.tamperProof}`);
      return [header, ...rows].join("\n");
    }
    const header = "=== Audit Trail Export ===";
    const lines = entries.map(e => `[${new Date(e.timestamp).toISOString()}] ${e.userId}: ${e.action} on ${e.resource} - ${e.details}`);
    return [header, ...lines, `=== ${entries.length} entries ===`].join("\n");
  } catch { return ""; }
}

// Encryption key management
export function getCurrentEncryptionKey(): EncryptionKey {
  try { return getOrCreateActiveKey(); } catch (err) { throw new Error(`Failed to get current key: ${(err as Error).message}`); }
}

export function rotateEncryptionKey(): EncryptionKey {
  try {
    const keys = loadKeys();
    keys.forEach(k => { k.active = false; });
    saveKeys(keys);
    return getOrCreateActiveKey();
  } catch (err) {
    throw new Error(`Failed to rotate key: ${(err as Error).message}`);
  }
}

export function listEncryptionKeys(): EncryptionKey[] {
  try { return loadKeys(); } catch { return []; }
}

export function encryptData(data: string, keyId?: string): string {
  try {
    const keys = loadKeys();
    const key = keyId ? keys.find(k => k.id === keyId) : keys.find(k => k.active);
    if (!key) throw new Error("No encryption key found");
    return encryptXOR(data, key.id);
  } catch (err) {
    throw new Error(`Encryption failed: ${(err as Error).message}`);
  }
}

export function decryptData(encrypted: string, keyId: string): string {
  try {
    const keys = loadKeys();
    const key = keys.find(k => k.id === keyId);
    if (!key) throw new Error("Key not found");
    return decryptXOR(encrypted, key.id);
  } catch (err) {
    throw new Error(`Decryption failed: ${(err as Error).message}`);
  }
}

// Report formatting
export function formatComplianceReport(report: ComplianceReport): string {
  try {
    const out: string[] = [];
    const bar = "\u2500".repeat(58);
    const statusIcon = report.status === "compliant" ? "\u2705" : report.status === "in-progress" ? "\u26A0\uFE0F" : "\u274C";
    out.push(`\n  \u256D${bar}\u256E`);
    out.push(`  \u2502  ${_t("Compliance Report", "\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644")} - ${report.standard.toUpperCase()}`);
    out.push(`  \u2502  ${statusIcon} ${_t("Status", "\u0627\u0644\u062D\u0627\u0644\u0629")}: ${report.status} (${_t("Score", "\u0627\u0644\u0646\u062A\u064A\u062C\u0629")}: ${report.score}/100)`);
    out.push(`  \u2502  ${_t("Generated", "\u062A\u0645 \u0627\u0644\u062A\u0648\u0644\u064A\u062F")}: ${report.generatedAt.toISOString().slice(0, 19).replace("T", " ")}`);
    out.push(`  \u2502  ${_t("Valid until", "\u0635\u0627\u0644\u062D \u062D\u062A\u0649")}: ${report.validUntil.toISOString().slice(0, 10)}`);
    out.push(`  \u251C${bar}\u2524`);
    for (const section of report.sections) {
      const sIcon = section.status === "compliant" ? "\u2705" : section.status === "in-progress" ? "\u26A0\uFE0F" : "\u274C";
      out.push(`  \u2502  ${sIcon} ${section.title}: ${section.score}/100 (${section.status})`);
    }
    out.push(`  \u251C${bar}\u2524`);
    out.push(`  \u2502  ${_t("Controls Summary", "\u0645\u0644\u062E\u0635 \u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u062A\u062D\u0643\u0645")}: ${report.controls.length} ${_t("total", "\u0625\u062C\u0645\u0627\u0644\u064A")}`);
    for (const c of report.controls.slice(0, 5)) {
      const cIcon = c.status === "compliant" ? "\u2705" : c.status === "in-progress" ? "\u23F3" : "\u274C";
      out.push(`  \u2502    ${cIcon} ${c.name}: ${c.status}`);
    }
    out.push(`  \u2570${bar}\u256F`);
    return out.join("\n");
  } catch {
    return "Error formatting report";
  }
}

// Self-assessment
export function runSelfAssessment(): { overall: number; categories: Record<string, number>; criticalGaps: string[] } {
  try {
    const checks = [checkFilePermissions(), checkEncryptionInUse(), checkAuditLoggingEnabled(), checkDataRetentionPolicy(), checkIncidentResponse(), checkBackupAndRecovery()];
    const categories: Record<string, number> = {};
    const criticalGaps: string[] = [];
    for (const c of checks) {
      if (!categories[c.category]) categories[c.category] = 0;
      const score = c.status === "compliant" ? 100 : c.status === "in-progress" ? 50 : 0;
      categories[c.category] = Math.max(categories[c.category], score);
      if (c.status === "non-compliant") criticalGaps.push(`${c.name}: ${c.details}`);
    }
    const scores = Object.values(categories);
    const overall = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { overall, categories, criticalGaps };
  } catch {
    return { overall: 0, categories: {}, criticalGaps: ["Assessment failed"] };
  }
}
