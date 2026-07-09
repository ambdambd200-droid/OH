import figlet from "figlet";
import chalk from "chalk";
import gradient from "gradient-string";
import { t, getLang } from "../i18n/index.js";

const ohGradient = gradient(["#8B5CF6", "#06B6D4"]);

export function showBanner(): void {
  const text = figlet.textSync("OH", {
    font: "Big",
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  console.log("\n" + ohGradient(text));
  console.log(chalk.hex("#A78BFA")(`  ${t().tagline}`));
  console.log(chalk.hex("#64748B")(`  v2.0.0 — ${getLang() === "ar" ? "المنصة الذكية بدون كود" : "The No-Code AI Platform"}`));
  console.log();
}
