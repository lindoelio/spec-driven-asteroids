<!-- SpecDriven:managed:start -->
# TESTING

## Test Philosophy
- Prioritize fast, reliable feedback to support safe incremental change.
- Favor deterministic tests with clear, actionable failures.
- Optimize for maintainability over exhaustive scenario coverage.

## Test Types and When to Use Each
- **Unit tests**: Pure functions, isolated logic, and edge cases.
- **Integration tests**: Package boundaries, workspace interactions, and TypeScript build outputs.
- **End-to-end tests**: Critical user workflows across packages in realistic environments.
- **Regression tests**: Focused reproductions added alongside bug fixes.

## Coverage Expectations
- Cover critical paths and error handling in all packages.
- Ensure new or changed logic has direct tests.
- Use risk-based focus; avoid low-value tests that only inflate coverage.

## Test Organization
- Keep tests close to source within each package.
- Mirror source structure for easy navigation.
- Separate fast unit tests from slower integration/e2e suites.

## Test Frameworks
- Use the standard TypeScript/JavaScript testing stack defined by package tooling.
- Prefer a single runner per test type for consistency.

## References
- Code style: STYLEGUIDE.md
- Contribution workflow: CONTRIBUTING.md
- Architecture overview: ARCHITECTURE.md
- Security requirements: SECURITY.md
<!-- SpecDriven:managed:end -->
