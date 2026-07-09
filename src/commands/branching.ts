import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { getConfig } from "../config/index.js";
import chalk from "chalk";

export type BranchNodeType = "user" | "assistant" | "system" | "tool" | "branch" | "merge";

export interface BranchNode {
  id: string;
  type: BranchNodeType;
  content: string;
  timestamp: number;
  parentId: string | null;
  branchId: string;
  metadata: {
    model?: string;
    tokens?: number;
    duration?: number;
    tag?: string;
  };
}

export interface Branch {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  headNodeId: string;
  rootNodeId: string;
  parentBranchId: string | null;
  color: string;
  status: "active" | "archived" | "merged";
  mergedInto?: string;
}

export interface ConversationTree {
  id: string;
  name: string;
  createdAt: number;
  branches: Map<string, Branch>;
  nodes: Map<string, BranchNode>;
  activeBranchId: string;
  rootNodeId: string;
}

const COLORS = ["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E", "#A78BFA", "#67E8F9", "#FB923C", "#34D399", "#818CF8"];

let trees: Map<string, ConversationTree> = new Map();

function getDataDir(): string {
  const base = getConfig()?.dataDir || ".oh";
  return join(base, "branches");
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function saveTree(tree: ConversationTree): void {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const data = {
    id: tree.id,
    name: tree.name,
    createdAt: tree.createdAt,
    branches: Array.from(tree.branches.entries()),
    nodes: Array.from(tree.nodes.entries()),
    activeBranchId: tree.activeBranchId,
    rootNodeId: tree.rootNodeId,
  };
  writeFileSync(join(dir, `${tree.id}.json`), JSON.stringify(data, null, 2));
}

function loadTree(id: string): ConversationTree | null {
  const dir = getDataDir();
  const path = join(dir, `${id}.json`);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return {
    ...raw,
    branches: new Map(raw.branches),
    nodes: new Map(raw.nodes),
  };
}

function getBranchColor(index: number): string {
  return COLORS[index % COLORS.length];
}

export function createConversation(name: string): ConversationTree {
  const rootId = genId();
  const branchId = genId();
  const rootNode: BranchNode = {
    id: rootId,
    type: "system",
    content: `Conversation: ${name}`,
    timestamp: Date.now(),
    parentId: null,
    branchId,
    metadata: {},
  };
  const branch: Branch = {
    id: branchId,
    name: "main",
    description: "Main conversation thread",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    headNodeId: rootId,
    rootNodeId: rootId,
    parentBranchId: null,
    color: COLORS[0],
    status: "active",
  };
  const tree: ConversationTree = {
    id: genId(),
    name,
    createdAt: Date.now(),
    branches: new Map([[branchId, branch]]),
    nodes: new Map([[rootId, rootNode]]),
    activeBranchId: branchId,
    rootNodeId: rootId,
  };
  trees.set(tree.id, tree);
  saveTree(tree);
  return tree;
}

export function addNode(treeId: string, content: string, type: BranchNodeType, metadata?: Record<string, any>): BranchNode | null {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return null;

  const branch = tree.branches.get(tree.activeBranchId);
  if (!branch) return null;

  const nodeId = genId();
  const node: BranchNode = {
    id: nodeId,
    type,
    content,
    timestamp: Date.now(),
    parentId: branch.headNodeId,
    branchId: tree.activeBranchId,
    metadata: metadata || {},
  };

  tree.nodes.set(nodeId, node);
  branch.headNodeId = nodeId;
  branch.updatedAt = Date.now();

  trees.set(treeId, tree);
  saveTree(tree);
  return node;
}

export function branchConversation(treeId: string, nodeId: string, branchName: string, description?: string): { tree: ConversationTree; branch: Branch } | null {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return null;
  const node = tree.nodes.get(nodeId);
  if (!node) return null;

  const newBranchId = genId();
  const color = getBranchColor(tree.branches.size);
  const branch: Branch = {
    id: newBranchId,
    name: branchName,
    description: description || `Branch from node ${nodeId.slice(0, 8)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    headNodeId: nodeId,
    rootNodeId: nodeId,
    parentBranchId: tree.activeBranchId,
    color,
    status: "active",
  };

  tree.branches.set(newBranchId, branch);
  trees.set(treeId, tree);
  saveTree(tree);
  return { tree, branch };
}

export function mergeBranches(treeId: string, sourceBranchId: string, targetBranchId?: string, strategy: "keep-source" | "keep-target" | "manual" = "keep-source"): { success: boolean; mergedContent?: string } {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return { success: false };
  const targetId = targetBranchId || tree.activeBranchId;
  const sourceBranch = tree.branches.get(sourceBranchId);
  const targetBranch = tree.branches.get(targetId);
  if (!sourceBranch || !targetBranch) return { success: false };

  const sourceNode = tree.nodes.get(sourceBranch.headNodeId);
  const targetNode = tree.nodes.get(targetBranch.headNodeId);
  if (!sourceNode || !targetNode) return { success: false };

  const mergedContent = strategy === "keep-source"
    ? sourceNode.content
    : strategy === "keep-target"
      ? targetNode.content
      : `${targetNode.content}\n\n— Merged from branch "${sourceBranch.name}" —\n${sourceNode.content}`;

  const mergeId = genId();
  const mergeNode: BranchNode = {
    id: mergeId,
    type: "merge",
    content: mergedContent,
    timestamp: Date.now(),
    parentId: targetBranch.headNodeId,
    branchId: targetId,
    metadata: {
      tag: `merged-from:${sourceBranchId}`,
    },
  };

  tree.nodes.set(mergeId, mergeNode);
  targetBranch.headNodeId = mergeId;
  targetBranch.updatedAt = Date.now();
  sourceBranch.status = "merged";
  sourceBranch.mergedInto = targetId;

  trees.set(treeId, tree);
  saveTree(tree);
  return { success: true, mergedContent };
}

export function getBranchHistory(treeId: string, branchId?: string): BranchNode[] {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return [];
  const targetBranchId = branchId || tree.activeBranchId;
  const branch = tree.branches.get(targetBranchId);
  if (!branch) return [];

  const history: BranchNode[] = [];
  let currentId: string | null = branch.headNodeId;
  while (currentId) {
    const node = tree.nodes.get(currentId);
    if (!node) break;
    history.unshift(node);
    currentId = node.parentId;
  }
  return history;
}

export function diffBranches(treeId: string, branchIdA: string, branchIdB: string): { additions: string[]; removals: string[]; unchanged: string[] } {
  const historyA = getBranchHistory(treeId, branchIdA);
  const historyB = getBranchHistory(treeId, branchIdB);
  const textA = historyA.map(n => n.content).join("\n");
  const textB = historyB.map(n => n.content).join("\n");

  const linesA = textA.split("\n");
  const linesB = textB.split("\n");
  const setA = new Set(linesA);
  const setB = new Set(linesB);

  return {
    additions: linesB.filter(l => !setA.has(l)),
    removals: linesA.filter(l => !setB.has(l)),
    unchanged: linesA.filter(l => setB.has(l)),
  };
}

export function switchBranch(treeId: string, branchId: string): boolean {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return false;
  if (!tree.branches.has(branchId)) return false;
  tree.activeBranchId = branchId;
  trees.set(treeId, tree);
  saveTree(tree);
  return true;
}

export function visualizeTree(treeId: string): string {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return "Tree not found";

  const lines: string[] = [];
  const activeBranch = tree.branches.get(tree.activeBranchId);
  lines.push(`\n  🌳 ${chalk.bold(tree.name)}`);
  lines.push(`  ${chalk.hex("#64748B")(`ID: ${tree.id} | ${tree.branches.size} branches | ${tree.nodes.size} nodes`)}`);
  lines.push(`  ${chalk.hex("#64748B")(`Active: ${activeBranch?.name || "none"} ${activeBranch ? chalk.hex(activeBranch.color)("●") : ""}`)}`);
  lines.push("");

  tree.branches.forEach((branch) => {
    const isActive = branch.id === tree.activeBranchId;
    const prefix = isActive ? chalk.hex("#10B981")("◉ ") : chalk.hex("#64748B")("○ ");
    const name = isActive ? chalk.bold(branch.name) : branch.name;
    const colorDot = chalk.hex(branch.color)("●");
    const statusIcon = branch.status === "active" ? "🟢" : branch.status === "merged" ? "🔀" : "📦";

    const history = getBranchHistory(tree.id, branch.id);
    const nodeCount = history.length;
    const lastNode = history[nodeCount - 1];
    const preview = lastNode ? lastNode.content.slice(0, 60).replace(/\n/g, " ") : "";

    lines.push(`  ${prefix} ${colorDot} ${statusIcon} ${name}`);
    lines.push(`    ${chalk.hex("#64748B")(`${nodeCount} messages | Created ${new Date(branch.createdAt).toLocaleString()}`)}`);
    if (branch.parentBranchId) {
      const parent = tree.branches.get(branch.parentBranchId);
      if (parent) lines.push(`    ${chalk.hex("#64748B")(`Forked from: ${parent.name}`)}`);
    }
    if (branch.mergedInto) {
      const merged = tree.branches.get(branch.mergedInto);
      if (merged) lines.push(`    ${chalk.hex("#10B981")(`Merged into: ${merged.name}`)}`);
    }
    if (preview) lines.push(`    ${chalk.hex("#94A3B8")(`↳ ${preview}${preview.length >= 60 ? "..." : ""}`)}`);
    lines.push("");
  });

  return lines.join("\n");
}

export function renderBranchTimeline(treeId: string): string {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return "";

  const lines: string[] = [];
  const allNodes: BranchNode[] = [];

  tree.branches.forEach((branch) => {
    const history = getBranchHistory(treeId, branch.id);
    allNodes.push(...history);
  });

  allNodes.sort((a, b) => a.timestamp - b.timestamp);

  lines.push(`\n  ${chalk.bold("📜 Conversation Timeline")}\n`);

  for (const node of allNodes) {
    const branch = tree.branches.get(node.branchId);
    if (!branch) continue;
    const color = branch.color;
    const branchLabel = branch.name;
    const time = new Date(node.timestamp).toLocaleTimeString();
    const icon = node.type === "user" ? "👤" : node.type === "assistant" ? "🤖" : node.type === "system" ? "⚙️" : node.type === "branch" ? "🌿" : node.type === "merge" ? "🔀" : "🔧";
    const shortContent = node.content.replace(/\n/g, " ").slice(0, 80);

    lines.push(`  ${chalk.hex(color)("│")}`);
    lines.push(`  ${chalk.hex(color)("├─")} ${icon} ${chalk.hex("#94A3B8")(time)} ${chalk.hex(color)(`[${branchLabel}]`)}`);
    lines.push(`  ${chalk.hex(color)("│")}  ${chalk.hex("#F8FAFC")(shortContent)}`);
  }
  lines.push(`  ${chalk.hex("#64748B")("└── End")}\n`);

  return lines.join("\n");
}

export function archiveBranch(treeId: string, branchId: string): boolean {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return false;
  const branch = tree.branches.get(branchId);
  if (!branch) return false;
  branch.status = "archived";
  saveTree(tree);
  return true;
}

export function deleteBranch(treeId: string, branchId: string): boolean {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return false;
  if (tree.branches.size <= 1) return false;
  if (tree.activeBranchId === branchId) return false;
  const branch = tree.branches.get(branchId);
  if (!branch) return false;
  if (branch.status === "merged") {
    tree.nodes.forEach((node, nodeId) => {
      if (node.branchId === branchId) tree.nodes.delete(nodeId);
    });
    tree.branches.delete(branchId);
    saveTree(tree);
    return true;
  }
  return false;
}

export function tagNode(treeId: string, nodeId: string, tag: string): boolean {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return false;
  const node = tree.nodes.get(nodeId);
  if (!node) return false;
  node.metadata.tag = tag;
  saveTree(tree);
  return true;
}

export function findNodeByTag(treeId: string, tag: string): BranchNode | undefined {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return undefined;
  for (const node of tree.nodes.values()) {
    if (node.metadata.tag === tag) return node;
  }
  return undefined;
}

export function renameBranch(treeId: string, branchId: string, newName: string): boolean {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return false;
  const branch = tree.branches.get(branchId);
  if (!branch) return false;
  branch.name = newName;
  saveTree(tree);
  return true;
}

export function getTreeList(): { id: string; name: string; branchCount: number; nodeCount: number; updatedAt: number }[] {
  const dir = getDataDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  return files.map((f) => {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf-8"));
    return {
      id: raw.id,
      name: raw.name,
      branchCount: raw.branches?.length || 0,
      nodeCount: raw.nodes?.length || 0,
      updatedAt: raw.updatedAt || raw.createdAt,
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadAllTrees(): ConversationTree[] {
  const dir = getDataDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  return files.map((f) => {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf-8"));
    return {
      ...raw,
      branches: new Map(raw.branches),
      nodes: new Map(raw.nodes),
    };
  });
}

export function rollbackToNode(treeId: string, nodeId: string): boolean {
  const tree = trees.get(treeId) || loadTree(treeId);
  if (!tree) return false;
  const node = tree.nodes.get(nodeId);
  if (!node) return false;

  const branch = tree.branches.get(node.branchId);
  if (!branch) return false;

  branch.headNodeId = nodeId;
  branch.updatedAt = Date.now();

  const toDelete: string[] = [];
  tree.nodes.forEach((n, nid) => {
    if (n.branchId === node.branchId && n.timestamp > node.timestamp) {
      toDelete.push(nid);
    }
  });
  toDelete.forEach((nid) => tree.nodes.delete(nid));

  saveTree(tree);
  return true;
}

// readdirSync already imported at top
