/**
 * SpecBuilder Service
 *
 * The Builder Agent: orchestrates the implementation phase by executing tasks,
 * loading context, writing code, and validating results.
 */

import type { IEnginePort, Checkpoint, FileReference } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { Task } from '../domain/Task.js';
import type { SteeringDocs } from '../domain/Steering.js';

export interface SpecBuilderDependencies {
    engine: IEnginePort;
    fileSystem: IFileSystemPort;
}

export interface ImplementationContext {
    requirements: string;
    design: string;
    steering: SteeringDocs;
    targetFileContents?: FileReference[];
    relatedTasks?: Task[];
    projectDocs?: Record<string, string>;
}

export interface ImplementationResult {
    success: boolean;
    output: string;
    filesModified?: string[];
    testsGenerated?: string[];
    errors?: string[];
    suggestedNextTask?: string;
}

export interface BuilderOptions {
    /** Load target files into context automatically */
    autoLoadTargetFiles?: boolean;
    /** Include related/dependent tasks in context */
    includeRelatedTasks?: boolean;
    /** Save checkpoint after execution */
    saveCheckpoint?: boolean;
    /** Validate output after execution */
    validateOutput?: boolean;
}

const DEFAULT_OPTIONS: BuilderOptions = {
    autoLoadTargetFiles: true,
    includeRelatedTasks: true,
    saveCheckpoint: true,
    validateOutput: true,
};

/**
 * SpecBuilder handles code generation from tasks.
 *
 * The Builder agent:
 * - Loads all relevant context (design, requirements, steering, memory)
 * - Injects target file contents for modification
 * - Generates implementation via engine
 * - Validates and saves checkpoint
 */
export class SpecBuilder {
    constructor(private readonly deps: SpecBuilderDependencies) { }

    // ═══════════════════════════════════════════════════════════════════════════
    // Primary Execution Methods
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Execute a single task with full context loading.
     */
    async executeTask(
        task: Task,
        baseContext: {
            requirements: string;
            design: string;
            steering: SteeringDocs;
            projectDocs?: Record<string, string>;
        },
        options: BuilderOptions = {}
    ): Promise<ImplementationResult> {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        try {
            // Build full context with file injection
            const context = await this.buildFullContext(task, baseContext, opts);

            // Load any previous checkpoint
            const checkpoint = await this.deps.engine.loadCheckpoint(task.specId);

            // Build and execute the implementation prompt
            const prompt = this.buildImplementationPrompt(task, context, checkpoint);

            const result = await this.deps.engine.prompt(
                { type: 'implementation', systemPrompt: this.getSystemPrompt(task) },
                {
                    specId: task.specId,
                    files: context.targetFileContents,
                    steering: context.steering,
                    memory: checkpoint?.decisions,
                    history: [{ role: 'user', content: prompt }],
                }
            );

            // Parse and validate the result
            const parsed = this.parseImplementationResult(result, task);

            // Save checkpoint if enabled
            if (opts.saveCheckpoint) {
                await this.saveTaskCheckpoint(task, parsed);
            }

            return parsed;
        } catch (error) {
            return {
                success: false,
                output: '',
                errors: [error instanceof Error ? error.message : String(error)],
            };
        }
    }

    /**
     * Stream task execution for interactive feedback.
     */
    async *streamExecuteTask(
        task: Task,
        baseContext: {
            requirements: string;
            design: string;
            steering: SteeringDocs;
            projectDocs?: Record<string, string>;
        },
        options: BuilderOptions = {}
    ): AsyncIterable<string> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const context = await this.buildFullContext(task, baseContext, opts);
        const checkpoint = await this.deps.engine.loadCheckpoint(task.specId);
        const prompt = this.buildImplementationPrompt(task, context, checkpoint);

        let fullOutput = '';
        const stream = this.deps.engine.streamPrompt(
            { type: 'implementation', systemPrompt: this.getSystemPrompt(task) },
            {
                specId: task.specId,
                files: context.targetFileContents,
                steering: context.steering,
                memory: checkpoint?.decisions,
                history: [{ role: 'user', content: prompt }],
            }
        );

        for await (const chunk of stream) {
            fullOutput += chunk;
            yield chunk;
        }

        // Save checkpoint implicitly (fire and forget for stream mode)
        const parsed = this.parseImplementationResult(fullOutput, task);
        await this.saveTaskCheckpoint(task, parsed);
    }

    /**
     * Execute multiple tasks in sequence with dependency awareness.
     */
    async executeTasks(
        tasks: Task[],
        baseContext: {
            requirements: string;
            design: string;
            steering: SteeringDocs;
            projectDocs?: Record<string, string>;
        },
        options: BuilderOptions = {}
    ): Promise<Map<string, ImplementationResult>> {
        const results = new Map<string, ImplementationResult>();

        // Sort tasks by dependencies (topological sort)
        const sortedTasks = this.topologicalSort(tasks);

        for (const task of sortedTasks) {
            // Check if dependencies completed successfully
            const depsFailed = task.dependsOn?.some(depId => {
                const depResult = results.get(depId);
                return depResult && !depResult.success;
            });

            if (depsFailed) {
                results.set(task.id, {
                    success: false,
                    output: '',
                    errors: ['Dependency task failed'],
                });
                continue;
            }

            const result = await this.executeTask(task, baseContext, options);
            results.set(task.id, result);
        }

        return results;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Context Building
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Build full implementation context with file injection.
     */
    private async buildFullContext(
        task: Task,
        baseContext: { requirements: string; design: string; steering: SteeringDocs; projectDocs?: Record<string, string> },
        options: BuilderOptions
    ): Promise<ImplementationContext> {
        const context: ImplementationContext = { ...baseContext };

        // Load target files if requested
        if (options.autoLoadTargetFiles && task.targetFiles?.length) {
            context.targetFileContents = await this.loadTargetFiles(task.targetFiles);
        }

        return context;
    }

    /**
     * Load target file contents for context injection.
     */
    private async loadTargetFiles(filePaths: string[]): Promise<FileReference[]> {
        const files: FileReference[] = [];

        for (const path of filePaths) {
            try {
                if (await this.deps.fileSystem.exists(path)) {
                    const content = await this.deps.fileSystem.readFile(path);
                    files.push({
                        path,
                        content,
                        language: this.inferLanguage(path),
                    });
                }
            } catch {
                // File doesn't exist or can't be read - skip
                console.log(`[SpecBuilder] Could not load file: ${path}`);
            }
        }

        return files;
    }

    /**
     * Infer programming language from file extension.
     */
    private inferLanguage(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescriptreact',
            js: 'javascript',
            jsx: 'javascriptreact',
            py: 'python',
            rb: 'ruby',
            java: 'java',
            go: 'go',
            rs: 'rust',
            cpp: 'cpp',
            c: 'c',
            cs: 'csharp',
            md: 'markdown',
            json: 'json',
            yaml: 'yaml',
            yml: 'yaml',
        };
        return languageMap[ext ?? ''] ?? 'plaintext';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Prompt Building
    // ═══════════════════════════════════════════════════════════════════════════

    private buildImplementationPrompt(
        task: Task,
        context: ImplementationContext,
        checkpoint: Checkpoint | null
    ): string {
        const parts: string[] = [
            '# Task to Implement',
            '',
            `## ${task.id}: ${task.title}`,
            '',
            task.description,
            '',
        ];

        // Task metadata
        if (task.type) {
            parts.push(`**Type**: ${task.type}`);
        }
        if (task.priority) {
            parts.push(`**Priority**: ${task.priority}`);
        }
        if (task.estimate) {
            parts.push(`**Estimated Effort**: ${task.estimate}`);
        }
        parts.push('');

        if (task.targetFiles?.length) {
            parts.push(`**Target Files**: ${task.targetFiles.join(', ')}`);
            parts.push('');
        }

        if (task.implements?.length) {
            parts.push(`**Implements Requirements**: ${task.implements.join(', ')}`);
            parts.push('');
        }

        if (task.dependsOn?.length) {
            parts.push(`**Depends On**: ${task.dependsOn.join(', ')}`);
            parts.push('');
        }

        // Context sections
        parts.push('---');
        parts.push('# Context');
        parts.push('');

        parts.push('## Requirements');
        parts.push('');
        parts.push(context.requirements);
        parts.push('');

        parts.push('## Design');
        parts.push('');
        parts.push(context.design);
        parts.push('');

        // Project Documentation
        if (context.projectDocs && Object.keys(context.projectDocs).length > 0) {
            parts.push('## Project Documentation');
            parts.push('');
            for (const [name, content] of Object.entries(context.projectDocs)) {
                parts.push(`### ${name}`);
                parts.push('');
                parts.push(content);
                parts.push('');
            }
        }

        // Target file contents
        if (context.targetFileContents?.length) {
            parts.push('## Current File Contents');
            parts.push('');
            for (const file of context.targetFileContents) {
                parts.push(`### ${file.path}`);
                parts.push('```' + (file.language ?? ''));
                parts.push(file.content);
                parts.push('```');
                parts.push('');
            }
        }

        // Memory/checkpoint context
        if (checkpoint) {
            parts.push('## Previous Decisions');
            parts.push('');
            parts.push(checkpoint.summary);
            if (Object.keys(checkpoint.decisions).length > 0) {
                parts.push('');
                parts.push('**Key decisions:**');
                for (const [key, value] of Object.entries(checkpoint.decisions)) {
                    parts.push(`- ${key}: ${value}`);
                }
            }
            parts.push('');
        }

        return parts.join('\n');
    }

    private getSystemPrompt(task: Task): string {
        const basePrompt = `You are a precise code implementation assistant. You implement exactly what is specified in the task, following the design and requirements provided.

Rules:
1. Follow the design exactly - do not add features not specified
2. Write idiomatic, well-documented code
3. Include necessary imports and type annotations
4. Follow the project's coding conventions
5. Output complete file contents when modifying files`;

        // Add task-type specific instructions
        if (task.type === 'test') {
            return basePrompt + `

Special Instructions for Test Tasks:
- Write comprehensive test cases covering happy path and edge cases
- Follow the project's test patterns and frameworks
- Include descriptive test names
- Mock external dependencies appropriately`;
        }

        if (task.type === 'refactor') {
            return basePrompt + `

Special Instructions for Refactor Tasks:
- Preserve existing behavior exactly
- Improve code structure, readability, or performance
- Ensure all existing tests still pass
- Document any significant structural changes`;
        }

        if (task.type === 'document') {
            return basePrompt + `

Special Instructions for Documentation Tasks:
- Write clear, comprehensive documentation
- Include code examples where appropriate
- Follow the project's documentation style
- Cover both usage and API reference`;
        }

        return basePrompt;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Result Parsing & Validation
    // ═══════════════════════════════════════════════════════════════════════════

    private parseImplementationResult(output: string, task: Task): ImplementationResult {
        // Extract file modifications from output
        const filesModified = this.extractFileModifications(output);
        const testsGenerated = filesModified.filter(f =>
            f.includes('.test.') || f.includes('.spec.') || f.includes('_test.')
        );

        return {
            success: true,
            output,
            filesModified,
            testsGenerated: testsGenerated.length > 0 ? testsGenerated : undefined,
            suggestedNextTask: this.extractNextTaskSuggestion(output, task),
        };
    }

    private extractNextTaskSuggestion(_output: string, _task: Task): string | undefined {
        // If this task has known dependents, suggest the first one
        // This would require knowledge of the full task graph
        // For now, return undefined - the caller can determine next task
        return undefined;
    }

    private extractFileModifications(output: string): string[] {
        const files: string[] = [];

        // Look for file path patterns in the output (common markdown patterns)
        const patterns = [
            /```(?:\w+)?\s*\n\/\/\s*File:\s*([^\n]+)/g,
            /```(?:\w+)?\s*\n#\s*([^\n]+\.\w+)/g,
            /\*\*File:\*\*\s*`([^`]+)`/g,
            /Creating file:\s*([^\n]+)/g,
            /Modifying:\s*([^\n]+)/g,
            // Also check for XML format just in case
            /<file\s+path="([^"]+)">/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(output)) !== null) {
                const filePath = match[1].trim();
                if (filePath && !files.includes(filePath)) {
                    files.push(filePath);
                }
            }
        }

        return files;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Checkpoint Management
    // ═══════════════════════════════════════════════════════════════════════════

    private async saveTaskCheckpoint(task: Task, result: ImplementationResult): Promise<void> {
        const checkpoint: Checkpoint = {
            specId: task.specId,
            phase: 'implementation',
            summary: `Completed task ${task.id}: ${task.title}`,
            decisions: {
                [`task_${task.id}_status`]: result.success ? 'completed' : 'failed',
                [`task_${task.id}_files`]: result.filesModified?.join(', ') ?? 'none',
            },
            timestamp: new Date(),
        };

        // Truncate output for memory efficiency
        if (result.output.length > 500) {
            checkpoint.decisions[`task_${task.id}_summary`] = result.output.substring(0, 500) + '...';
        }

        await this.deps.engine.saveCheckpoint(checkpoint);
    }

    /**
     * Load checkpoint for a spec.
     */
    async loadCheckpoint(specId: string): Promise<Checkpoint | null> {
        return this.deps.engine.loadCheckpoint(specId);
    }

    /**
     * Query memory for past decisions.
     */
    async queryMemory(query: string): Promise<Record<string, unknown>[]> {
        return this.deps.engine.queryMemory(query);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Task Ordering
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Sort tasks by dependencies (topological sort).
     */
    private topologicalSort(tasks: Task[]): Task[] {
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const visited = new Set<string>();
        const result: Task[] = [];

        const visit = (task: Task) => {
            if (visited.has(task.id)) return;
            visited.add(task.id);

            for (const depId of task.dependsOn ?? []) {
                const depTask = taskMap.get(depId);
                if (depTask) {
                    visit(depTask);
                }
            }

            result.push(task);
        };

        for (const task of tasks) {
            visit(task);
        }

        return result;
    }
}
