# Spec Driven Asteroids ☄️

> Inject Spec-Driven Intelligence into your favorite AI Agents. Rigorous. Simple. Frictionless.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Vision

**Spec Driven Asteroids** is a modular toolkit designed to bring discipline to AI-powered software engineering. Instead of providing a custom IDE or extension, it **injects** high-standard workflows (SDD) directly into the native environments of **GitHub Copilot**, **Google Antigravity**, and **OpenCode**.

- **Platform Native**: No new UI to learn. Work entirely within your existing AI chat.
- **Strict Enforcement**: Uses **Model Context Protocol (MCP)** to programmatically validate AI-generated specs.
- **Rigorous Flow**: Requirements (EARS) → Technical Design (Mermaid) → Atomic Tasks → Implementation.

## Core Pillars

1. **The Brain (Standards)**: Universal Markdown-based Skills and Agent Profiles that define specialized roles like `@spec-planner` and `@spec-designer`.
2. **The Enforcer (MCP)**: A background service that verifies EARS syntax, Mermaid diagrams, and requirement traceability.
3. **The Injector (CLI)**: A simple tool to scaffold any repository with these standards in seconds.

## Architecture

```
packages/
├── mcp/                # Node.js MCP Server (The Enforcer)
├── standards/          # Markdown templates for Skills & Agents (The Brain)
└── cli/                # Terminal interface for injections (The Injector)
```

## Getting Started

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/lindoelio/spec-driven-agentic-assistant.git
cd spec-driven-agentic-assistant

# Install dependencies
pnpm install

# Build the toolkit
pnpm build
```

### 2. Inject into your Project

Navigate to your target repository and run:

```bash
npx spec-driven-asteroids inject
```

Select your platforms (GitHub Copilot, Antigravity, or OpenCode) to scaffold the necessary `.github/`, `.agent/`, or `.opencode/` configurations.

### 3. Connect the Enforcer

Configure your AI tool to connect to the MCP server using `pnpm`:

```json
{
  "mcpServers": {
    "spec-driven-asteroids": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/spec-driven-agentic-assistant/packages/mcp", "start"]
    }
  }
}
```

## Usage

### GitHub Copilot
Use specialized custom agents directly in chat:
- `@spec-planner`: Create EARS requirements.
- `@spec-designer`: Create technical designs.
- `@copilot`: Implement code following the approved specs.

### Google Antigravity
Use native workflows:
- `/spec-driven-feature`: Orchestrates the full Requirements → Design → Task loop.

---

## Standards

- **EARS**: Easy Approach to Requirements Syntax (WHEN, IF, THEN, SHALL).
- **Mermaid**: Standard visualization for architecture and sequence diagrams.
- **Traceability**: Every design and task must link back to a requirement ID.
