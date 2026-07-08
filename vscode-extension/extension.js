const vscode = require("vscode");
const { exec } = require("child_process");
const path = require("path");

const OH_PROJECT = path.join(__dirname, "..");
const OH_CMD = process.platform === "win32"
  ? `cmd /c "cd /d "${OH_PROJECT}" && npm run dev --`
  : `cd "${OH_PROJECT}" && npm run dev --`;

let outputChannel;

function activate(context) {
  outputChannel = vscode.window.createOutputChannel("OH");
  outputChannel.appendLine("OH extension activated");

  context.subscriptions.push(
    vscode.commands.registerCommand("oh.chat", ohChat),
    vscode.commands.registerCommand("oh.models", ohModels),
    vscode.commands.registerCommand("oh.model", ohModel),
    vscode.commands.registerCommand("oh.createAgent", ohCreateAgent)
  );
}

function runOH(args) {
  return new Promise((resolve, reject) => {
    const cmd = `${OH_CMD} ${args})`;
    outputChannel.appendLine(`$ ${cmd}`);
    exec(cmd, { cwd: OH_PROJECT, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && err.code !== 0 && !stdout) return reject(err);
      const out = stripAnsi(stdout || "");
      const errOut = stripAnsi(stderr || "");
      if (errOut.trim()) outputChannel.appendLine(`stderr: ${errOut}`);
      resolve(out.trim() || errOut.trim());
    });
  });
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1B\][0-9;]*[^\x1B]*(\x1B\\)?/g, "");
}

async function ohChat() {
  const message = await vscode.window.showInputBox({
    prompt: "Enter your message for OH",
    placeHolder: "Type your message...",
    ignoreFocusOut: true,
  });
  if (!message) return;

  outputChannel.appendLine(`Chat: ${message}`);

  const doc = await vscode.workspace.openTextDocument({
    content: `# OH Chat Response\n\n---\n\n**You:** ${message}\n\n`,
    language: "markdown",
  });
  const editor = await vscode.window.showTextDocument(doc);

  try {
    const result = await runOH(`chat "${message.replace(/"/g, '\\"')}"`);
    const full = editor.document.getText() + `${result}\n\n---\n`;
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(editor.document.getText().length)
    );
    edit.replace(doc.uri, fullRange, full);
    await vscode.workspace.applyEdit(edit);
  } catch (err) {
    vscode.window.showErrorMessage(`OH chat failed: ${err.message}`);
  }
}

async function ohModels() {
  const doc = await vscode.workspace.openTextDocument({
    content: "# OH Models\n\nLoading...\n",
    language: "markdown",
  });
  const editor = await vscode.window.showTextDocument(doc);

  try {
    const result = await runOH("models all");
    const full = `# OH Models\n\n\`\`\`\n${result}\n\`\`\`\n`;
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(editor.document.getText().length)
    );
    edit.replace(doc.uri, fullRange, full);
    await vscode.workspace.applyEdit(edit);
  } catch (err) {
    vscode.window.showErrorMessage(`OH models failed: ${err.message}`);
  }
}

async function ohModel() {
  try {
    const result = await runOH("models all");
    const lines = result.split("\n").filter(l => l.includes("○") || l.includes("◉"));
    const modelIds = lines
      .map(l => l.replace(/.*ID:\s*(\S+).*/, "$1").trim())
      .filter(id => id && id.length > 3);

    if (modelIds.length === 0) {
      vscode.window.showErrorMessage("No models found");
      return;
    }

    const selected = await vscode.window.showQuickPick(modelIds, {
      placeHolder: "Select a model to switch to",
      ignoreFocusOut: true,
    });
    if (!selected) return;

    await runOH(`model ${selected}`);
    vscode.window.showInformationMessage(`Switched to model: ${selected}`);
  } catch (err) {
    vscode.window.showErrorMessage(`OH model switch failed: ${err.message}`);
  }
}

async function ohCreateAgent() {
  const name = await vscode.window.showInputBox({
    prompt: "Agent name",
    placeHolder: "my-agent",
    ignoreFocusOut: true,
  });
  if (!name) return;

  const description = await vscode.window.showInputBox({
    prompt: "Agent description",
    placeHolder: "My OH agent",
    ignoreFocusOut: true,
  });
  if (!description) return;

  try {
    const result = await runOH(`create "${name}" "${description}"`);
    outputChannel.appendLine(result);
    vscode.window.showInformationMessage(`Agent "${name}" created`);
  } catch (err) {
    vscode.window.showErrorMessage(`OH create agent failed: ${err.message}`);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
