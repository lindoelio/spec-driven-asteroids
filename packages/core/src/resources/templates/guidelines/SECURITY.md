# Security Policy

This document outlines security policies and procedures for this project.

> **Note**: For code style, see [STYLEGUIDE.md](STYLEGUIDE.md). For testing, see [TESTING.md](TESTING.md).

<!-- SpecDriven:managed:start -->

## Reporting a Vulnerability

{{VULNERABILITY_REPORTING}}

## Authentication

{{AUTHENTICATION_REQUIREMENTS}}

## Authorization

{{AUTHORIZATION_REQUIREMENTS}}

## Data Protection

{{DATA_PROTECTION_REQUIREMENTS}}

## Input Validation

{{INPUT_VALIDATION_REQUIREMENTS}}

## Secrets Management

{{SECRETS_MANAGEMENT}}

## Code Review Security Checklist

When reviewing code, verify:

- [ ] No hardcoded secrets or credentials
- [ ] Input validation on all user inputs
- [ ] Proper authentication/authorization checks
- [ ] Secure handling of sensitive data
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Dependencies are up to date
- [ ] Error messages don't leak sensitive information

## AI Agent Security Guidelines

When AI agents contribute code:

- Never include real credentials or API keys
- Always validate and sanitize inputs
- Follow the principle of least privilege
- Use parameterized queries for database operations
- Encrypt sensitive data at rest and in transit
- Log security-relevant events appropriately

## Dependency Management

{{DEPENDENCY_MANAGEMENT}}

<!-- SpecDriven:managed:end -->

## Project-Specific Security Notes

<!-- Add any project-specific security policies below this line -->
