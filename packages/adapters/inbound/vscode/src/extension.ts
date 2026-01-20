/**
 * VS Code Extension Entry Point
 *
 * Activates the SpecDriven extension and wires up adapters.
 */

import * as vscode from 'vscode';
import { VsCodeInterfaceAdapter } from './VsCodeInterfaceAdapter';
import { VsCodeFileSystemAdapter } from './FileSystemAdapter';
import { SpecsTreeProvider } from './TreeProviders/SpecsTreeProvider';
import { SteeringTreeProvider } from './TreeProviders/SteeringTreeProvider';
import { TasksTreeProvider } from './TreeProviders/TasksTreeProvider';
import { TaskFileWatcher } from './services/TaskFileWatcher';
import { registerChatParticipant } from './ChatParticipant';
import { STEERING_PATHS } from '@spec-driven/core';
import { CopilotEngineAdapter } from '@spec-driven/adapter-copilot';

export async function activate(context: vscode.ExtensionContext) {
    console.log('SpecDrivenAgentic is activating...');

    // Initialize adapters
    const fileSystemAdapter = new VsCodeFileSystemAdapter();
    const interfaceAdapter = new VsCodeInterfaceAdapter(fileSystemAdapter);

    // Wire up Copilot adapter without memory/session persistence
    const copilotAdapter = new CopilotEngineAdapter({});
    interfaceAdapter.setEngineAdapter(copilotAdapter);

    const workspaceRoot = fileSystemAdapter.getWorkspaceRoot() ?? '';

    // Initialize task file watcher for bidirectional sync
    const taskWatcher = new TaskFileWatcher(interfaceAdapter, workspaceRoot);
    context.subscriptions.push(taskWatcher);

    // Register tree views
    const specsProvider = new SpecsTreeProvider(interfaceAdapter);
    const steeringProvider = new SteeringTreeProvider(fileSystemAdapter);
    const tasksProvider = new TasksTreeProvider(interfaceAdapter);

    // Connect task watcher for bidirectional sync
    tasksProvider.connectWatcher(taskWatcher);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('specdriven.specs', specsProvider),
        vscode.window.registerTreeDataProvider('specdriven.steering', steeringProvider),
        vscode.window.registerTreeDataProvider('specdriven.tasks', tasksProvider)
    );

    // Register spec tree commands
    SpecsTreeProvider.registerCommands(context, specsProvider, workspaceRoot);

    // Register task tree commands
    TasksTreeProvider.registerCommands(context, tasksProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('specdriven.openSteering', async () => {
            const items = [
                { label: '$(rocket) Product', description: 'Product vision and goals', path: STEERING_PATHS.product },
                { label: '$(gear) Tech Stack', description: 'Technology and architecture', path: STEERING_PATHS.tech },
                { label: '$(symbol-structure) Architecture', description: 'System structure and diagrams', path: STEERING_PATHS.architecture },
                { label: '$(law) Conventions', description: 'Coding standards', path: STEERING_PATHS.conventions },
                { label: '$(beaker) Testing', description: 'Testing strategy', path: STEERING_PATHS.testing },
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select steering document to open',
            });

            if (selected) {
                const root = fileSystemAdapter.getWorkspaceRoot();
                if (root) {
                    const uri = vscode.Uri.file(`${root}/${selected.path}`);
                    try {
                        await vscode.commands.executeCommand('markdown.showPreview', uri);
                    } catch {
                        vscode.window.showWarningMessage(`${selected.label} doesn't exist.`);
                    }
                }
            }
        }),

        vscode.commands.registerCommand('specdriven.openSteeringDoc', async (docPath: string) => {
            const root = fileSystemAdapter.getWorkspaceRoot();
            if (root) {
                const uri = vscode.Uri.file(`${root}/${docPath}`);
                await vscode.commands.executeCommand('markdown.showPreview', uri);
            }
        }),

        // === Refresh Commands ===
        /*
        // Handled by SpecsTreeProvider.registerCommands
        vscode.commands.registerCommand('specdriven.refreshSpecs', () => {
            specsProvider.refresh();
        }),
        */
        vscode.commands.registerCommand('specdriven.refreshSteering', () => {
            steeringProvider.refresh();
        }),

        vscode.commands.registerCommand('specdriven.refreshTasks', () => {
            tasksProvider.refresh();
        })
    );

    // Register @spec chat participant
    registerChatParticipant(context, interfaceAdapter);

    console.log('SpecDrivenAgentic activated!');
}

export function deactivate() {
    console.log('SpecDrivenAgentic deactivated.');
}
