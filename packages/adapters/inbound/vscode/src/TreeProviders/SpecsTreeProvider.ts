/**
 * Specs Tree Provider
 *
 * Provides the tree view for specs in the sidebar with context menus
 * and file opening capabilities.
 */

import * as vscode from 'vscode';
import type { VsCodeInterfaceAdapter } from '../VsCodeInterfaceAdapter';

export type SpecItemType = 'spec' | 'requirements' | 'design' | 'tasks';

export class SpecsTreeProvider implements vscode.TreeDataProvider<SpecTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SpecTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly adapter: VsCodeInterfaceAdapter) { }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: SpecTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SpecTreeItem): Promise<SpecTreeItem[]> {
        if (!element) {
            // Root level: list all specs
            const specs = await this.adapter.getSpecs();

            if (specs.length === 0) {
                return [];
            }

            return specs.map(spec => new SpecTreeItem(
                spec.id,
                spec.id,
                'spec',
                spec.status,
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                this.getSpecDescription(spec)
            ));
        }

        // Spec level: show phases
        const spec = await this.adapter.getSpec(element.specId);
        const children: SpecTreeItem[] = [];

        // Always show requirements (even if placeholder)
        if (spec.requirements) {
            children.push(new SpecTreeItem(
                'Requirements',
                element.specId,
                'requirements',
                'ready',
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon('file-text')
            ));
        }

        // Design (show if requirements exist)
        if (spec.design) {
            children.push(new SpecTreeItem(
                'Design',
                element.specId,
                'design',
                'ready',
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon('symbol-structure')
            ));
        }

        // Tasks (show if tasks exist - check taskCount or tasks array)
        if (spec.taskCount > 0 || (spec.tasks && spec.tasks.length > 0)) {
            children.push(new SpecTreeItem(
                `Tasks${spec.taskCount > 0 ? ` (${spec.completedTaskCount}/${spec.taskCount})` : ''}`,
                element.specId,
                'tasks',
                'ready',
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon('checklist')
            ));
        }



        return children;
    }

    private getSpecDescription(spec: { status: string; taskCount: number; completedTaskCount: number }): string {
        if (spec.taskCount > 0) {
            const progress = Math.round((spec.completedTaskCount / spec.taskCount) * 100);
            return `${progress}% complete`;
        }
        return spec.status;
    }

    /**
     * Register tree view commands for context menus.
     */
    static registerCommands(
        context: vscode.ExtensionContext,
        provider: SpecsTreeProvider,
        workspaceRoot: string
    ): void {
        // Open spec file
        context.subscriptions.push(
            vscode.commands.registerCommand('specdriven.openSpecFile', async (item: SpecTreeItem) => {
                const filePath = provider.getFilePath(item, workspaceRoot);
                if (filePath) {
                    // Open markdown files in preview mode
                    if (filePath.fsPath.endsWith('.md')) {
                        await vscode.commands.executeCommand('markdown.showPreview', filePath);
                    } else if (filePath.scheme === 'file') { // Ensure it's a file before opening
                        const doc = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(doc, { preview: false });
                    }
                }
            })
        );

        // Refresh specs
        context.subscriptions.push(
            vscode.commands.registerCommand('specdriven.refreshSpecs', () => {
                provider.refresh();
            })
        );

        // Open spec folder
        context.subscriptions.push(
            vscode.commands.registerCommand('specdriven.openSpecFolder', async (item: SpecTreeItem) => {
                const folderPath = vscode.Uri.file(`${workspaceRoot}/.spec/changes/${item.specId}`);
                await vscode.commands.executeCommand('revealFileInOS', folderPath);
            })
        );

        // Copy spec ID
        context.subscriptions.push(
            vscode.commands.registerCommand('specdriven.copySpecId', async (item: SpecTreeItem) => {
                await vscode.env.clipboard.writeText(item.specId);
                vscode.window.showInformationMessage(`Copied: ${item.specId}`);
            })
        );
    }

    /**
     * Get the file path for a spec item.
     */
    getFilePath(item: SpecTreeItem, workspaceRoot: string): vscode.Uri | null {
        const basePath = `${workspaceRoot}/.spec/changes/${item.specId}`;

        switch (item.itemType) {
            case 'requirements':
                return vscode.Uri.file(`${basePath}/requirements.md`);
            case 'design':
                return vscode.Uri.file(`${basePath}/design.md`);
            case 'tasks':
                return vscode.Uri.file(`${basePath}/tasks.md`);

            case 'spec':
                return vscode.Uri.file(basePath);
            default:
                return null;
        }
    }
}

export class SpecTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly specId: string,
        public readonly itemType: SpecItemType,
        public readonly status: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        icon?: vscode.ThemeIcon,
        description?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = this.buildTooltip();
        this.description = description;
        this.contextValue = itemType;

        if (icon) {
            this.iconPath = icon;
        } else {
            this.iconPath = this.getStatusIcon(status);
        }

        // Add command for file items
        if (itemType !== 'spec' && status === 'ready') {
            this.command = {
                command: 'specdriven.openSpecFile',
                title: 'Open File',
                arguments: [this],
            };
        }
    }

    private buildTooltip(): string {
        const lines: string[] = [`**${this.label}**`];

        if (this.itemType === 'spec') {
            lines.push(`ID: ${this.specId}`);
            lines.push(`Status: ${this.status}`);
        } else {
            lines.push(`Type: ${this.itemType}`);
            if (this.status === 'pending') {
                lines.push('Click to generate');
            }
        }

        return lines.join('\n');
    }

    private getStatusIcon(status: string): vscode.ThemeIcon {
        switch (status) {
            case 'draft':
                return new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.yellow'));
            case 'approved':
                return new vscode.ThemeIcon('verified', new vscode.ThemeColor('charts.green'));
            case 'in-progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
            case 'done':
                return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
            case 'ready':
                return new vscode.ThemeIcon('check');
            case 'pending':
                return new vscode.ThemeIcon('circle-outline');
            default:
                return new vscode.ThemeIcon('file');
        }
    }
}
