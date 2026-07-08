import blessed from 'blessed';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

export class FilePanel {
  public element: blessed.Widgets.BoxElement;
  private fileList: blessed.Widgets.ListElement;
  private viewer: blessed.Widgets.BoxElement;
  private currentPath: string;
  private currentFiles: string[] = [];
  private mode: 'browse' | 'view' = 'browse';

  constructor(private screen: blessed.Widgets.Screen, private parent: blessed.Widgets.BoxElement) {
    this.currentPath = process.cwd();

    this.element = blessed.box({
      parent,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      style: { bg: '#0F0D1A' },
    });

    this.fileList = blessed.list({
      parent: this.element,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-1',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '░' },
    style: {
      fg: '#94A3B8',
      bg: '#0F0D1A',
      selected: { fg: '#8B5CF6', bold: true },
    },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
  });

  this.viewer = blessed.box({
    parent: this.element,
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '░' },
      style: { fg: '#F8FAFC', bg: '#0F0D1A' },
      content: '',
      tags: true,
      hidden: true,
    });

    this.loadDirectory(this.currentPath);
    this.setupKeys();
  }

  private setupKeys() {
    this.fileList.key(['enter'], () => {
      const idx = (this.fileList as any).selected;
      if (idx < 0 || idx >= this.currentFiles.length) return;
      const name = this.currentFiles[idx];
      const fullPath = join(this.currentPath, name);

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          this.loadDirectory(fullPath);
        } else {
          this.viewFile(fullPath);
        }
      } catch {
        // ignore
      }
      this.screen.render();
    });

    this.fileList.key(['backspace'], () => {
      const parent = join(this.currentPath, '..');
      this.loadDirectory(parent);
      this.screen.render();
    });

    this.fileList.key(['escape'], () => {
      if (this.mode === 'view') {
        this.mode = 'browse';
        this.viewer.hide();
        this.fileList.show();
        this.fileList.focus();
        this.screen.render();
      }
    });
  }

  private loadDirectory(dirPath: string) {
    this.currentPath = dirPath;
    this.currentFiles = [];

    const items = ['📁 ..'];
    try {
      const entries = readdirSync(dirPath);
      const dirs: string[] = [];
      const files: string[] = [];

      for (const entry of entries) {
        try {
          const stat = statSync(join(dirPath, entry));
          if (entry.startsWith('.')) continue;
          if (stat.isDirectory()) {
            dirs.push(`📁 ${entry}`);
            this.currentFiles.push(entry);
          } else {
            files.push(`📄 ${entry}`);
            this.currentFiles.push(entry);
          }
        } catch {
          // skip inaccessible
        }
      }

      items.push(...dirs.sort(), ...files.sort());
    } catch {
      items.push('(cannot read directory)');
    }

    this.fileList.setItems(items);
    this.fileList.select(0);
  }

  private viewFile(filePath: string) {
    this.mode = 'view';
    this.fileList.hide();

    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const maxLines = 500;
      const display = lines.slice(0, maxLines).map((l, i) =>
        `{#64748B-fg}${String(i + 1).padStart(4)}|{/} ${l}`
      ).join('\n');

      this.viewer.setContent(
        `{#06B6D4-fg}File:{/} {#F8FAFC-fg}${basename(filePath)}{/}\n` +
        `{#64748B-fg}${'-'.repeat(50)}{/}\n` +
        display +
        (lines.length > maxLines ? '\n{#F59E0B-fg}(file truncated to 500 lines){/}' : '')
      );
    } catch (err: any) {
      this.viewer.setContent(`{#F43F5E-fg}Error reading file: ${err?.message}{/}`);
    }

    this.viewer.setScrollPerc(0);
    this.viewer.show();
    this.viewer.focus();
  }

  show() {
    this.element.show();
    this.fileList.focus();
  }

  hide() {
    this.element.hide();
  }

  handleInput(input: string) {
    if (input === 'cd ' || input.startsWith('cd ')) {
      const dir = input.slice(3).trim();
      if (dir) {
        const target = join(this.currentPath, dir);
        if (existsSync(target) && statSync(target).isDirectory()) {
          this.loadDirectory(target);
        }
      }
    }
    this.screen.render();
  }
}
