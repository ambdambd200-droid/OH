import { createInterface } from "readline";
import chalk from "chalk";
import { t, getLang } from "../i18n/index.js";
import { getConfig } from "../config/index.js";
import { getModelById } from "../proxy/index.js";

export function askQuestion(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.hex("#8B5CF6")(`${prompt} `), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function showStatus(): void {
  const modelId = getConfig().model;
  const model = getModelById(modelId);
  console.log(`  ${chalk.hex("#10B981")("●")} ${chalk.hex("#94A3B8")("System")}    ${chalk.hex("#F8FAFC")("Healthy")}`);
  console.log(`  ${chalk.hex("#06B6D4")("●")} ${chalk.hex("#94A3B8")("Language")}  ${chalk.hex("#F8FAFC")(getLang().toUpperCase())}`);
  console.log(`  ${chalk.hex("#8B5CF6")("●")} ${chalk.hex("#94A3B8")("Model")}     ${chalk.hex("#F8FAFC")(model?.name || modelId)}`);
  console.log(`  ${chalk.hex("#64748B")("●")} ${chalk.hex("#94A3B8")("Memory")}   ${chalk.hex("#F8FAFC")("Active")}`);
  console.log(`  ${chalk.hex("#64748B")("●")} ${chalk.hex("#94A3B8")("Security")} ${chalk.hex("#F8FAFC")("Enabled")}`);
  console.log();
}
