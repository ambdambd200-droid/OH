import blessed from 'blessed';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { t, getLang } from '../i18n/index.js';
import { memoryStore, memorySearch } from '../memory/index.js';
import { proxyRequest } from '../proxy/index.js';
import { getConfig } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ChatPanel {
  public element: blessed.Widgets.BoxElement;
  private log: blessed.Widgets.Log;
  private systemPrompt: string;
  private messages: ChatMessage[] = [];
  private thinking = false;

  constructor(private screen: blessed.Widgets.Screen, private parent: blessed.Widgets.BoxElement) {
    this.systemPrompt = this.loadSystemPrompt();

    this.element = blessed.box({
      parent,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      style: { bg: '#0F0D1A' },
    });

    this.log = blessed.log({
      parent: this.element,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-1',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '░' },
      style: { fg: '#F8FAFC', bg: '#0F0D1A' },
      tags: true,
    });

    this.log.log(`{#A78BFA-fg}OH Chat — {#64748B-fg}Type a message and press Enter{/}`);
    this.log.log(`{#64748B-fg}Arabic and English supported.{/}`);
    this.log.log('');
  }

  private loadSystemPrompt(): string {
    const locations = [
      join(__dirname, '..', 'prompt', 'claude-fable-5.md'),
      join(__dirname, '..', '..', 'src', 'prompt', 'claude-fable-5.md'),
    ];
    for (const loc of locations) {
      if (existsSync(loc)) {
        return readFileSync(loc, 'utf-8');
      }
    }
    return 'You are OH (Open Hermes) — a no-code AI agent platform.';
  }

  show() {
    this.element.show();
  }

  hide() {
    this.element.hide();
  }

  async handleInput(input: string) {
    if (this.thinking) return;
    if (!input.trim()) return;

    this.messages.push({ role: 'user', content: input });
    memoryStore(`chat:${Date.now()}`, input);

    this.log.log(`{#8B5CF6-fg}You:{/#} ${input}`);
    this.screen.render();

    this.thinking = true;
    this.log.log(`{#64748B-fg}OH is thinking...{/}`);
    this.screen.render();

    try {
      const memories = memorySearch(input);
      const context = memories.length > 0
        ? `\nRelevant context:\n${memories.slice(0, 3).map(m => `- ${m.key}: ${m.value}`).join('\n')}\n`
        : '';

      const message = this.messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const fullPrompt = `${this.systemPrompt}\n\nConversation history:\n${message}\n\nUser: ${input}\n\n${context}`;

      const response = await proxyRequest(getConfig().model, fullPrompt);
      this.messages.push({ role: 'assistant', content: response });

      this.log.log(`{#06B6D4-fg}OH:{/#} ${response}`);
      if (context) {
        this.log.log(`{#64748B-fg}(context from memory){/}`);
      }
    } catch (err: any) {
      this.log.log(`{#F43F5E-fg}Error:{/#} ${err?.message || 'Failed to get response'}`);
    }

    this.thinking = false;
    this.log.log('');
    this.screen.render();
  }
}
