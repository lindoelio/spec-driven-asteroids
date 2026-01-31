# SpecDrivenAgentic - Usage Guide

> **Spec-Driven Development for GitHub Copilot**
> Transform "vibe coding" into structured, traceable, and maintainable software development.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [New Project Workflow](#new-project-workflow)
4. [Existing Project Workflow](#existing-project-workflow)
5. [Usage Tips by Scenario](#usage-tips-by-scenario)
   - [New Feature Development](#new-feature-development)
   - [Improvements & Refactoring](#improvements--refactoring)
   - [Bug Fixes](#bug-fixes)
   - [Code Analysis & Documentation](#code-analysis--documentation)
6. [The @spec Chat Commands](#the-spec-chat-commands)
7. [Sidebar Views](#sidebar-views)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Installation

### From VSIX File

1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type **"Extensions: Install from VSIX..."**
4. Select the `specdriven-agentic-0.1.0.vsix` file
5. Reload VS Code when prompted

### Verify Installation

- Look for the **SpecDriven** icon in the Activity Bar (left sidebar)
- Open Copilot Chat and type `@spec` - you should see autocomplete suggestions

---

## Quick Start

### The SpecDriven Philosophy

Every piece of code should be traceable to:
```
Requirement → Design → Task → Implementation
```

This extension enforces this workflow through:
- **Guidelines**: Project-wide documents at repo root (AGENTS.md, CONTRIBUTING.md, TESTING.md, etc.)
- **Specs**: Feature-specific requirements, design, and tasks
- **Traceability**: Every task links back to requirements

### Three Ways to Interact

1. **@spec Chat Participant** - Natural language planning in Copilot Chat
2. **Sidebar Views** - Visual management of specs, guidelines, and tasks
3. **Context Menus** - Right-click actions in the Explorer

---

## New Project Workflow

When starting a fresh project, follow this sequence to establish a solid foundation.

### Step 1: Initialize Guidelines

Guidelines define your project's DNA - the technology choices, coding conventions, and product vision that guide all development. These are community-standard files at the repository root.

**Option A: Manual Initialization**
1. Click the **SpecDriven** icon in the Activity Bar
2. In the **Guidelines** view, click **Initialize Guidelines**
3. This creates root-level guideline files (AGENTS.md, CONTRIBUTING.md, etc.)

**Option B: Using Chat**
```
@spec /configure
```

### Step 2: Define Your Guidelines

Edit the generated files at your repository root:

| File | Purpose | Example Content |
|------|---------|-----------------|
| `AGENTS.md` | AI agent instructions, product vision | "B2B SaaS for inventory management" |
| `ARCHITECTURE.md` | System structure, patterns, diagrams | "Hexagonal architecture with ports and adapters" |
| `CONTRIBUTING.md` | Coding standards, naming patterns, tech stack | "Next.js 14, PostgreSQL, Prisma ORM" |

**💡 Tip:** Be specific in `CONTRIBUTING.md` about versions and patterns. This helps the AI generate compatible code.

### Step 3: Plan Your First Feature

Now you're ready to plan features with full context:

```
@spec /plan User authentication with email and password
```

This triggers the complete workflow:
1. **Requirements** - EARS-formatted user stories
2. **Design** - Architecture with Mermaid diagrams
3. **Tasks** - Atomic implementation steps

### Step 4: Implement Tasks

View tasks in the **Tasks** sidebar view, then:

```
@spec /implement
```

Or click the **Implement** button on any task in the sidebar.

---

## Existing Project Workflow

For brownfield projects, start by reverse-engineering specs from your codebase.

### Step 1: Generate Guidelines from Project

Let the AI analyze your project structure:

1. In the **Guidelines** view, click **Generate from Project** (sparkle icon)
2. Or use chat:
   ```
   @spec Analyze this project and generate guidelines
   ```

This scans your codebase for:
- Package managers and dependencies
- Framework patterns (React, Express, etc.)
- Project structure conventions
- Testing frameworks

### Step 2: Reverse Engineer Existing Features

**For a specific folder:**
1. Right-click any folder in the Explorer
2. Select **"SpecDriven: Reverse Engineer Folder"**

**For analysis preview first:**
1. Right-click folder → **"Analyze for Reverse Engineering (Preview)"**
2. Review detected clusters and patterns
3. Confirm to generate specs

**Using chat:**
```
@spec /reverse src/features/authentication
```

This creates:
- `requirements.md` - Inferred requirements from code behavior
- `design.md` - Architecture diagram from actual structure
- `tasks.md` - Documentation tasks for the existing code

### Step 3: Fill the Gaps

Review generated specs and:
1. Refine auto-generated requirements with business context
2. Add missing architectural decisions to design
3. Create tasks for improvements you've identified

### Step 4: Continue with New Features

Now use the standard planning workflow for new development:

```
@spec /plan Add password reset functionality
```

---

## Usage Tips by Scenario

### New Feature Development

**Best approach:** Full planning workflow

```
@spec /plan <feature description>
```

**Workflow:**
1. **Requirements Phase** - Define WHAT the feature does
   - Review generated EARS requirements
   - Add edge cases the AI might have missed
   - Confirm before proceeding to design

2. **Design Phase** - Define HOW it works
   - Review architecture diagrams
   - Check API contracts
   - Verify integration points

3. **Task Phase** - Define implementation steps
   - Tasks are ordered by dependency
   - Each task is atomic (completable in one session)
   - TDD tasks (tests first) are suggested when appropriate

4. **Implementation Phase** - Write code
   ```
   @spec /implement
   ```

**💡 Tips:**
- Be specific in your initial description
- Include constraints: "must work offline", "needs to support 10k users"
- Reference existing features: "similar to the login flow"

---

### Improvements & Refactoring

**Best approach:** Targeted planning with context

```
@spec /plan Refactor UserService to use repository pattern
```

**Workflow:**
1. Let AI analyze the current implementation
2. Review proposed changes in design phase
3. Get atomic refactoring tasks
4. Implement incrementally with tests

**For larger refactors, use reverse engineering first:**
```
@spec /reverse src/services/UserService.ts
```

Then plan improvements on the generated spec:
```
@spec /design Improve the UserService to add caching layer
```

**💡 Tips:**
- Start with a reverse-engineered spec to establish baseline
- Request "backwards compatible" changes when needed
- Ask for migration tasks: "include database migration steps"

---

### Bug Fixes

**Best approach:** Analysis + targeted tasks

**Step 1: Analyze the affected area**
```
@spec /reverse src/features/checkout
```

**Step 2: Describe the bug and get fix tasks**
```
@spec /tasks Fix: Cart total doesn't update when removing items. The issue is in CartContext.tsx where state isn't properly synchronized.
```

**Step 3: Implement with verification**
```
@spec /implement
```

**💡 Tips:**
- Include error messages or stack traces in your description
- Reference the specific file/function if known
- Ask for regression test tasks: "add tests to prevent this bug"

**For quick fixes without full spec:**
```
@spec The removeItem function in CartContext.tsx doesn't trigger a re-render. Help me fix it.
```

---

### Code Analysis & Documentation

**Best approach:** Reverse engineering + status

**Analyze a folder:**
1. Right-click → **"Analyze for Reverse Engineering (Preview)"**
2. View cluster analysis without generating specs

**Generate documentation:**
```
@spec /reverse src/core
```

This creates:
- Architecture documentation with diagrams
- API documentation from code structure
- Dependency maps

**Get project overview:**
```
@spec /status
```

Shows:
- All specs and their completion status
- Task summary across all features
- Active work in progress

**💡 Tips:**
- Use analysis preview to understand code before making changes
- Generate specs for critical modules even if not planning changes
- Keep specs updated as documentation

---

## The @spec Chat Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `/plan` | Full workflow: Requirements → Design → Tasks | `@spec /plan Add user notifications` |
| `/configure` | Initialize or update guideline documents | `@spec /configure` |
| `/status` | Show specs and task progress | `@spec /status` |

### Natural Language Variations

You can also use natural language:

```
@spec Start planning a new payment integration
@spec What's the status of my current work?
@spec Help me implement the next task
@spec Analyze the src/api folder and create specs
```

---

## Sidebar Views

### Specs View
- **Tree structure**: Specs → Requirements/Design/Tasks files
- **Status icons**: Draft, In Progress, Complete
- **Actions**: Open file, Delete spec, Copy ID

### Guidelines View
- **Documents**: AGENTS.md, ARCHITECTURE.md, CONTRIBUTING.md, TESTING.md, SECURITY.md
- **Actions**: Generate from project, Edit document
- **Indicators**: Missing documents highlighted

### Tasks View
- **Grouped by**: Spec → Phase → Individual tasks
- **Status**: Pending, In Progress, Done, Blocked
- **Actions**: Start, Complete, Block, Implement

### Task Actions

| Icon | Action | Description |
|------|--------|-------------|
| ▶️ | Start | Mark task as in-progress |
| ✅ | Done | Mark task as complete |
| ⚠️ | Block | Mark task as blocked |
| 💻 | Implement | Open AI implementation for this task |

---

## Best Practices

### 1. Always Start with Guidelines

Even for small projects, define your tech stack and conventions. This gives the AI crucial context for generating compatible code.

### 2. Plan Before You Code

Resist the urge to jump into implementation. The few minutes spent planning saves hours of refactoring.

```
❌ @spec Write a login form
✅ @spec /plan User authentication with email/password, including session management and remember-me functionality
```

### 3. Review Each Phase

Don't auto-accept generated content. Review and refine:
- **Requirements**: Add business edge cases
- **Design**: Verify architecture decisions
- **Tasks**: Reorder if needed, add missing steps

### 4. Keep Tasks Atomic

Each task should be:
- Completable in one coding session
- Independently testable
- Clearly defined

### 5. Update Specs as You Learn

Specs are living documents. Update them when:
- Requirements change
- You discover edge cases during implementation
- Design decisions evolve

### 6. Use Reverse Engineering for Onboarding

When joining a project or exploring unfamiliar code:
1. Reverse engineer the main folders
2. Review generated specs to understand architecture
3. Use specs as documentation

### 7. Link Related Specs

Reference related features in your planning:

```
@spec /plan Password reset flow (relates to user-authentication spec)
```

---

## Troubleshooting

### "No guidelines found"

**Solution:** Initialize guidelines first
```
@spec /configure
```

### "@spec not responding"

**Check:**
1. GitHub Copilot extension is active
2. You're signed into Copilot
3. Reload VS Code: `Cmd+Shift+P` → "Developer: Reload Window"

### Generated code doesn't match my stack

**Solution:** Update `CONTRIBUTING.md` with specific versions:
```markdown
## Tech Stack
- Node.js 20.x
- TypeScript 5.3
- React 18 with hooks (no class components)
- Prisma 5.x for database
```

### Tasks aren't syncing with sidebar

**Solution:** Click the refresh icon in the Tasks view, or:
```
@spec /status
```

### Reverse engineering creates too many/few clusters

**Adjust by analyzing first:**
1. Right-click → "Analyze for Reverse Engineering (Preview)"
2. Review detected clusters
3. If unsatisfied, manually select smaller/larger folders

---

## File Structure Reference

```
your-project/
├── # Guidelines (repo root)
├── AGENTS.md             # AI agent instructions & product vision
├── ARCHITECTURE.md       # System structure & diagrams
├── CONTRIBUTING.md       # Coding standards & tech stack
├── TESTING.md            # Testing strategy
├── SECURITY.md           # Security policy
│
├── .spec/
│   ├── changes/
│   │   ├── user-authentication/
│   │   │   ├── requirements.md
│   │   │   ├── design.md
│   │   │   └── tasks.md
│   │   │
│   │   └── payment-integration/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       └── tasks.md
│   │
│   └── state.json          # Internal state (auto-managed)
│
└── src/
    └── ... your code
```

---

## Getting Help

- **In-editor:** Use `@spec help` or `@spec What can you do?`
- **Documentation:** This guide
- **Issues:** Report bugs in the project repository

---

*Happy Spec-Driven Development! 🚀*
