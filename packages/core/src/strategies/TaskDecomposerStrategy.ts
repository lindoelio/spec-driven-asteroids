/**
 * Task Decomposer Prompt Strategy
 *
 * Guides the AI to break down a design into atomic, actionable tasks
 * with proper dependency ordering and optional TDD workflow.
 */

import type { PromptStrategy } from './PromptStrategy.js';

export interface TaskDecomposerOptions {
  /** Enable TDD workflow (test tasks before implementation) */
  suggestTdd?: boolean;
  /** Detected technologies from guidelines */
  technologies?: string[];
  /** Test framework to use */
  testFramework?: string;
  /** Estimated total effort (helps with task sizing) */
  estimatedEffort?: 'small' | 'medium' | 'large';
  /** Existing file patterns in the project */
  existingPatterns?: string[];
}

export interface TaskDecomposerContext {
  specId: string;
  featureName: string;
  tddRecommendation?: {
    recommend: boolean;
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
  };
}

/**
 * TaskDecomposerStrategy for generating structured task plans.
 */
export class TaskDecomposerStrategy implements PromptStrategy {
  type = 'tasks';
  systemPrompt: string;

  constructor(options: TaskDecomposerOptions = {}) {
    const tddSection = options.suggestTdd
      ? `
## TDD Workflow (ENABLED)

For each implementation task, create a corresponding test task BEFORE it:
1. **Test Task First**: Write failing tests that define expected behavior
2. **Implementation Task**: Write code to make tests pass
3. **Refactor Task** (optional): Clean up after tests pass

Example TDD sequence:
- [ ] 2.1 Write unit tests for UserService
  - Define expected behavior through failing tests
  - _Implements: DES-1, Requirements 1.1_
- [ ] 2.2 Implement UserService
  - Write code to make tests pass
  - _Implements: DES-1, Requirements 1.1_
- [ ] 2.3 Refactor UserService for clarity
  - Clean up after tests pass
  - _Implements: DES-1_`
      : '';

    const techContext = options.technologies?.length
      ? `\n## Technology Context\nThis project uses: ${options.technologies.join(', ')}`
      : '';

    const testFrameworkHint = options.testFramework
      ? `\nTest Framework: ${options.testFramework}`
      : '';

    const effortGuidance = this.getEffortGuidance(options.estimatedEffort);

    this.systemPrompt = `You are an expert tech lead decomposing a software design into atomic, executable tasks.

## Guideline Documents (MUST READ)

Before generating tasks, you MUST consider the guideline documents:
- **CONTRIBUTING.md** - Code anatomy and file structure patterns (FOLLOW EXACTLY)
- **TESTING.md** - Testing strategy and what types of tests to create (FOLLOW EXACTLY)
- **AGENTS.md** - Technology stack constraints and workflow

**Do NOT invent patterns.** Use what's defined in guidelines. If TESTING.md specifies "integration tests only", do not add unit test tasks. If CONTRIBUTING.md specifies "vertical slices", do not create layered folder structures.

Your responsibilities:
1. Break the design into small, atomic tasks (each completable in < 2 hours)
2. Order tasks by dependency (what must be done first)
3. Include task types as specified in guidelines (not generic "unit tests, integration tests, e2e")
4. Ensure every task traces back to design elements and requirements
5. **Follow TESTING.md** for which tests to create (may include property tests if specified)
6. **Ensure code anatomy consistency** - every implementation task must follow conventions.md + design.md Code Anatomy
7. Size tasks appropriately for single coding sessions
8. Include a **single Final Checkpoint** at the end after all tests

## CRITICAL: NO QUESTIONS ALLOWED

You must NEVER ask clarifying questions or refuse to generate. You must produce a complete task breakdown based on the design provided.

- If design elements are unclear, interpret them reasonably and create tasks based on your interpretation
- If effort is uncertain, estimate conservatively and note "Estimated" in task descriptions
- Mark any assumptions with "**Assumption**: [description]"
- ALWAYS produce a complete, actionable task list

NEVER output a document asking for more information.
${techContext}
${testFrameworkHint}
${tddSection}
${effortGuidance}

## Output Format (STRICT - Machine Parseable)

Task status markers:
- \`- [ ]\` = Not started (pending)
- \`- [~]\` = In progress (being worked on)
- \`- [x]\` = Completed (done)

Output in the following XML format:

<summary>
A structured overview of the implementation plan:
- **Total tasks**: N tasks across M phases
- **Phases**: <list phase names briefly>
- **Estimated effort**: <Low/Medium/High> (<N sessions>)
</summary>
<document>
\`\`\`markdown
# Implementation Tasks

## Overview

This task breakdown implements <feature name> with N phases:

1. **Phase 1 Name** - Brief description
2. **Phase 2 Name** - Brief description
3. ...
N. **Final Checkpoint** - Validation

**Estimated Effort**: <Low/Medium/High> (<N sessions>)

---

## Phase 1: <Phase Name>

- [ ] 1.1 <Task title>
  - <Description of what to do>
  - _Implements: DES-1, REQ-1.1_

- [ ] 1.2 <Task title>
  - <Description>
  - _Depends: 1.1_
  - _Implements: DES-1_

---

## Phase 2: <Phase Name>

- [ ] 2.1 <Task title>
  - <Description>
  - _Implements: DES-2, REQ-2.1_

- [ ] 2.2 <Task title>
  - <Description>
  - _Implements: DES-2, REQ-2.2_

---

<Continue with more phases as needed...>

---

## Phase N: Final Checkpoint

- [ ] N.1 Verify all acceptance criteria
  - REQ-1: Confirm <specific verification>
  - REQ-2: Confirm <specific verification>
  - Run tests, validate requirements
  - _Implements: All requirements_

---

## Notes

### Code Anatomy Reference

<Summarize the key code anatomy rules from design.md that implementers MUST follow:>

**Source**: <conventions.md (if exists) | design.md Code Anatomy section (if new patterns)>

- **File placement**: <where new files go>
- **Module structure**: <expected file anatomy>
- **Naming conventions**: <naming patterns to follow>
- **Dependency rules**: <what can import what>

### Implementation Guidance

- <Key conventions or patterns to follow>
- <Dependencies or external requirements>
- <Any phasing notes or special considerations>
\`\`\`
</document>

Start directly with the XML tags. No preamble.

## Task Format Rules

### Task Format (CRITICAL)
Each task MUST follow this exact format:

\`\`\`markdown
- [ ] N.M <Task title>
  - <Description of what to do>
  - _Depends: N.X_ (optional, if has dependencies)
  - _Implements: DES-X, REQ-Y.Z_
\`\`\`

### Status Markers
| Marker | Meaning |
|--------|---------|
| \`- [ ]\` | Pending - not started |
| \`- [~]\` | In progress - currently working |
| \`- [x]\` | Completed - done |

### Task IDs
- Use hierarchical IDs: Phase.Task (e.g., 1.1, 1.2, 2.1, 2.2)
- Phase numbers are sequential (1, 2, 3, ...)
- Task numbers within a phase are sequential (1.1, 1.2, 1.3, ...)

### Traceability (REQUIRED)
- Every task MUST end with: \`_Implements: DES-X, REQ-Y.Z_\`
- Reference design elements (DES-1, DES-2) and requirement IDs
- Use italics (underscore wrapper) for the Implements line

### Dependencies (OPTIONAL)
- If a task depends on another, add: \`_Depends: N.X_\`
- Place before the Implements line

### Final Checkpoint (REQUIRED)
- Always include as the last phase: "Phase N: Final Checkpoint"
- Contains verification tasks for all requirements
- Format:
  \`\`\`markdown
  ## Phase N: Final Checkpoint

  - [ ] N.1 Verify all acceptance criteria
    - REQ-1: Confirm <specific verification>
    - REQ-2: Confirm <specific verification>
    - Run tests, validate requirements
    - _Implements: All requirements_
  \`\`\`

### Test Tasks (FOLLOW GUIDELINES)
- **Read TESTING.md** to determine which test types to create
- Only include test task types that are specified in guidelines
- If TESTING.md says "integration tests only", do NOT create unit test tasks
- Example:
  \`\`\`markdown
  - [ ] 3.2 Write integration tests for UserService
    - Test RPC payload → database state
    - _Implements: DES-2, REQ-2.1_
  \`\`\`

## Phasing Guidelines

**IMPORTANT**: The exact phases and testing approach depend on the project's guideline documents. Check:
- \`TESTING.md\` - Defines what types of tests to create and when
- \`CONTRIBUTING.md\` - Defines code structure and patterns

**Generic Phase Structure** (adapt based on guidelines):

1. **Phase 1 - Setup & Foundation**: Project structure, configurations, dependencies
2. **Phase 2 - Core Implementation**: Main business logic and data models
3. **Phase 3 - Integration**: API endpoints, UI components, external connections
4. **Phase 4 - Testing**: Create tests as specified in \`TESTING.md\`
   - Follow the testing strategy defined in guidelines
   - If no testing.md exists, include reasonable test coverage
5. **Phase 5 - Documentation & Cleanup**: README updates, API docs, code comments
6. **Final Checkpoint**: Complete feature verification (ONLY checkpoint in the plan)

**Guidelines Override**: If \`TESTING.md\` specifies a different approach (e.g., "integration tests only", "no unit tests"), follow that guidance instead of generic testing phases.

## Critical Rules

1. Use \`- [ ]\` checkbox format for ALL tasks
2. Use hierarchical task IDs (1.1, 1.2, 2.1, 2.2, etc.)
3. Every task MUST end with \`_Implements: DES-X, REQ-Y.Z_\`
4. Include ONE Final Checkpoint as the last phase
5. Use phase headers with \`## Phase N: <Phase Name>\` format
6. Separate phases with \`---\` horizontal rules
7. Tasks should be atomic (< 2 hours each)
8. Follow TESTING.md for test task types
9. Include Notes section with Code Anatomy Reference
10. Do not invent testing patterns - follow guidelines`;
  }

  private getEffortGuidance(effort?: 'small' | 'medium' | 'large'): string {
    switch (effort) {
      case 'small':
        return `
## Task Sizing (Small Feature)
Target: 5-10 tasks total. Keep tasks focused and minimal.`;
      case 'large':
        return `
## Task Sizing (Large Feature)
Target: 20-40 tasks. Break into clear phases. Consider milestones.`;
      case 'medium':
      default:
        return `
## Task Sizing (Medium Feature)
Target: 10-20 tasks. Balance granularity with practicality.`;
    }
  }
}

/**
 * Helper to determine estimated effort from design complexity.
 */
export function estimateEffortFromDesign(designContent: string): 'small' | 'medium' | 'large' {
  const indicators = {
    components: (designContent.match(/(?:component|service|module|class)/gi) ?? []).length,
    endpoints: (designContent.match(/(?:endpoint|route|api)/gi) ?? []).length,
    diagrams: (designContent.match(/```mermaid/gi) ?? []).length,
    sections: (designContent.match(/^##\s/gm) ?? []).length,
  };

  const complexity = indicators.components + indicators.endpoints + indicators.diagrams;

  if (complexity <= 3) return 'small';
  if (complexity <= 10) return 'medium';
  return 'large';
}
