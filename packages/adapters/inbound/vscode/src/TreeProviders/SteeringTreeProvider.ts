/**
 * Steering Tree Provider
 *
 * Provides the tree view for steering documents in the sidebar.
 */

import * as vscode from 'vscode';
import type { IFileSystemPort } from '@spec-driven/core';
import { STEERING_PATHS } from '@spec-driven/core';

export class SteeringTreeProvider implements vscode.TreeDataProvider<SteeringTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SteeringTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly fileSystem: IFileSystemPort) { }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: SteeringTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<SteeringTreeItem[]> {
        const items: SteeringTreeItem[] = [];
        const root = this.fileSystem.getWorkspaceRoot();

        if (!root) {
            return items;
        }

        const docs = [
            { name: 'Product', path: STEERING_PATHS.product, icon: 'rocket', contextValue: 'steering-product' },
            { name: 'Tech Stack', path: STEERING_PATHS.tech, icon: 'gear', contextValue: 'steering-tech' },
            { name: 'Architecture', path: STEERING_PATHS.architecture, icon: 'symbol-structure', contextValue: 'steering-architecture' },
            { name: 'Conventions', path: STEERING_PATHS.conventions, icon: 'law', contextValue: 'steering-conventions' },
            { name: 'Testing', path: STEERING_PATHS.testing, icon: 'beaker', contextValue: 'steering-testing' },
        ];

        for (const doc of docs) {
            const exists = await this.fileSystem.exists(doc.path);
            if (!exists) {
                continue;
            }
            items.push(new SteeringTreeItem(
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

class SteeringTreeItem extends vscode.TreeItem {
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
