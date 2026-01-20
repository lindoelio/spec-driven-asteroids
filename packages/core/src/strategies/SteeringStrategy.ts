/**
 * Steering Prompt Strategy
 *
 * Guides the AI to generate steering documents based on project analysis.
 * Loads opinionated defaults from resource files instead of hardcoding them.
 */

import type { PromptStrategy } from './PromptStrategy.js';
import { loadDefault } from '../lib/ResourceLoader.js';


const AGENTIC_MONOREPO_DEFAULTS = `
## PREFERRED STACK: "The Agentic Monorepo"

If the project appears to be a new App or the user asks for a full stack app without specifying details, PREFER this structure:

### 1. Technology Stack
- **Runtime**: Node.js v24+ (LTS)
- **Language**: TypeScript (Strict Mode)
- **Monorepo Manager**: Turborepo + pnpm workspaces
- **Frontend**: SvelteKit (Svelte 5)
- **Protocol**: JSON-RPC 2.0 (Transport Agnostic)
- **Database**: Prisma (v5.x) + SQLite (dev) / Postgres (prod)
- **Validation**: Zod (v3.x)
- **Testing**:
  - Backend: node:test (Native)
  - Frontend: Playwright (E2E)

### 2. Architecture: The "Safe-Boundary" Monorepo
- **packages/contract**: Shared Types & Zod Schemas (Available to ALL)
- **packages/core**: Business Logic & DB (Backend ONLY)
- **apps/http-api**: HTTP Gateway (Imports core)
- **apps/web**: Svelte Frontend (Imports contract ONLY)

### 3. Critical Rules
- **No Frameworks**: Do not install Express, Fastify, or NestJS. Use native Node http.
- **Vertical Slices**: Organize code by Feature, not technical layer.
  - \`src/modules/user/user.methods.ts\` (Logic)
  - \`src/modules/user/user.test.ts\` (Tests)
- **Browser Boundary**: \`apps/web\` must NEVER import from \`@my/core\`.
`;

export interface SteeringStrategyOptions {
    /** Type of steering document to generate */
    steeringType: 'tech' | 'conventions' | 'product' | 'testing' | 'architecture';
    /** Project analysis data */
    projectAnalysis: ProjectAnalysisContext;
    /** User inquiry or intent for the product/feature */
    userInquiry?: string;
    /** Requirements content if available */
    requirements?: string;
    /** Existing steering documents for context */
    existingSteering?: {
        product?: string;
        tech?: string;
        architecture?: string;
        conventions?: string;
        testing?: string;
    };
}

export interface ProjectAnalysisContext {
    languages: string[];
    frameworks: string[];
    dependencies: { name: string; version: string; purpose?: string }[];
    devDependencies: { name: string; version: string; purpose?: string }[];
    buildTools: string[];
    testFrameworks: string[];
    linters: string[];
    packageManager: string | null;
    /** Sample code snippets for convention inference */
    codeSnippets?: string[];
    /** Project structure overview */
    projectStructure?: string;
}

/**
 * SteeringStrategy for AI-generated steering documents.
 * Defaults are loaded from packages/core/src/resources/templates/steering/*.md
 */
export class SteeringStrategy implements PromptStrategy {
    type = 'steering';
    systemPrompt: string;

    constructor(options: SteeringStrategyOptions) {
        const { steeringType, projectAnalysis, existingSteering, userInquiry, requirements } = options;

        const analysisContext = this.formatAnalysisContext(projectAnalysis);

        switch (steeringType) {
            case 'tech':
                this.systemPrompt = this.buildTechPrompt(analysisContext, existingSteering, requirements);
                break;
            case 'conventions':
                this.systemPrompt = this.buildConventionsPrompt(analysisContext, projectAnalysis, existingSteering, requirements);
                break;
            case 'product':
                this.systemPrompt = this.buildProductPrompt(analysisContext, existingSteering, userInquiry);
                break;
            case 'testing':
                this.systemPrompt = this.buildTestingPrompt(analysisContext, projectAnalysis, existingSteering, requirements);
                break;
            case 'architecture':
                this.systemPrompt = this.buildArchitecturePrompt(analysisContext, existingSteering, requirements);
                break;
        }
    }

    private formatAnalysisContext(analysis: ProjectAnalysisContext): string {
        const sections: string[] = [];

        if (analysis.languages.length > 0) {
            sections.push(`**Languages**: ${analysis.languages.join(', ')}`);
        }
        if (analysis.frameworks.length > 0) {
            sections.push(`**Frameworks**: ${analysis.frameworks.join(', ')}`);
        }
        if (analysis.buildTools.length > 0) {
            sections.push(`**Build Tools**: ${analysis.buildTools.join(', ')}`);
        }
        if (analysis.testFrameworks.length > 0) {
            sections.push(`**Test Frameworks**: ${analysis.testFrameworks.join(', ')}`);
        }
        if (analysis.linters.length > 0) {
            sections.push(`**Linters/Formatters**: ${analysis.linters.join(', ')}`);
        }
        if (analysis.packageManager) {
            sections.push(`**Package Manager**: ${analysis.packageManager}`);
        }
        if (analysis.dependencies.length > 0) {
            const depList = analysis.dependencies.slice(0, 10)
                .map(d => `- ${d.name}@${d.version}${d.purpose ? ` (${d.purpose})` : ''}`)
                .join('\n');
            sections.push(`**Key Dependencies**:\n${depList}`);
        }
        if (analysis.projectStructure) {
            sections.push(`**Project Structure**:\n\`\`\`\n${analysis.projectStructure}\n\`\`\``);
        }

        return sections.join('\n\n');
    }

    /**
     * Load opinionated defaults from resource file.
     */
    private loadDefaults(type: 'tech' | 'conventions' | 'product' | 'testing' | 'architecture'): string {
        try {
            return loadDefault(type);
        } catch {
            // Fallback to empty string if resource not found
            return '';
        }
    }

    private buildTechPrompt(analysisContext: string, existingSteering?: { product?: string }, requirements?: string): string {
        const productContext = existingSteering?.product
            ? `\n\n## Product Context\n${existingSteering.product.slice(0, 1500)}`
            : '';

        const reqContext = requirements
            ? `\n\n## Requirements Context\n${requirements.slice(0, 1500)}`
            : '';

        const defaults = this.loadDefaults('tech');

        return `You are a senior software architect creating a Technology Stack document (tech.md) for a development team.

## Project Analysis
${analysisContext}
${productContext}
${reqContext}

## OPINIONATED DEFAULTS (Use for Gaps)

${defaults}

${AGENTIC_MONOREPO_DEFAULTS}

## Your Task

Generate a comprehensive **tech.md** steering document. **Priority order:**
1. **Detected values** from project analysis (highest priority)
2. **User-provided values** in existing steering (if updating)
3. **Agentic Monorepo Defaults** (if requirements suggest a full-stack app and project is empty)
4. **Opinionated defaults** (only for gaps)

Include:

### 1. Technology Overview
- Primary languages and their versions
- Core frameworks and why they were chosen
- Runtime environment (Node.js version, Python version, etc.)

### 2. Architecture Pattern
- Describe the architectural pattern (e.g., Hexagonal, MVC, Microservices)
- Key design principles followed
- Layer organization

### 3. Key Libraries & Their Roles
Create a table with:
| Library | Version | Purpose | Documentation |
|---------|---------|---------|---------------|

### 4. Build & Development
- Build tooling and commands
- Development workflow
- Local setup requirements

### 5. Testing Strategy
- Test frameworks and their purposes
- Test organization (unit, integration, e2e)
- Coverage expectations

### 6. Infrastructure & Deployment
- Target deployment environment
- CI/CD considerations
- Environment configuration approach

## Output Format

Output in the following XML format:

<summary>
A brief summary of the technology stack choices and analysis.
</summary>
<document>
\`\`\`markdown
# Technology Stack
... content ...
\`\`\`
</document>

Start directly with the XML tags. No preamble.

## CRITICAL: NO QUESTIONS ALLOWED

You must NEVER ask clarifying questions or refuse to generate. Produce a complete document based on the analysis provided.
- If versions are unclear, use "latest" or detected versions
- If architecture is unclear, infer from folder structure and file organization
- Mark assumptions with "**Inferred**: [rationale]"
- ALWAYS produce actionable content, never ask for more information

Make the document actionable and specific to this project. Include version numbers where detected.
Do NOT include generic placeholders - use actual detected values or omit the section.`;
    }

    private buildConventionsPrompt(
        analysisContext: string,
        analysis: ProjectAnalysisContext,
        existingSteering?: { tech?: string },
        requirements?: string
    ): string {
        const techContext = existingSteering?.tech
            ? `\n\n## Tech Stack Context\n${existingSteering.tech.slice(0, 1000)}`
            : '';

        const codeContext = analysis.codeSnippets?.length
            ? `\n\n## Code Samples from Project\n${analysis.codeSnippets.slice(0, 3).map((s, i) => `### Sample ${i + 1}\n\`\`\`\n${s.slice(0, 500)}\n\`\`\``).join('\n\n')}`
            : '';

        const reqContext = requirements
            ? `\n\n## Requirements Context\n${requirements.slice(0, 1500)}`
            : '';

        const defaults = this.loadDefaults('conventions');

        return `You are a senior developer creating a Coding Conventions document (conventions.md) based on an existing codebase.

## Project Analysis
${analysisContext}
${techContext}
${reqContext}
${codeContext}

## OPINIONATED DEFAULTS (Use for Gaps)

${defaults}

${AGENTIC_MONOREPO_DEFAULTS}

## Your Task

Analyze the project and generate a **conventions.md** that documents the project's coding conventions AND code anatomy.

**Priority order:**
1. **Detected patterns** from code samples (highest priority - preserve existing patterns)
2. **User-provided conventions** in existing steering (if updating)
3. **Agentic Monorepo Defaults** (if requirements suggest a full-stack app and project is empty)
4. **Opinionated defaults** (only for gaps)

**Your approach depends on the project state:**
- **Existing Codebase**: Reverse-engineer and document the ACTUAL patterns found. Only use defaults for sections with no detected patterns.
- **New Project**: If this is a new app, prefer the "Agentic Monorepo" vertical slices structure.

## Output Format

Output in the following XML format:

<summary>
A brief summary of the conventions inferred and documented.
</summary>
<document>
\`\`\`markdown
# Coding Conventions

## 1. Code Anatomy

Code anatomy defines the structural patterns that every file and component must follow. This ensures consistency across all implementations, whether by humans or AI agents.

### 1.1 File Structure Patterns

<For each major file type, document the expected anatomy>

### 1.2 Module Organization

| Layer/Category | Location | Naming | Purpose |
|----------------|----------|--------|---------|
| <layer> | <path pattern> | <naming convention> | <responsibility> |

### 1.3 Error Handling

<Document error handling patterns - this is CRITICAL for consistency>

## 2. Code Style

### 2.1 Formatting
- Indentation: <tabs/spaces, count>
- Line length: <max characters>

### 2.2 Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files | <convention> | <example> |

### 2.3 Import Organization
<Document the import order>

## 3. Patterns & Practices

### 3.1 Error Handling
- How errors are created
- How errors are propagated
- Error types location

### 3.2 Async Patterns
### 3.3 State Management

## 4. Testing Conventions
## 5. Documentation
## 6. Git Conventions
\`\`\`
</document>

Start directly with the XML tags. No preamble.

## CRITICAL: NO QUESTIONS ALLOWED

You must NEVER ask clarifying questions or refuse to generate. Produce a complete document based on the analysis provided.
- If patterns are unclear, infer from code samples or propose best practices for the stack
- If structure is unclear, propose a reasonable structure based on the detected frameworks
- Mark assumptions with "**Inferred**: [rationale]" or "**Proposed**: [rationale]"
- ALWAYS produce actionable content, never ask for more information

## CRITICAL Instructions

### For EXISTING Codebases (Reverse Engineering)

1. **Code Anatomy is Priority #1**: The Code Anatomy section must be detailed and specific.
2. **Error Handling is Priority #2**: Document how errors are created, propagated, and handled.
3. **Infer from Evidence**: Use detected linters, frameworks, and code samples.
4. **Be Specific**: Include actual paths, actual naming patterns, actual structures.
5. **Preserve Existing Patterns**: Even if patterns aren't "optimal", document what EXISTS.

### For NEW Projects (Defining Optimal Patterns)

If no code samples are available or this is a greenfield project:

1. **Define Optimal Anatomy**: Based on the detected stack, recommend industry best practices.
2. **Include Error Handling**: Use the error handling patterns from the defaults.
3. **Prioritize Maintainability**: Structure code for readability, testability, reusability.`;
    }

    private buildProductPrompt(analysisContext: string, existingSteering?: { tech?: string }, userInquiry?: string): string {
        const techContext = existingSteering?.tech
            ? `\n\n## Detected Tech Stack\n${existingSteering.tech.slice(0, 800)}`
            : '';

        const defaults = this.loadDefaults('product');
        const userContext = userInquiry
            ? `\n\n## User Inquiry / Intent\n"${userInquiry}"\n\n(Use this as the PRIMARY source for Product Vision, Problem Statement, and Features)`
            : '';

        return `You are a product manager creating a Product Vision document (product.md) for a development project.

## Project Analysis
${analysisContext}
${techContext}
${userContext}

## PRODUCT VISION EXAMPLE/TEMPLATE

${defaults}

## Your Task

Create a **product.md** that defines the product vision.

**Priority order:**
1. **User Inquiry / Intent** (if provided above - PRIMARY SOURCE)
2. **User-provided vision** (if they describe the product in the intent)
3. **Inferred from project structure** (what the code suggests)
4. **Inferred from general knowledge and context** (only for gaps)

Include:

### 1. Vision Statement
Summarize the overall vision
<!-- REVIEW: Placeholder for the team to fill -->

### 2. Problem Statement
Define/infer the core problem the product aims to solve
<!-- REVIEW: Placeholder for the team to fill -->

### 3. Target Users
Suggest likely user types
<!-- REVIEW: Placeholder for the team to fill -->

### 4. Key Features
Suggest overall features based on detected patterns

### 5. Success Metrics
Suggest measurable success criteria

### 6. Constraints & Assumptions
Document technical constraints based on analysis:
- Runtime/Platform constraints
- Integration requirements
- Performance expectations

## Output Format

Output in the following XML format:

<summary>
A brief summary of the product vision and structure generated.
</summary>
<document>
\`\`\`markdown
# Product Vision
... content ...
\`\`\`
</document>

Start directly with the XML tags. No preamble.

## CRITICAL: NO QUESTIONS ALLOWED

You must NEVER ask clarifying questions or refuse to generate. Produce a complete document template with reasonable defaults.
- Fill in what can be inferred from the project structure and dependencies
- Mark sections that need human input with <!-- REVIEW: --> comments
- ALWAYS produce a complete document structure, never ask for more information

Mark sections that need human input with <!-- REVIEW: --> comments.
Fill in technical constraints based on detected technologies.`;
    }

    private buildTestingPrompt(
        analysisContext: string,
        analysis: ProjectAnalysisContext,
        existingSteering?: { tech?: string; conventions?: string },
        requirements?: string
    ): string {
        const techContext = existingSteering?.tech
            ? `\n\n## Tech Stack Context\n${existingSteering.tech.slice(0, 1000)}`
            : '';

        const conventionsContext = existingSteering?.conventions
            ? `\n\n## Conventions Context\n${existingSteering.conventions.slice(0, 1000)}`
            : '';

        const reqContext = requirements
            ? `\n\n## Requirements Context\n${requirements.slice(0, 1500)}`
            : '';

        const testFrameworksDetected = analysis.testFrameworks.length > 0
            ? `\n\n**Detected Test Frameworks**: ${analysis.testFrameworks.join(', ')}`
            : '';

        const defaults = this.loadDefaults('testing');

        return `You are a senior QA engineer creating a Testing Strategy document (testing.md) for a development team.

## Project Analysis
${analysisContext}${techContext}${conventionsContext}${reqContext}${testFrameworksDetected}

## OPINIONATED DEFAULTS (Use for Gaps)

${defaults}

${AGENTIC_MONOREPO_DEFAULTS}

## Your Task

Create a **testing.md** that defines the testing strategy.

**Priority order:**
1. **Detected test frameworks** from project analysis
2. **User-provided testing preferences** (if specified)
3. **Agentic Monorepo Defaults** (if requirements suggest a full-stack app and project is empty, prefer Native + Playwright)
4. **Opinionated defaults** (only for gaps)

Generate a document that includes:
1. Testing Philosophy
2. Test Pyramid / Distribution
3. Test Types with examples
4. Test Organization (file locations, naming)
5. What NOT to test (anti-patterns)
6. Agent Instructions for each test type
7. Coverage Expectations

## Output Format

Output in the following XML format:

<summary>
A brief summary of the testing strategy.
</summary>
<document>
\`\`\`markdown
# Testing Strategy

## Philosophy
...

## Test Types
...

## Anti-Patterns
...

## Agent Instructions
...
\`\`\`
</document>

Start directly with the XML tags. No preamble.

## CRITICAL: NO QUESTIONS ALLOWED

You must NEVER ask clarifying questions or refuse to generate. Produce a complete document.
- If test frameworks are unclear, use opinionated defaults (node:test for backend, Playwright for frontend)
- If test organization is unclear, use colocated tests pattern
- ALWAYS produce actionable content, never ask for more information`;
    }

    private buildArchitecturePrompt(
        analysisContext: string,
        existingSteering?: { product?: string; tech?: string },
        requirements?: string
    ): string {
        const productContext = existingSteering?.product
            ? `\n\n## Product Context\n${existingSteering.product.slice(0, 1000)}`
            : '';

        const techContext = existingSteering?.tech
            ? `\n\n## Tech Context\n${existingSteering.tech.slice(0, 1000)}`
            : '';

        const reqContext = requirements
            ? `\n\n## Requirements Context\n${requirements.slice(0, 1500)}`
            : '';

        const defaults = this.loadDefaults('architecture');

        return `You are a software architect creating an Architecture document (architecture.md) for a development team.

## Project Analysis
${analysisContext}
${productContext}
${techContext}
${reqContext}

## OPINIONATED DEFAULTS (Use for Gaps)

${defaults}

${AGENTIC_MONOREPO_DEFAULTS}

## Your Task

Create an **architecture.md** that defines the system architecture.

**Priority order:**
1. **Detected architecture** from patterns
2. **User-provided constraints** (if specified)
3. **Agentic Monorepo Defaults** (if requirements suggest a full-stack app and project is empty, prefer "Safe-Boundary" Monorepo)
4. **Opinionated defaults** (only for gaps)

Include:

### 1. High-Level Architecture
- Mermaid diagram of system components
- Data flow description
- Boundary definitions

### 2. Component/Module Structure
- Project organization (monorepo workspaces vs single package)
- Vertical slice definition
- Dependency rules (e.g., Core logic is isolated from Transport)

### 3. Data Architecture
- Data persistence strategy
- Schema management
- Repository patterns (or avoidance thereof)

### 4. Integration Patterns
- API styles (JSON-RPC, REST, GraphQL)
- Messaging patterns (if relevant)

## Output Format

Output in the following XML format:

<summary>
A brief summary of the architecture.
</summary>
<document>
\`\`\`markdown
# Architecture
... content ...
\`\`\`
</document>

Start directly with the XML tags. No preamble.

## CRITICAL: NO QUESTIONS ALLOWED

You must NEVER ask clarifying questions or refuse to generate. Produce a complete document.`;
    }
}
