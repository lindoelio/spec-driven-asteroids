/**
 * Steering Domain Entity
 *
 * Represents project governance documents that guide AI behavior.
 * Templates are loaded from packages/core/src/resources/templates/
 */

import {
    loadSteeringTemplate,
    loadAgentSkillTemplate,
    loadCopilotInstructionsTemplate,
    loadCopilotInstructionsAppend,
} from '../lib/ResourceLoader.js';

/**
 * Configuration for engine-specific skill files.
 * Different AI engines (GitHub Copilot, OpenCode, Codex, Claude Code) have different conventions.
 */
export interface EngineSkillConfig {
    /** The directory path for the skill file (e.g., '.github/skills/spec-driven-implementation') */
    skillDirectory: string;

    /** The skill file name (e.g., 'SKILL.md') */
    skillFileName: string;

    /** The skill name used in the file content */
    skillName: string;

    /** Optional: Path to custom instructions file (e.g., '.github/copilot-instructions.md') */
    customInstructionsPath?: string;
}

/**
 * Collection of steering documents.
 */
export interface SteeringDocs {
    /** Product vision and goals */
    product?: string;

    /** Technology stack and architecture decisions */
    tech?: string;

    /** Architecture guide and diagrams */
    architecture?: string;

    /** Coding conventions and style guide */
    conventions?: string;

    /** Testing strategy and patterns */
    testing?: string;
}

/**
 * Steering paths relative to workspace root.
 */
export const STEERING_PATHS = {
    root: '.spec/steering',
    product: '.spec/steering/product.md',
    tech: '.spec/steering/tech.md',
    architecture: '.spec/steering/architecture.md',
    conventions: '.spec/steering/conventions.md',
    testing: '.spec/steering/testing.md',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Template Getters (Lazy Loading from Resource Files)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the product.md template.
 * Loaded from resources/templates/steering/product.md
 */
export function getProductTemplate(): string {
    return loadSteeringTemplate('product');
}

/**
 * Get the tech.md template.
 * Loaded from resources/templates/steering/tech.md
 */
export function getTechTemplate(): string {
    return loadSteeringTemplate('tech');
}

/**
 * Get the architecture.md template.
 * Loaded from resources/templates/steering/architecture.md
 */
export function getArchitectureTemplate(): string {
    return loadSteeringTemplate('architecture');
}

/**
 * Get the conventions.md template.
 * Loaded from resources/templates/steering/conventions.md
 */
export function getConventionsTemplate(): string {
    return loadSteeringTemplate('conventions');
}

/**
 * Get the testing.md template.
 * Loaded from resources/templates/steering/testing.md
 */
export function getTestingTemplate(): string {
    return loadSteeringTemplate('testing');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy Constants (Deprecated - Use getter functions instead)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use getProductTemplate() instead
 */
export const PRODUCT_TEMPLATE = `# Product Vision

## Overview
<!-- Brief description of the product -->

## Goals
<!-- Key objectives this product aims to achieve -->
-

## Non-Goals
<!-- What this product explicitly does NOT aim to do -->
-

## Target Users
<!-- Who will use this product -->
-
`;

/**
 * @deprecated Use getTechTemplate() instead
 */
export const TECH_TEMPLATE = `# Technology Stack

## Languages
<!-- Primary programming languages -->
-

## Frameworks
<!-- Major frameworks in use -->
-

## Key Libraries
<!-- Important libraries and their versions -->
| Library | Version | Purpose |
|---------|---------|---------|
|         |         |         |

## Architecture
<!-- High-level architecture notes -->

## Build & Deploy
<!-- Build tools, CI/CD, deployment targets -->
-
`;

/**
 * @deprecated Use getConventionsTemplate() instead
 */
export const CONVENTIONS_TEMPLATE = `# Coding Conventions

## Code Style
<!-- Formatting, naming conventions -->
-

## File Organization
<!-- How files and folders should be structured -->
-

## Error Handling
<!-- How errors should be handled -->
-

## Testing
<!-- Testing conventions and requirements -->
-

## Documentation
<!-- Documentation standards -->
-

## Git
<!-- Commit message format, branching strategy -->
-
`;

/**
 * @deprecated Use getTestingTemplate() instead
 */
export const TESTING_TEMPLATE = `# Testing Strategy

## Philosophy
<!-- Core testing principles -->
-

## Test Pyramid
<!-- Distribution of test types -->
| Type | Percentage | Purpose |
|------|------------|---------|
| Unit | | |
| Integration | | |
| E2E | | |

## Frameworks
<!-- Testing frameworks and tools -->
-

## Coverage
<!-- Coverage requirements and targets -->
-

## Patterns
<!-- Testing patterns to follow -->
-

## Anti-Patterns
<!-- Testing patterns to avoid -->
-
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Skill Templates
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Agent Skill template with customizable skill name.
 * Loaded from resources/templates/agent-skill.md
 * @param skillName - The name of the skill (e.g., 'spec-driven-implementation')
 */
export function generateAgentSkillTemplate(skillName: string = 'spec-driven-implementation'): string {
    return loadAgentSkillTemplate(skillName);
}

/**
 * Default Agent Skill template (for backward compatibility).
 * @deprecated Use generateAgentSkillTemplate() instead.
 */
export const AGENT_SKILL_TEMPLATE = generateAgentSkillTemplate();

// ═══════════════════════════════════════════════════════════════════════════════
// Copilot Instructions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Marker to identify SpecDriven instructions in copilot-instructions.md.
 */
export const SPECDRIVEN_INSTRUCTIONS_MARKER = '<!-- SpecDriven Instructions -->';

/**
 * Get the copilot instructions template.
 * Loaded from resources/templates/copilot-instructions.md
 */
export function getCopilotInstructionsTemplate(): string {
    return loadCopilotInstructionsTemplate();
}

/**
 * Get the copilot instructions append section.
 * Loaded from resources/templates/copilot-instructions-append.md
 */
export function getCopilotInstructionsAppend(): string {
    return loadCopilotInstructionsAppend();
}

/**
 * Template for custom instructions file (.github/copilot-instructions.md).
 * @deprecated Use getCopilotInstructionsTemplate() instead.
 */
export const COPILOT_INSTRUCTIONS_TEMPLATE = `# Project Instructions

${SPECDRIVEN_INSTRUCTIONS_MARKER}
## SpecDriven Development Workflow

This project uses **Spec-Driven Development**. Before implementing features:

1. Check \`.spec/steering/\` for product, tech, architecture, conventions, and testing guidance
2. Check \`.spec/specs/<feature>/\` for feature specifications
3. **Use the \`spec-driven-implementation\` skill** when implementing tasks

### Implementation Workflow

When asked to implement tasks, phases, or features:
- Load the \`.github/skills/spec-driven-implementation/SKILL.md\` skill
- Follow its instructions for reading specs and updating task status
- Mark tasks as \`in-progress\` before starting, \`done\` when complete

### Project Structure

\`\`\`
.spec/
├── steering/           # Project-wide guidance
│   ├── product.md       # Product vision
│   ├── tech.md          # Technology stack
│   ├── architecture.md  # Architecture & diagrams
│   ├── conventions.md   # Coding conventions
│   └── testing.md       # Testing strategy
└── specs/<feature>/    # Feature specifications
    ├── requirements.md # What to build
    ├── design.md       # How to build it
    └── tasks.md        # Implementation tasks
\`\`\`
<!-- End SpecDriven Instructions -->
`;

/**
 * Section to append to existing copilot-instructions.md files.
 * @deprecated Use getCopilotInstructionsAppend() instead.
 */
export const COPILOT_INSTRUCTIONS_APPEND = `

${SPECDRIVEN_INSTRUCTIONS_MARKER}
## SpecDriven Development Workflow

This project uses **Spec-Driven Development**. Before implementing features:

1. Check \`.spec/steering/\` for product, tech, architecture, conventions, and testing guidance
2. Check \`.spec/specs/<feature>/\` for feature specifications
3. **Use the \`spec-driven-implementation\` skill** when implementing tasks

### Implementation Workflow

When asked to implement tasks, phases, or features:
- Load the \`.github/skills/spec-driven-implementation/SKILL.md\` skill
- Follow its instructions for reading specs and updating task status
- Mark tasks as \`in-progress\` before starting, \`done\` when complete
<!-- End SpecDriven Instructions -->
`;
