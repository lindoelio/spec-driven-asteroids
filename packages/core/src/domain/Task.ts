/**
 * Task Domain Entity
 *
 * Represents an atomic unit of work derived from a spec's design.
 * Follows a strict schema for bidirectional UI/file sync.
 */

export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked' | 'skipped';

export type TaskType = 'implement' | 'test' | 'refactor' | 'document' | 'review';

/**
 * Task entity representing an atomic implementation unit.
 */
export interface Task {
    /** Unique task identifier (e.g., "1.2.3") */
    id: string;

    /** Parent spec ID */
    specId: string;

    /** Short task title */
    title: string;

    /** Detailed description */
    description: string;

    /** Current status */
    status: TaskStatus;

    /** Type of task */
    type: TaskType;

    /** Priority (lower = higher priority) */
    priority: number;

    /** Estimated effort (e.g., "S", "M", "L") */
    estimate?: string;

    /** Files this task will modify */
    targetFiles?: string[];

    /** Traceability: which design/requirement this implements */
    implements?: string[];

    /** Dependencies: task IDs that must complete first */
    dependsOn?: string[];

    /** Completion timestamp */
    completedAt?: Date;
}

/**
 * Task schema for parsing/serializing to Markdown.
 *
 * Format in tasks.md:
 * ```markdown
 * ## Task 1.1: Create user model
 *
 * - **Status**: pending
 * - **Type**: implement
 * - **Priority**: 1
 * - **Implements**: REQ-1.1, DES-2.1
 * - **Files**: src/models/User.ts
 *
 * Create the User domain entity with validation.
 * ```
 */
export const TaskSchema = {
    /**
     * Parse a task from its Markdown representation.
     */
    parse(markdown: string, specId: string): Task | null {
        const headerMatch = markdown.match(/^## Task ([\d.]+): (.+)$/m);
        if (!headerMatch) return null;

        const id = headerMatch[1];
        const title = headerMatch[2];

        const getField = (field: string): string | undefined => {
            const match = markdown.match(new RegExp(`^- \\*\\*${field}\\*\\*: (.+)$`, 'm'));
            return match?.[1];
        };

        const getListField = (field: string): string[] | undefined => {
            const value = getField(field);
            return value?.split(',').map(s => s.trim());
        };

        // Extract description (everything after the metadata block)
        const descMatch = markdown.match(/\n\n([^-*#].+)/s);
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
    },

    /**
     * Serialize a task to its Markdown representation.
     */
    serialize(task: Task): string {
        const lines: string[] = [
            `## Task ${task.id}: ${task.title}`,
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

        lines.push('', task.description);

        return lines.join('\n');
    },
};
