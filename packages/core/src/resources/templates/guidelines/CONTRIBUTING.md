# Contributing

Guidelines for contributing to this project.

> **Note**: For code style, see [STYLEGUIDE.md](STYLEGUIDE.md). For testing, see [TESTING.md](TESTING.md).

<!-- SpecDriven:managed:start -->

## Quick Links

| Document | Purpose |
|----------|---------|
| [STYLEGUIDE.md](STYLEGUIDE.md) | Naming conventions, code patterns, formatting |
| [TESTING.md](TESTING.md) | Testing strategy and patterns |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and ADRs |
| [SECURITY.md](SECURITY.md) | Security policies |

## Development Setup

{{SETUP_INSTRUCTIONS}}

## Git Workflow

### Branch Naming

**Pattern**: `<type>/<issue-id>-<short-description>`

| Type | Use Case | Example |
|------|----------|---------|
| `feature/` | New features | `feature/PROJ-123-user-auth` |
| `fix/` | Bug fixes | `fix/PROJ-456-login-error` |
| `refactor/` | Code improvements | `refactor/cleanup-utils` |
| `docs/` | Documentation | `docs/update-readme` |
| `chore/` | Maintenance | `chore/update-deps` |

### Commit Messages

**Format**: `<type>(<scope>): <description>`

```
feat(auth): add OAuth2 login support

- Implement Google OAuth provider
- Add token refresh logic
- Update user model with provider field

Closes #123
```

**Types**:
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting (no code change) |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Pull Request Process

{{PR_GUIDELINES}}

**PR Checklist**:
- [ ] Code follows style guide (see [STYLEGUIDE.md](STYLEGUIDE.md))
- [ ] Tests added/updated (see [TESTING.md](TESTING.md))
- [ ] Documentation updated if needed
- [ ] No console.log or debug code
- [ ] Self-reviewed the diff

## Code Review

{{REVIEW_PROCESS}}

**Review Focus Areas**:
1. **Correctness**: Does it do what it should?
2. **Tests**: Are edge cases covered?
3. **Style**: Follows conventions? (see [STYLEGUIDE.md](STYLEGUIDE.md))
4. **Security**: Any vulnerabilities? (see [SECURITY.md](SECURITY.md))
5. **Performance**: Any bottlenecks?

<!-- SpecDriven:managed:end -->

## Project-Specific Guidelines

<!-- Add any project-specific contribution guidelines below this line -->
