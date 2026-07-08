import { isSafeCommand } from "../security/index.js";

type ToolHandler = (args: string[]) => Promise<string>;

interface Tool {
  name: string;
  description: string;
  handler: ToolHandler;
}

const tools = new Map<string, Tool>();

export function registerTool(name: string, description: string, handler: ToolHandler): void {
  tools.set(name, { name, description, handler });
}

export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}

export function listTools(): Tool[] {
  return Array.from(tools.values());
}

registerTool("echo", "Echo input back", async (args) => args.join(" "));
registerTool("help", "List available tools", async () => {
  return listTools().map((t) => `${t.name}: ${t.description}`).join("\n");
});

export async function executeTool(name: string, args: string[]): Promise<string> {
  const tool = getTool(name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  const check = isSafeCommand(name + " " + args.join(" "));
  if (!check.safe) throw new Error(check.reason);
  return tool.handler(args);
}
