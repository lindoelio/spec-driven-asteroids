# SpecDrivenAgentic - Development Plan

## Executive Summary

**SpecDrivenAgentic** is a platform-agnostic Spec-Driven Development (SDD) assistant designed to bring engineering discipline to AI-assisted coding. It enforces a strict **Requirements → Design → Tasks → Implementation** workflow, eliminating "vibe coding" and ensuring every line of code is traceable to a documented decision.

The system is built on a **Hexagonal Architecture (Ports & Adapters)** within a **monorepo**, enabling transparent integration with:
*   **Multiple IDEs/Interfaces**: VS Code Extension, CLI, Web Dashboard (future).
*   **Multiple Agentic Engines**: GitHub Copilot, OpenAI Codex, OpenCode, etc. (future).

The first release targets **VS Code + GitHub Copilot**. Subsequent releases will add adapters for other interfaces and engines without modifying the core business logic.

---

## 1. Core Philosophy

1.  **Extend, Don't Replace**: We augment the user's existing agentic tool (e.g., GitHub Copilot). We do not build a competing chat UI.
2.  **Strict Structure**: We do not support "vibe coding". Every line of code must be traceable to a Task → Design → Requirement.
3.  **Agentic Specialization**: Distinct agent behaviors (Planner, Builder, Reverser) for each phase of the workflow.
4.  **Persistent Context (Memory)**: MCP servers provide "infinite" context by storing checkpoints and architectural decisions across sessions.
5.  **Documentation Rigor**: Agents must actively seek external (web) and internal (repo) documentation to ground solutions in specific library versions and best practices.
6.  **Hexagonal Portability**: The core logic is decoupled from all I/O. Adapters handle IDE-specific APIs and Engine-specific prompting styles.

---

## 2. Hexagonal Architecture

The architecture follows the **Ports & Adapters** pattern, ensuring the core domain logic remains pure and testable while allowing multiple "shells" to interact with it.

### 2.1 Conceptual Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Interfaces                                │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                 │
│   │  VS Code Ext  │   │   CLI (Future)│   │  Web (Future) │                 │
│   │   (Adapter)   │   │   (Adapter)   │   │   (Adapter)   │                 │
│   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘                 │
│           │                   │                   │                         │
│           ▼                   ▼                   ▼                         │
│   ════════════════════════════════════════════════════════════════════      │
│   ║               INTERFACE PORT (Inbound)                         ║      │
│   ════════════════════════════════════════════════════════════════════      │
│                                   │                                         │
│                                   ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        CORE DOMAIN                                  │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│   │  │ SpecPlanner │  │ SpecBuilder │  │ SpecReverser│  │ TaskSchema │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│   │  │PromptManager│  │ SpecParser  │  │SteeringGen  │                  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│   ════════════════════════════════════════════════════════════════════      │
│   ║               ENGINE PORT (Outbound)                           ║      │
│   ════════════════════════════════════════════════════════════════════      │
│           │                   │                   │                         │
│           ▼                   ▼                   ▼                         │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                 │
│   │GitHub Copilot │   │   Codex API   │   │   OpenCode    │                 │
│   │   (Adapter)   │   │   (Future)    │   │   (Future)    │                 │
│   └───────────────┘   └───────────────┘   └───────────────┘                 │
│                              Agentic Engines                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Port Definitions

#### 2.2.1 Interface Port (Inbound)
Defines how user interfaces interact with the core.

```typescript
// packages/core/src/ports/IInterfacePort.ts
interface IInterfacePort {
  // Spec Lifecycle
  startSpec(featureName: string): Promise<SpecSession>;
  getSpecs(): Promise<SpecSummary[]>;
  getSpec(specId: string): Promise<SpecDetail>;

  // Task Management
  getTasks(specId: string): Promise<Task[]>;
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;

  // Steering
  getSteering(): Promise<SteeringDocs>;
  generateSteering(projectPath: string): Promise<SteeringDocs>;

  // Reverse Engineering
  reverseEngineer(targetPath: string): Promise<SpecDetail[]>;
}
```

#### 2.2.2 Engine Port (Outbound)
Defines how the core interacts with agentic engines.

```typescript
// packages/core/src/ports/IEnginePort.ts
interface IEnginePort {
  // Core prompting
  prompt(strategy: PromptStrategy, context: PromptContext): Promise<string>;

  // Streaming (for interactive flows)
  streamPrompt(strategy: PromptStrategy, context: PromptContext): AsyncIterable<string>;

  // Context management
  injectContext(files: FileReference[]): Promise<void>;

  // Memory (MCP)
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
  loadCheckpoint(specId: string): Promise<Checkpoint | null>;
}
```

### 2.3 Monorepo Package Structure

```
SpecDrivenAgentic/
├── packages/
│   ├── core/                             # Pure TypeScript - Domain Logic
│   │   ├── src/
│   │   │   ├── ports/                    # Port interfaces (contracts)
│   │   │   │   ├── inbound/
│   │   │   │   │   └── IInterfacePort.ts
│   │   │   │   ├── outbound/
│   │   │   │   │   ├── IEnginePort.ts
│   │   │   │   │   └── IFileSystemPort.ts
│   │   │   │   └── index.ts
│   │   │   ├── domain/                   # Business entities
│   │   │   │   ├── Spec.ts
│   │   │   │   ├── Task.ts
│   │   │   │   └── Steering.ts
│   │   │   ├── services/                 # Use cases / Application logic
│   │   │   │   ├── SpecPlanner.ts
│   │   │   │   ├── SpecBuilder.ts
│   │   │   │   ├── SpecReverser.ts
│   │   │   │   └── SteeringGenerator.ts
│   │   │   ├── strategies/               # Prompt strategies (EARS, Design, etc.)
│   │   │   │   ├── EarsStrategy.ts
│   │   │   │   ├── DesignStrategy.ts
│   │   │   │   └── TaskDecomposerStrategy.ts
│   │   │   └── schemas/                  # Task/Spec schemas for parsing
│   │   │       └── TaskSchema.ts
│   │   └── package.json
│   │
│   ├── adapters/
│   │   ├── inbound/                      # Interface Adapters (User → Core)
│   │   │   ├── vscode/                   # VS Code Extension
│   │   │   │   ├── src/
│   │   │   │   │   ├── extension.ts
│   │   │   │   │   ├── ChatParticipant.ts
│   │   │   │   │   ├── TreeProviders/
│   │   │   │   │   ├── FileSystemAdapter.ts
│   │   │   │   │   └── VsCodeInterfaceAdapter.ts
│   │   │   │   └── package.json
│   │   │   │
│   │   │   ├── cli/                      # CLI (Future)
│   │   │   │   └── ...
│   │   │   │
│   │   │   └── web/                      # Web Dashboard (Future)
│   │   │       └── ...
│   │   │
│   │   └── outbound/                     # Engine Adapters (Core → AI Services)
│   │       ├── copilot/                  # GitHub Copilot
│   │       │   ├── src/
│   │       │   │   ├── CopilotEngineAdapter.ts
│   │       │   │   └── McpClient.ts
│   │       │   └── package.json
│   │       │
│   │       ├── opencode/                 # OpenCode (Future)
│   │       │   └── ...
│   │       │
│   │       └── codex/                    # OpenAI Codex (Future)
│   │           └── ...
│   │
├── .spec/                                # Spec artifacts (managed by extension)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── DEVELOPMENT_PLAN.md
```

---

## 3. Feature Specification

### 3.1 The `@spec` Chat Participant (VS Code + Copilot)

The VS Code adapter contributes a Chat Participant `@spec` which routes user intent to the core domain services.

#### 3.1.1 Spec Planning Agent (The Architect)
*Responsibility*: Transform interaction into structured artifacts.
*   **Requirements Phase**:
    *   **Context Grounding**: Searches for relevant external docs (e.g., library versions) and internal docs before starting.
    *   **Automated Ingestion (MCP)**: Checks for issue tracker MCPs (Jira, Linear). Auto-detects Issue ID from branch or prompts user.
    *   **EARS Strategy**: Uses EARS prompt strategies for structured requirements.
    *   Outputs `requirements.md`.
*   **Design Phase**:
    *   Loads Design prompt strategies.
    *   **Impact Analysis**: Scans codebase for impacted files before finalizing.
    *   Outputs `design.md` (Architecture, API contracts, Mermaid diagrams).
*   **Task Planning Phase**:
    *   Decomposes design into atomic tasks in `tasks.md`.
    *   **Strict Task Schema**: Machine-parseable format for bidirectional UI sync.
    *   **Test-First Reasoning**: Suggests TDD workflow if appropriate; user confirms.
    *   Ensures traceability links.

#### 3.1.2 Spec Implementation Agent (The Builder)
*Responsibility*: Execute code changes based on approved tasks.
*   **Context Loading**: Bundles `design.md`, `requirements.md`, Steering, and MCP memory.
*   **Execution**: Writes code to fulfill a task.
*   **Validation**: Updates `tasks.md` status.

### 3.2 Model Context Protocol (MCP) Integration
*   **Checkpoints**: Saves spec summaries and decisions to MCP Memory server.
*   **Issue Ingestion**: Queries Jira/Linear MCPs for ticket details.
*   **Fallback**: Local `.spec/state.json` if MCP unavailable.

### 3.3 Steering System & Auto-Generation
*   **Manual/Wizard**: UI to create `product.md`, `tech.md`, `conventions.md`.
*   **Auto-Generation**: Agent generates Steering from prompt or scans existing codebase.

### 3.4 Reverse Engineering Specs
*   **Feature Reconstruction**: Clusters legacy code into logical features.
*   **Spec Generation**: Creates `requirements.md` and `design.md` per feature.
*   **Orphaned Tasks**: Generates `tasks.md` for existing work.

### 3.5 Unified Management UI (VS Code)
*   **Specs View**: Tree view with status icons.
*   **Steering View**: Edit global/project steering docs.
*   **Hooks View**: Manage automation (e.g., run tests after task).
*   **Bidirectional Sync**: UI ↔ `tasks.md` file stays in sync.

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Monorepo + Core Skeleton)
*   **Goal**: Establish hexagonal structure and basic wiring.
*   **Tasks**:
    1.  Initialize monorepo with `pnpm workspaces`.
    2.  Create `packages/core` with port interfaces.
    3.  Create `packages/adapter-vscode` skeleton (extension scaffolding).
    4.  Create `packages/adapter-copilot` skeleton.
    5.  Implement `IFileSystemPort` in VS Code adapter.

### Phase 2: Steering & Basic UI
*   **Goal**: First visible value—generate `tech.md` from existing projects.
*   **Tasks**:
    1.  Implement `SteeringGenerator` in core.
    2.  Wire VS Code command to trigger generation.
    3.  Create **Steering View** in sidebar.

### Phase 3: Spec Planning Agent
*   **Goal**: Full requirements & design flow via `@spec`.
*   **Tasks**:
    1.  Register `@spec` chat participant.
    2.  Implement `EarsStrategy` (EARS prompting).
    3.  Implement `DesignStrategy` with Impact Analysis.
    4.  Implement MCP Issue Ingestion (Jira/Linear).
    5.  Implement Context Grounding (web doc search).
    6.  Create **Specs View** in sidebar.

### Phase 4: Task Generation & Management
*   **Goal**: Break design into tasks with UI management.
*   **Tasks**:
    1.  Define `TaskSchema` (machine-parseable Markdown).
    2.  Implement `TaskDecomposerStrategy`.
    3.  Implement TDD Reasoning Engine.
    4.  Implement Bidirectional Sync (file watcher + parser).
    5.  Update Specs View with task tree.

### Phase 5: Implementation Agent & MCP Memory
*   **Goal**: The Builder agent writes code from tasks.
*   **Tasks**:
    1.  Implement `CopilotEngineAdapter` (IEnginePort).
    2.  Implement `McpClient` in adapter-copilot.
    3.  Implement `SpecBuilder` service in core.
    4.  Add Checkpoint save/load.

### Phase 6: Reverse Engineering
*   **Goal**: Generate specs from existing code.
*   **Tasks**:
    1.  Implement Feature Cluster Analysis.
    2.  Implement Spec Reconstruction.
    3.  Wire VS Code commands.

### Phase 7: CLI Adapter (Future)
*   **Goal**: Headless spec-driven workflow for terminal users.
*   **Tasks**:
    1.  Create `packages/adapter-cli`.
    2.  Implement CLI interface (e.g., `specdriven plan feature-x`).
    3.  Expose core as MCP tools for OpenCode integration.

### Phase 8: Additional Engine Adapters (Future)
*   **Goal**: Support Codex, OpenCode, and other engines.
*   **Tasks**:
    1.  Create `packages/adapter-codex` (OpenAI API).
    2.  Create `packages/adapter-opencode` (MCP tool surface).
    3.  Abstract prompt formatting per engine.

---

## 5. First Release Scope (MVP)

**Target**: VS Code Extension for GitHub Copilot

**Included**:
*   `@spec` Chat Participant (Planner + Builder agents).
*   Steering generation (auto + manual).
*   `requirements.md`, `design.md`, `tasks.md` generation.
*   Specs View + Steering View in sidebar.
*   Bidirectional task sync.
*   MCP Memory checkpoints.
*   MCP Issue Ingestion (Jira/Linear if available).

**Excluded (Future Phases)**:
*   Reverse Engineering.
*   CLI Adapter.
*   Web Dashboard.
*   Non-Copilot engines.

---

## 6. Next Steps for Immediate Execution

1.  **Initialize Monorepo**: `pnpm init` + workspace config.
2.  **Scaffold Packages**: `core`, `adapter-vscode`, `adapter-copilot`.
3.  **Define Port Interfaces**: `IInterfacePort`, `IEnginePort`, `IFileSystemPort`.
4.  **Register @spec**: Basic "Hello World" chat participant.
5.  **Implement SteeringGenerator**: First user-visible feature.
