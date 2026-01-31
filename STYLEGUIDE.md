<!-- SpecDriven:managed:start -->

# STYLEGUIDE

## Naming Conventions
- Use `camelCase` for variables, parameters, and functions.
- Use `PascalCase` for classes, types, interfaces, and enums.
- Use `UPPER_SNAKE_CASE` for constants that are truly immutable and shared.
- Prefix boolean variables with verbs like `is`, `has`, `can`, `should`.
- File names: `kebab-case.ts` for modules, `PascalCase.tsx` for React components if applicable.
- Avoid abbreviations unless they are domain-standard.

## Code Formatting Rules
- Use TypeScript strict typing; avoid `any` unless justified.
- Prefer `const` over `let`; avoid `var`.
- Use single responsibility functions; keep functions under ~50 lines when practical.
- Keep line length under 100 characters.
- Use trailing commas in multi-line objects/arrays.
- Use explicit return types for public APIs.
- Group related logic into small, named helpers.

## Import/Export Patterns
- Prefer ES module syntax: `import`/`export`.
- Use named exports for most modules; default exports only for single-purpose modules.
- Order imports: external packages, internal packages, relative paths.
- Avoid circular dependencies by keeping module boundaries clear.
- Re-export from barrel files only when it simplifies public API surface.

<!-- SpecDriven:managed:start -->
# STYLEGUIDE

## Naming Conventions
- Use `camelCase` for variables, parameters, and functions.
- Use `PascalCase` for classes, types, interfaces, and enums.
- Use `UPPER_SNAKE_CASE` for shared, immutable constants.
- Prefix booleans with verbs like `is`, `has`, `can`, `should`.
- File names: `kebab-case.ts` for modules; `PascalCase.tsx` for React components (if applicable).
- Avoid abbreviations unless domain-standard.

## Code Formatting Rules
- Use TypeScript strict typing; avoid `any` unless justified.
- Prefer `const` over `let`; avoid `var`.
- Keep functions focused and under ~50 lines when practical.
- Keep line length under 100 characters.
- Use trailing commas in multi-line objects/arrays.
- Use explicit return types for public APIs.
- Group related logic into small, named helpers.

## Import/Export Patterns
- Prefer ES module syntax: `import`/`export`.
- Use named exports for most modules; default exports only for single-purpose modules.
- Order imports: external, internal, relative; separate groups with blank lines.
- Avoid deep import paths; re-export from package entry points.

## Error Handling Patterns
- Use `Error` subclasses for domain-specific failures.
- Fail fast on invalid inputs; return early for guard clauses.
- Preserve root causes when wrapping errors.
- Avoid swallowing errors; log or surface them at module boundaries.

## Design Patterns
- Favor small, composable functions over large classes.
- Use dependency injection for external services and side effects.
- Prefer pure functions for business logic.
- Encapsulate configuration in typed objects with defaults.

## References
- Contribution workflow: CONTRIBUTING.md
- Testing practices: TESTING.md
- Security requirements: SECURITY.md
- Architecture overview: ARCHITECTURE.md
<!-- SpecDriven:managed:end -->
