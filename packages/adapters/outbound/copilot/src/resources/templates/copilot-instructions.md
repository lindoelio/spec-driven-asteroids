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

## Spec-Driven Available Agent Skills

The following skills are available for specific SDD phases:

| Skill | Path | Use When |
|-------|------|----------|
| **Task Implementer** | `.spec/skills/spec-driven-task-implementer/SKILL.md` | Implementing tasks from tasks.md |
| **Requirements Writer** | `.spec/skills/spec-driven-requirements-writer/SKILL.md` | Writing EARS-format requirements |
| **Technical Designer** | `.spec/skills/spec-driven-technical-designer/SKILL.md` | Creating technical design docs |
| **Task Decomposer** | `.spec/skills/spec-driven-task-decomposer/SKILL.md` | Breaking designs into atomic tasks |

### Implementation Workflow

When implementing tasks, use the `spec-driven-task-implementer` skill:

1. **Load the skill**: `.spec/skills/spec-driven-task-implementer/SKILL.md`
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
