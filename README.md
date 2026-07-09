# OH — Open Hermes v3

> The Ultimate No-Code AI Agent Platform — 42 models, 25+ built-in systems, Arabic-first CLI, real-time web dashboard.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22.22-339933?logo=nodedotjs)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](#)

---

## Quick Start

```bash
# Install dependencies
npm install

# Run CLI (interactive mode)
npm run oh

# Run web dashboard
npm run web

# Build for production
npm run build
npm start
```

**Prerequisites:** Node.js 18+ (recommended: 22.x), npm 9+

---

## Features

### Core
| System | Description |
|--------|-------------|
| **42 AI Models** | 16 Chinese (DeepSeek, Qwen, Yi, GLM, Baichuan, InternLM, Minimax) + 24 American (OpenAI, Anthropic, Meta, Google, Mistral, Cohere) + 2 OpenRouter |
| **DDA Commands** | Egyptian Arabic dialect commands — `ده`, `دا`, `دي` — natural language agent control |
| **Adaptive Memory** | 5-layer memory with confidence scoring, HNSW indexing, hybrid search |
| **Agent Engine** | Create, template, search, run, delete agents via CLI or natural language |
| **8 Internal Personas** | PM, UX, Designer, Developer, Copywriter, QA, DevOps, Orchestrator — collaborative agent teams |

### Infrastructure
| System | Description |
|--------|-------------|
| **Web Dashboard** | Real-time UI with WebSocket, Express backend, dark theme design system |
| **Offline Mode** | Ollama, llama.cpp, GPT4All, ONNX, WebNN backends with SQLite local storage |
| **Disaster Recovery** | Auto-backup, encryption, multi-location restore, integrity verification |
| **Scheduler & Cron** | 6 schedule types: cron, interval, one-time, conditional, event-triggered, webhook |
| **Real-Time Collab** | CRDT-based sync, presence, multi-user session management |
| **Multi-Agent Swarm** | 6 orchestration patterns: round-robin, broadcast, chain, hierarchy, mesh, dynamic |

### AI & Automation
| System | Description |
|--------|-------------|
| **Self-Evolution** | Learns from feedback cycles, auto-improves responses, adapts to user patterns |
| **A/B Testing Engine** | Variant management, metric tracking, statistical analysis, auto-optimize |
| **Plugin SDK** | 7 plugin types: tool, source, hook, action, parser, auth, transport |
| **Agent Version Control** | Git-like agent versioning: commit, diff, branch, merge, rollback |
| **Conversation Branching** | Tree-based branching like PI — fork, explore, merge conversations |
| **Voice Interface** | STT + TTS, wake word detection, voice commands |

### Business & Compliance
| System | Description |
|--------|-------------|
| **Cost Tracking** | Per-model/per-agent billing, budget alerts, usage analytics |
| **Compliance Suite** | SOC 2, HIPAA, GDPR, PCI DSS — audit trails, consent management, data classification |
| **Data Export** | 15 formats (JSON, CSV, PDF, DOCX, XLSX, HTML, MD, XML, YAML, SQL, Parquet, Arrow, Notion, Airtable, n8n) |
| **Community Hub** | Agent marketplace, plugin registry, template sharing |
| **Daily Health Monitor** | 7 checks: disk, memory, API, model, queue, cert, uptime — auto-recovery |
| **User Customization** | 5 themes (Dark, Light, Ocean, Midnight, Neon), locale, keybindings |

### Platforms
| System | Description |
|--------|-------------|
| **Telegram Bot** | Full agent interaction via Telegram |
| **Discord Bot** | Slash commands, agent management, real-time streaming |
| **WhatsApp Bot** | WhatsApp Web integration with QR pairing |
| **Mobile (React Native)** | Expo-based mobile app with push notifications |
| **WebSocket API** | Real-time bidirectional communication |

---

## Web Dashboard

The web dashboard runs on `http://localhost:3456` and features:

- **Dark theme** design system with glassmorphism, gradients, animations
- **Sidebar navigation** — Dashboard, Agents, Memory, Models, Settings, Analytics
- **Real-time agent interaction** via WebSocket
- **System health metrics** — uptime, memory usage, model count, agent activity
- **Quick actions** — trigger agents, AI processing, automated workflows
- **Terminal panel** with live log output

Start with:
```bash
npm run web
```

---

## CLI Usage

```bash
# Interactive mode
npm run oh

# Commands within the interactive shell:
models            # List all 42 models
model <name>      # Switch model
agents            # List agents
search <query>    # Search memory
help              # Show help
clean             # Clear cache

# Egyptian Arabic (DDA) commands:
شغل دا [name]     # Run an agent
دور دا [query]    # Search
غير دا [model]    # Switch model
اعرض دا           # List agents
احذف دا [name]    # Delete agent
ساعدني           # Show DDA help

# Direct execution:
npx tsx src/index.ts web          # Start web dashboard
npx tsx src/index.ts telegram     # Start Telegram bot
npx tsx src/index.ts discord      # Start Discord bot
```

---

## Architecture

```
src/
├── index.ts            # Entry point — interactive CLI + command routing
├── commands/           # All 25 command modules
│   ├── dda.ts          # Egyptian Arabic dialect commands
│   ├── chat.ts         # Core chat engine
│   ├── agentgit.ts     # Agent version control
│   ├── branching.ts    # Conversation branching
│   ├── plugin.ts       # Plugin SDK
│   ├── offline.ts      # Offline mode
│   ├── evolution.ts    # Self-evolution engine
│   ├── health.ts       # Health monitor
│   ├── scheduler.ts    # Cron & scheduling
│   ├── swarm.ts        # Multi-agent orchestration
│   ├── collaboration.ts# Real-time collab
│   ├── voice.ts        # Voice interface
│   ├── abtesting.ts    # A/B testing
│   ├── export.ts       # Data export
│   ├── disaster.ts     # Disaster recovery
│   ├── cost.ts         # Cost tracking
│   ├── community.ts    # Community hub
│   ├── compliance.ts   # Compliance suite
│   ├── customization.ts# User preferences
│   ├── accessibility.ts# WCAG/ARIA support
│   └── templates.ts    # Agent templates
├── web/
│   ├── index.ts        # Express + WebSocket server
│   └── public/
│       └── index.html  # Full dashboard SPA (60KB, single-file)
├── proxy/
│   ├── index.ts        # Model routing & provider abstraction
│   └── models.ts       # 42 model definitions
├── memory/
│   └── adaptive.ts     # 5-layer adaptive memory
├── personas/
│   ├── personas.ts     # 8-persona orchestration engine
│   └── subagents/      # Per-persona subagents
├── config/             # Config management
├── i18n/               # English + Arabic localization
├── security/           # Audit log, encryption
├── platforms/          # Telegram, Discord, WhatsApp bridges
└── prompt/             # System prompts
mobile/                 # React Native + Expo mobile app
```

---

## Model Catalog

| Category | Models | Count |
|----------|--------|-------|
| **Chinese** | DeepSeek V3/R1/R2, Qwen 2.5/Max/Coder, Yi Lightning/Spark, GLM-4, Baichuan 4/Turbo, InternLM 3, Minimax, Step 2, DeepSeek Janus | 16 |
| **American** | GPT 4.1/4o/4o-mini/o3/o4-mini, Claude Opus/Sonnet/Haiku, Gemini 2.5 Pro/Flash, Llama 4 Scout/Maverick/Behemoth, Grok 3, Mistral Large/Small/Codestral, Command R+, Pi, Together, Groq | 24 |
| **OpenRouter** | DeepSeek V3 (free), Qwen 2.5 Coder 32B | 2 |

---

## Development

```bash
# Type check
npx tsc --noEmit

# Run in dev mode
npx tsx src/index.ts

# Run specific module directly
npx tsx src/commands/offline.ts
```

### Build
```bash
npm run build    # Compiles to dist/
npm start        # Runs compiled output
```

---

## License

MIT

---

## Links

- **Repository:** https://github.com/ambdambd200-droid/OH
- **Issues:** https://github.com/ambdambd200-droid/OH/issues
