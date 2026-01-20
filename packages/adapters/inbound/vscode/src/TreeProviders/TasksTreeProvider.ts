/**
 * Tasks Tree Provider
 *
 * Provides the tree view for tasks in the sidebar with
 * status management, dependency visualization, and sync.
 */

import * as vscode from 'vscode';
import type { VsCodeInterfaceAdapter } from '../VsCodeInterfaceAdapter';
import type { Task } from '@spec-driven/core';
import type { TaskFileWatcher, TaskChangeEvent } from '../services/TaskFileWatcher';

export type TaskItemType = 'spec' | 'phase' | 'task';

export class TasksTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TaskTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private currentSpecId: string | undefined;
    private taskWatcher: TaskFileWatcher | undefined;

    constructor(private readonly adapter: VsCodeInterfaceAdapter) { }

    /**
     * Connect to the task file watcher for bidirectional sync.
     */
    connectWatcher(watcher: TaskFileWatcher): void {
        this.taskWatcher = watcher;
        watcher.onTasksChanged((event: TaskChangeEvent) => {
            if (!this.currentSpecId || event.specId === this.currentSpecId) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    setCurrentSpec(specId: string): void {
        this.currentSpecId = specId;
        this.refresh();
    }

    clearCurrentSpec(): void {
        this.currentSpecId = undefined;
        this.refresh();
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        if (!element) {
            // Root level
            if (this.currentSpecId) {
                // Show phases for current spec
                return this.getPhases(this.currentSpecId);
            } else {
                // Show all specs with tasks
                return this.getSpecsWithTasks();
            }
        }

        if (element.itemType === 'spec') {
            // Show phases for this spec
            return this.getPhases(element.specId);
        }

        if (element.itemType === 'phase') {
            // Show tasks in this phase
            return this.getTasksInPhase(element.specId, element.phaseId!);
        }

        return [];
    }

    private async getSpecsWithTasks(): Promise<TaskTreeItem[]> {
        const specs = await this.adapter.getSpecs();
        return specs
            .filter(s => s.taskCount > 0)
            .map(s => new TaskTreeItem(
                s.featureName,
                s.id,
                'spec',
                undefined,
                undefined,
                `${s.completedTaskCount}/${s.taskCount}`,
                vscode.TreeItemCollapsibleState.Collapsed,
                this.getProgressIcon(s.completedTaskCount, s.taskCount)
            ));
    }

    private async getPhases(specId: string): Promise<TaskTreeItem[]> {
        if (!this.taskWatcher) {
            // Fallback to flat task list
            return this.getFlatTasks(specId);
        }

        const taskFile = await this.taskWatcher.getTaskFile(specId);
        if (!taskFile || taskFile.phases.length === 0) {
            return this.getFlatTasks(specId);
        }

        return taskFile.phases.map(phase => {
            const phaseTasks = taskFile.tasks.filter(t => phase.taskIds.includes(t.id));
            const doneTasks = phaseTasks.filter(t => t.status === 'done').length;
            const totalTasks = phaseTasks.length;

            return new TaskTreeItem(
                `Phase ${phase.id}: ${phase.name}`,
                specId,
                'phase',
                phase.id,
                undefined,
                `${doneTasks}/${totalTasks}`,
                vscode.TreeItemCollapsibleState.Expanded,
                this.getProgressIcon(doneTasks, totalTasks)
            );
        });
    }

    private async getTasksInPhase(specId: string, phaseId: number): Promise<TaskTreeItem[]> {
        if (!this.taskWatcher) {
            return [];
        }

        const taskFile = await this.taskWatcher.getTaskFile(specId);
        if (!taskFile) return [];

        const phase = taskFile.phases.find(p => p.id === phaseId);
        if (!phase) return [];

        return phase.taskIds
            .map(taskId => taskFile.tasks.find(t => t.id === taskId))
            .filter((t): t is Task => t !== undefined)
            .map(task => this.taskToTreeItem(task, specId));
    }

    private async getFlatTasks(specId: string): Promise<TaskTreeItem[]> {
        const tasks = await this.adapter.getTasks(specId);
        return tasks.map(task => this.taskToTreeItem(task, specId));
    }

    private taskToTreeItem(task: Task, specId: string): TaskTreeItem {
        const hasDeps = task.dependsOn && task.dependsOn.length > 0;
        const depInfo = hasDeps ? ` (depends on: ${task.dependsOn!.join(', ')})` : '';

        return new TaskTreeItem(
            `${task.id}: ${task.title}`,
            specId,
            'task',
            undefined,
            task,
            task.status,
            vscode.TreeItemCollapsibleState.None,
            this.getTaskIcon(task),
            task.description + depInfo
        );
    }

    private getProgressIcon(done: number, total: number): vscode.ThemeIcon {
        if (total === 0) return new vscode.ThemeIcon('circle-outline');
        const progress = done / total;
        if (progress === 1) return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
        if (progress >= 0.5) return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('charts.blue'));
        if (progress > 0) return new vscode.ThemeIcon('circle-large-outline', new vscode.ThemeColor('charts.yellow'));
        return new vscode.ThemeIcon('circle-outline');
    }

    private getTaskIcon(task: Task): vscode.ThemeIcon {
        // First check for type-specific icons
        if (task.type === 'test') {
            if (task.status === 'done') {
                return new vscode.ThemeIcon('beaker', new vscode.ThemeColor('testing.iconPassed'));
            }
            return new vscode.ThemeIcon('beaker');
        }
        if (task.type === 'document') {
            return new vscode.ThemeIcon('book');
        }
        if (task.type === 'refactor') {
            return new vscode.ThemeIcon('tools');
        }
        if (task.type === 'review') {
            return new vscode.ThemeIcon('eye');
        }

        // Status-based icons for implement tasks
        switch (task.status) {
            case 'done':
                return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
            case 'in-progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
            case 'blocked':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            case 'skipped':
                return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    /**
     * Register tree view commands.
     */
    static registerCommands(
        context: vscode.ExtensionContext,
        provider: TasksTreeProvider
    ): void {
        // Focus on a spec
        context.subscriptions.push(
            vscode.commands.registerCommand('specdriven.focusSpec', (specId: string) => {
                provider.setCurrentSpec(specId);
            })
        );

        // Clear spec focus
        context.subscriptions.push(
            vscode.commands.registerCommand('specdriven.clearSpecFocus', () => {
                provider.clearCurrentSpec();
            })
        );

        // Open task file
        context.subscriptions.push(
            vscode.commands.registerCommand('specdriven.openTaskFile', async (item: TaskTreeItem) => {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!workspaceRoot) return;

                const filePath = vscode.Uri.file(`${workspaceRoot}/.spec/specs/${item.specId}/tasks.md`);
                // Open in preview mode
                await vscode.commands.executeCommand('markdown.showPreview', filePath);
            })
        );
    }
}

export class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly specId: string,
        public readonly itemType: TaskItemType,
        public readonly phaseId: number | undefined,
        public readonly task: Task | undefined,
        public readonly status: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        icon?: vscode.ThemeIcon,
        tooltip?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip ?? `${label} (${status})`;
        this.description = status;
        this.contextValue = itemType;

        if (icon) {
            this.iconPath = icon;
        }

        // Read-only: open tasks.md preview
        if (itemType === 'task' && task) {
            this.command = {
                command: 'specdriven.openTaskFile',
                title: 'Open Tasks File',
                arguments: [this],
            };
        }
    }
}
