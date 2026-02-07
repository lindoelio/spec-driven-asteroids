# Spec Driven Asteroids ☄️

> Inject Spec-Driven Intelligence into your favorite AI Agents. Rigorous. Simple. Frictionless.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Vision

**Spec Driven Asteroids** is a modular toolkit designed to bring discipline to AI-powered software engineering. Instead of providing a custom IDE or extension, it **injects** high-standard workflows (SDD) directly into the native environments of **GitHub Copilot**, **Google Antigravity**, and **OpenCode**.

- **Platform Native**: No new UI to learn. Work entirely within your existing AI chat.
- **Strict Enforcement**: Uses **Model Context Protocol (MCP)** to programmatically validate AI-generated specs.
- **Rigorous Flow**: Requirements (EARS) → Technical Design (Mermaid) → Atomic Tasks → Implementation.

---

## Core Pillars

1. **The Brain (Standards)**: Universal Markdown-based Skills and Agent Profiles that define specialized roles like `@spec-driven`.
2. **The Enforcer (MCP)**: A background service with 5 comprehensive validation tools for EARS syntax, Mermaid diagrams, file structure, and traceability.
3. **The Injector (CLI)**: A command-line interface with MCP server selection and spec injection capabilities.

---

## Architecture

```
packages/
├── mcp/                 # Node.js MCP Server (The Enforcer)
├── standards/             # Markdown templates for Skills & Agents (The Brain)
└── cli/                  # Terminal interface for injections (The Injector)
```

---

## Getting Started

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/lindoelio/spec-driven-asteroids.git
cd spec-driven-asteroids

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

**Select your platforms** (GitHub Copilot, Antigravity, or OpenCode) to scaffold the necessary `.github/`, `.agent/`, or `.opencode/` configurations.

**Select MCP servers** from categorized list:
- **Git**: GitHub MCP
- **Project Management**: Linear MCP, Atlassian MCP
- **Database**: Supabase MCP, Firebase MCP
- **Authentication**: Notion MCP
- **Testing**: Postman MCP, TestStrike MCP, Playwright MCP
- **Development**: Svelte MCP, Context7 MCP

### 3. Connect to Enforcer

Configure your AI tool to connect to the MCP server using `pnpm`:

```json
{
  "mcpServers": {
    "spec-driven-asteroids": {
      "command": "pnpm",
      "args": ["dlx", "@spec-driven-asteroids/mcp"]
    }
  }
}
```

---

## Usage

### 1. GitHub Copilot

Once injected, you have access to specialized **Custom Agents** directly in your chat.

*   **Plan a Feature**:
    > `@spec-driven I want to add a rate limiter to my API.`
    > *(The agent generates a slug and creates `specs/changes/rate-limiter/requirements.md`, `design.md`, `tasks.md`)*

*   **Implement**:
    > `@copilot Implement the rate limiter following the tasks in specs/changes/rate-limiter/tasks.md.`
    > *(The agent follows the validated task breakdown with proper traceability)*

### 2. Google Antigravity

Use native **Workflows** to orchestrate the entire process.

*   **Run the Full Loop**:
    > `/spec-driven`
    > *(Guides you through Requirements → Design → Tasks → Code, saving everything in `specs/changes/<slug>/`)*

### 3. OpenCode / Claude Code

Spec Driven Asteroids injects **Skills** that OpenCode discovers automatically.

*   **Automatic Skill Detection**:
    > "Create a plan for user authentication."
    > *(OpenCode detects `spec-driven-asteroids` skill and follows folder and syntax standards)*

---

## MCP Validation Tools

The MCP server provides 5 comprehensive validation tools:

| Tool | Purpose | Validates |
|------|---------|-----------|
| `verify_spec_structure` | Folder structure | Directory exists, required files present |
| `verify_requirements_file` | Requirements content | Sections, EARS patterns, REQ-X IDs, AC numbering |
| `verify_design_file` | Design content | Sections, Mermaid diagrams, DES-X IDs, traceability, Impact Analysis |
| `verify_tasks_file` | Tasks content | Sections, phases, checkboxes, traceability, status markers |
| `verify_complete_spec` | Complete workflow | All 3 files together, cross-file traceability |

**Error Format**: All tools use 3-level context with SKILL.md links:
```
[Error Type] → Context → Suggested Fix
   See: packages/standards/src/templates/universal/skills/[relevant-skill]/SKILL.md
   Line: 42
```

---

## Standards

- **EARS**: Easy Approach to Requirements Syntax (WHEN, IF, THEN, SHALL, WHILE, WHERE)
- **Mermaid**: Standard visualization for architecture and sequence diagrams
- **Folder Convention**: `specs/changes/<slug>/[requirements.md | design.md | tasks.md]`
- **Traceability**: Every design and task must link back to a requirement ID

---

## MCP Server Selection

The CLI supports 11 MCP servers across 7 categories:

**Git**
- GitHub MCP - Repository management, PRs, issues

**Project Management**
- Linear MCP - Issue tracking, projects
- Atlassian MCP - Jira & Confluence integration

**Database**
- Supabase MCP - Database and auth services
- Firebase MCP - Firebase tools

**Authentication**
- Notion MCP - Notion API integration

**Testing**
- Postman MCP - API collection and testing
- TestStrike MCP - Test automation
- Playwright MCP - Browser automation and testing

**Development**
- Svelte MCP - Svelte development tools
- Context7 MCP - Search with Context7 API

**Note**: MCP servers requiring API keys (GitHub, Linear, Notion, Supabase, Atlassian, Postman, Context7) will display documentation links during injection. Configuration of API keys is left to the user.

---

## Impact Analysis

The Technical Designer skill includes a comprehensive **Impact Analysis** section for changes to existing features:

**What's Analyzed:**
- Affected modules, files, and components
- Data flow and dependencies
- External services or APIs
- Existing test coverage gaps

**Risk Categories:**
- Breaking changes (API, schema changes)
- Performance implications
- Security considerations
- Migration needs

**Mitigation Planning:**
- Backward compatibility requirements
- Rollback strategies
- Testing strategies (unit, integration, regression)
- Gradual rollout for high-risk changes

---

## Publishing

### CLI Package

```bash
cd packages/cli
pnpm publish
```

### MCP Server Package

```bash
cd packages/mcp
pnpm publish
```

---

## License

MIT
