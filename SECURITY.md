<!-- SpecDriven:managed:start -->
# SECURITY

## Authentication Requirements
- Use centralized identity providers where available.
- Enforce strong password policies or SSO with MFA.
- Require short-lived tokens and rotate on compromise.
- Log authentication events without storing credentials.

## Authorization Requirements
- Implement least-privilege access controls for all services.
- Validate authorization on every request to protected resources.
- Separate roles for administrative and operational access.
- Deny by default when access cannot be verified.

## Data Protection Policies
- Classify data and apply protection based on sensitivity.
- Encrypt sensitive data in transit and at rest.
- Minimize data retention and remove stale data promptly.
- Avoid logging sensitive fields; apply redaction where required.

## Vulnerability Handling
- Triage security reports promptly and track remediation.
- Patch critical vulnerabilities with highest priority.
- Validate third-party dependency risks during updates.
- Document security-impacting changes in release notes.

## Secrets Management
- Store secrets in approved secret managers only.
- Prohibit secrets in source control and build artifacts.
- Rotate secrets on a defined schedule and after exposure.
- Restrict access to secrets by role and service identity.

## References
- Code style: STYLEGUIDE.md
- Testing practices: TESTING.md
- Architecture overview: ARCHITECTURE.md
- Contribution workflow: CONTRIBUTING.md
<!-- SpecDriven:managed:end -->
