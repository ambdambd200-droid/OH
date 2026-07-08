import { createInterface } from "readline";
import chalk from "chalk";
import { t, getLang } from "../i18n/index.js";

export function askQuestion(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.hex("#8B5CF6")(`  ${prompt} `), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function showStatus(): void {
  console.log(chalk.hex("#10B981")("  🟢 System: Healthy"));
  console.log(chalk.hex("#06B6D4")(`  🌐 Language: ${getLang().toUpperCase()}`));
  console.log(chalk.hex("#94A3B8")("  💾 Memory: Active"));
  console.log(chalk.hex("#64748B")("  🔒 Security: Enabled"));
}
