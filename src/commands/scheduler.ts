import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";

export type ScheduleType = "cron" | "interval" | "one-time" | "event-triggered" | "conditional" | "webhook";
export type ScheduleStatus = "active" | "paused" | "completed" | "failed";

export interface ScheduledTask {
  id: string;
  name: string;
  type: ScheduleType;
  agentId: string;
  action: string;
  config: {
    cron?: string;
    interval?: number;
    executeAt?: Date;
    event?: string;
    condition?: string;
    webhook?: string;
  };
  status: ScheduleStatus;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failCount: number;
  createdAt: Date;
  tags: string[];
  output?: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "success" | "failed";
  output: string;
  error?: string;
  duration: number;
}

const tasks: Map<string, ScheduledTask> = new Map();
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
const eventTriggers: Map<string, Set<string>> = new Map();
const executionLogs: Map<string, TaskExecution[]> = new Map();

function schedulerDir(): string {
  return join(getConfig().dataDir, "scheduler");
}

function tasksPath(): string {
  return join(schedulerDir(), "tasks.json");
}

function logPath(taskId: string): string {
  return join(schedulerDir(), "logs", `${taskId}.json`);
}

function saveTasks(): void {
  try {
    ensureDir(schedulerDir());
    const data = Array.from(tasks.values());
    writeFileSync(tasksPath(), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save tasks:", (err as Error).message);
  }
}

function loadTasks(): void {
  try {
    const path = tasksPath();
    if (!existsSync(path)) return;
    const raw = readFileSync(path, "utf-8");
    const data: ScheduledTask[] = JSON.parse(raw);
    tasks.clear();
    for (const t of data) {
      tasks.set(t.id, t);
    }
  } catch (err) {
    console.error("Failed to load tasks:", (err as Error).message);
  }
}

function saveLogs(taskId: string): void {
  try {
    const logsDir = join(schedulerDir(), "logs");
    ensureDir(logsDir);
    const logs = executionLogs.get(taskId) || [];
    writeFileSync(logPath(taskId), JSON.stringify(logs, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save logs:", (err as Error).message);
  }
}

function loadLogs(taskId: string): TaskExecution[] {
  try {
    const path = logPath(taskId);
    if (!existsSync(path)) return [];
    const raw = readFileSync(path, "utf-8");
    const data: TaskExecution[] = JSON.parse(raw);
    executionLogs.set(taskId, data);
    return data;
  } catch {
    return [];
  }
}

let idCounter = Date.now();
function generateId(): string {
  return `task_${idCounter++}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createTask(task: Omit<ScheduledTask, "id" | "createdAt" | "runCount" | "successCount" | "failCount">): ScheduledTask {
  try {
    const newTask: ScheduledTask = {
      ...task,
      id: generateId(),
      createdAt: new Date(),
      runCount: 0,
      successCount: 0,
      failCount: 0,
    };
    if (newTask.type === "cron" && newTask.config.cron) {
      newTask.nextRun = getNextCronRun(newTask.config.cron);
    }
    tasks.set(newTask.id, newTask);
    saveTasks();
    return newTask;
  } catch (err) {
    throw new Error(`Failed to create task: ${(err as Error).message}`);
  }
}

export function getTask(id: string): ScheduledTask | null {
  return tasks.get(id) || null;
}

export function listTasks(status?: ScheduleStatus, type?: ScheduleType): ScheduledTask[] {
  const all = Array.from(tasks.values());
  return all.filter(t => {
    if (status && t.status !== status) return false;
    if (type && t.type !== type) return false;
    return true;
  });
}

export function updateTask(id: string, updates: Partial<ScheduledTask>): boolean {
  const task = tasks.get(id);
  if (!task) return false;
  Object.assign(task, updates);
  if (updates.config?.cron && updates.config.cron !== task.config.cron) {
    task.nextRun = getNextCronRun(updates.config.cron);
  }
  saveTasks();
  return true;
}

export function deleteTask(id: string): boolean {
  const existed = tasks.has(id);
  tasks.delete(id);
  executionLogs.delete(id);
  saveTasks();
  return existed;
}

export function pauseTask(id: string): boolean {
  const task = tasks.get(id);
  if (!task || task.status === "paused") return false;
  task.status = "paused";
  saveTasks();
  return true;
}

export function resumeTask(id: string): boolean {
  const task = tasks.get(id);
  if (!task || task.status !== "paused") return false;
  task.status = "active";
  if (task.type === "cron" && task.config.cron) {
    task.nextRun = getNextCronRun(task.config.cron);
  }
  saveTasks();
  return true;
}

export function parseCron(cron: string): { minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number } {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: "${cron}". Expected 5 fields.`);
  }
  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6),
  };
}

function parseCronField(field: string, min: number, max: number): number {
  if (field === "*") return -1;
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) throw new Error(`Invalid cron step: "${field}"`);
    return -step;
  }
  const ranges = field.split(",");
  for (const r of ranges) {
    if (r.includes("-")) {
      const [a, b] = r.split("-").map(Number);
      if (isNaN(a) || isNaN(b)) throw new Error(`Invalid cron range: "${r}"`);
    } else {
      const v = parseInt(r, 10);
      if (isNaN(v) || v < min || v > max) throw new Error(`Invalid cron value: "${r}"`);
    }
  }
  return parseInt(ranges[0], 10);
}

export function getNextCronRun(cron: string, from?: Date): Date {
  const now = from || new Date();
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Invalid cron expression: "${cron}"`);

  const [minField, hourField, domField, monField, dowField] = parts;
  const start = new Date(now);
  start.setSeconds(0, 0);

  for (let i = 0; i < 525600; i++) {
    const candidate = new Date(start.getTime() + i * 60000);
    if (candidate <= now) continue;
    if (!matchesCronField(minField, candidate.getMinutes(), 0, 59)) continue;
    if (!matchesCronField(hourField, candidate.getHours(), 0, 23)) continue;
    if (!matchesCronField(domField, candidate.getDate(), 1, 31)) continue;
    if (!matchesCronField(monField, candidate.getMonth() + 1, 1, 12)) continue;
    if (!matchesCronField(dowField, candidate.getDay(), 0, 6)) continue;
    return candidate;
  }
  throw new Error(`Unable to compute next run for cron: "${cron}"`);
}

function matchesCronField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) return false;
    return value % step === 0;
  }
  const ranges = field.split(",");
  for (const r of ranges) {
    if (r.includes("-")) {
      const [a, b] = r.split("-").map(Number);
      if (!isNaN(a) && !isNaN(b) && value >= a && value <= b) return true;
    } else {
      const v = parseInt(r, 10);
      if (!isNaN(v) && value === v) return true;
    }
  }
  return false;
}

export function getCronDescription(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression";

  const [min, hour, dom, mon, dow] = parts;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const desc: string[] = [];

  if (dow !== "*" && dom === "*" && mon === "*") {
    const days = expandField(dow, 0, 6).map(d => dayNames[d]);
    desc.push(`Every ${days.join(", ")}`);
  }

  if (dom !== "*" && mon === "*" && dow === "*") {
    desc.push(`On day ${dom} of every month`);
  }

  if (mon !== "*") {
    const months = expandField(mon, 1, 12).map(m => monNames[m]);
    desc.push(`In ${months.join(", ")}`);
  }

  if (desc.length === 0) {
    if (min.startsWith("*/")) {
      desc.push(`Every ${min.slice(2)} minutes`);
    } else if (min === "0") {
      if (hour.startsWith("*/")) {
        desc.push(`Every ${hour.slice(2)} hours`);
      } else if (hour === "*") {
        desc.push("Every hour");
      } else {
        const hours = expandField(hour, 0, 23).map(h => `${h.toString().padStart(2, "0")}:00`);
        desc.push(`At ${hours.join(", ")}`);
      }
    } else if (hour === "*") {
      const mins = expandField(min, 0, 59).map(m => `:${m.toString().padStart(2, "0")}`);
      desc.push(`Every hour${mins.join(",")}`);
    } else {
      const times: string[] = [];
      const hours = expandField(hour, 0, 23);
      const mins = expandField(min, 0, 59);
      for (const h of hours) {
        for (const m of mins) {
          times.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        }
      }
      desc.push(`At ${times.join(", ")}`);
    }
  }

  return desc.join(" ") || `Cron: ${cron}`;
}

function expandField(field: string, min: number, max: number): number[] {
  if (field === "*") {
    const result: number[] = [];
    for (let i = min; i <= max; i++) result.push(i);
    return result;
  }
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) return [min];
    const result: number[] = [];
    for (let i = min; i <= max; i += step) result.push(i);
    return result;
  }
  const result: number[] = [];
  const parts = field.split(",");
  for (const p of parts) {
    if (p.includes("-")) {
      const [a, b] = p.split("-").map(Number);
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = a; i <= b; i++) result.push(i);
      }
    } else {
      const v = parseInt(p, 10);
      if (!isNaN(v)) result.push(v);
    }
  }
  return result;
}

export async function executeTask(id: string): Promise<TaskExecution> {
  const task = tasks.get(id);
  if (!task) throw new Error(`Task not found: ${id}`);

  const execution: TaskExecution = {
    id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    taskId: id,
    startedAt: new Date(),
    status: "running",
    output: "",
    duration: 0,
  };

  let logs = executionLogs.get(id) || loadLogs(id);
  logs.push(execution);
  executionLogs.set(id, logs);

  task.status = "active";
  task.lastRun = new Date();
  task.runCount++;

  try {
    const result = await runTaskAction(task);
    execution.completedAt = new Date();
    execution.status = "success";
    execution.output = result;
    execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
    task.successCount++;
  } catch (err) {
    execution.completedAt = new Date();
    execution.status = "failed";
    execution.error = (err as Error).message;
    execution.output = (err as Error).message || "";
    execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
    task.failCount++;

    if (task.failCount >= 5) {
      task.status = "failed";
    }
  }

  if (task.type === "cron" && task.config.cron) {
    task.nextRun = getNextCronRun(task.config.cron);
  } else if (task.type === "interval" && task.config.interval) {
    task.nextRun = new Date(Date.now() + task.config.interval);
  } else if (task.type === "one-time") {
    task.status = "completed";
  }

  saveTasks();
  saveLogs(id);
  return execution;
}

async function runTaskAction(task: ScheduledTask): Promise<string> {
  const { action } = task;

  if (action.startsWith("http://") || action.startsWith("https://")) {
    try {
      const resp = await fetch(action, { method: "GET", signal: AbortSignal.timeout(30000) });
      const text = await resp.text();
      return `HTTP ${resp.status}: ${text.slice(0, 1000)}`;
    } catch (err) {
      throw new Error(`HTTP request failed: ${(err as Error).message}`);
    }
  }

  if (action.startsWith("file://")) {
    const filePath = action.slice(7);
    try {
      const content = readFileSync(filePath, "utf-8");
      return content.slice(0, 1000);
    } catch (err) {
      throw new Error(`File read failed: ${(err as Error).message}`);
    }
  }

  if (action.startsWith("webhook:") && task.config.webhook) {
    try {
      const resp = await fetch(task.config.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.name, action: task.action, timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(15000),
      });
      return `Webhook ${resp.status}`;
    } catch (err) {
      throw new Error(`Webhook failed: ${(err as Error).message}`);
    }
  }

  return `Executed: ${action}`;
}

export async function runTaskNow(id: string): Promise<TaskExecution> {
  return executeTask(id);
}

export function startScheduler(): void {
  if (schedulerTimer) return;
  loadTasks();
  schedulerTimer = setInterval(() => {
    const now = new Date();
    const activeTasks = listTasks("active");
    for (const task of activeTasks) {
      if (task.type === "event-triggered" || task.type === "conditional") continue;
      if (task.type === "cron") {
        if (task.nextRun && now >= task.nextRun) {
          executeTask(task.id).catch(() => {});
        }
      } else if (task.type === "interval") {
        if (task.nextRun && now >= task.nextRun) {
          executeTask(task.id).catch(() => {});
        }
      } else if (task.type === "webhook") {
        if (task.nextRun && now >= task.nextRun) {
          executeTask(task.id).catch(() => {});
        }
      }
    }
  }, 10000);
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export function getSchedulerStatus(): "running" | "stopped" {
  return schedulerTimer ? "running" : "stopped";
}

export function getSchedulerStats(): { total: number; active: number; running: number; completed: number; failed: number } {
  const all = Array.from(tasks.values());
  return {
    total: all.length,
    active: all.filter(t => t.status === "active").length,
    running: all.filter(t => t.status === "active" && t.lastRun && (!t.nextRun || t.nextRun > new Date())).length,
    completed: all.filter(t => t.status === "completed").length,
    failed: all.filter(t => t.status === "failed").length,
  };
}

export function getExecutionHistory(taskId: string, limit?: number): TaskExecution[] {
  const logs = executionLogs.get(taskId) || loadLogs(taskId);
  if (limit && limit > 0) return logs.slice(-limit);
  return logs;
}

export function clearLogs(taskId?: string): void {
  if (taskId) {
    executionLogs.delete(taskId);
    const path = logPath(taskId);
    if (existsSync(path)) {
      try {
        writeFileSync(path, "[]", "utf-8");
      } catch {}
    }
  } else {
    executionLogs.clear();
    const logsDir = join(schedulerDir(), "logs");
    if (existsSync(logsDir)) {
      try {
        const files = readdirSync(logsDir);
        for (const f of files) {
          writeFileSync(join(logsDir, f), "[]", "utf-8");
        }
      } catch {}
    }
  }
}

export function registerEventTrigger(event: string, taskId: string): void {
  if (!eventTriggers.has(event)) {
    eventTriggers.set(event, new Set());
  }
  eventTriggers.get(event)!.add(taskId);
}

export function fireEvent(event: string, data?: any): void {
  const triggered = eventTriggers.get(event);
  if (!triggered || triggered.size === 0) return;
  for (const taskId of triggered) {
    const task = tasks.get(taskId);
    if (task && task.status === "active") {
      executeTask(taskId).catch(() => {});
    }
  }
}

export function evaluateCondition(condition: string): boolean {
  try {
    const trimmed = condition.trim();

    const numericOps = [
      { op: ">=", fn: (a: number, b: number) => a >= b },
      { op: "<=", fn: (a: number, b: number) => a <= b },
      { op: ">", fn: (a: number, b: number) => a > b },
      { op: "<", fn: (a: number, b: number) => a < b },
      { op: "==", fn: (a: number, b: number) => a === b },
      { op: "!=", fn: (a: number, b: number) => a !== b },
    ];

    for (const { op, fn } of numericOps) {
      const idx = trimmed.indexOf(op);
      if (idx > 0) {
        const left = trimmed.slice(0, idx).trim();
        const right = trimmed.slice(idx + op.length).trim();
        const leftVal = resolveValue(left);
        const rightVal = parseFloat(right);
        if (!isNaN(leftVal) && !isNaN(rightVal)) {
          return fn(leftVal, rightVal);
        }
      }
    }

    if (trimmed.startsWith("true")) return true;
    if (trimmed.startsWith("false")) return false;

    return false;
  } catch {
    return false;
  }
}

function resolveValue(name: string): number {
  const sys = name.toLowerCase();
  if (sys === "disk_usage") return getDiskUsage();
  if (sys === "memory_usage") return getMemoryUsageMB();
  if (sys === "cpu_usage") return getCPUUsage();
  if (sys === "uptime_hours") return process.uptime() / 3600;
  if (sys === "task_count") return tasks.size;
  return 0;
}

function getDiskUsage(): number {
  try {
    const { execSync } = require("child_process");
    const out = execSync("wmic logicaldisk where drivetype=3 get size,freespace /format:csv", { encoding: "utf-8", timeout: 5000 });
    const lines = out.trim().split("\n").filter((l: string) => l.includes(","));
    if (lines.length > 0) {
      const parts = lines[0].split(",");
      if (parts.length >= 3) {
        const free = parseFloat(parts[1]);
        const total = parseFloat(parts[2]);
        if (!isNaN(free) && !isNaN(total) && total > 0) {
          return Math.round((1 - free / total) * 100);
        }
      }
    }
  } catch {}
  return 50;
}

function getMemoryUsageMB(): number {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

function getCPUUsage(): number {
  const usage = process.cpuUsage();
  const total = (usage.user + usage.system) / 1000000;
  return Math.round(total * 100) / 100;
}

export const CRON_EXAMPLES: { expression: string; description: string }[] = [
  { expression: "0 9 * * 1-5", description: "Every weekday at 9 AM" },
  { expression: "*/30 * * * *", description: "Every 30 minutes" },
  { expression: "0 0 * * *", description: "Daily at midnight" },
  { expression: "0 0 * * 0", description: "Weekly on Sunday" },
  { expression: "0 0 1 * *", description: "Monthly on the 1st" },
];

loadTasks();
