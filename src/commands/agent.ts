import chalk from "chalk";
import { t } from "../i18n/index.js";
import { memoryStore, memoryGet, memorySearch } from "../memory/index.js";
import { auditLog } from "../security/index.js";

interface Agent {
  name: string;
  description: string;
  createdAt: string;
  model: string;
  status: "idle" | "running" | "error";
}

const agents = new Map<string, Agent>();

export function createAgent(name: string, description: string, model = "gpt-4o-mini"): void {
  if (agents.has(name)) {
    console.log(chalk.hex("#F59E0B")(`  ⚠ Agent "${name}" already exists`));
    return;
  }
  agents.set(name, {
    name,
    description,
    createdAt: new Date().toISOString(),
    model,
    status: "idle",
  });
  memoryStore(`agent:${name}`, JSON.stringify({ description, model }));
  auditLog("AGENT_CREATE", `Created agent: ${name}`);
  console.log(chalk.hex("#10B981")(`  ✅ ${t().agent.created}: ${chalk.bold(name)}`));
}

export function listAgents(): void {
  if (agents.size === 0) {
    console.log(chalk.hex("#64748B")("  No agents yet. Use 'oh create <name>' to create one."));
    return;
  }
  console.log(chalk.hex("#8B5CF6").bold(`\n  ${t().help.agent}\n`));
  for (const agent of agents.values()) {
    const statusColor = agent.status === "running" ? "#10B981" : agent.status === "error" ? "#F43F5E" : "#64748B";
    console.log(`  ${chalk.hex("#F8FAFC").bold(agent.name)} ${chalk.hex(statusColor)(`● ${agent.status}`)}`);
    console.log(`    ${chalk.hex("#94A3B8")(agent.description)}`);
    console.log(`    ${chalk.hex("#64748B")(`Model: ${agent.model} | Created: ${agent.createdAt.slice(0, 10)}`)}`);
    console.log();
  }
}

export function deleteAgent(name: string): void {
  if (!agents.has(name)) {
    console.log(chalk.hex("#F43F5E")(`  ❌ ${t().agent.notFound}: ${name}`));
    return;
  }
  agents.delete(name);
  auditLog("AGENT_DELETE", `Deleted agent: ${name}`);
  console.log(chalk.hex("#10B981")(`  ✅ ${t().agent.deleted}: ${name}`));
}

export function runAgent(name: string): void {
  const agent = agents.get(name);
  if (!agent) {
    console.log(chalk.hex("#F43F5E")(`  ❌ ${t().agent.notFound}: ${name}`));
    return;
  }
  agent.status = "running";
  auditLog("AGENT_RUN", `Running agent: ${name}`);
  console.log(chalk.hex("#06B6D4")(`  🤖 Running agent "${name}"...`));
  console.log(chalk.hex("#10B981")(`  ✅ Agent "${name}" completed`));
  agent.status = "idle";
}
