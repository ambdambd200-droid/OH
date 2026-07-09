import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";

export type SwarmPattern = "sequential" | "parallel" | "hierarchical" | "consensus" | "competitive" | "adaptive";
export type SwarmStatus = "idle" | "running" | "completed" | "failed" | "partial";

export interface SwarmAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  instructions: string;
  tools: string[];
  parentId?: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Swarm {
  id: string;
  name: string;
  pattern: SwarmPattern;
  agents: SwarmAgent[];
  task: string;
  status: SwarmStatus;
  context: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
  qualityScore: number;
}

export interface SwarmMessage {
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  type: "request" | "response" | "delegation" | "report";
}

const swarms: Map<string, Swarm> = new Map();
const messages: Map<string, SwarmMessage[]> = new Map();
let idCounter = Date.now();

function generateId(prefix: string = "id"): string {
  return `${prefix}_${idCounter++}_${Math.random().toString(36).slice(2, 8)}`;
}

function swarmsDir(): string {
  return join(getConfig().dataDir, "swarms");
}

function swarmPath(swarmId: string): string {
  return join(swarmsDir(), `${swarmId}.json`);
}

function saveSwarm(swarm: Swarm): void {
  try {
    ensureDir(swarmsDir());
    writeFileSync(swarmPath(swarm.id), JSON.stringify(swarm, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save swarm:", (err as Error).message);
  }
}

function loadSwarms(): Swarm[] {
  try {
    const dir = swarmsDir();
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter(f => f.endsWith(".json"));
    const result: Swarm[] = [];
    for (const f of files) {
      try {
        const raw = readFileSync(join(dir, f), "utf-8");
        const swarm: Swarm = JSON.parse(raw);
        result.push(swarm);
      } catch {}
    }
    return result;
  } catch {
    return [];
  }
}

export function createSwarm(name: string, pattern: SwarmPattern, task: string): Swarm {
  const swarm: Swarm = {
    id: generateId("swarm"),
    name,
    pattern,
    agents: [],
    task,
    status: "idle",
    context: {},
    createdAt: new Date(),
    qualityScore: 0,
  };
  swarms.set(swarm.id, swarm);
  saveSwarm(swarm);
  return swarm;
}

export function addAgent(swarmId: string, agent: Omit<SwarmAgent, "id" | "status" | "startedAt" | "completedAt">): SwarmAgent {
  const swarm = swarms.get(swarmId);
  if (!swarm) throw new Error(`Swarm not found: ${swarmId}`);

  const newAgent: SwarmAgent = {
    ...agent,
    id: generateId("agent"),
    status: "pending",
  };
  swarm.agents.push(newAgent);
  saveSwarm(swarm);
  return newAgent;
}

export function removeAgent(swarmId: string, agentId: string): boolean {
  const swarm = swarms.get(swarmId);
  if (!swarm) return false;
  const idx = swarm.agents.findIndex(a => a.id === agentId);
  if (idx === -1) return false;
  swarm.agents.splice(idx, 1);
  saveSwarm(swarm);
  return true;
}

export function getSwarm(swarmId: string): Swarm | null {
  return swarms.get(swarmId) || null;
}

export function listSwarms(status?: SwarmStatus): Swarm[] {
  const all = Array.from(swarms.values());
  if (status) return all.filter(s => s.status === status);
  return all;
}

export function deleteSwarm(swarmId: string): boolean {
  const existed = swarms.has(swarmId);
  swarms.delete(swarmId);
  messages.delete(swarmId);
  const path = swarmPath(swarmId);
  if (existsSync(path)) {
    try { writeFileSync(path, "{}", "utf-8"); } catch {}
  }
  return existed;
}

export async function runSwarm(swarmId: string): Promise<Swarm> {
  const swarm = swarms.get(swarmId);
  if (!swarm) throw new Error(`Swarm not found: ${swarmId}`);
  if (swarm.status === "running") throw new Error(`Swarm "${swarm.name}" is already running`);

  swarm.status = "running";
  swarm.agents.forEach(a => { a.status = "pending"; a.output = undefined; a.startedAt = undefined; a.completedAt = undefined; });
  saveSwarm(swarm);

  try {
    let result: Swarm;
    switch (swarm.pattern) {
      case "sequential":
        result = await runSequential(swarm);
        break;
      case "parallel":
        result = await runParallel(swarm);
        break;
      case "hierarchical":
        result = await runHierarchical(swarm);
        break;
      case "consensus":
        result = await runConsensus(swarm);
        break;
      case "competitive":
        result = await runCompetitive(swarm);
        break;
      case "adaptive":
        result = await runAdaptive(swarm);
        break;
      default:
        throw new Error(`Unknown swarm pattern: ${swarm.pattern}`);
    }

    const completedCount = result.agents.filter(a => a.status === "completed").length;
    const totalCount = result.agents.length;
    result.status = completedCount === totalCount ? "completed" : completedCount > 0 ? "partial" : "failed";
    result.completedAt = new Date();
    result.qualityScore = scoreSwarmOutput(result);
    swarms.set(result.id, result);
    saveSwarm(result);
    return result;
  } catch (err) {
    swarm.status = "failed";
    swarm.completedAt = new Date();
    swarm.qualityScore = scoreSwarmOutput(swarm);
    saveSwarm(swarm);
    throw err;
  }
}

export async function runSequential(swarm: Swarm): Promise<Swarm> {
  let prevOutput = swarm.task;
  for (const agent of swarm.agents) {
    agent.status = "running";
    agent.startedAt = new Date();
    agent.output = await simulateAgentRun(agent, prevOutput, swarm.context);
    agent.completedAt = new Date();
    agent.status = "completed";
    prevOutput = agent.output;
    sendMessage({ from: agent.id, to: "_next", content: agent.output, type: "report" });
  }
  return swarm;
}

export async function runParallel(swarm: Swarm): Promise<Swarm> {
  const promises = swarm.agents.map(async (agent) => {
    agent.status = "running";
    agent.startedAt = new Date();
    try {
      agent.output = await simulateAgentRun(agent, swarm.task, swarm.context);
      agent.completedAt = new Date();
      agent.status = "completed";
    } catch (err) {
      agent.status = "failed";
      agent.output = (err as Error).message;
    }
    return agent;
  });
  await Promise.all(promises);
  const outputs = swarm.agents.map(a => a.output).filter(Boolean).join("\n---\n");
  setContext(swarm.id, "combined_output", outputs);
  return swarm;
}

export async function runHierarchical(swarm: Swarm): Promise<Swarm> {
  const manager = swarm.agents.find(a => !a.parentId);
  if (!manager) throw new Error("No manager agent found in hierarchical swarm");

  const workers = swarm.agents.filter(a => a.parentId === manager.id);

  manager.status = "running";
  manager.startedAt = new Date();

  const workerPromises = workers.map(async (worker) => {
    worker.status = "running";
    worker.startedAt = new Date();
    try {
      worker.output = await simulateAgentRun(worker, swarm.task, swarm.context);
      worker.completedAt = new Date();
      worker.status = "completed";
      sendMessage({ from: worker.id, to: manager.id, content: worker.output || "", type: "report" });
    } catch (err) {
      worker.status = "failed";
      worker.output = (err as Error).message;
    }
  });

  await Promise.all(workerPromises);

  const workerResults = workers.map(w => `[${w.name} / ${w.role}]: ${w.output || "no output"}`).join("\n");
  manager.output = await simulateAgentRun(manager, `Task: ${swarm.task}\n\nWorker results:\n${workerResults}`, swarm.context);
  manager.completedAt = new Date();
  manager.status = "completed";

  setContext(swarm.id, "manager_output", manager.output);
  setContext(swarm.id, "worker_results", workerResults);
  return swarm;
}

export async function runConsensus(swarm: Swarm): Promise<Swarm> {
  const promises = swarm.agents.map(async (agent) => {
    agent.status = "running";
    agent.startedAt = new Date();
    try {
      agent.output = await simulateAgentRun(agent, swarm.task, swarm.context);
      agent.completedAt = new Date();
      agent.status = "completed";
    } catch (err) {
      agent.status = "failed";
      agent.output = (err as Error).message;
    }
  });

  await Promise.all(promises);

  const completed = swarm.agents.filter(a => a.status === "completed");
  const outputs = completed.map(a => a.output || "");

  const consensus = findConsensus(outputs);
  setContext(swarm.id, "consensus", consensus);
  setContext(swarm.id, "all_opinions", outputs);

  const finalOutput = `Consensus reached: ${consensus}\n\nAll outputs:\n${outputs.map((o, i) => `[${completed[i]?.name || "Agent"}] ${o}`).join("\n---\n")}`;
  if (swarm.agents.length > 0) {
    swarm.agents[0].output = finalOutput;
  }

  return swarm;
}

function findConsensus(outputs: string[]): string {
  if (outputs.length === 0) return "No outputs to evaluate";

  const seen = new Map<string, number>();
  let maxCount = 0;
  let consensus = outputs[0] || "";

  for (const out of outputs) {
    const key = out.slice(0, 100).trim().toLowerCase();
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count > maxCount) {
      maxCount = count;
      consensus = out;
    }
  }

  return consensus;
}

export async function runCompetitive(swarm: Swarm): Promise<Swarm> {
  if (swarm.agents.length < 2) throw new Error("Competitive swarm needs at least 2 agents");

  const promises = swarm.agents.map(async (agent) => {
    agent.status = "running";
    agent.startedAt = new Date();
    try {
      agent.output = await simulateAgentRun(agent, swarm.task, swarm.context);
      agent.completedAt = new Date();
      agent.status = "completed";
    } catch (err) {
      agent.status = "failed";
      agent.output = (err as Error).message;
    }
  });

  await Promise.all(promises);

  const completed = swarm.agents.filter(a => a.status === "completed");
  completed.sort((a, b) => (b.output?.length || 0) - (a.output?.length || 0));

  const winner = completed[0];
  if (winner) {
    setContext(swarm.id, "winner", winner.name);
    setContext(swarm.id, "winner_output", winner.output);
    const summary = `Winner: ${winner.name}\n\n${winner.output || ""}`;
    swarm.agents[0].output = summary;
  }

  return swarm;
}

export async function runAdaptive(swarm: Swarm): Promise<Swarm> {
  let currentTask = swarm.task;
  let round = 0;
  const maxRounds = Math.max(3, swarm.agents.length);

  while (round < maxRounds) {
    const agentIdx = round % swarm.agents.length;
    const agent = swarm.agents[agentIdx];

    if (agent.status !== "completed") {
      agent.status = "running";
      agent.startedAt = new Date();
    }

    try {
      const roleSuffix = round > 0 ? `\n\n[Round ${round + 1}] Previous result: ${currentTask.slice(0, 200)}` : "";
      agent.output = await simulateAgentRun(agent, currentTask + roleSuffix, swarm.context);
      agent.completedAt = new Date();
      agent.status = "completed";
      currentTask = agent.output || currentTask;

      sendMessage({
        from: agent.id,
        to: swarm.agents[(agentIdx + 1) % swarm.agents.length].id,
        content: currentTask,
        type: "response",
      });
    } catch (err) {
      agent.status = "failed";
    }

    if (isConverged(currentTask, round, swarm)) break;
    round++;
  }

  setContext(swarm.id, "final_output", currentTask);
  if (swarm.agents.length > 0) {
    swarm.agents[0].output = currentTask;
  }

  return swarm;
}

function isConverged(output: string, round: number, swarm: Swarm): boolean {
  if (!output || output.length < 20) return false;
  const recentOutputs = swarm.agents
    .filter(a => a.output)
    .map(a => a.output!.slice(0, 50).toLowerCase());
  const unique = new Set(recentOutputs);
  return unique.size === 1 && recentOutputs.length >= 2;
}

async function simulateAgentRun(agent: SwarmAgent, input: string, context: Record<string, any>): Promise<string> {
  const contextStr = Object.keys(context).length > 0
    ? `\n\nContext: ${JSON.stringify(context, null, 2).slice(0, 500)}`
    : "";

  return `[${agent.name} (${agent.role})] Processed: ${input.slice(0, 200)}${contextStr}`;
}

export function sendMessage(msg: Omit<SwarmMessage, "timestamp">): SwarmMessage {
  const full: SwarmMessage = { ...msg, timestamp: new Date() };

  const swarmId = findSwarmIdByAgent(msg.from) || findSwarmIdByAgent(msg.to);
  if (swarmId) {
    if (!messages.has(swarmId)) messages.set(swarmId, []);
    messages.get(swarmId)!.push(full);
  }

  return full;
}

function findSwarmIdByAgent(agentId: string): string | null {
  for (const [id, swarm] of swarms) {
    if (swarm.agents.some(a => a.id === agentId)) return id;
  }
  return null;
}

export function getMessages(swarmId: string, agentId?: string): SwarmMessage[] {
  const msgs = messages.get(swarmId) || [];
  if (agentId) return msgs.filter(m => m.from === agentId || m.to === agentId);
  return msgs;
}

export function getConversation(swarmId: string, agentA: string, agentB: string): SwarmMessage[] {
  const msgs = messages.get(swarmId) || [];
  return msgs.filter(m =>
    (m.from === agentA && m.to === agentB) || (m.from === agentB && m.to === agentA)
  );
}

export function setContext(swarmId: string, key: string, value: any): void {
  const swarm = swarms.get(swarmId);
  if (swarm) {
    swarm.context[key] = value;
    saveSwarm(swarm);
  }
}

export function getContext(swarmId: string, key: string): any {
  const swarm = swarms.get(swarmId);
  return swarm ? swarm.context[key] : undefined;
}

export function getAllContext(swarmId: string): Record<string, any> {
  const swarm = swarms.get(swarmId);
  return swarm ? { ...swarm.context } : {};
}

export function createSequentialSwarm(
  name: string,
  agents: { name: string; role: string; instructions: string }[],
  task: string
): Swarm {
  const swarm = createSwarm(name, "sequential", task);
  for (const a of agents) {
    addAgent(swarm.id, {
      name: a.name,
      role: a.role,
      model: "gpt-4o-mini",
      instructions: a.instructions,
      tools: [],
    });
  }
  return swarm;
}

export function createParallelSwarm(
  name: string,
  agents: { name: string; role: string; instructions: string }[],
  task: string
): Swarm {
  const swarm = createSwarm(name, "parallel", task);
  for (const a of agents) {
    addAgent(swarm.id, {
      name: a.name,
      role: a.role,
      model: "gpt-4o-mini",
      instructions: a.instructions,
      tools: [],
    });
  }
  return swarm;
}

export function createHierarchicalSwarm(
  name: string,
  manager: { name: string; instructions: string },
  workers: { name: string; role: string; instructions: string }[],
  task: string
): Swarm {
  const swarm = createSwarm(name, "hierarchical", task);
  const managerAgent = addAgent(swarm.id, {
    name: manager.name,
    role: "manager",
    model: "gpt-4o-mini",
    instructions: manager.instructions,
    tools: [],
  });
  for (const w of workers) {
    addAgent(swarm.id, {
      name: w.name,
      role: w.role,
      model: "gpt-4o-mini",
      instructions: w.instructions,
      tools: [],
      parentId: managerAgent.id,
    });
  }
  return swarm;
}

export function resolveConflict(swarmId: string, issue: string, resolution: string): void {
  const swarm = swarms.get(swarmId);
  if (!swarm) throw new Error(`Swarm not found: ${swarmId}`);
  setContext(swarmId, `conflict:${issue}`, resolution);
  sendMessage({
    from: "_resolver",
    to: swarm.agents[0]?.id || "_system",
    content: `Conflict resolved: ${issue} → ${resolution}`,
    type: "report",
  });
}

export function scoreSwarmOutput(swarm: Swarm): number {
  const totalAgents = swarm.agents.length;
  if (totalAgents === 0) return 0;

  const completed = swarm.agents.filter(a => a.status === "completed").length;
  const completionRatio = completed / totalAgents;

  const errorFree = swarm.agents.filter(a => a.status !== "failed").length;
  const qualityRatio = errorFree / totalAgents;

  const contextUsage = Object.keys(swarm.context).length > 0 ? 0.1 : 0;

  const allHaveOutput = swarm.agents.every(a => a.output && a.output.length > 0) ? 0.1 : 0;

  const rawScore = (completionRatio * 50) + (qualityRatio * 30) + (contextUsage * 10) + (allHaveOutput * 10);
  return Math.round(Math.min(100, Math.max(0, rawScore)));
}

export const SWARM_TEMPLATES = {
  "code-review": {
    pattern: "sequential" as SwarmPattern,
    agents: [
      { name: "PM", role: "product manager", model: "gpt-4o-mini", instructions: "Review requirements", tools: [], status: "pending" as const },
      { name: "Dev", role: "developer", model: "gpt-4o-mini", instructions: "Review code quality", tools: [], status: "pending" as const },
      { name: "QA", role: "quality assurance", model: "gpt-4o-mini", instructions: "Test the changes", tools: [], status: "pending" as const },
    ],
  },
  "research": {
    pattern: "parallel" as SwarmPattern,
    agents: [
      { name: "Researcher 1", role: "researcher", model: "gpt-4o-mini", instructions: "Gather data from sources", tools: [], status: "pending" as const },
      { name: "Researcher 2", role: "analyst", model: "gpt-4o-mini", instructions: "Analyze findings", tools: [], status: "pending" as const },
      { name: "Researcher 3", role: "synthesizer", model: "gpt-4o-mini", instructions: "Synthesize report", tools: [], status: "pending" as const },
    ],
  },
  "full-stack-app": {
    pattern: "hierarchical" as SwarmPattern,
    agents: [
      { name: "Tech Lead", role: "manager", model: "gpt-4o-mini", instructions: "Coordinate the team", tools: [], status: "pending" as const, id: "manager" },
      { name: "Frontend", role: "frontend developer", model: "gpt-4o-mini", instructions: "Build UI", tools: [], parentId: "manager", status: "pending" as const },
      { name: "Backend", role: "backend developer", model: "gpt-4o-mini", instructions: "Build API", tools: [], parentId: "manager", status: "pending" as const },
      { name: "DevOps", role: "devops engineer", model: "gpt-4o-mini", instructions: "Setup infrastructure", tools: [], parentId: "manager", status: "pending" as const },
    ],
  },
  "decision": {
    pattern: "consensus" as SwarmPattern,
    agents: [
      { name: "Evaluator 1", role: "evaluator", model: "gpt-4o-mini", instructions: "Evaluate from technical perspective", tools: [], status: "pending" as const },
      { name: "Evaluator 2", role: "evaluator", model: "gpt-4o-mini", instructions: "Evaluate from business perspective", tools: [], status: "pending" as const },
      { name: "Evaluator 3", role: "evaluator", model: "gpt-4o-mini", instructions: "Evaluate from user perspective", tools: [], status: "pending" as const },
    ],
  },
};

const loaded = loadSwarms();
for (const s of loaded) {
  swarms.set(s.id, s);
}
