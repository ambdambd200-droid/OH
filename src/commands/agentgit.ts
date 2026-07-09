import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";

export interface AgentCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: AgentFileChange[];
  parentHash: string | null;
  branch: string;
}

export interface AgentFileChange {
  path: string;
  action: "added" | "modified" | "deleted";
  content?: string;
  oldContent?: string;
}

export interface AgentBranch {
  name: string;
  headHash: string;
  createdAt: Date;
}

export interface AgentTag {
  name: string;
  commitHash: string;
  message: string;
  createdAt: Date;
}

export interface AgentRepo {
  name: string;
  agentId: string;
  branches: AgentBranch[];
  tags: AgentTag[];
  commits: Map<string, AgentCommit>;
  HEAD: string;
}

function _(ar: string, en: string): string {
  return getConfig().lang === "ar" ? ar : en;
}

function generateHash(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function gitPath(agentId: string, ...sub: string[]): string {
  return join(getConfig().dataDir, "git", agentId, ...sub);
}

function ensureGitDir(agentId: string): void {
  const base = gitPath(agentId);
  ensureDir(base);
  ensureDir(join(base, "refs", "heads"));
  ensureDir(join(base, "refs", "tags"));
  ensureDir(join(base, "commits"));
}

function writeHEAD(agentId: string, branch: string): void {
  writeFileSync(gitPath(agentId, "HEAD"), branch, "utf-8");
}

function readHEAD(agentId: string): string {
  const p = gitPath(agentId, "HEAD");
  return existsSync(p) ? readFileSync(p, "utf-8").trim() : "main";
}

function writeRef(agentId: string, type: "heads" | "tags", name: string, hash: string): void {
  writeFileSync(gitPath(agentId, "refs", type, name), hash, "utf-8");
}

function readRef(agentId: string, type: "heads" | "tags", name: string): string | null {
  const p = gitPath(agentId, "refs", type, name);
  return existsSync(p) ? readFileSync(p, "utf-8").trim() : null;
}

function writeCommitFile(agentId: string, commit: AgentCommit): void {
  writeFileSync(gitPath(agentId, "commits", `${commit.hash}.json`), JSON.stringify(commit, null, 2), "utf-8");
}

function readCommitFile(agentId: string, hash: string): AgentCommit | null {
  const p = gitPath(agentId, "commits", `${hash}.json`);
  if (!existsSync(p)) return null;
  const raw = JSON.parse(readFileSync(p, "utf-8"));
  raw.date = new Date(raw.date);
  raw.files.forEach((f: AgentFileChange) => {});
  return raw as AgentCommit;
}

function findCommonAncestor(repo: AgentRepo, hashA: string, hashB: string): string | null {
  const ancestors = new Set<string>();
  let cur: string | null = hashA;
  while (cur) {
    ancestors.add(cur);
    const c = repo.commits.get(cur);
    if (!c || !c.parentHash) break;
    cur = c.parentHash;
  }
  cur = hashB;
  while (cur) {
    if (ancestors.has(cur)) return cur;
    const c = repo.commits.get(cur);
    if (!c || !c.parentHash) break;
    cur = c.parentHash;
  }
  return null;
}

function getCommitRange(repo: AgentRepo, fromHash: string, toHash: string): AgentCommit[] {
  const commits: AgentCommit[] = [];
  let cur: string | null = toHash;
  while (cur && cur !== fromHash) {
    const c = repo.commits.get(cur);
    if (!c) break;
    commits.unshift(c);
    cur = c.parentHash;
  }
  return commits;
}

function detectConflicts(sourceCommits: AgentCommit[], currentCommits: AgentCommit[]): string[] {
  const sourceFiles = new Map<string, Set<number>>();
  const currentFiles = new Map<string, Set<number>>();

  function collectLines(commits: AgentCommit[], map: Map<string, Set<number>>) {
    for (const c of commits) {
      for (const f of c.files) {
        if (!map.has(f.path)) map.set(f.path, new Set());
        if (f.content) {
          f.content.split("\n").forEach((_, i) => map.get(f.path)!.add(i));
        }
        if (f.oldContent) {
          f.oldContent.split("\n").forEach((_, i) => map.get(f.path)!.add(i));
        }
      }
    }
  }

  collectLines(sourceCommits, sourceFiles);
  collectLines(currentCommits, currentFiles);

  const conflicts: string[] = [];
  for (const [path, srcLines] of sourceFiles) {
    const curLines = currentFiles.get(path);
    if (curLines) {
      for (const line of srcLines) {
        if (curLines.has(line)) {
          conflicts.push(path);
          break;
        }
      }
    }
  }
  return conflicts;
}

export function initRepo(agentName: string, agentId: string): AgentRepo {
  ensureGitDir(agentId);

  const hash = generateHash();
  const now = new Date();

  const initialCommit: AgentCommit = {
    hash,
    author: agentName,
    date: now,
    message: "Initial commit",
    files: [],
    parentHash: null,
    branch: "main",
  };

  const branch: AgentBranch = {
    name: "main",
    headHash: hash,
    createdAt: now,
  };

  writeCommitFile(agentId, initialCommit);
  writeRef(agentId, "heads", "main", hash);
  writeHEAD(agentId, "main");

  const repo: AgentRepo = {
    name: agentName,
    agentId,
    branches: [branch],
    tags: [],
    commits: new Map([[hash, initialCommit]]),
    HEAD: "main",
  };

  return repo;
}

export function commit(repo: AgentRepo, message: string, files: AgentFileChange[]): AgentCommit {
  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  const parentHash = currentBranch?.headHash || null;

  const hash = generateHash();
  const commitObj: AgentCommit = {
    hash,
    author: repo.name,
    date: new Date(),
    message,
    files,
    parentHash,
    branch: repo.HEAD,
  };

  writeCommitFile(repo.agentId, commitObj);
  writeRef(repo.agentId, "heads", repo.HEAD, hash);

  repo.commits.set(hash, commitObj);
  if (currentBranch) currentBranch.headHash = hash;

  return commitObj;
}

export function branch(repo: AgentRepo, name: string): AgentBranch {
  if (repo.branches.some((b) => b.name === name)) {
    throw new Error(
      chalk.hex("#F43F5E")(`  ❌ ${_(`الفرع "${name}" موجود بالفعل`, `Branch "${name}" already exists`)}`)
    );
  }

  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  const headHash = currentBranch?.headHash || "";

  const newBranch: AgentBranch = {
    name,
    headHash,
    createdAt: new Date(),
  };

  repo.branches.push(newBranch);
  if (headHash) writeRef(repo.agentId, "heads", name, headHash);

  return newBranch;
}

export function checkout(repo: AgentRepo, target: string): AgentRepo {
  const branchExists = repo.branches.find((b) => b.name === target);
  if (branchExists) {
    repo.HEAD = target;
    writeHEAD(repo.agentId, target);
    return repo;
  }

  if (repo.commits.has(target)) {
    const detachedName = `detached-${target.slice(0, 7)}`;
    repo.branches.push({
      name: detachedName,
      headHash: target,
      createdAt: new Date(),
    });
    repo.HEAD = detachedName;
    writeHEAD(repo.agentId, detachedName);
    writeRef(repo.agentId, "heads", detachedName, target);
    return repo;
  }

  throw new Error(
    chalk.hex("#F43F5E")(`  ❌ ${_(`الفرع أو الالتزام "${target}" غير موجود`, `Branch or commit "${target}" not found`)}`)
  );
}

export function merge(
  repo: AgentRepo,
  source: string,
  strategy: "fast-forward" | "squash" | "rebase"
): { repo: AgentRepo; conflicts: string[] } {
  const sourceBranch = repo.branches.find((b) => b.name === source);
  if (!sourceBranch) {
    throw new Error(
      chalk.hex("#F43F5E")(`  ❌ ${_(`الفرع "${source}" غير موجود`, `Branch "${source}" not found`)}`)
    );
  }

  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  if (!currentBranch) {
    throw new Error(
      chalk.hex("#F43F5E")(`  ❌ ${_("لا يوجد فرع حالي", "No current branch")}`)
    );
  }

  if (sourceBranch.headHash === currentBranch.headHash) {
    return { repo, conflicts: [] };
  }

  const ancestor = findCommonAncestor(repo, currentBranch.headHash, sourceBranch.headHash);

  if (strategy === "fast-forward") {
    if (ancestor === currentBranch.headHash) {
      currentBranch.headHash = sourceBranch.headHash;
      writeRef(repo.agentId, "heads", repo.HEAD, sourceBranch.headHash);
      return { repo, conflicts: [] };
    }
    throw new Error(
      chalk.hex("#FBBF24")(`  ⚠ ${_("لا يمكن التقديم السريع، ليس سلفاً خطياً", "Cannot fast-forward, not a linear ancestor")}`)
    );
  }

  const sourceCommits = getCommitRange(repo, ancestor || "", sourceBranch.headHash);
  const currentCommits = getCommitRange(repo, ancestor || "", currentBranch.headHash);
  const conflicts = detectConflicts(sourceCommits, currentCommits);

  if (strategy === "squash") {
    const seen = new Set<string>();
    const allFiles: AgentFileChange[] = [];
    for (const c of sourceCommits) {
      for (const f of c.files) {
        if (!seen.has(f.path)) {
          seen.add(f.path);
          allFiles.push(f);
        }
      }
    }

    const hash = generateHash();
    const msg = `Squash merge of '${source}' into '${repo.HEAD}'`;
    const squashCommit: AgentCommit = {
      hash,
      author: repo.name,
      date: new Date(),
      message: msg,
      files: allFiles,
      parentHash: currentBranch.headHash,
      branch: repo.HEAD,
    };

    writeCommitFile(repo.agentId, squashCommit);
    writeRef(repo.agentId, "heads", repo.HEAD, hash);
    repo.commits.set(hash, squashCommit);
    currentBranch.headHash = hash;

    return { repo, conflicts };
  }

  if (strategy === "rebase") {
    let parentHash: string | null = currentBranch.headHash;
    for (const c of sourceCommits) {
      const hash = generateHash();
      const rebased: AgentCommit = {
        hash,
        author: c.author,
        date: c.date,
        message: `[rebase] ${c.message}`,
        files: c.files,
        parentHash,
        branch: repo.HEAD,
      };
      writeCommitFile(repo.agentId, rebased);
      writeRef(repo.agentId, "heads", repo.HEAD, hash);
      repo.commits.set(hash, rebased);
      parentHash = hash;
    }
    currentBranch.headHash = parentHash || currentBranch.headHash;
    return { repo, conflicts };
  }

  return { repo, conflicts };
}

export function diff(commit1: AgentCommit, commit2: AgentCommit): string {
  let output = "";
  const allPaths = new Set([
    ...commit1.files.map((f) => f.path),
    ...commit2.files.map((f) => f.path),
  ]);

  for (const path of allPaths) {
    const f1 = commit1.files.find((f) => f.path === path);
    const f2 = commit2.files.find((f) => f.path === path);

    if (!f1) {
      output += `\n+ ${path} (${_("أضيف", "added")})\n`;
      if (f2?.content) {
        output += f2.content.split("\n").map((l) => `+ ${l}`).join("\n") + "\n";
      }
    } else if (!f2) {
      output += `\n- ${path} (${_("حذف", "deleted")})\n`;
      if (f1?.content) {
        output += f1.content.split("\n").map((l) => `- ${l}`).join("\n") + "\n";
      }
    } else if (f1.content !== f2.content) {
      output += `\n~ ${path} (${_("تعديل", "modified")})\n`;
      const lines1 = (f1.content || "").split("\n");
      const lines2 = (f2.content || "").split("\n");
      const maxLen = Math.max(lines1.length, lines2.length);
      for (let i = 0; i < maxLen; i++) {
        if (i >= lines1.length) {
          output += `+ ${lines2[i]}\n`;
        } else if (i >= lines2.length) {
          output += `- ${lines1[i]}\n`;
        } else if (lines1[i] !== lines2[i]) {
          output += `- ${lines1[i]}\n`;
          output += `+ ${lines2[i]}\n`;
        } else {
          output += `  ${lines1[i]}\n`;
        }
      }
    }
  }

  return output || _("لا توجد تغييرات", "No changes");
}

export function log(repo: AgentRepo, limit?: number): AgentCommit[] {
  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  if (!currentBranch) return [];

  const commits: AgentCommit[] = [];
  let hash: string | null = currentBranch.headHash;

  while (hash) {
    const c = repo.commits.get(hash);
    if (!c) break;
    commits.push(c);
    hash = c.parentHash;
    if (limit !== undefined && commits.length >= limit) break;
  }

  return commits;
}

export function tag(repo: AgentRepo, name: string, message?: string): AgentTag {
  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  const commitHash = currentBranch?.headHash;
  if (!commitHash) {
    throw new Error(
      chalk.hex("#F43F5E")(`  ❌ ${_("لا يوجد التزام لوضع علامة", "No commit to tag")}`)
    );
  }

  const newTag: AgentTag = {
    name,
    commitHash,
    message: message || "",
    createdAt: new Date(),
  };

  repo.tags.push(newTag);
  writeFileSync(gitPath(repo.agentId, "refs", "tags", name), JSON.stringify(newTag), "utf-8");

  return newTag;
}

export function rollback(repo: AgentRepo, target: string): AgentRepo {
  if (!repo.commits.has(target)) {
    throw new Error(
      chalk.hex("#F43F5E")(`  ❌ ${_(`الالتزام "${target.slice(0, 7)}" غير موجود`, `Commit "${target.slice(0, 7)}" not found`)}`)
    );
  }

  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  if (!currentBranch) return repo;

  currentBranch.headHash = target;
  writeRef(repo.agentId, "heads", repo.HEAD, target);

  return repo;
}

export function blame(
  repo: AgentRepo,
  filePath: string
): { line: number; hash: string; author: string; date: Date }[] {
  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  if (!currentBranch) return [];

  const allCommits: AgentCommit[] = [];
  let hash: string | null = currentBranch.headHash;
  while (hash) {
    const c = repo.commits.get(hash);
    if (!c) break;
    allCommits.unshift(c);
    hash = c.parentHash;
  }

  let finalContent = "";
  for (const c of allCommits) {
    const file = c.files.find((f) => f.path === filePath);
    if (file) {
      if (file.action === "deleted") {
        finalContent = "";
        break;
      }
      if (file.content !== undefined) finalContent = file.content;
    }
  }

  const lines = finalContent.split("\n");
  const result: { line: number; hash: string; author: string; date: Date }[] = [];

  for (let i = 0; i < lines.length; i++) {
    let blamed = false;
    for (let ci = allCommits.length - 1; ci >= 0; ci--) {
      const c = allCommits[ci];
      const file = c.files.find((f) => f.path === filePath);
      if (file?.content) {
        const fileLines = file.content.split("\n");
        if (i < fileLines.length) {
          result.push({ line: i + 1, hash: c.hash, author: c.author, date: c.date });
          blamed = true;
          break;
        }
      }
    }
    if (!blamed) {
      result.push({ line: i + 1, hash: "—", author: _("غير معروف", "Unknown"), date: new Date() });
    }
  }

  return result;
}

export function stash(repo: AgentRepo): AgentRepo {
  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  if (!currentBranch) return repo;

  const headCommit = repo.commits.get(currentBranch.headHash);
  if (!headCommit) return repo;

  const stashData = {
    branch: repo.HEAD,
    commitHash: currentBranch.headHash,
    files: headCommit.files,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(gitPath(repo.agentId, "stash.json"), JSON.stringify(stashData, null, 2), "utf-8");

  return repo;
}

export function cherryPick(repo: AgentRepo, commitHash: string): AgentRepo {
  const sourceCommit = repo.commits.get(commitHash);
  if (!sourceCommit) {
    throw new Error(
      chalk.hex("#F43F5E")(`  ❌ ${_(`الالتزام "${commitHash.slice(0, 7)}" غير موجود`, `Commit "${commitHash.slice(0, 7)}" not found`)}`)
    );
  }

  commit(repo, `Cherry-pick: ${sourceCommit.message} (${commitHash.slice(0, 7)})`, sourceCommit.files);
  return repo;
}

export function status(repo: AgentRepo): { staged: AgentFileChange[]; modified: AgentFileChange[]; untracked: string[] } {
  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  if (!currentBranch) {
    return { staged: [], modified: [], untracked: [] };
  }

  const headCommit = repo.commits.get(currentBranch.headHash);
  if (!headCommit) {
    return { staged: [], modified: [], untracked: [] };
  }

  return {
    staged: [],
    modified: headCommit.files.filter((f) => f.action !== "deleted"),
    untracked: [],
  };
}

export function saveRepo(repo: AgentRepo): void {
  ensureGitDir(repo.agentId);

  const meta = {
    name: repo.name,
    agentId: repo.agentId,
    HEAD: repo.HEAD,
    branches: repo.branches.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
    tags: repo.tags.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
  };

  writeFileSync(gitPath(repo.agentId, "repo.json"), JSON.stringify(meta, null, 2), "utf-8");
  writeHEAD(repo.agentId, repo.HEAD);

  for (const branch of repo.branches) {
    writeRef(repo.agentId, "heads", branch.name, branch.headHash);
  }

  for (const tag of repo.tags) {
    writeFileSync(gitPath(repo.agentId, "refs", "tags", tag.name), JSON.stringify(tag), "utf-8");
  }

  for (const [, commit] of repo.commits) {
    writeCommitFile(repo.agentId, commit);
  }
}

export function loadRepo(agentId: string): AgentRepo | null {
  const metaPath = gitPath(agentId, "repo.json");
  if (!existsSync(metaPath)) return null;

  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));

  const commits = new Map<string, AgentCommit>();
  const commitsDir = gitPath(agentId, "commits");
  if (existsSync(commitsDir)) {
    const files = readdirSync(commitsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(commitsDir, file), "utf-8"));
      raw.date = new Date(raw.date);
      commits.set(raw.hash, raw as AgentCommit);
    }
  }

  const branches: AgentBranch[] = (meta.branches || []).map((b: any) => ({
    ...b,
    createdAt: new Date(b.createdAt),
  }));

  const tags: AgentTag[] = (meta.tags || []).map((t: any) => ({
    ...t,
    createdAt: new Date(t.createdAt),
  }));

  return {
    name: meta.name,
    agentId: meta.agentId,
    branches,
    tags,
    commits,
    HEAD: meta.HEAD || readHEAD(agentId),
  } as AgentRepo;
}

export function reset(repo: AgentRepo, commitHash: string, mode: "soft" | "hard"): AgentRepo {
  if (!repo.commits.has(commitHash)) {
    throw new Error(
      chalk.hex("#F43F5E")(`  ❌ ${_(`الالتزام "${commitHash.slice(0, 7)}" غير موجود`, `Commit "${commitHash.slice(0, 7)}" not found`)}`)
    );
  }

  const currentBranch = repo.branches.find((b) => b.name === repo.HEAD);
  if (!currentBranch) return repo;

  currentBranch.headHash = commitHash;
  writeRef(repo.agentId, "heads", repo.HEAD, commitHash);

  if (mode === "hard") {
    console.log(
      chalk.hex("#F43F5E")(`  ⚠ ${_("تم إعادة التعيين بشكل كامل", "Hard reset completed")}`)
    );
  }

  return repo;
}

export function bisect(
  repo: AgentRepo,
  start: string,
  end: string
): { good: AgentCommit[]; bad: AgentCommit[] } {
  const commits: AgentCommit[] = [];
  let cur: string | null = end;
  while (cur && cur !== start) {
    const c = repo.commits.get(cur);
    if (!c) break;
    commits.unshift(c);
    cur = c.parentHash;
  }
  if (cur === start) {
    const startCommit = repo.commits.get(start);
    if (startCommit) commits.unshift(startCommit);
  }

  const midpoint = Math.floor(commits.length / 2);
  return {
    good: commits.slice(0, midpoint),
    bad: commits.slice(midpoint),
  };
}
