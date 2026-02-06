# Spec-Driven Agentic Assistant

> A flexible, tool-agnostic platform for Spec-Driven Development — bringing discipline to AI-powered software engineering.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Vision

**Spec-Driven Development (SDD)** is emerging as a best practice for building reliable software with AI coding assistants. Tools like AWS Kiro, GitHub SpecKit, and Google Conductor are pioneering this space — but they often come with lock-in, complexity, or limited integration with real codebases.

**Spec-Driven Assistant** takes a different approach:

- **Tool-agnostic** — Works with your IDE (VS Code, CLI, more coming) and your AI engine (Copilot, OpenCode, Codex, etc.)
- **Deeply integrated** — Lives in your codebase, not a separate platform
- **Human-first** — Acts as a coworker, not a replacement — you review, refine, and approve at every step
- **Simple flow** — Inspired by Kiro's elegant workflow: Requirements → Design → Tasks → Code

## How It Works

```
Natural Language → Requirements (EARS) → Technical Design → Atomic Tasks → Implementation
```

Every line of code traces back to documented requirements. Every decision is captured. Every change is intentional.

## Features

- **Structured Planning** — Generate EARS-format requirements from natural language
- **Technical Design** — Architecture documents with Mermaid diagrams
- **Task Breakdown** — Atomic, traceable implementation tasks
- **Guidelines Management** — Project standards that AI assistants follow (AGENTS.md, CONTRIBUTING.md, etc.)
- **Multi-Engine Support** — Bring your own AI: Copilot, OpenCode, Codex, or others
- **Multi-Tool Support** — VS Code today, Antigravity, CLI and other IDEs coming soon

## Architecture

The project follows a **hexagonal (ports & adapters)** architecture, making it easy to plug in new tools and AI engines:

```
packages/
├── core/                         # Pure domain logic (tool-agnostic)
│   └── src/
│       ├── agents/               # Planning agents (Requirements, Design, Tasks)
│       ├── services/             # Orchestration and builders
│       └── strategies/           # Prompt strategies (EARS, naming, etc.)
│
├── adapters/
│   ├── inbound/                  # Development Tools (IDEs, CLIs)
│   │   └── vscode/               # ✅ VS Code extension
│   │   └── cli/                  # 🔜 Command-line interface
│   │
│   └── outbound/                 # AI Engines
│       └── copilot/              # ✅ GitHub Copilot
│       └── opencode/             # 🔜 OpenCode / Claude
│       └── codex/                # 🔜 OpenAI Codex
```

## Getting Started

### Prerequisites

- Node.js 20+
- VS Code
- An AI coding assistant (GitHub Copilot for now)

### Installation

```bash
# Clone the repository
git clone https://github.com/lindoelio/spec-driven-agentic.git
cd spec-driven-agentic

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Package the VS Code extension
pnpm package
```

### Install the VS Code Extension

1. Open VS Code
2. Press `Cmd+Shift+P` → **Extensions: Install from VSIX...**
3. Select `packages/adapters/inbound/vscode/spec-driven-assistant-vscode-0.1.0.vsix`
4. Reload VS Code

## Usage (VS Code)

### Chat Commands

| Command | Description |
|---------|-------------|
| `@spec /configure` | Initialize or update guideline documents |
| `@spec /plan <feature>` | Start planning a new feature |
| `@spec /status` | Check project and spec progress |

### Workflow

1. **Configure** — Run `@spec /configure` to set up project guidelines
2. **Plan** — Describe your feature with `@spec /plan User login with OAuth`
3. **Review** — Approve or refine the generated requirements (human-in-the-loop)
4. **Design** — Continue to technical design with architecture diagrams
5. **Tasks** — Break down into atomic implementation tasks
6. **Implement** — Execute tasks with full traceability

## Contributing

We welcome contributions! Whether it's:

- **New inbound adapters** — CLI, JetBrains IDEs, Neovim, etc.
- **New outbound adapters** — OpenCode, Codex, local LLMs, etc.
- **Core improvements** — Better prompts, new strategies, bug fixes

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

- [x] VS Code extension with Copilot integration
- [ ] Antigravity extension
- [ ] OpenCode adapter
- [ ] Codex adapter
- [ ] Claude adapter
- [ ] Command-line interface (CLI)
- [ ] JetBrains IDE plugin
- [ ] Local LLM support (Ollama, llama.cpp)
- [ ] Team collaboration features

## Development

```bash
# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Package Scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Build all packages |
| `pnpm clean` | Clean build artifacts |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run tests across all packages |
| `pnpm package` | Build and package the VS Code extension |

## License

MIT © [Lindoélio Lázaro](mailto:lindoelio@gmail.com)

---

<p align="center">
  <em>Built for developers who believe AI should amplify — not replace — human judgment.</em>
</p>
