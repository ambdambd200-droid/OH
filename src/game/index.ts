import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getConfig, ensureDir } from "../config/index.js";

export interface UserProfile {
  xp: number;
  level: number;
  streak: number;
  lastActive: string;
  commandsRun: number;
  agentsCreated: number;
  messagesSent: number;
  achievements: string[];
  badges: string[];
}

const PROFILE_FILE = "profile.json";

const XP_PER_LEVEL = 100;

const ACHIEVEMENTS: Record<string, { name: string; desc: string; icon: string }> = {
  first_command: { name: "First Steps", desc: "Run your first command", icon: "🚀" },
  chatty: { name: "Chatty", desc: "Send 10 messages", icon: "💬" },
  power_user: { name: "Power User", desc: "Run 50 commands", icon: "⚡" },
  agent_creator: { name: "Agent Creator", desc: "Create 3 agents", icon: "🤖" },
  streak_3: { name: "On Fire", desc: "3-day streak", icon: "🔥" },
  streak_7: { name: "Week Warrior", desc: "7-day streak", icon: "📅" },
  level_5: { name: "Apprentice", desc: "Reach level 5", icon: "🟢" },
  level_10: { name: "Expert", desc: "Reach level 10", icon: "🔵" },
  level_25: { name: "Master", desc: "Reach level 25", icon: "🟣" },
  centurion: { name: "Centurion", desc: "Earn 1000 XP", icon: "💎" },
};

const BADGES: Record<string, { name: string; icon: string }> = {
  early_adopter: { name: "Early Adopter", icon: "🥇" },
  arabic_speaker: { name: "Arabic Speaker", icon: "🕌" },
  template_master: { name: "Template Master", icon: "📋" },
};

function getProfilePath(): string {
  const dataDir = getConfig().dataDir;
  ensureDir(dataDir);
  return join(dataDir, PROFILE_FILE);
}

function defaultProfile(): UserProfile {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastActive: new Date().toISOString(),
    commandsRun: 0,
    agentsCreated: 0,
    messagesSent: 0,
    achievements: [],
    badges: [],
  };
}

function readProfile(): UserProfile {
  const path = getProfilePath();
  if (!existsSync(path)) return defaultProfile();
  return { ...defaultProfile(), ...JSON.parse(readFileSync(path, "utf-8")) };
}

function writeProfile(profile: UserProfile): void {
  writeFileSync(getProfilePath(), JSON.stringify(profile, null, 2), "utf-8");
}

function checkAchievements(profile: UserProfile): string[] {
  const unlocked: string[] = [];

  if (profile.commandsRun >= 1 && !profile.achievements.includes("first_command")) unlocked.push("first_command");
  if (profile.messagesSent >= 10 && !profile.achievements.includes("chatty")) unlocked.push("chatty");
  if (profile.commandsRun >= 50 && !profile.achievements.includes("power_user")) unlocked.push("power_user");
  if (profile.agentsCreated >= 3 && !profile.achievements.includes("agent_creator")) unlocked.push("agent_creator");
  if (profile.streak >= 3 && !profile.achievements.includes("streak_3")) unlocked.push("streak_3");
  if (profile.streak >= 7 && !profile.achievements.includes("streak_7")) unlocked.push("streak_7");
  if (profile.level >= 5 && !profile.achievements.includes("level_5")) unlocked.push("level_5");
  if (profile.level >= 10 && !profile.achievements.includes("level_10")) unlocked.push("level_10");
  if (profile.level >= 25 && !profile.achievements.includes("level_25")) unlocked.push("level_25");
  if (profile.xp >= 1000 && !profile.achievements.includes("centurion")) unlocked.push("centurion");

  for (const id of unlocked) {
    profile.achievements.push(id);
    const a = ACHIEVEMENTS[id];
    console.log(chalk.hex("#FBBF24")(`  🏆 Achievement unlocked: ${a.icon} ${a.name} — ${a.desc}`));
  }

  return unlocked;
}

export function getProfile(): UserProfile {
  return readProfile();
}

export function addXP(amount: number): { xp: number; level: number; leveledUp: boolean } {
  const profile = readProfile();
  const oldLevel = profile.level;
  profile.xp += amount;
  profile.level = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  const leveledUp = profile.level > oldLevel;
  if (leveledUp) {
    console.log(chalk.hex("#8B5CF6")(`  ⬆ Level up! You are now level ${profile.level}`));
  }
  checkAchievements(profile);
  writeProfile(profile);
  return { xp: profile.xp, level: profile.level, leveledUp };
}

export function addCommand(): void {
  const profile = readProfile();
  profile.commandsRun++;
  writeProfile(profile);
  addXP(10);
}

export function addAgentCreated(): void {
  const profile = readProfile();
  profile.agentsCreated++;
  writeProfile(profile);
  addXP(25);
}

export function addMessage(): void {
  const profile = readProfile();
  profile.messagesSent++;
  writeProfile(profile);
  addXP(5);
}

export function getLevel(): number {
  return readProfile().level;
}

export function getStreak(): number {
  return readProfile().streak;
}

export function checkDailyStreak(): void {
  const profile = readProfile();
  const now = new Date();
  const last = new Date(profile.lastActive);
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return;
  if (diffDays === 1) {
    profile.streak++;
    console.log(chalk.hex("#FBBF24")(`  🔥 ${profile.streak}-day streak!`));
  } else {
    profile.streak = 1;
  }
  profile.lastActive = now.toISOString();
  checkAchievements(profile);
  writeProfile(profile);
}

export function getAchievements(): string[] {
  return readProfile().achievements;
}

export function getLeaderboard(): UserProfile[] {
  return [readProfile()];
}

export function showProfile(): void {
  const p = readProfile();
  const progress = p.xp % XP_PER_LEVEL;
  const barLen = 20;
  const filled = Math.round((progress / XP_PER_LEVEL) * barLen);
  const bar = chalk.hex("#8B5CF6")("█".repeat(filled)) + chalk.hex("#334155")("█".repeat(barLen - filled));

  console.log(chalk.hex("#8B5CF6").bold("\n  ╔══════════════════════════════╗"));
  console.log(chalk.hex("#8B5CF6").bold("  ║        YOUR PROFILE          ║"));
  console.log(chalk.hex("#8B5CF6").bold("  ╚══════════════════════════════╝\n"));

  console.log(`  ${chalk.hex("#F8FAFC").bold(`Level ${p.level}`)}   ${chalk.hex("#94A3B8")(`${p.xp} XP`)}`);
  console.log(`  ${bar} ${chalk.hex("#64748B")(`${progress}/${XP_PER_LEVEL}`)}`);
  console.log();
  console.log(`  ${chalk.hex("#94A3B8")("🔥 Streak:")}    ${chalk.hex("#F8FAFC")(`${p.streak} days`)}`);
  console.log(`  ${chalk.hex("#94A3B8")("⚡ Commands:")}  ${chalk.hex("#F8FAFC")(`${p.commandsRun}`)}`);
  console.log(`  ${chalk.hex("#94A3B8")("🤖 Agents:")}    ${chalk.hex("#F8FAFC")(`${p.agentsCreated}`)}`);
  console.log(`  ${chalk.hex("#94A3B8")("💬 Messages:")}  ${chalk.hex("#F8FAFC")(`${p.messagesSent}`)}`);
  console.log();

  if (p.achievements.length > 0) {
    console.log(chalk.hex("#FBBF24").bold("  Achievements:\n"));
    for (const id of p.achievements) {
      const a = ACHIEVEMENTS[id];
      if (a) console.log(`  ${a.icon} ${chalk.hex("#F8FAFC")(a.name)} — ${chalk.hex("#64748B")(a.desc)}`);
    }
    console.log();
  }

  if (p.badges.length > 0) {
    console.log(chalk.hex("#06B6D4").bold("  Badges:\n"));
    for (const id of p.badges) {
      const b = BADGES[id];
      if (b) console.log(`  ${b.icon} ${chalk.hex("#F8FAFC")(b.name)}`);
    }
    console.log();
  }
}

export function showLeaderboard(): void {
  const p = readProfile();
  console.log(chalk.hex("#8B5CF6").bold("\n  Leaderboard\n"));
  console.log(`  ${chalk.hex("#FBBF24")("🥇")} ${chalk.hex("#F8FAFC").bold("You")}  —  ${chalk.hex("#94A3B8")(`Level ${p.level}, ${p.xp} XP`)}`);
  console.log();
}
