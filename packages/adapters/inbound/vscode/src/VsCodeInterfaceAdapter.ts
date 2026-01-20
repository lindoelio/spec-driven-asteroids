/**
 * VS Code Interface Adapter
 *
 * Implements IInterfacePort for VS Code, connecting UI actions to core services.
 */

import type {
    IInterfacePort,
    SpecSession,
    SpecSummary,
    SpecDetail,
    Task,
    TaskStatus,
    SteeringDocs,
    IFileSystemPort,
    IEnginePort,
    EngineSkillConfig,
} from '@spec-driven/core';
import {
    SteeringGenerator,
    SpecPlanner,
    ContextGrounder,
    TaskManager,
    SpecBuilder,
    SpecReverser,
    type ImplementationResult,
    type BuilderOptions,
    type ReverseEngineerOptions,
    type AnalysisResult,
} from '@spec-driven/core';

export interface PlanningOptions {
    technologies?: string[];
    issueContext?: {
        id: string;
        title: string;
        description: string;
        acceptanceCriteria?: string[];
    };
}

export interface DesignResult {
    content: string;
    summary?: string;
    impactAnalysis?: {
        riskLevel: 'low' | 'medium' | 'high';
        affectedFiles: string[];
    };
}

/**
 * GitHub Copilot skill configuration.
 * Defines where the agent skill file and custom instructions are created.
 */
export const GITHUB_COPILOT_SKILL_CONFIG: EngineSkillConfig = {
    skillDirectory: '.github/skills/spec-driven-implementation',
    skillFileName: 'SKILL.md',
    skillName: 'spec-driven-implementation',
    customInstructionsPath: '.github/copilot-instructions.md',
};

export class VsCodeInterfaceAdapter implements IInterfacePort {
    private steeringGenerator: SteeringGenerator;
    private specPlanner: SpecPlanner | null = null;
    private specBuilder: SpecBuilder | null = null;
    private specReverser: SpecReverser | null = null;
    private contextGrounder: ContextGrounder;
    private taskManager: TaskManager;
    private engineAdapter: IEnginePort | null = null;
    private skillConfig: EngineSkillConfig;

    // Expose fileSystem for TaskFileWatcher
    public readonly fileSystem: IFileSystemPort;

    constructor(fileSystem: IFileSystemPort, skillConfig: EngineSkillConfig = GITHUB_COPILOT_SKILL_CONFIG) {
        this.fileSystem = fileSystem;
        this.skillConfig = skillConfig;
        this.steeringGenerator = new SteeringGenerator({ fileSystem, skillConfig });
        this.contextGrounder = new ContextGrounder({ fileSystem });
        this.taskManager = new TaskManager({ fileSystem });
    }

    /**
     * Set the engine adapter for AI-powered operations.
     */
    setEngineAdapter(engine: IEnginePort): void {
        this.engineAdapter = engine;
        this.specPlanner = new SpecPlanner({ engine, fileSystem: this.fileSystem, skillConfig: this.skillConfig });
        this.specBuilder = new SpecBuilder({ engine, fileSystem: this.fileSystem });
        this.specReverser = new SpecReverser({ engine, fileSystem: this.fileSystem });

        // Wire engine to steering generator for AI-powered steering
        this.steeringGenerator.setEngine(engine);
    }

    /**
     * Get the configured engine adapter.
     */
    getEngineAdapter(): IEnginePort | null {
        return this.engineAdapter;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Steering (Implemented)
    // ═══════════════════════════════════════════════════════════════════════════


    async initializeSteering(): Promise<SteeringDocs> {
        return this.steeringGenerator.initializeSteering();
    }

    async generateTechSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        return this.steeringGenerator.generateTechSteering(requirements);
    }

    async generateConventionsSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        return this.steeringGenerator.generateConventionsSteering(requirements);
    }

    async generateProductSteering(userInquiry?: string): Promise<{ content: string; summary: string }> {
        return this.steeringGenerator.generateProductSteering(userInquiry);
    }

    async generateArchitectureSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        return this.steeringGenerator.generateArchitectureSteering(requirements);
    }

    async generateTestingSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        return this.steeringGenerator.generateTestingSteering(requirements);
    }

    async generateAllSteering(userInquiry?: string): Promise<{
        product: { content: string; summary: string };
        tech: { content: string; summary: string };
        architecture: { content: string; summary: string };
        conventions: { content: string; summary: string };
        testing: { content: string; summary: string };
    }> {
        return this.steeringGenerator.generateAllSteering(userInquiry);
    }

    async isSteeringInitialized(): Promise<boolean> {
        return this.steeringGenerator.isInitialized();
    }

    async getSteering(): Promise<SteeringDocs> {
        return this.steeringGenerator.loadSteering();
    }

    async generateSteering(_projectPath: string): Promise<SteeringDocs> {
        await this.steeringGenerator.generateTechSteering();
        await this.steeringGenerator.generateArchitectureSteering();
        await this.steeringGenerator.generateConventionsSteering();
        return this.steeringGenerator.loadSteering();
    }

    async updateSteering(docType: keyof SteeringDocs, content: string): Promise<void> {
        const paths: Record<keyof SteeringDocs, string> = {
            product: '.spec/steering/product.md',
            tech: '.spec/steering/tech.md',
            architecture: '.spec/steering/architecture.md',
            conventions: '.spec/steering/conventions.md',
            testing: '.spec/steering/testing.md',
        };
        await this.fileSystem.writeFile(paths[docType], content);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Spec Lifecycle
    // ═══════════════════════════════════════════════════════════════════════════

    async startSpec(featureName: string): Promise<SpecSession> {
        if (this.specPlanner) {
            const spec = await this.specPlanner.createSpec(featureName);
            return {
                specId: spec.id,
                featureName: spec.featureName,
                phase: 'requirements',
                createdAt: new Date(),
            };
        }

        // Fallback if no engine/planner available
        const id = featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const specPath = `.spec/specs/${id}`;

        await this.fileSystem.createDirectory(specPath);
        await this.fileSystem.writeFile(
            `${specPath}/requirements.md`,
            `# Requirements: ${featureName}\n\n<!-- To be generated -->\n`
        );

        return {
            specId: id,
            featureName,
            phase: 'requirements',
            createdAt: new Date(),
        };
    }

    async getSpecs(): Promise<SpecSummary[]> {
        const specsPath = '.spec/specs';
        if (!(await this.fileSystem.exists(specsPath))) {
            return [];
        }

        const entries = await this.fileSystem.readDirectory(specsPath);
        const specs: SpecSummary[] = [];

        for (const entry of entries) {
            if (entry.type === 'directory') {
                const specId = entry.name;
                const path = `.spec/specs/${specId}`;

                // Get task counts
                let taskCount = 0;
                let completedTaskCount = 0;

                const taskFile = await this.taskManager.parseTaskFile(specId);
                if (taskFile) {
                    taskCount = taskFile.metadata.totalTasks;
                    completedTaskCount = taskFile.metadata.completedTasks;
                }

                // Try to get feature name from requirements
                let featureName = specId.replace(/-/g, ' ');
                if (await this.fileSystem.exists(`${path}/requirements.md`)) {
                    const content = await this.fileSystem.readFile(`${path}/requirements.md`);
                    const match = content.match(/^#\s+(.+)$/m);
                    if (match) {
                        featureName = match[1].trim();
                    }
                }

                specs.push({
                    id: specId,
                    featureName,
                    status: 'draft',
                    currentPhase: 'requirements',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    taskCount,
                    completedTaskCount,
                });
            }
        }

        return specs;
    }

    async getSpec(specId: string): Promise<SpecDetail> {
        const specPath = `.spec/specs/${specId}`;

        let requirements: string | undefined;
        let design: string | undefined;

        if (await this.fileSystem.exists(`${specPath}/requirements.md`)) {
            requirements = await this.fileSystem.readFile(`${specPath}/requirements.md`);
        }
        if (await this.fileSystem.exists(`${specPath}/design.md`)) {
            design = await this.fileSystem.readFile(`${specPath}/design.md`);
        }

        // Try to get feature name from requirements
        let featureName = specId.replace(/-/g, ' ');
        if (requirements) {
            const match = requirements.match(/^#\s+(.+)$/m);
            if (match) {
                featureName = match[1].trim();
            }
        }

        // Load tasks
        const taskFile = await this.taskManager.parseTaskFile(specId);
        const tasks = taskFile ? taskFile.tasks : [];

        return {
            id: specId,
            featureName,
            status: 'draft',
            currentPhase: 'requirements',
            createdAt: new Date(),
            updatedAt: new Date(),
            taskCount: tasks.length,
            completedTaskCount: tasks.filter(t => t.status === 'done').length,
            path: specPath,
            requirements,
            design,
            tasks,
            traceability: [],
        };
    }

    async deleteSpec(specId: string): Promise<void> {
        const specPath = `.spec/specs/${specId}`;
        await this.fileSystem.delete(specPath, { recursive: true });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Planning Flow (Chat Participant Support)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Gather context before requirements generation.
     */
    async gatherPlanningContext(featureName: string, userDescription: string): Promise<{
        technologies?: string[];
        relevantFiles?: string[];
    }> {
        const context = await this.contextGrounder.gatherContext(featureName, userDescription);
        return {
            technologies: context.technologies,
            relevantFiles: context.workspaceFiles.map(f => f.path),
        };
    }

    async analyzeRequest(description: string): Promise<{
        isClear: boolean;
        missingInfo: string[];
    }> {
        if (!this.specPlanner) {
            return { isClear: true, missingInfo: [] };
        }
        return this.specPlanner.analyzeRequest(description);
    }

    /**
     * Generate requirements document using EARS strategy.
     */
    async generateRequirements(
        specId: string,
        userInput: string,
        options: PlanningOptions = {}
    ): Promise<{ content: string; summary?: string }> {
        if (!this.specPlanner) {
            // Fallback: generate placeholder if no engine configured
            const content = this.generatePlaceholderRequirements(specId, userInput, options);
            const reqPath = `.spec/specs/${specId}/requirements.md`;
            await this.fileSystem.writeFile(reqPath, content);
            return { content, summary: 'Generated placeholder requirements.' };
        }

        const spec = await this.specPlanner.loadSpec(specId);
        if (!spec) {
            throw new Error(`Spec not found: ${specId}`);
        }

        const steering = await this.getSteering();
        const result = await this.specPlanner.generateRequirements(spec, userInput, {
            steering,
            technologies: options.technologies,
            issueContext: options.issueContext,
        });

        return { content: result.content, summary: result.summary };
    }

    /**
     * Generate design document with impact analysis.
     */
    async generateDesign(
        specId: string,
        requirements: string,
        options: PlanningOptions = {}
    ): Promise<DesignResult> {
        if (!this.specPlanner) {
            // Fallback: generate placeholder if no engine configured
            const content = this.generatePlaceholderDesign(specId, requirements, options);
            const designPath = `.spec/specs/${specId}/design.md`;
            await this.fileSystem.writeFile(designPath, content);
            return { content };
        }

        const spec = await this.specPlanner.loadSpec(specId);
        if (!spec) {
            throw new Error(`Spec not found: ${specId}`);
        }

        const steering = await this.getSteering();
        const result = await this.specPlanner.generateDesign(spec, requirements, {
            steering,
            technologies: options.technologies,
        });

        return {
            content: result.content,
            summary: result.summary,
            impactAnalysis: result.impactAnalysis ? {
                riskLevel: result.impactAnalysis.riskLevel,
                affectedFiles: result.impactAnalysis.potentiallyAffectedFiles,
            } : undefined,
        };
    }

    /**
     * Generate tasks document from design.
     */
    async generateTasks(
        specId: string,
        design: string,
        options: { suggestTdd?: boolean } = {}
    ): Promise<{ content: string; summary?: string }> {
        if (!this.specPlanner) {
            // Fallback: generate placeholder if no engine configured
            const content = this.generatePlaceholderTasks(specId, design, options);
            const tasksPath = `.spec/specs/${specId}/tasks.md`;
            await this.fileSystem.writeFile(tasksPath, content);
            return { content, summary: 'Generated placeholder tasks.' };
        }

        const spec = await this.specPlanner.loadSpec(specId);
        if (!spec) {
            throw new Error(`Spec not found: ${specId}`);
        }

        const result = await this.specPlanner.generateTasks(spec, design, options);
        return { content: result.content, summary: result.summary };
    }

    /**
     * Get requirements for a spec.
     */
    async getRequirements(specId: string): Promise<string | null> {
        const path = `.spec/specs/${specId}/requirements.md`;
        if (!await this.fileSystem.exists(path)) {
            return null;
        }
        return this.fileSystem.readFile(path);
    }

    /**
     * Get design for a spec.
     */
    async getDesign(specId: string): Promise<string | null> {
        const path = `.spec/specs/${specId}/design.md`;
        if (!await this.fileSystem.exists(path)) {
            return null;
        }
        return this.fileSystem.readFile(path);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Placeholder Generators (when no engine is configured)
    // ═══════════════════════════════════════════════════════════════════════════

    private generatePlaceholderRequirements(
        specId: string,
        userInput: string,
        options: PlanningOptions
    ): string {
        const techs = options.technologies?.join(', ') || 'Not detected';
        return `# Requirements: ${specId}

## Overview

${userInput}

## Technologies

${techs}

---

> ⚠️ **Note**: This is a placeholder. Configure an engine adapter for AI-generated requirements using EARS syntax.

## User Stories

- [ ] As a user, I want to...

## Functional Requirements

### FR-001: [Requirement Name]

**EARS Pattern**: When [trigger], the system shall [response].

## Non-Functional Requirements

### NFR-001: Performance

The system shall respond within [X] seconds.

## Constraints

- [List any constraints]

## Assumptions

- [List any assumptions]
`;
    }

    private generatePlaceholderDesign(
        specId: string,
        requirements: string,
        options: PlanningOptions
    ): string {
        return `# Design: ${specId}

## Overview

This document describes the technical design for implementing the requirements.

---

> ⚠️ **Note**: This is a placeholder. Configure an engine adapter for AI-generated design with Mermaid diagrams.

## Architecture

\`\`\`mermaid
graph TB
    A[Component A] --> B[Component B]
    B --> C[Component C]
\`\`\`

## Components

### Component 1

- **Purpose**:
- **Responsibilities**:

## Data Model

\`\`\`mermaid
erDiagram
    Entity1 ||--o{ Entity2 : has
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant User
    participant System
    User->>System: Request
    System-->>User: Response
\`\`\`

## Error Handling

- [Define error handling strategy]

## Security Considerations

- [Define security requirements]

## Testing Strategy

- Unit tests for [components]
- Integration tests for [flows]
`;
    }

    private generatePlaceholderTasks(
        specId: string,
        design: string,
        options: { suggestTdd?: boolean }
    ): string {
        const tddNote = options.suggestTdd
            ? '\n> 💡 **TDD Mode**: Write tests first for each task.\n'
            : '';

        return `# Tasks: ${specId}
${tddNote}
## Task List

### Phase 1: Setup

- [ ] **TASK-001**: Set up project structure
  - Create necessary directories
  - Initialize configuration files
  - Trace: FR-001

### Phase 2: Core Implementation

- [ ] **TASK-002**: Implement core component
  - Description of work
  - Trace: FR-002

- [ ] **TASK-003**: Add integration
  - Description of work
  - Trace: FR-003

### Phase 3: Testing & Polish

- [ ] **TASK-004**: Write tests
  - Unit tests
  - Integration tests
  - Trace: NFR-001

- [ ] **TASK-005**: Documentation
  - Update README
  - Add API docs
  - Trace: FR-001, FR-002

---

> ⚠️ **Note**: This is a placeholder. Configure an engine adapter for AI-generated task decomposition.
`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Task Management (Implemented)
    // ═══════════════════════════════════════════════════════════════════════════

    async getTasks(specId: string): Promise<Task[]> {
        return this.taskManager.getTasks(specId);
    }

    async getTask(specId: string, taskId: string): Promise<Task | null> {
        return this.taskManager.getTask(specId, taskId);
    }

    async updateTaskStatus(taskId: string, status: TaskStatus, specId?: string): Promise<void> {
        if (!specId) {
            // Try to find the spec from taskId format (e.g., "feature-x/1.1")
            console.warn('[VsCodeInterfaceAdapter] updateTaskStatus called without specId');
            return;
        }
        await this.taskManager.updateTaskStatus(specId, taskId, status);
    }

    async getNextTask(specId: string): Promise<Task | null> {
        return this.taskManager.getNextTask(specId);
    }

    async focusTask(taskId: string): Promise<void> {
        // TODO: Set active task for implementation
    }

    /**
     * Get TDD recommendation for a design.
     */
    async getTddRecommendation(specId: string): Promise<{
        recommend: boolean;
        confidence: 'high' | 'medium' | 'low';
        reasons: string[];
    } | null> {
        const design = await this.getDesign(specId);
        if (!design) return null;

        return this.taskManager.recommendTdd(design, specId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Implementation (The Builder Agent)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Execute a task implementation.
     */
    async executeTask(
        specId: string,
        taskId: string,
        options: BuilderOptions = {}
    ): Promise<ImplementationResult> {
        if (!this.specBuilder) {
            return {
                success: false,
                output: '',
                errors: ['No engine adapter configured. Cannot execute task.'],
            };
        }

        const task = await this.taskManager.getTask(specId, taskId);
        if (!task) {
            return {
                success: false,
                output: '',
                errors: [`Task not found: ${taskId}`],
            };
        }

        // Load context
        const requirements = await this.getRequirements(specId);
        const design = await this.getDesign(specId);
        const steering = await this.getSteering();
        const projectDocs = await this.getProjectDocs();

        if (!requirements || !design) {
            return {
                success: false,
                output: '',
                errors: ['Missing requirements or design for spec'],
            };
        }

        // Execute the task
        const result = await this.specBuilder.executeTask(task, {
            requirements,
            design,
            steering,
            projectDocs,
        }, options);

        // Update task status based on result
        if (result.success) {
            await this.taskManager.updateTaskStatus(specId, taskId, 'done');
        }

        return result;
    }

    /**
     * Apply file changes from LLM output to the filesystem.
     * Parses markdown code blocks with file path headers.
     */
    private async applyFileChangesFromOutput(output: string): Promise<string[]> {
        const filesWritten: string[] = [];

        // Pattern 1: Headers like `path/to/file.ext` followed by code block
        // Pattern 2: **File:** `path` followed by code block
        // We look for code blocks that are preceded by a file path indicator

        // Split by code blocks and look backwards for file paths
        const codeBlockRegex = /(?:`([^`\n]+)`|\*\*([^*]+)\*\*)\s*\n+```(\w+)?\n([\s\S]*?)```/g;

        let match;
        while ((match = codeBlockRegex.exec(output)) !== null) {
            const filePath = (match[1] || match[2] || '').trim();
            const content = match[4];

            // Validate it looks like a file path
            if (!filePath || !filePath.includes('/') && !filePath.includes('.')) {
                continue;
            }

            // Skip if path contains markdown artifacts
            if (filePath.includes('**') || filePath.includes('##')) {
                continue;
            }

            try {
                // Ensure directory exists
                const dir = filePath.substring(0, filePath.lastIndexOf('/'));
                if (dir) {
                    await this.fileSystem.createDirectory(dir);
                }

                await this.fileSystem.writeFile(filePath, content);
                filesWritten.push(filePath);
                console.log(`[VsCodeInterfaceAdapter] Created file: ${filePath}`);
            } catch (error) {
                console.error(`[VsCodeInterfaceAdapter] Failed to write file ${filePath}:`, error);
            }
        }

        return filesWritten;
    }

    /**
     * Get optional project documentation files.
     */
    private async getProjectDocs(): Promise<Record<string, string>> {
        const docs: Record<string, string> = {};
        const files = ['ARCHITECTURE.md', 'TESTING.md', 'SECURITY.md', 'CONTRIBUTING.md'];

        for (const file of files) {
            try {
                if (await this.fileSystem.exists(file)) {
                    docs[file] = await this.fileSystem.readFile(file);
                }
            } catch {
                // Ignore missing files
            }
        }
        return docs;
    }

    /**
     * Stream task execution for interactive feedback.
     */
    async *streamExecuteTask(
        specId: string,
        taskId: string,
        options: BuilderOptions = {}
    ): AsyncIterable<string> {
        if (!this.specBuilder) {
            yield 'Error: No engine adapter configured.';
            return;
        }

        const task = await this.taskManager.getTask(specId, taskId);
        if (!task) {
            yield `Error: Task not found: ${taskId}`;
            return;
        }

        const requirements = await this.getRequirements(specId);
        const design = await this.getDesign(specId);
        const steering = await this.getSteering();
        const projectDocs = await this.getProjectDocs();

        if (!requirements || !design) {
            yield 'Error: Missing requirements or design for spec';
            return;
        }

        // Mark task as in-progress
        await this.taskManager.updateTaskStatus(specId, taskId, 'in-progress');

        let fullOutput = '';
        for await (const chunk of this.specBuilder.streamExecuteTask(task, {
            requirements,
            design,
            steering,
            projectDocs,
        }, options)) {
            fullOutput += chunk;
            yield chunk;
        }

        // Apply file changes from output
        const filesWritten = await this.applyFileChangesFromOutput(fullOutput);

        // Mark task as done if files were written
        if (filesWritten.length > 0) {
            await this.taskManager.updateTaskStatus(specId, taskId, 'done');
            yield `\n\n✅ **Task ${taskId} completed!** Created/updated ${filesWritten.length} file(s).\n`;
        }
    }

    /**
     * Get the next recommended task to implement.
     */
    async getRecommendedNextTask(specId: string): Promise<Task | null> {
        return this.taskManager.getNextTask(specId);
    }

    /**
     * Load checkpoint for a spec.
     */
    async loadCheckpoint(specId: string): Promise<{
        phase: string;
        summary: string;
        decisions: Record<string, string>;
    } | null> {
        if (!this.specBuilder) {
            return null;
        }
        return this.specBuilder.loadCheckpoint(specId);
    }

    /**
     * Query memory for past decisions related to a query.
     */
    async queryMemory(query: string): Promise<Record<string, unknown>[]> {
        if (!this.specBuilder) {
            return [];
        }
        return this.specBuilder.queryMemory(query);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Reverse Engineering
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Reverse engineer specs from existing code.
     */
    async reverseEngineer(
        targetPath: string,
        options: ReverseEngineerOptions = {}
    ): Promise<SpecDetail[]> {
        if (!this.specReverser) {
            // No engine configured - still try with template generation
            const tempReverser = new SpecReverser({
                engine: this.createPlaceholderEngine(),
                fileSystem: this.fileSystem,
            });
            return tempReverser.reverseEngineer(targetPath, options);
        }

        return this.specReverser.reverseEngineer(targetPath, options);
    }

    /**
     * Analyze a directory for reverse engineering preview.
     */
    async analyzeForReverseEngineering(
        targetPath: string,
        options: ReverseEngineerOptions = {}
    ): Promise<AnalysisResult> {
        if (!this.specReverser) {
            const tempReverser = new SpecReverser({
                engine: this.createPlaceholderEngine(),
                fileSystem: this.fileSystem,
            });
            return tempReverser.analyze(targetPath, options);
        }

        return this.specReverser.analyze(targetPath, options);
    }

    /**
     * Create a placeholder engine for template-based generation.
     */
    private createPlaceholderEngine(): IEnginePort {
        return {
            async prompt() {
                return '[Prompt ready - no engine configured]';
            },
            async *streamPrompt() {
                yield '[Prompt ready - no engine configured]';
            },
            async injectContext() { },
            async saveCheckpoint() { },
            async loadCheckpoint() {
                return null;
            },
            async queryMemory() {
                return [];
            },
        };
    }
}
