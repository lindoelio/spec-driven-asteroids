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

1. **The Brain (Standards)**: Universal Markdown-based Skills and Agent Profiles that define specialized roles like `@spec-driven`.
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
      "args": ["--dir", "/path/to/spec-driven-asteroids/packages/mcp", "start"]
    }
  }
}
```

## Usage

### 1. GitHub Copilot
Once injected, you have access to a specialized **Custom Agent** directly in your chat.

*   **Plan a Feature**:
    > `@spec-driven I want to add a rate limiter to the API.`
    > *(The agent generates a slug and creates `specs/changes/rate-limiter/requirements.md`, `design.md`, and `tasks.md`)*

*   **Implement**:
    > `@copilot Implement the rate limiter following the tasks in specs/changes/rate-limiter/tasks.md.`

### 2. Google Antigravity
Use native **Workflows** to orchestrate the entire process.

*   **Run the Full Loop**:
    > `/spec-driven`
    > *(Guides you through Requirements → Design → Tasks → Code, saving everything in `specs/changes/<slug>/`)*

### 3. OpenCode / Claude Code
Spec Driven Asteroids injects **Skills** that OpenCode discovers automatically.

*   **Automatic Skill Detection**:
    > "Create a plan for user authentication."
    > *(OpenCode detects the `spec-driven-asteroids` skill and follows the folder and syntax standards)*

---

## Standards

- **EARS**: Easy Approach to Requirements Syntax (WHEN, IF, THEN, SHALL).
- **Mermaid**: Standard visualization for architecture and sequence diagrams.
- **Folder Convention**: `specs/changes/<slug>/[requirements.md | design.md | tasks.md]`.
- **Traceability**: Every design and task must link back to a requirement ID.
