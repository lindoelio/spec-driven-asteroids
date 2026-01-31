# GitHub Copilot Project Instructions

## Primary Guidelines

**IMPORTANT:** Before working on any feature or task, always read and follow:

- **AGENTS.md** - Primary AI agent instructions, project vision, and tech stack

This file is the source of truth for how AI agents should behave in this project. It contains:
- Project description and goals
- Technology stack and dependencies
- Coding conventions and patterns
- Architecture decisions

## Spec-Driven Development

This project follows **Spec-Driven Development (SDD)**. Feature specifications are located at:

```
.spec/changes/<feature-id>/
├── requirements.md  # What to build (EARS format)
├── design.md        # How to build it (with Mermaid diagrams)
└── tasks.md         # Implementation tasks (checkbox format)
```

### Implementation Workflow

When implementing tasks, use the `sdd-task-implementer` skill:

1. **Load the skill**: `.github/skills/sdd-task-implementer/SKILL.md`
2. **Read guidelines**: Start with `AGENTS.md` at repository root
3. **Read the feature spec**: Check `.spec/changes/<feature-id>/` for context
4. **Mark task status**: Update `tasks.md` with `[~]` when starting, `[x]` when done

### Task Status Format

```markdown
- [ ] Pending task
- [~] In-progress task
- [x] Completed task
```

### Key Principle

Always read `AGENTS.md` first - it provides the project context and conventions that all AI agents must follow.


<!-- SpecDriven Instructions -->
## SpecDriven Development Workflow

This project uses **Spec-Driven Development**. Before implementing features:

1. Check root guidelines: `AGENTS.md`, `CONTRIBUTING.md`, `TESTING.md`, `ARCHITECTURE.md`
2. Check `.spec/changes/<feature>/` for feature specifications
3. **Use the `sdd-task-implementer` skill** when implementing tasks

### Implementation Workflow

When asked to implement tasks, phases, or features:
- Load the `.github/skills/sdd-task-implementer/SKILL.md` skill
- Follow its instructions for reading specs and updating task status
- Mark tasks as `[~]` in-progress before starting, `[x]` when done
<!-- End SpecDriven Instructions -->
