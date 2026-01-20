# Project Instructions

<!-- SpecDriven Instructions -->
## SpecDriven Development Workflow

This project uses **Spec-Driven Development** with a two-level approach:

### Workflow Order (Critical)

```
[PROJECT LEVEL - Once]        [FEATURE LEVEL - Per Feature]

     Steering         →       Requirements → Design → Tasks → Implementation
        ↓                          ↓           ↓         ↓
    product.md                  EARS       Mermaid    Checkbox
    tech.md                   patterns    diagrams    tasks
    conventions.md              User      Code        with
    testing.md                Stories     Anatomy   traceability
    (code anatomy)
```

**Steering MUST exist before creating feature specs.** Requirements, design, and tasks all depend on the context established in steering documents.

### Planning Phase (Spec Generation)

**Flow A - Steering missing/incomplete/placeholders:**
```
Generate Steering → Requirements → Load/Update Steering → Design → Update Steering? → Tasks
```

**Flow B - Steering exists and complete:**
```
Requirements → Load/Update Steering → Design → Update Steering? → Tasks
```

**Key principle**: Steering is kept **fresh throughout planning**. Design may reveal new patterns that should be captured in steering before generating tasks.

### Implementation Phase

**Task Scope Determines Workflow**

The implementation workflow depends on what the user asks for:

#### Single Leaf Task
When asked to implement a **single task without subtasks** (e.g., "implement task 2.1"):
1. **Verify steering exists** - Stop if missing (run planning first)
2. **Read all context** - Steering + feature spec (design.md, tasks.md)
3. **Mark in-progress** - Change to `- [~]` before starting work
4. **Implement the task** - Follow code anatomy from design.md
5. **Mark complete** - Change to `- [x]` when done
6. **Check parent completion** - If all sibling subtasks are now `[x]`, mark parent as `[x]`
7. **Report and stop**

#### Parent Task or Phase (Autonomous Mode)
When asked to implement a **parent task, phase, or feature** (e.g., "implement phase 2", "implement task 3"):
1. **Verify steering exists** - Stop if missing (run planning first)
2. **Read all context** - Steering + feature spec (design.md, tasks.md)
3. **Identify all subtasks** - Find all child tasks under the requested scope
4. **Implement ALL subtasks autonomously** - Process each without stopping for confirmation
5. **Mark each subtask** - `[~]` when starting, `[x]` when done
6. **Mark parent complete** - After all subtasks are done, mark parent as `[x]`
7. **Report completion summary** - List what was completed

**Parent Completion Rule**: When all subtasks of a parent task are marked `[x]`, the parent task MUST also be marked `[x]`.

**Why scope matters?** When a user explicitly asks for a phase or parent task, they want all work completed. Only stop for confirmation on individual leaf tasks.

Use the `spec-driven-implementation` skill when implementing tasks.

### Project Structure

```
.spec/
├── steering/           # Project-wide guidance (FIRST)
│   ├── product.md      # Product vision
│   ├── tech.md         # Technology stack
│   ├── conventions.md  # Coding conventions & Code Anatomy
│   └── testing.md      # Testing strategy & patterns
└── specs/<feature>/    # Feature specifications (AFTER steering)
    ├── requirements.md # What to build (uses steering context)
    ├── design.md       # How to build it (references tech & anatomy)
    └── tasks.md        # Implementation tasks (follows patterns)
```
<!-- End SpecDriven Instructions -->
