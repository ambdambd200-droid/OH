import blessed from 'blessed';
import { t, getLang } from '../i18n/index.js';
import { createAgent, listAgents, deleteAgent, runAgent } from '../commands/agent.js';
import { memoryStore, memorySearch } from '../memory/index.js';
import { auditLog } from '../security/index.js';

export class AgentsPanel {
  public element: blessed.Widgets.BoxElement;
  private agentList: blessed.Widgets.ListElement;
  private agentStore: Map<string, { name: string; description: string; status: string }> = new Map();

  constructor(private screen: blessed.Widgets.Screen, private parent: blessed.Widgets.BoxElement) {
    this.element = blessed.box({
      parent,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      style: { bg: '#0F0D1A' },
    });

    this.agentList = blessed.list({
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

    this.refreshAgents();
    this.setupKeys();
  }

  private setupKeys() {
    this.agentList.key(['enter'], () => {
      const idx = (this.agentList as any).selected;
      const agents = Array.from(this.agentStore.values());
      if (idx < 0 || idx >= agents.length) return;
      const agent = agents[idx];
      runAgent(agent.name);
      this.refreshAgents();
      this.screen.render();
    });

    this.agentList.key(['d'], () => {
      const idx = (this.agentList as any).selected;
      const agents = Array.from(this.agentStore.values());
      if (idx < 0 || idx >= agents.length) return;
      deleteAgent(agents[idx].name);
      this.agentStore.delete(agents[idx].name);
      this.refreshAgents();
      this.screen.render();
    });

    this.agentList.key(['c'], () => {
      // Create mode is handled via text input below
    });
  }

  private refreshAgents() {
    const agents = Array.from(this.agentStore.values());
    if (agents.length === 0) {
      this.agentList.setItems([
        `{#64748B-fg}No agents yet.{/}`,
        `{#64748B-fg}Type "create <name>" to create one.{/}`,
      ]);
      return;
    }

    const items = agents.map(a => {
      const statusIcon = a.status === 'running' ? '{#10B981-fg}●{/}' :
                         a.status === 'error' ? '{#F43F5E-fg}●{/}' :
                         '{#64748B-fg}●{/}';
      return `${statusIcon} {#F8FAFC-fg}${a.name}{/} {#64748B-fg}${a.description}{/}`;
    });

    this.agentList.setItems(items);
  }

  show() {
    this.element.show();
    this.refreshAgents();
    this.agentList.focus();
  }

  hide() {
    this.element.hide();
  }

  handleInput(input: string) {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    switch (cmd) {
      case 'create': {
        const name = parts[1];
        const desc = parts.slice(2).join(' ') || 'My OH agent';
        if (name) {
          this.agentStore.set(name, { name, description: desc, status: 'idle' });
          createAgent(name, desc);
          this.refreshAgents();
        }
        break;
      }
      case 'delete': {
        const name = parts[1];
        if (name && this.agentStore.has(name)) {
          deleteAgent(name);
          this.agentStore.delete(name);
          this.refreshAgents();
        }
        break;
      }
      case 'run': {
        const name = parts[1];
        if (name && this.agentStore.has(name)) {
          runAgent(name);
          const agent = this.agentStore.get(name);
          if (agent) agent.status = 'idle';
          this.refreshAgents();
        }
        break;
      }
      case 'list': {
        // Already shown, just refresh
        this.refreshAgents();
        break;
      }
    }
    this.screen.render();
  }
}
