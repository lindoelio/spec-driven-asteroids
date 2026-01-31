<!-- SpecDriven:managed:start -->
# CONTRIBUTING

## Git Workflow
- Use a short-lived branch for each change.
- Sync with the default branch before opening a PR.
- Keep changes small and focused to reduce risk.

## Branch Naming
Use:
- `type/short-description`

Examples:
- `feat/add-config-loader`
- `fix/handle-null-input`
- `chore/update-deps`

## Commit Message Format
Use:
- `type(scope): summary`

Guidance:
- Use imperative mood.
- Keep the summary concise and specific.

Examples:
- `feat(core): add workspace resolver`
- `fix(api): handle empty payload`
- `chore(ci): update pnpm cache key`

## PR Process
- Open a PR early for visibility.
- Describe intent, scope, and impact.
- Link related issues or work items.
- Ensure required checks pass before requesting review.

## Code Review Process
- At least one reviewer approval is required.
- Address feedback promptly and document key decisions.
- Prefer incremental updates over large rewrites.

## References
- Code style: STYLEGUIDE.md
- Testing: TESTING.md
- Architecture: ARCHITECTURE.md
- Security: SECURITY.md
<!-- SpecDriven:managed:end -->
