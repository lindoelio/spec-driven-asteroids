---
name: spec-driven-feature
description: Implements a feature using the Spec Driven Asteroids flow (Requirements → Design → Tasks → Code).
---

# Spec Driven Feature Implementation

Follow these steps strictly to ensure high-quality, traceable software
engineering.

## 1. Requirements (The "Asteroid" impact)

- **Action**: Use the `spec-requirements` skill.
- **Goal**: Produce a Markdown requirement using EARS syntax.
- **Validation**: Call `mcp:verify_ears_syntax`.
- **Review**: STOP and ask: "Human, does this requirement accurately reflect
  your intent?"

## 2. Technical Design

- **Action**: Use the `spec-design` skill.
- **Goal**: Create architecture diagrams (Mermaid) and code anatomy.
- **Validation**: Call `mcp:verify_mermaid_syntax`.
- **Review**: STOP and ask the human to review the design decisions.

## 3. Atomic Tasks

- **Action**: Use the `spec-tasks` skill.
- **Goal**: Break the design into numbered implementation tasks.
- **Validation**: Call `mcp:trace_requirements`.
- **Review**: Confirm the task list with the human.

## 4. Implementation

- **Action**: Execute tasks one by one.
- **Traceability**: Reference the Requirement and Design IDs in every commit
  message.
