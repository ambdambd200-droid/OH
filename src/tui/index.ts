import blessed from 'blessed';
import { ChatPanel } from './chat.js';
import { FilePanel } from './files.js';
import { TerminalPanel } from './terminal.js';
import { AgentsPanel } from './agents.js';
import { InputBar } from './input.js';
import { showBanner } from '../cli/banner.js';

type PanelKey = 'chat' | 'files' | 'term' | 'agents';

export function startTUI() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'OH v2.0 — Open Hermes TUI',
    cursor: { artificial: true, blink: true, shape: 'block', color: 'white' },
    dockBorders: true,
    fullUnicode: true,
  });

  const topBar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    style: { fg: '#A78BFA', bg: '#1E1B2E' },
    tags: true,
    content: ' OH v2.0 ',
  });

  const leftBorder = blessed.box({
    top: 1,
    left: 0,
    width: '30%',
    bottom: 3,
    border: { type: 'line' },
    style: { fg: '#94A3B8', bg: '#0F0D1A', border: { fg: '#4B4568' } },
    label: ' Files ',
  });

  const fileTree = blessed.list({
    parent: leftBorder,
    top: 0,
    left: 1,
    right: 1,
    bottom: 1,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '░' },
    style: {
      fg: '#64748B',
      bg: '#0F0D1A',
      selected: { fg: '#8B5CF6', bold: true },
    },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    items: ['(file tree in Files tab)'],
  });

  const mainArea = blessed.box({
    top: 1,
    left: '30%',
    width: '70%',
    bottom: 3,
    border: { type: 'line' },
    style: { bg: '#0F0D1A', border: { fg: '#4B4568' } },
  });

  const tabBar = blessed.box({
    parent: mainArea,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    style: { fg: '#64748B', bg: '#1A1730' },
    tags: true,
    content: '',
  });

  const tabContent = blessed.box({
    parent: mainArea,
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-1',
    style: { bg: '#0F0D1A' },
  });

  const panels: Record<PanelKey, {
    show: () => void;
    hide: () => void;
    handleInput: (input: string) => void;
  }> = {
    chat: new ChatPanel(screen, tabContent),
    files: new FilePanel(screen, tabContent),
    term: new TerminalPanel(screen, tabContent),
    agents: new AgentsPanel(screen, tabContent),
  };

  const inputBar = new InputBar(screen);
  screen.append(inputBar.element);

  screen.append(topBar);
  screen.append(leftBorder);
  screen.append(mainArea);

  let activeTab: PanelKey = 'chat';
  const tabOrder: PanelKey[] = ['chat', 'files', 'term', 'agents'];
  const tabLabels = ['Chat', 'Files', 'Term', 'Agents'];

  function updateTabBar() {
    const idx = tabOrder.indexOf(activeTab);
    const parts = tabLabels.map((label, i) => {
      if (i === idx) return `{bold}{#8B5CF6-fg}[${label}]{/}{/bold}`;
      return `{#64748B-fg} ${label} {/}`;
    });
    topBar.setContent(` OH v2.0 │ ${parts.join('│')} `);
    tabBar.setContent(` ${tabLabels.map((l, i) =>
      i === idx ? `{bold}{#8B5CF6-fg}[${l}]{/}{/bold}` : `{#64748B-fg} ${l} {/}`
    ).join(' │ ')} `);
    screen.render();
  }

  function switchTab(tab: PanelKey) {
    for (const [key, panel] of Object.entries(panels)) {
      if (key === tab) panel.show();
      else panel.hide();
    }
    activeTab = tab;
    updateTabBar();
    inputBar.focus();
  }

  Object.values(panels).forEach(p => p.hide());
  switchTab('chat');

  screen.key(['C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key(['C-tab'], () => {
    const idx = tabOrder.indexOf(activeTab);
    switchTab(tabOrder[(idx + 1) % tabOrder.length]);
  });

  screen.key(['S-tab'], () => {
    const idx = tabOrder.indexOf(activeTab);
    switchTab(tabOrder[(idx - 1 + tabOrder.length) % tabOrder.length]);
  });

  screen.key(['f1'], () => switchTab('chat'));
  screen.key(['f2'], () => switchTab('files'));
  screen.key(['f3'], () => switchTab('term'));
  screen.key(['f4'], () => switchTab('agents'));

  inputBar.onSubmit((value: string) => {
    panels[activeTab].handleInput(value);
  });

  inputBar.focus();
  screen.render();
}
