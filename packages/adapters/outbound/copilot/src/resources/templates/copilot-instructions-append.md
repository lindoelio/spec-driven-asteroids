
<!-- SpecDriven Instructions -->
## SpecDriven Development Workflow

This project uses **Spec-Driven Development**. Before implementing features:

1. Check root guidelines: `AGENTS.md`, `CONTRIBUTING.md`, `TESTING.md`, `ARCHITECTURE.md`
2. Check `.spec/changes/<feature>/` for feature specifications
3. **Use the `spec-driven-task-implementer` skill** when implementing tasks

### Available Skills

| Skill | Path | Use When |
|-------|------|----------|
| **Task Implementer** | `.spec/skills/spec-driven-task-implementer/SKILL.md` | Implementing tasks |
| **Requirements Writer** | `.spec/skills/spec-driven-requirements-writer/SKILL.md` | Writing requirements |
| **Technical Designer** | `.spec/skills/spec-driven-technical-designer/SKILL.md` | Creating designs |
| **Task Decomposer** | `.spec/skills/spec-driven-task-decomposer/SKILL.md` | Breaking down tasks |

### Implementation Workflow

When asked to implement tasks, phases, or features:
- Load the `.spec/skills/spec-driven-task-implementer/SKILL.md` skill
- Follow its instructions for reading specs and updating task status
- Mark tasks as `[~]` in-progress before starting, `[x]` when done
<!-- End SpecDriven Instructions -->
