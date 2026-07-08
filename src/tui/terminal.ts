import blessed from 'blessed';
import { execSync } from 'child_process';
import { isSafeCommand } from '../security/index.js';

export class TerminalPanel {
  public element: blessed.Widgets.BoxElement;
  private log: blessed.Widgets.Log;
  private running = false;

  constructor(private screen: blessed.Widgets.Screen, private parent: blessed.Widgets.BoxElement) {
    this.element = blessed.box({
      parent,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      style: { bg: '#0A0A0A' },
    });

    this.log = blessed.log({
      parent: this.element,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '░' },
      style: { fg: '#00FF00', bg: '#0A0A0A' },
      tags: true,
    });

    this.log.log('{#00FF00-fg}OH Terminal{/}');
    this.log.log('{#64748B-fg}Type a command and press Enter to run.{/}');
    this.log.log('{#64748B-fg}Use with caution — commands run on your system.{/}');
    this.log.log('');
  }

  show() {
    this.element.show();
  }

  hide() {
    this.element.hide();
  }

  async handleInput(input: string) {
    if (this.running) return;
    if (!input.trim()) return;

    this.log.log(`{#8B5CF6-fg}$ {/#}${input}`);
    this.screen.render();

    const safetyCheck = isSafeCommand(input);
    if (!safetyCheck.safe) {
      this.log.log(`{#F43F5E-fg}BLOCKED: ${safetyCheck.reason}{/}`);
      this.log.log('');
      this.screen.render();
      return;
    }

    this.running = true;
    this.log.log(`{#64748B-fg}Running...{/}`);

    try {
      const result = execSync(input, {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      if (result.trim()) {
        for (const line of result.trim().split('\n').slice(0, 200)) {
          this.log.log(`  ${line}`);
        }
      } else {
        this.log.log(`{#10B981-fg}Command completed (no output){/}`);
      }
    } catch (err: any) {
      if (err.stdout) {
        for (const line of String(err.stdout).trim().split('\n').slice(0, 100)) {
          this.log.log(`  ${line}`);
        }
      }
      if (err.stderr) {
        this.log.log(`{#F43F5E-fg}${String(err.stderr).trim()}{/}`);
      }
      if (err.message && !err.stdout && !err.stderr) {
        this.log.log(`{#F43F5E-fg}Error: ${err.message}{/}`);
      }
    }

    this.running = false;
    this.log.log('');
    this.screen.render();
  }
}
