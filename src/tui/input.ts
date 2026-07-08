import blessed from 'blessed';
import { getLang } from '../i18n/index.js';
import { auditLog } from '../security/index.js';

const COMMANDS = [
  'chat', 'create', 'list', 'run', 'delete',
  'memory', 'memory store', 'memory get', 'memory search', 'memory clear',
  'help', 'status', 'models', 'exit',
];

export class InputBar {
  public element: blessed.Widgets.TextboxElement;
  private history: string[] = [];
  private historyIndex = -1;
  private commands: string[] = COMMANDS;
  private commandIndex = -1;
  private submitHandler?: (value: string) => void;

  constructor(private screen: blessed.Widgets.Screen) {
    this.element = blessed.textbox({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      inputOnFocus: true,
      style: { fg: '#A78BFA', bg: '#0F0D1A', border: { fg: '#4B4568' } },
      border: { type: 'line' },
      padding: { left: 2 },
      keys: true,
      mouse: true,
    });
    this.setupKeys();
  }

  private setupKeys() {
    this.element.key(['enter'], () => {
      const value = this.element.getValue().trim();
      if (!value) return;
      this.history.push(value);
      this.historyIndex = this.history.length;
      this.element.clearValue();
      auditLog('TUI_INPUT', value.slice(0, 200));
      this.submitHandler?.(value);
      this.screen.render();
    });

    this.element.key(['up'], () => {
      if (this.history.length === 0) return;
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.element.setValue(this.history[this.historyIndex]);
      }
      this.screen.render();
    });

    this.element.key(['down'], () => {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.element.setValue(this.history[this.historyIndex]);
      } else {
        this.historyIndex = this.history.length;
        this.element.clearValue();
      }
      this.screen.render();
    });

    this.element.key(['tab'], () => {
      const current = this.element.getValue().trim().toLowerCase();
      if (!current) return;
      const matches = this.commands.filter(c => c.startsWith(current));
      if (matches.length === 1) {
        this.element.setValue(matches[0] + ' ');
      } else if (matches.length > 1) {
        const common = this.longestCommonPrefix(matches);
        if (common.length > current.length) {
          this.element.setValue(common);
        }
      }
      this.screen.render();
    });
  }

  private longestCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (strings[i].indexOf(prefix) !== 0) {
        prefix = prefix.slice(0, -1);
        if (prefix === '') return '';
      }
    }
    return prefix;
  }

  onSubmit(handler: (value: string) => void) {
    this.submitHandler = handler;
  }

  focus() {
    this.element.focus();
  }

  getValue(): string {
    return this.element.getValue();
  }

  setValue(value: string) {
    this.element.setValue(value);
    this.screen.render();
  }
}
