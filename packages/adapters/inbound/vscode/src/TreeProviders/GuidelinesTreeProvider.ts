/**
 * Guidelines Tree Provider
 *
 * Provides the tree view for guideline documents in the sidebar.
 */

import * as vscode from 'vscode';
import type { IFileSystemPort } from '@spec-driven/core';
import { GUIDELINES_PATHS } from '@spec-driven/core';

export class GuidelinesTreeProvider implements vscode.TreeDataProvider<GuidelinesTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GuidelinesTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly fileSystem: IFileSystemPort) { }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: GuidelinesTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<GuidelinesTreeItem[]> {
        const items: GuidelinesTreeItem[] = [];
        const root = this.fileSystem.getWorkspaceRoot();

        if (!root) {
            return items;
        }

        const docs = [
            { name: 'AGENTS', path: GUIDELINES_PATHS.agents, icon: 'person', contextValue: 'guidelines-agents' },
            { name: 'ARCHITECTURE', path: GUIDELINES_PATHS.architecture, icon: 'symbol-structure', contextValue: 'guidelines-architecture' },
            { name: 'CONTRIBUTING', path: GUIDELINES_PATHS.contributing, icon: 'law', contextValue: 'guidelines-contributing' },
            { name: 'TESTING', path: GUIDELINES_PATHS.testing, icon: 'beaker', contextValue: 'guidelines-testing' },
            { name: 'SECURITY', path: GUIDELINES_PATHS.security, icon: 'shield', contextValue: 'guidelines-security' },
            { name: 'STYLEGUIDE', path: GUIDELINES_PATHS.styleguide, icon: 'paintcan', contextValue: 'guidelines-styleguide' },
        ];

        for (const doc of docs) {
            const exists = await this.fileSystem.exists(doc.path);
            if (!exists) {
                continue;
            }
            items.push(new GuidelinesTreeItem(
                doc.name,
                doc.path,
                exists,
                new vscode.ThemeIcon(doc.icon),
                doc.contextValue
            ));
        }

        return items;
    }
}

class GuidelinesTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        public readonly exists: boolean,
        icon: vscode.ThemeIcon,
        contextValue: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        this.tooltip = exists
            ? `Click to edit ${filePath}`
            : `${label} not created yet. Click to create.`;
        this.description = exists ? '✓' : '(not created)';
        this.iconPath = icon;
        this.contextValue = contextValue;

        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        this.command = {
            command: 'markdown.showPreview',
            title: 'Open Preview',
            arguments: [vscode.Uri.file(`${root}/${filePath}`)],
        };
    }
}
