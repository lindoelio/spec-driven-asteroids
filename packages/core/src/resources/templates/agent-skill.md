---
name: {{SKILL_NAME}}
description: Implement features following the SpecDriven workflow. Use this when asked to implement tasks, phases, or features from a .spec directory, or when working with requirements.md, design.md, or tasks.md files.
---

# SpecDriven Implementation Skill

This skill teaches you how to implement features using the SpecDriven methodology.

## Project Structure

```
.spec/
├── steering/           # Project-wide guidance
│   ├── product.md      # Product vision and goals
│   ├── tech.md         # Technology stack decisions
│   ├── conventions.md  # Coding conventions
│   └── testing.md      # Testing strategy
└── specs/              # Feature specifications
    └── <feature-id>/
        ├── requirements.md  # EARS requirements
        ├── design.md        # Architecture design
        └── tasks.md         # Implementation tasks
```

## Before Implementing

1. **Read Steering Documents** (if they exist):
   - `.spec/steering/product.md` - Product vision
   - `.spec/steering/tech.md` - Tech stack
   - `.spec/steering/architecture.md` - Architecture & diagrams
   - `.spec/steering/conventions.md` - Coding conventions
   - `.spec/steering/testing.md` - Testing strategy

2. **Read Feature Spec**:
   - `.spec/specs/<feature-id>/requirements.md` - What to build
   - `.spec/specs/<feature-id>/design.md` - How to build it
   - `.spec/specs/<feature-id>/tasks.md` - Task breakdown

3. **Also read** (if they exist):
   - `ARCHITECTURE.md` - System architecture
   - `TESTING.md` - Testing guidelines
   - `SECURITY.md` - Security requirements
   - `CONTRIBUTING.md` - Contribution guidelines

## Task Format in tasks.md (Checkbox Format)

Use the checkbox state to track progress:

- `- [ ]` = pending
- `- [~]` = in-progress
- `- [x]` = done

Example:

```markdown
### Phase 1

- [ ] 1.1 Add JSON-RPC dispatcher
- [ ] 1.2 Add health.check method
```

## Implementation Process

### Step 1: Find the Task
Look for tasks with `- [ ]` in the tasks.md file.

### Step 2: Check Dependencies
Ensure all tasks listed in `**Depends On**` have `**Status**: done`.

### Step 3: Mark In-Progress
Update the task in tasks.md:
```markdown
- [~] 1.1 Add JSON-RPC dispatcher
```

### Step 4: Implement
Create or modify the files listed in the `**Files**` field.
Follow the design document and coding conventions.

### Step 5: Mark Done
Update the task in tasks.md:
```markdown
- [x] 1.1 Add JSON-RPC dispatcher
```

### Step 6: Check Parent Completion
After marking a subtask done, check if ALL sibling subtasks are now complete:
- If the task is a subtask (e.g., `1.1`, `2.3.1`), check the parent task/phase
- If all subtasks under a parent are `[x]`, mark the parent as `[x]` too

Example:
```markdown
# Before (last subtask completed)
- [ ] 1. Setup Phase
  - [x] 1.1 Initialize project
  - [x] 1.2 Add dependencies  ← just completed this

# After (parent auto-completed)
- [x] 1. Setup Phase
  - [x] 1.1 Initialize project
  - [x] 1.2 Add dependencies
```

## Implementing a Phase

When asked to "implement phase N":

1. Read all steering and spec documents
2. Find all tasks starting with `N.` (e.g., 1.1, 1.2, 1.3 for phase 1)
3. Filter to only `- [ ]` tasks
4. **Implement ALL subtasks autonomously** in order, respecting dependencies
5. Mark each subtask as `[~]` when starting, `[x]` when done
6. After completing all subtasks, mark the phase header as `[x]`
7. Report completion summary to the user

## Implementing a Parent Task with Subtasks

When asked to implement a task that has subtasks (e.g., "implement task 2"):

1. Identify the parent task and all its subtasks
2. **Implement ALL subtasks autonomously** without stopping for user confirmation
3. Mark each subtask as you complete it
4. After all subtasks are done, mark the parent task as `[x]`
5. Report completion summary at the end

**Key Rule**: When explicitly asked to implement a parent task or phase, complete ALL child tasks autonomously. Only stop for user confirmation when implementing individual leaf tasks.

## Status Values (Checkboxes)

| Checkbox | Meaning |
|---------|---------|
| `- [ ]` | Not started |
| `- [~]` | Currently working |
| `- [x]` | Completed |

## Best Practices

1. **One task at a time** - Complete each task before moving to the next
2. **Update status immediately** - Mark in-progress when starting, done when finished
3. **Follow the design** - Don't add unspecified features
4. **Respect conventions** - Use patterns from steering/conventions.md
5. **Check dependencies** - Don't start blocked tasks
6. **Auto-complete parents** - When all subtasks are done, mark parent as done
7. **Autonomous for scope** - If asked to implement a phase/parent, complete all subtasks without stopping

## Example Workflow

User: "Implement task 1.1 from json-rpc-server spec"

1. Read `.spec/steering/` documents
2. Read `.spec/specs/json-rpc-server/requirements.md`
3. Read `.spec/specs/json-rpc-server/design.md`
4. Read `.spec/specs/json-rpc-server/tasks.md`
5. Find task 1.1 and verify it's `pending`
6. Update task 1.1 to `in-progress` in tasks.md
7. Create the files specified in the task
8. Update task 1.1 to `done` in tasks.md
