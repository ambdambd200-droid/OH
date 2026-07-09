import chalk from "chalk";
import { t, getLang } from "../i18n/index.js";

export function showBanner(): void {
  const lang = getLang();
  console.log();
  console.log(`${chalk.hex("#8B5CF6").bold("OH")} ${chalk.hex("#64748B")("v2.0")} ${chalk.hex("#4B5563")("—")} ${chalk.hex("#94A3B8")(lang === "ar" ? "المنصة الذكية بدون كود" : "The No-Code AI Agent Platform")}`);
  console.log(chalk.hex("#4B5563")(`${"─".repeat(50)}`));
  console.log();
}
