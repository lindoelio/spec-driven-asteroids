/**
 * Task File Watcher
 *
 * Watches tasks.md files for changes and emits events for UI sync.
 * Implements bidirectional synchronization between file and UI.
 */

import * as vscode from 'vscode';
import { TaskManager, type TaskFile } from '@spec-driven/core';
import type { VsCodeInterfaceAdapter } from '../VsCodeInterfaceAdapter';

export type TaskChangeType = 'created' | 'updated' | 'deleted' | 'statusChanged';

export interface TaskChangeEvent {
    specId: string;
    type: TaskChangeType;
    taskId?: string;
    taskFile?: TaskFile;
}

/**
 * Watches .spec/specs/{specId}/tasks.md files for changes.
 */
export class TaskFileWatcher implements vscode.Disposable {
    private watcher: vscode.FileSystemWatcher | undefined;
    private taskManager: TaskManager;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private lastKnownState: Map<string, string> = new Map(); // specId -> file hash

    private readonly _onTasksChanged = new vscode.EventEmitter<TaskChangeEvent>();
    readonly onTasksChanged = this._onTasksChanged.event;

    constructor(
        private readonly adapter: VsCodeInterfaceAdapter,
        private readonly workspaceRoot: string
    ) {
        // TaskManager needs fileSystem port - get it from adapter
        this.taskManager = new TaskManager({
            fileSystem: (adapter as any).fileSystem
        });
        this.initialize();
    }

    private initialize(): void {
        // Watch for tasks.md files in .spec/specs/*/
        const pattern = new vscode.RelativePattern(
            this.workspaceRoot,
            '.spec/specs/*/tasks.md'
        );

        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.watcher.onDidCreate(uri => this.handleFileChange(uri, 'created'));
        this.watcher.onDidChange(uri => this.handleFileChange(uri, 'updated'));
        this.watcher.onDidDelete(uri => this.handleFileChange(uri, 'deleted'));
    }

    /**
     * Handle file change with debouncing.
     */
    private handleFileChange(uri: vscode.Uri, changeType: TaskChangeType): void {
        const specId = this.extractSpecId(uri);
        if (!specId) return;

        // Debounce rapid changes
        const existingTimer = this.debounceTimers.get(specId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.debounceTimers.delete(specId);
            await this.processChange(specId, changeType);
        }, 300);

        this.debounceTimers.set(specId, timer);
    }

    /**
     * Extract spec ID from file URI.
     */
    private extractSpecId(uri: vscode.Uri): string | null {
        const match = uri.fsPath.match(/\.spec\/specs\/([^/]+)\/tasks\.md$/);
        return match?.[1] ?? null;
    }

    /**
     * Process the file change and emit events.
     */
    private async processChange(specId: string, changeType: TaskChangeType): Promise<void> {
        if (changeType === 'deleted') {
            this.lastKnownState.delete(specId);
            this._onTasksChanged.fire({ specId, type: 'deleted' });
            return;
        }

        try {
            const taskFile = await this.taskManager.parseTaskFile(specId);
            if (!taskFile) return;

            // Detect specific status changes
            const previousHash = this.lastKnownState.get(specId);
            const currentHash = this.computeStateHash(taskFile);

            if (previousHash !== currentHash) {
                this.lastKnownState.set(specId, currentHash);
                this._onTasksChanged.fire({
                    specId,
                    type: changeType,
                    taskFile,
                });
            }
        } catch (error) {
            console.error(`[TaskFileWatcher] Error processing ${specId}:`, error);
        }
    }

    /**
     * Compute a simple hash of task states for change detection.
     */
    private computeStateHash(taskFile: TaskFile): string {
        const stateString = taskFile.tasks
            .map(t => `${t.id}:${t.status}`)
            .join('|');
        return stateString;
    }

    /**
     * Force a refresh for a specific spec.
     */
    async refresh(specId: string): Promise<TaskFile | null> {
        const taskFile = await this.taskManager.parseTaskFile(specId);
        if (taskFile) {
            this._onTasksChanged.fire({
                specId,
                type: 'updated',
                taskFile,
            });
        }
        return taskFile;
    }

    /**
     * Get current task file for a spec.
     */
    async getTaskFile(specId: string): Promise<TaskFile | null> {
        return this.taskManager.parseTaskFile(specId);
    }

    /**
     * Update a task status (triggers file write and event).
     */
    async updateTaskStatus(
        specId: string,
        taskId: string,
        status: 'pending' | 'in-progress' | 'done' | 'blocked' | 'skipped'
    ): Promise<boolean> {
        const task = await this.taskManager.updateTaskStatus(specId, taskId, status);
        if (task) {
            this._onTasksChanged.fire({
                specId,
                type: 'statusChanged',
                taskId,
            });
            return true;
        }
        return false;
    }

    /**
     * Get the next actionable task.
     */
    async getNextTask(specId: string) {
        return this.taskManager.getNextTask(specId);
    }

    /**
     * Get TDD recommendation for a design.
     */
    async getTddRecommendation(designContent: string, specId: string) {
        return this.taskManager.recommendTdd(designContent, specId);
    }

    dispose(): void {
        this.watcher?.dispose();
        this._onTasksChanged.dispose();
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}

/**
 * Register task-related commands.
 */
export function registerTaskCommands(
    context: vscode.ExtensionContext,
    watcher: TaskFileWatcher
): void {
    // Toggle task status
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'specdriven.toggleTaskStatus',
            async (specId: string, taskId: string) => {
                const taskFile = await watcher.getTaskFile(specId);
                const task = taskFile?.tasks.find(t => t.id === taskId);
                if (!task) return;

                // Cycle through statuses
                const statusCycle: Array<'pending' | 'in-progress' | 'done'> = [
                    'pending', 'in-progress', 'done'
                ];
                const currentIndex = statusCycle.indexOf(task.status as any);
                const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

                await watcher.updateTaskStatus(specId, taskId, nextStatus);
                vscode.window.showInformationMessage(
                    `Task ${taskId} marked as ${nextStatus}`
                );
            }
        )
    );

    // Mark task as done
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'specdriven.markTaskDone',
            async (specId: string, taskId: string) => {
                await watcher.updateTaskStatus(specId, taskId, 'done');
                vscode.window.showInformationMessage(`Task ${taskId} completed! ✓`);
            }
        )
    );

    // Start task (mark in-progress)
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'specdriven.startTask',
            async (specId: string, taskId: string) => {
                await watcher.updateTaskStatus(specId, taskId, 'in-progress');
                vscode.window.showInformationMessage(`Started task ${taskId}`);
            }
        )
    );

    // Block task
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'specdriven.blockTask',
            async (specId: string, taskId: string) => {
                const reason = await vscode.window.showInputBox({
                    prompt: 'Why is this task blocked?',
                    placeHolder: 'Waiting for API documentation...',
                });
                if (reason !== undefined) {
                    await watcher.updateTaskStatus(specId, taskId, 'blocked');
                    vscode.window.showWarningMessage(`Task ${taskId} blocked: ${reason || 'No reason given'}`);
                }
            }
        )
    );

    // Get next task
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'specdriven.getNextTask',
            async (specId: string) => {
                const nextTask = await watcher.getNextTask(specId);
                if (nextTask) {
                    vscode.window.showInformationMessage(
                        `Next task: ${nextTask.id} - ${nextTask.title}`,
                        'Start Task'
                    ).then(selection => {
                        if (selection === 'Start Task') {
                            vscode.commands.executeCommand(
                                'specdriven.startTask',
                                specId,
                                nextTask.id
                            );
                        }
                    });
                } else {
                    vscode.window.showInformationMessage('No actionable tasks available!');
                }
            }
        )
    );
}
