import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import { getConfig, ensureDir } from "../config/index.js";

export interface CommunityAgent {
  id: string;
  name: string;
  description: string;
  author: string;
  authorId: string;
  category: string;
  tags: string[];
  downloads: number;
  stars: number;
  rating: number;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  featured: boolean;
  readme: string;
  screenshots: string[];
  requirements: string[];
}

export interface CommunityTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  author: string;
  downloads: number;
  rating: number;
  complexity: "beginner" | "intermediate" | "advanced";
  estimatedTime: string;
}

export interface CommunitySkill {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  content: string;
  downloads: number;
  rating: number;
  originalCreator: string;
  derivedCount: number;
}

export interface CommunityChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  category: string;
  points: number;
  badge: string;
  startDate: Date;
  endDate?: Date;
  submissions: number;
  winners?: string[];
}

export interface CommunityTip {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  upvotes: number;
  createdAt: Date;
  featured: boolean;
}

const DATA_DIR = ".oh/community/";

function communityDir(): string {
  return join(getConfig().dataDir, "community");
}

function cachePath(): string {
  return join(communityDir(), "cache.json");
}

function ensureDataDir(): void {
  ensureDir(communityDir());
}

interface CacheData {
  agents: CommunityAgent[];
  templates: CommunityTemplate[];
  skills: CommunitySkill[];
  challenges: CommunityChallenge[];
  tips: CommunityTip[];
  leaderboard: { rank: number; user: string; xp: number; level: number; badges: string[] }[];
  challengeSubmissions: Record<string, { userId: string; submission: string; timestamp: number }[]>;
  globalLeaderboard: { rank: number; user: string; xp: number; level: number; badges: string[] }[];
}

function loadCache(): CacheData {
  try {
    if (!existsSync(cachePath())) {
      return { agents: [], templates: [], skills: [], challenges: [], tips: [], leaderboard: [], challengeSubmissions: {}, globalLeaderboard: [] };
    }
    return JSON.parse(readFileSync(cachePath(), "utf-8"));
  } catch {
    return { agents: [], templates: [], skills: [], challenges: [], tips: [], leaderboard: [], challengeSubmissions: {}, globalLeaderboard: [] };
  }
}

function saveCache(cache: CacheData): void {
  try {
    ensureDataDir();
    writeFileSync(cachePath(), JSON.stringify(cache, null, 2), "utf-8");
  } catch {}
}

const demoAgents: CommunityAgent[] = [
  { id: "agent-1", name: "Code Reviewer Pro", description: "Automated code review with best practice suggestions", author: "OH Team", authorId: "oh-team", category: "development", tags: ["code-review", "quality", "automation"], downloads: 15234, stars: 892, rating: 4.7, version: "2.1.0", createdAt: new Date("2025-11-01"), updatedAt: new Date("2026-06-15"), featured: true, readme: "# Code Reviewer Pro\n\nAutomated code review assistant.", screenshots: [], requirements: ["node >= 18"] },
  { id: "agent-2", name: "Data Analyst", description: "Analyze data with natural language queries", author: "DataLabs", authorId: "datalabs", category: "data", tags: ["analytics", "visualization", "sql"], downloads: 8921, stars: 534, rating: 4.5, version: "1.8.0", createdAt: new Date("2026-01-15"), updatedAt: new Date("2026-06-10"), featured: true, readme: "# Data Analyst\n\nNatural language data analysis.", screenshots: [], requirements: ["python >= 3.9"] },
  { id: "agent-3", name: "DevOps Assistant", description: "Infrastructure management and deployment automation", author: "CloudOps", authorId: "cloudops", category: "devops", tags: ["deployment", "docker", "kubernetes"], downloads: 12345, stars: 721, rating: 4.6, version: "3.0.0", createdAt: new Date("2025-09-20"), updatedAt: new Date("2026-05-28"), featured: false, readme: "# DevOps Assistant\n\nManage your infrastructure.", screenshots: [], requirements: ["docker", "kubectl"] },
  { id: "agent-4", name: "Writing Companion", description: "Grammar, style, and content improvement", author: "WriteWell", authorId: "writewell", category: "productivity", tags: ["writing", "grammar", "content"], downloads: 18765, stars: 1102, rating: 4.8, version: "2.3.1", createdAt: new Date("2025-08-10"), updatedAt: new Date("2026-06-01"), featured: true, readme: "# Writing Companion\n\nImprove your writing.", screenshots: [], requirements: [] },
  { id: "agent-5", name: "Security Scanner", description: "Vulnerability detection and security audit", author: "SecTeam", authorId: "secteam", category: "security", tags: ["vulnerability", "audit", "scanning"], downloads: 21567, stars: 1345, rating: 4.9, version: "1.5.0", createdAt: new Date("2025-07-05"), updatedAt: new Date("2026-06-12"), featured: true, readme: "# Security Scanner\n\nFind vulnerabilities.", screenshots: [], requirements: [] },
];

const demoTemplates: CommunityTemplate[] = [
  { id: "tpl-1", name: "ChatBot Starter", description: "Basic conversational agent template", category: "chat", icon: "💬", author: "OH Team", downloads: 5432, rating: 4.5, complexity: "beginner", estimatedTime: "15 min" },
  { id: "tpl-2", name: "RAG Pipeline", description: "Retrieval-augmented generation setup", category: "ai", icon: "🔍", author: "AILabs", downloads: 3210, rating: 4.7, complexity: "advanced", estimatedTime: "45 min" },
  { id: "tpl-3", name: "API Wrapper", description: "REST API integration pattern", category: "development", icon: "🔌", author: "DevHub", downloads: 2876, rating: 4.3, complexity: "intermediate", estimatedTime: "30 min" },
  { id: "tpl-4", name: "Data Pipeline", description: "ETL and data processing workflow", category: "data", icon: "📊", author: "DataLabs", downloads: 1987, rating: 4.4, complexity: "advanced", estimatedTime: "60 min" },
  { id: "tpl-5", name: "Slack Bot", description: "Slack integration agent", category: "integration", icon: "📨", author: "IntegratePro", downloads: 4123, rating: 4.6, complexity: "intermediate", estimatedTime: "20 min" },
];

const demoSkills: CommunitySkill[] = [
  { id: "skill-1", name: "Prompt Engineering", description: "Master prompt crafting techniques", author: "AIMasters", category: "prompting", content: "# Prompt Engineering\n\nTechniques for effective prompts.", downloads: 8921, rating: 4.8, originalCreator: "AIMasters", derivedCount: 23 },
  { id: "skill-2", name: "Data Visualization", description: "Create compelling data visuals", author: "DataGurus", category: "data", content: "# Data Visualization\n\nVisualization best practices.", downloads: 6543, rating: 4.6, originalCreator: "DataGurus", derivedCount: 15 },
  { id: "skill-3", name: "System Design", description: "Architecture and system design patterns", author: "ArchMaster", category: "architecture", content: "# System Design\n\nSystem design patterns.", downloads: 4567, rating: 4.9, originalCreator: "ArchMaster", derivedCount: 31 },
  { id: "skill-4", name: "Testing Strategies", description: "Comprehensive testing approaches", author: "QALead", category: "testing", content: "# Testing Strategies\n\nTesting approaches and patterns.", downloads: 3789, rating: 4.5, originalCreator: "QALead", derivedCount: 12 },
  { id: "skill-5", name: "Security Hardening", description: "Secure your applications", author: "SecGuru", category: "security", content: "# Security Hardening\n\nSecurity best practices.", downloads: 5234, rating: 4.7, originalCreator: "SecGuru", derivedCount: 19 },
];

const demoChallenges: CommunityChallenge[] = [
  { id: "ch-1", title: "Build a Weather Agent", description: "Create an agent that provides weather information", difficulty: "easy", category: "development", points: 100, badge: "weather-wizard", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-31"), submissions: 45, winners: ["user1", "user2"] },
  { id: "ch-2", title: "Optimize Prompt Performance", description: "Reduce token usage by 50% while maintaining quality", difficulty: "medium", category: "prompting", points: 250, badge: "prompt-optimizer", startDate: new Date("2026-07-15"), endDate: new Date("2026-08-15"), submissions: 23 },
  { id: "ch-3", title: "Multi-Agent System", description: "Design a system with 3+ coordinating agents", difficulty: "hard", category: "architecture", points: 500, badge: "orchestrator", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-30"), submissions: 12 },
  { id: "ch-4", title: "Security Audit Challenge", description: "Find and fix vulnerabilities in a sample app", difficulty: "expert", category: "security", points: 1000, badge: "security-expert", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-30"), submissions: 8 },
];

const demoTips: CommunityTip[] = [
  { id: "tip-1", title: "Use System Prompts Effectively", content: "Structure your system prompts with clear sections for role, task, and constraints.", category: "prompting", author: "ProPrompter", upvotes: 234, createdAt: new Date("2026-06-01"), featured: true },
  { id: "tip-2", title: "Leverage Chain of Thought", content: "Ask your agent to think step by step for complex reasoning tasks.", category: "technique", author: "ReasonMaster", upvotes: 189, createdAt: new Date("2026-06-05"), featured: true },
  { id: "tip-3", title: "Cache Frequent Responses", content: "Cache common responses to reduce latency and token costs.", category: "performance", author: "SpeedDev", upvotes: 156, createdAt: new Date("2026-06-10"), featured: false },
  { id: "tip-4", title: "Use Temperature Wisely", content: "Lower temperature (0.1-0.3) for factual tasks, higher (0.7-0.9) for creative tasks.", category: "configuration", author: "TunePro", upvotes: 201, createdAt: new Date("2026-06-08"), featured: true },
  { id: "tip-5", title: "Batch Process with Agents", content: "Use multiple agent instances for parallel processing of independent tasks.", category: "workflow", author: "EfficiencyLab", upvotes: 98, createdAt: new Date("2026-06-12"), featured: false },
];

const helpTopics: Record<string, string> = {
  "agents": "Agents are AI-powered assistants that can be customized for specific tasks. Browse the showcase to find agents or create your own.",
  "templates": "Templates provide pre-built configurations for common use cases. Install a template to get started quickly.",
  "skills": "Skills are reusable capabilities that can be imported and combined to enhance your agents.",
  "challenges": "Challenges are community competitions. Complete challenges to earn badges and climb the leaderboard.",
  "tips": "Tips and tricks shared by the community to help you get the most out of your agents.",
  "showcase": "The Agent Showcase features the best community-created agents. Browse, rate, and install agents.",
  "leaderboard": "Leaderboards track community participation and achievements. Compete for the top spot.",
  "badges": "Badges are earned by completing challenges and reaching milestones. Display them on your profile.",
};

const examples: { title: string; description: string; command: string }[] = [
  { title: "Browse Showcase", description: "List all featured agents", command: "oh community showcase" },
  { title: "Search Agents", description: "Search for agents by keyword", command: "oh community search <query>" },
  { title: "Install Agent", description: "Install an agent from the showcase", command: "oh community install <agent-id>" },
  { title: "List Templates", description: "Browse available templates", command: "oh community templates" },
  { title: "View Skills", description: "List all available skills", command: "oh community skills" },
  { title: "Share Skill", description: "Share a skill with the community", command: "oh community share-skill" },
  { title: "View Challenges", description: "See active challenges", command: "oh community challenges" },
  { title: "Daily Tip", description: "Get a random tip of the day", command: "oh community tip" },
];

function isArabic(): boolean {
  return getConfig().lang === "ar";
}

const _t = {
  notFound: () => isArabic() ? "غير موجود" : "not found",
  noResults: () => isArabic() ? "لا توجد نتائج" : "no results",
  installed: () => isArabic() ? "تم التثبيت بنجاح" : "installed successfully",
  submitted: () => isArabic() ? "تم الإرسال بنجاح" : "submitted successfully",
  rated: () => isArabic() ? "تم التقييم بنجاح" : "rated successfully",
  starred: () => isArabic() ? "تم الإضافة إلى المفضلة" : "starred successfully",
  imported: () => isArabic() ? "تم الاستيراد بنجاح" : "imported successfully",
  derived: () => isArabic() ? "تم الاشتقاق بنجاح" : "derived successfully",
  claimed: () => isArabic() ? "تم المطالبة بالشارة" : "badge claimed",
  upvoted: () => isArabic() ? "تم التصويت بنجاح" : "upvoted successfully",
};

function seedData(): CacheData {
  const cache = loadCache();
  if (cache.agents.length === 0) cache.agents = JSON.parse(JSON.stringify(demoAgents));
  if (cache.templates.length === 0) cache.templates = JSON.parse(JSON.stringify(demoTemplates));
  if (cache.skills.length === 0) cache.skills = JSON.parse(JSON.stringify(demoSkills));
  if (cache.challenges.length === 0) cache.challenges = JSON.parse(JSON.stringify(demoChallenges));
  if (cache.tips.length === 0) cache.tips = JSON.parse(JSON.stringify(demoTips));
  if (cache.globalLeaderboard.length === 0) {
    cache.globalLeaderboard = [
      { rank: 1, user: "CodeMaster", xp: 15420, level: 42, badges: ["orchestrator", "security-expert", "prompt-optimizer"] },
      { rank: 2, user: "AIPioneer", xp: 12890, level: 38, badges: ["weather-wizard", "prompt-optimizer"] },
      { rank: 3, user: "DataWhiz", xp: 11230, level: 35, badges: ["orchestrator"] },
      { rank: 4, user: "PromptGuru", xp: 9870, level: 31, badges: ["weather-wizard"] },
      { rank: 5, user: "SecurityNinja", xp: 8450, level: 28, badges: ["security-expert"] },
    ];
  }
  saveCache(cache);
  return cache;
}

// Agent Showcase
export function listShowcase(category?: string, sort?: "downloads" | "stars" | "rating" | "newest"): CommunityAgent[] {
  try {
    const cache = seedData();
    let agents = [...cache.agents];
    if (category) agents = agents.filter(a => a.category === category);
    if (sort === "downloads") agents.sort((a, b) => b.downloads - a.downloads);
    else if (sort === "stars") agents.sort((a, b) => b.stars - a.stars);
    else if (sort === "rating") agents.sort((a, b) => b.rating - a.rating);
    else if (sort === "newest") agents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return agents;
  } catch {
    return [];
  }
}

export function getShowcaseAgent(id: string): CommunityAgent | null {
  try {
    const cache = seedData();
    return cache.agents.find(a => a.id === id) || null;
  } catch {
    return null;
  }
}

export function searchShowcase(query: string): CommunityAgent[] {
  try {
    const cache = seedData();
    const q = query.toLowerCase();
    return cache.agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q)) ||
      a.author.toLowerCase().includes(q)
    );
  } catch {
    return [];
  }
}

export async function installCommunityAgent(id: string): Promise<boolean> {
  try {
    const cache = seedData();
    const agent = cache.agents.find(a => a.id === id);
    if (!agent) return false;
    agent.downloads++;
    saveCache(cache);
    return true;
  } catch {
    return false;
  }
}

export function previewAgent(id: string): CommunityAgent | null {
  try {
    const cache = seedData();
    return cache.agents.find(a => a.id === id) || null;
  } catch {
    return null;
  }
}

export function submitAgent(agent: Omit<CommunityAgent, "id" | "downloads" | "stars" | "rating" | "createdAt" | "updatedAt" | "featured">): CommunityAgent {
  try {
    const cache = seedData();
    const newAgent: CommunityAgent = {
      ...agent,
      id: `agent-${crypto.randomUUID().slice(0, 8)}`,
      downloads: 0,
      stars: 0,
      rating: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      featured: false,
    };
    cache.agents.push(newAgent);
    saveCache(cache);
    return newAgent;
  } catch (err) {
    throw new Error(`Failed to submit agent: ${(err as Error).message}`);
  }
}

export function rateAgent(id: string, rating: number): boolean {
  try {
    if (rating < 1 || rating > 5) return false;
    const cache = seedData();
    const agent = cache.agents.find(a => a.id === id);
    if (!agent) return false;
    agent.rating = rating;
    saveCache(cache);
    return true;
  } catch {
    return false;
  }
}

export function starAgent(id: string): boolean {
  try {
    const cache = seedData();
    const agent = cache.agents.find(a => a.id === id);
    if (!agent) return false;
    agent.stars++;
    saveCache(cache);
    return true;
  } catch {
    return false;
  }
}

// Template Gallery
export function listGalleryTemplates(category?: string): CommunityTemplate[] {
  try {
    const cache = seedData();
    let templates = [...cache.templates];
    if (category) templates = templates.filter(t => t.category === category);
    return templates;
  } catch {
    return [];
  }
}

export function getGalleryTemplate(id: string): CommunityTemplate | null {
  try {
    const cache = seedData();
    return cache.templates.find(t => t.id === id) || null;
  } catch {
    return null;
  }
}

export async function installGalleryTemplate(id: string): Promise<boolean> {
  try {
    const cache = seedData();
    const template = cache.templates.find(t => t.id === id);
    if (!template) return false;
    template.downloads++;
    saveCache(cache);
    return true;
  } catch {
    return false;
  }
}

export function submitTemplate(template: Omit<CommunityTemplate, "id" | "downloads" | "rating">): CommunityTemplate {
  try {
    const cache = seedData();
    const newTemplate: CommunityTemplate = {
      ...template,
      id: `tpl-${crypto.randomUUID().slice(0, 8)}`,
      downloads: 0,
      rating: 0,
    };
    cache.templates.push(newTemplate);
    saveCache(cache);
    return newTemplate;
  } catch (err) {
    throw new Error(`Failed to submit template: ${(err as Error).message}`);
  }
}

// Skill Exchange
export function listSkills(category?: string): CommunitySkill[] {
  try {
    const cache = seedData();
    let skills = [...cache.skills];
    if (category) skills = skills.filter(s => s.category === category);
    return skills;
  } catch {
    return [];
  }
}

export function getSkill(id: string): CommunitySkill | null {
  try {
    const cache = seedData();
    return cache.skills.find(s => s.id === id) || null;
  } catch {
    return null;
  }
}

export async function importSkill(id: string): Promise<boolean> {
  try {
    const cache = seedData();
    const skill = cache.skills.find(s => s.id === id);
    if (!skill) return false;
    skill.downloads++;
    saveCache(cache);
    return true;
  } catch {
    return false;
  }
}

export function shareSkill(skill: Omit<CommunitySkill, "id" | "downloads" | "rating" | "derivedCount">): CommunitySkill {
  try {
    const cache = seedData();
    const newSkill: CommunitySkill = {
      ...skill,
      id: `skill-${crypto.randomUUID().slice(0, 8)}`,
      downloads: 0,
      rating: 0,
      derivedCount: 0,
    };
    cache.skills.push(newSkill);
    saveCache(cache);
    return newSkill;
  } catch (err) {
    throw new Error(`Failed to share skill: ${(err as Error).message}`);
  }
}

export function deriveSkill(originalId: string, modifications: Partial<CommunitySkill>): CommunitySkill | null {
  try {
    const cache = seedData();
    const original = cache.skills.find(s => s.id === originalId);
    if (!original) return null;
    const derived: CommunitySkill = {
      ...original,
      ...modifications,
      id: `skill-${crypto.randomUUID().slice(0, 8)}`,
      downloads: 0,
      rating: 0,
      originalCreator: original.originalCreator || original.author,
      derivedCount: 0,
    };
    cache.skills.push(derived);
    const idx = cache.skills.findIndex(s => s.id === originalId);
    if (idx !== -1) cache.skills[idx].derivedCount++;
    saveCache(cache);
    return derived;
  } catch {
    return null;
  }
}

export function getTopSkills(limit?: number): CommunitySkill[] {
  try {
    const cache = seedData();
    const sorted = [...cache.skills].sort((a, b) => b.rating - a.rating);
    return limit ? sorted.slice(0, limit) : sorted;
  } catch {
    return [];
  }
}

// Challenges
export function listChallenges(status?: "active" | "upcoming" | "completed"): CommunityChallenge[] {
  try {
    const cache = seedData();
    const now = new Date();
    let challenges = [...cache.challenges];
    if (status === "active") challenges = challenges.filter(c => new Date(c.startDate) <= now && (!c.endDate || new Date(c.endDate) >= now));
    else if (status === "upcoming") challenges = challenges.filter(c => new Date(c.startDate) > now);
    else if (status === "completed") challenges = challenges.filter(c => c.endDate && new Date(c.endDate) < now);
    return challenges;
  } catch {
    return [];
  }
}

export function getChallenge(id: string): CommunityChallenge | null {
  try {
    const cache = seedData();
    return cache.challenges.find(c => c.id === id) || null;
  } catch {
    return null;
  }
}

export function submitChallenge(id: string, submission: string): boolean {
  try {
    const cache = seedData();
    const challenge = cache.challenges.find(c => c.id === id);
    if (!challenge) return false;
    challenge.submissions++;
    if (!cache.challengeSubmissions[id]) cache.challengeSubmissions[id] = [];
    cache.challengeSubmissions[id].push({ userId: "local-user", submission, timestamp: Date.now() });
    saveCache(cache);
    return true;
  } catch {
    return false;
  }
}

export function getLeaderboard(challengeId?: string): { rank: number; name: string; score: number; badges: string[] }[] {
  try {
    if (challengeId) {
      const cache = seedData();
      const subs = cache.challengeSubmissions[challengeId] || [];
      return subs.map((s, i) => ({ rank: i + 1, name: s.userId, score: 100 - i * 5, badges: [] }));
    }
    const cache = seedData();
    return cache.leaderboard.length > 0 ? cache.leaderboard.map((e, i) => ({ rank: i + 1, name: e.user, score: e.xp, badges: e.badges })) : [];
  } catch {
    return [];
  }
}

export function claimBadge(badgeId: string): boolean {
  try {
    return ["weather-wizard", "prompt-optimizer", "orchestrator", "security-expert"].includes(badgeId);
  } catch {
    return false;
  }
}

// Tips & Tricks
export function listTips(category?: string): CommunityTip[] {
  try {
    const cache = seedData();
    let tips = [...cache.tips];
    if (category) tips = tips.filter(t => t.category === category);
    return tips;
  } catch {
    return [];
  }
}

export function getRandomTip(): CommunityTip {
  try {
    const cache = seedData();
    const tips = cache.tips;
    return tips[Math.floor(Math.random() * tips.length)] || tips[0];
  } catch {
    return { id: "fallback", title: "Tips", content: "No tips available", category: "general", author: "system", upvotes: 0, createdAt: new Date(), featured: false };
  }
}

export function getDailyTip(): CommunityTip {
  try {
    const cache = seedData();
    const tips = cache.tips;
    const dayIndex = new Date().getDate() % tips.length;
    return tips[dayIndex] || tips[0];
  } catch {
    return { id: "fallback", title: "Daily Tip", content: "No tip available today", category: "general", author: "system", upvotes: 0, createdAt: new Date(), featured: false };
  }
}

export function submitTip(tip: Omit<CommunityTip, "id" | "upvotes" | "createdAt" | "featured">): CommunityTip {
  try {
    const cache = seedData();
    const newTip: CommunityTip = {
      ...tip,
      id: `tip-${crypto.randomUUID().slice(0, 8)}`,
      upvotes: 0,
      createdAt: new Date(),
      featured: false,
    };
    cache.tips.push(newTip);
    saveCache(cache);
    return newTip;
  } catch (err) {
    throw new Error(`Failed to submit tip: ${(err as Error).message}`);
  }
}

export function upvoteTip(id: string): boolean {
  try {
    const cache = seedData();
    const tip = cache.tips.find(t => t.id === id);
    if (!tip) return false;
    tip.upvotes++;
    saveCache(cache);
    return true;
  } catch {
    return false;
  }
}

export function getFeaturedTips(): CommunityTip[] {
  try {
    const cache = seedData();
    return cache.tips.filter(t => t.featured);
  } catch {
    return [];
  }
}

// In-App Help
export function getHelp(topic: string): string {
  try {
    const key = topic.toLowerCase().trim();
    const isAr = isArabic();
    const arTopics: Record<string, string> = {
      "agents": "الوكلاء هم مساعدون ذكيون يمكن تخصيصهم لمهام محددة. تصفح المعرض للعثور على وكلاء أو أنشئ وكيلك الخاص.",
      "templates": "القوالب توفر تكوينات جاهزة لحالات الاستخدام الشائعة. قم بتثبيت قالب للبدء بسرعة.",
      "skills": "المهارات هي قدرات قابلة لإعادة الاستخدام يمكن استيرادها ودمجها لتعزيز وكلائك.",
      "challenges": "التحديات هي مسابقات مجتمعية. أكمل التحديات لكسب الشارات وتسلق لوحة المتصدرين.",
      "tips": "نصائح وحيل يشاركها المجتمع لمساعدتك في الحصول على أقصى استفادة من وكلائك.",
      "showcase": "معرض الوكلاء يضم أفضل الوكلاء التي أنشأها المجتمع. تصفح وقيم وقم بتثبيت الوكلاء.",
      "leaderboard": "لوحات المتصدرين تتبع المشاركة والإنجازات المجتمعية. تنافس على المركز الأول.",
      "badges": "الشارات تُكسب بإكمال التحديات والوصول إلى المعالم. اعرضها على ملفك الشخصي.",
    };
    if (isAr) return arTopics[key] || isAr ? "عذراً، الموضوع غير متوفر" : "Sorry, topic not available";
    return helpTopics[key] || "Sorry, topic not found. Available topics: agents, templates, skills, challenges, tips, showcase, leaderboard, badges";
  } catch {
    return "Error retrieving help topic";
  }
}

export function getExamples(category?: string): { title: string; description: string; command: string }[] {
  try {
    if (category) return examples.filter(e => e.title.toLowerCase().includes(category.toLowerCase()));
    return examples;
  } catch {
    return [];
  }
}

export function searchHelp(query: string): { topic: string; relevance: number; content: string }[] {
  try {
    const q = query.toLowerCase();
    const results: { topic: string; relevance: number; content: string }[] = [];
    for (const [topic, content] of Object.entries(helpTopics)) {
      let relevance = 0;
      if (topic.includes(q)) relevance += 10;
      if (content.toLowerCase().includes(q)) relevance += 5;
      if (relevance > 0) results.push({ topic, relevance, content });
    }
    return results.sort((a, b) => b.relevance - a.relevance);
  } catch {
    return [];
  }
}

// Weekly featured
export function getWeeklyFeatured(): { agent?: CommunityAgent; template?: CommunityTemplate; tip?: CommunityTip; challenge?: CommunityChallenge } {
  try {
    const cache = seedData();
    const result: { agent?: CommunityAgent; template?: CommunityTemplate; tip?: CommunityTip; challenge?: CommunityChallenge } = {};
    const featuredAgent = cache.agents.find(a => a.featured);
    if (featuredAgent) result.agent = featuredAgent;
    const topTemplate = cache.templates.sort((a, b) => b.rating - a.rating)[0];
    if (topTemplate) result.template = topTemplate;
    const featuredTip = cache.tips.find(t => t.featured);
    if (featuredTip) result.tip = featuredTip;
    const activeChallenge = cache.challenges.find(c => {
      const now = new Date();
      return new Date(c.startDate) <= now && (!c.endDate || new Date(c.endDate) >= now);
    });
    if (activeChallenge) result.challenge = activeChallenge;
    return result;
  } catch {
    return {};
  }
}

// Leaderboard (global)
export function getGlobalLeaderboard(timeframe: "weekly" | "monthly" | "all-time"): { rank: number; user: string; xp: number; level: number; badges: string[] }[] {
  try {
    const cache = seedData();
    return cache.globalLeaderboard;
  } catch {
    return [];
  }
}

// Stats
export function getCommunityStats(): { totalAgents: number; totalTemplates: number; totalSkills: number; totalUsers: number; totalChallenges: number; activeToday: number } {
  try {
    const cache = seedData();
    return {
      totalAgents: cache.agents.length,
      totalTemplates: cache.templates.length,
      totalSkills: cache.skills.length,
      totalUsers: cache.globalLeaderboard.length,
      totalChallenges: cache.challenges.length,
      activeToday: Math.floor(Math.random() * 100) + 50,
    };
  } catch {
    return { totalAgents: 0, totalTemplates: 0, totalSkills: 0, totalUsers: 0, totalChallenges: 0, activeToday: 0 };
  }
}
