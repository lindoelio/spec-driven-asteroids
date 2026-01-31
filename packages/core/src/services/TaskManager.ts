/**
 * Task Manager Service
 *
 * Handles task lifecycle: parsing, serialization, status updates,
 * and bidirectional sync between UI and tasks.md file.
 */

import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { Task, TaskStatus, TaskType } from '../domain/Task.js';

export interface TaskManagerDependencies {
    fileSystem: IFileSystemPort;
}

export interface TaskFile {
    specId: string;
    featureName: string;
    phases: TaskPhase[];
    tasks: Task[];
    metadata: TaskFileMetadata;
}

export interface TaskPhase {
    id: number;
    name: string;
    taskIds: string[];
}

export interface TaskFileMetadata {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    blockedTasks: number;
    tddEnabled: boolean;
}

export interface TddRecommendation {
    recommend: boolean;
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
    suggestedTestTasks: string[];
}

/**
 * TaskManager handles all task operations for a spec.
 */
export class TaskManager {
    constructor(private readonly deps: TaskManagerDependencies) { }

    // ═══════════════════════════════════════════════════════════════════════════
    // Task File Parsing
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Parse a tasks.md file into structured data.
     */
    async parseTaskFile(specId: string): Promise<TaskFile | null> {
        const path = `.spec/changes/${specId}/tasks.md`;

        if (!await this.deps.fileSystem.exists(path)) {
            return null;
        }

        const content = await this.deps.fileSystem.readFile(path);
        return this.parseTaskMarkdown(content, specId);
    }

    /**
     * Parse Markdown content into TaskFile structure.
     */
    parseTaskMarkdown(content: string, specId: string): TaskFile {
        const tasks: Task[] = [];
        const phases: TaskPhase[] = [];

        // Extract feature name from title
        const titleMatch = content.match(/^# Implementation Plan: (.+)$/m);
        const featureName = titleMatch?.[1] ?? specId;

        // Split by phase headers
        const phaseRegex = /^## Phase (\d+): (.+)$/gm;
        const taskRegex = /^### Task ([\d.]+): (.+)$([\s\S]*?)(?=^### Task|^## Phase|$)/gm;

        let phaseMatch;
        let currentPhaseId = 0;

        // First pass: find all phases
        const phaseMatches: Array<{ id: number; name: string; start: number }> = [];
        while ((phaseMatch = phaseRegex.exec(content)) !== null) {
            phaseMatches.push({
                id: parseInt(phaseMatch[1], 10),
                name: phaseMatch[2],
                start: phaseMatch.index,
            });
        }

        // Parse each task
        let taskMatch;
        while ((taskMatch = taskRegex.exec(content)) !== null) {
            const taskId = taskMatch[1];
            const taskTitle = taskMatch[2];
            const taskBody = taskMatch[3];

            // Determine which phase this task belongs to
            currentPhaseId = 1;
            for (let i = 0; i < phaseMatches.length; i++) {
                if (taskMatch.index > phaseMatches[i].start) {
                    currentPhaseId = phaseMatches[i].id;
                }
            }

            const task = this.parseTaskBlock(taskId, taskTitle, taskBody, specId);
            if (task) {
                tasks.push(task);

                // Add to phase
                let phase = phases.find(p => p.id === currentPhaseId);
                if (!phase) {
                    const phaseName = phaseMatches.find(p => p.id === currentPhaseId)?.name ?? `Phase ${currentPhaseId}`;
                    phase = { id: currentPhaseId, name: phaseName, taskIds: [] };
                    phases.push(phase);
                }
                phase.taskIds.push(taskId);
            }
        }

        // Sort phases by ID
        phases.sort((a, b) => a.id - b.id);

        // Calculate metadata
        const metadata: TaskFileMetadata = {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'done').length,
            inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
            blockedTasks: tasks.filter(t => t.status === 'blocked').length,
            tddEnabled: tasks.some(t => t.type === 'test' && t.priority < (tasks.find(
                impl => impl.dependsOn?.includes(t.id)
            )?.priority ?? 999)),
        };

        return {
            specId,
            featureName,
            phases,
            tasks,
            metadata,
        };
    }

    /**
     * Parse a single task block.
     */
    private parseTaskBlock(id: string, title: string, body: string, specId: string): Task | null {
        const getField = (field: string): string | undefined => {
            const match = body.match(new RegExp(`^- \\*\\*${field}\\*\\*: (.+)$`, 'm'));
            return match?.[1];
        };

        const getListField = (field: string): string[] | undefined => {
            const value = getField(field);
            if (!value) return undefined;
            return value.split(',').map(s => s.trim()).filter(Boolean);
        };

        // Extract description (content after metadata block)
        const descMatch = body.match(/(?:\n\n)([^-*].+)/s);
        const description = descMatch?.[1]?.trim() ?? '';

        return {
            id,
            specId,
            title,
            description,
            status: (getField('Status') as TaskStatus) ?? 'pending',
            type: (getField('Type') as TaskType) ?? 'implement',
            priority: parseInt(getField('Priority') ?? '99', 10),
            estimate: getField('Estimate'),
            targetFiles: getListField('Files'),
            implements: getListField('Implements'),
            dependsOn: getListField('Depends On'),
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Task File Serialization
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Serialize a TaskFile back to Markdown.
     */
    serializeTaskFile(taskFile: TaskFile): string {
        const lines: string[] = [
            `# Implementation Plan: ${taskFile.featureName}`,
            '',
            `> Total: ${taskFile.metadata.totalTasks} tasks | ` +
            `Done: ${taskFile.metadata.completedTasks} | ` +
            `In Progress: ${taskFile.metadata.inProgressTasks}` +
            (taskFile.metadata.blockedTasks > 0 ? ` | Blocked: ${taskFile.metadata.blockedTasks}` : ''),
            '',
        ];

        // Group tasks by phase
        for (const phase of taskFile.phases) {
            lines.push(`## Phase ${phase.id}: ${phase.name}`, '');

            for (const taskId of phase.taskIds) {
                const task = taskFile.tasks.find(t => t.id === taskId);
                if (task) {
                    lines.push(this.serializeTask(task), '');
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * Serialize a single task to Markdown.
     */
    serializeTask(task: Task): string {
        const lines: string[] = [
            `### Task ${task.id}: ${task.title}`,
            '',
            `- **Status**: ${task.status}`,
            `- **Type**: ${task.type}`,
            `- **Priority**: ${task.priority}`,
        ];

        if (task.estimate) {
            lines.push(`- **Estimate**: ${task.estimate}`);
        }
        if (task.implements?.length) {
            lines.push(`- **Implements**: ${task.implements.join(', ')}`);
        }
        if (task.dependsOn?.length) {
            lines.push(`- **Depends On**: ${task.dependsOn.join(', ')}`);
        }
        if (task.targetFiles?.length) {
            lines.push(`- **Files**: ${task.targetFiles.join(', ')}`);
        }

        if (task.description) {
            lines.push('', task.description);
        }

        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Task Updates
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Update a task's status and save to file.
     */
    async updateTaskStatus(specId: string, taskId: string, status: TaskStatus): Promise<Task | null> {
        const taskFile = await this.parseTaskFile(specId);
        if (!taskFile) return null;

        const task = taskFile.tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Update status
        task.status = status;
        if (status === 'done') {
            task.completedAt = new Date();
        }

        // Check for dependent tasks that can now be unblocked
        if (status === 'done') {
            for (const t of taskFile.tasks) {
                if (t.status === 'blocked' && t.dependsOn?.includes(taskId)) {
                    // Check if all dependencies are now done
                    const allDepsDone = t.dependsOn.every(depId =>
                        taskFile.tasks.find(dep => dep.id === depId)?.status === 'done'
                    );
                    if (allDepsDone) {
                        t.status = 'pending';
                    }
                }
            }
        }

        // Recalculate metadata
        taskFile.metadata = {
            totalTasks: taskFile.tasks.length,
            completedTasks: taskFile.tasks.filter(t => t.status === 'done').length,
            inProgressTasks: taskFile.tasks.filter(t => t.status === 'in-progress').length,
            blockedTasks: taskFile.tasks.filter(t => t.status === 'blocked').length,
            tddEnabled: taskFile.metadata.tddEnabled,
        };

        // Save back to file
        const path = `.spec/changes/${specId}/tasks.md`;
        await this.deps.fileSystem.writeFile(path, this.serializeTaskFile(taskFile));

        return task;
    }

    /**
     * Get all tasks for a spec.
     */
    async getTasks(specId: string): Promise<Task[]> {
        const taskFile = await this.parseTaskFile(specId);
        return taskFile?.tasks ?? [];
    }

    /**
     * Get a specific task.
     */
    async getTask(specId: string, taskId: string): Promise<Task | null> {
        const tasks = await this.getTasks(specId);
        return tasks.find(t => t.id === taskId) ?? null;
    }

    /**
     * Get the next actionable task (pending with no unmet dependencies).
     */
    async getNextTask(specId: string): Promise<Task | null> {
        const tasks = await this.getTasks(specId);

        // Find pending tasks with all dependencies met
        const actionable = tasks.filter(task => {
            if (task.status !== 'pending') return false;
            if (!task.dependsOn?.length) return true;

            return task.dependsOn.every(depId =>
                tasks.find(t => t.id === depId)?.status === 'done'
            );
        });

        // Sort by priority
        actionable.sort((a, b) => a.priority - b.priority);

        return actionable[0] ?? null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TDD Reasoning Engine
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Analyze design content and recommend TDD approach.
     */
    async recommendTdd(designContent: string, _specId: string): Promise<TddRecommendation> {
        const reasons: string[] = [];
        const suggestedTestTasks: string[] = [];
        let score = 0;

        // Check for critical/complex patterns in design
        const patterns = [
            { pattern: /(?:critical|security|auth|payment|financial)/gi, weight: 3, reason: 'Critical/security-sensitive functionality' },
            { pattern: /(?:algorithm|calculation|formula|transform)/gi, weight: 2, reason: 'Complex algorithmic logic' },
            { pattern: /(?:validation|sanitize|parse|convert)/gi, weight: 2, reason: 'Data validation/transformation' },
            { pattern: /(?:state machine|workflow|process|pipeline)/gi, weight: 2, reason: 'Complex state management' },
            { pattern: /(?:edge case|boundary|constraint)/gi, weight: 1, reason: 'Explicit edge case handling' },
            { pattern: /(?:integration|api|external|third-party)/gi, weight: 1, reason: 'External integration points' },
            { pattern: /(?:refactor|legacy|migration)/gi, weight: 2, reason: 'Refactoring existing code' },
            { pattern: /(?:bug|fix|issue|problem)/gi, weight: 3, reason: 'Bug fix (regression prevention)' },
        ];

        for (const { pattern, weight, reason } of patterns) {
            const matches = designContent.match(pattern);
            if (matches && matches.length > 0) {
                score += weight * Math.min(matches.length, 3);
                if (!reasons.includes(reason)) {
                    reasons.push(reason);
                }
            }
        }

        // Check for existing test infrastructure
        const hasTestMentions = /(?:test|spec|jest|vitest|mocha|pytest)/gi.test(designContent);
        if (hasTestMentions) {
            score += 1;
            reasons.push('Test infrastructure already mentioned');
        }

        // Determine recommendation
        const recommend = score >= 4;
        const confidence: 'high' | 'medium' | 'low' =
            score >= 8 ? 'high' :
                score >= 4 ? 'medium' : 'low';

        // Suggest test tasks based on design elements
        const componentMatches = designContent.match(/(?:component|service|module|class|function):\s*(\w+)/gi);
        if (componentMatches) {
            for (const match of componentMatches.slice(0, 5)) {
                const name = match.split(':')[1]?.trim() ?? match;
                suggestedTestTasks.push(`Write unit tests for ${name}`);
            }
        }

        return {
            recommend,
            confidence,
            reasons,
            suggestedTestTasks,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Task Dependency Analysis
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get the dependency graph for visualization.
     */
    async getDependencyGraph(specId: string): Promise<{
        nodes: Array<{ id: string; label: string; status: TaskStatus }>;
        edges: Array<{ from: string; to: string }>;
    }> {
        const tasks = await this.getTasks(specId);

        const nodes = tasks.map(t => ({
            id: t.id,
            label: `${t.id}: ${t.title}`,
            status: t.status,
        }));

        const edges: Array<{ from: string; to: string }> = [];
        for (const task of tasks) {
            if (task.dependsOn) {
                for (const depId of task.dependsOn) {
                    edges.push({ from: depId, to: task.id });
                }
            }
        }

        return { nodes, edges };
    }

    /**
     * Check for circular dependencies.
     */
    detectCircularDependencies(tasks: Task[]): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recStack = new Set<string>();
        const path: string[] = [];

        const dfs = (taskId: string): boolean => {
            visited.add(taskId);
            recStack.add(taskId);
            path.push(taskId);

            const task = tasks.find(t => t.id === taskId);
            if (task?.dependsOn) {
                for (const depId of task.dependsOn) {
                    if (!visited.has(depId)) {
                        if (dfs(depId)) return true;
                    } else if (recStack.has(depId)) {
                        // Found cycle
                        const cycleStart = path.indexOf(depId);
                        cycles.push([...path.slice(cycleStart), depId]);
                        return true;
                    }
                }
            }

            path.pop();
            recStack.delete(taskId);
            return false;
        };

        for (const task of tasks) {
            if (!visited.has(task.id)) {
                dfs(task.id);
            }
        }

        return cycles;
    }
}
