/**
 * VS Code Extension Entry Point
 *
 * Activates the SpecDriven extension and wires up adapters.
 */

import * as vscode from 'vscode';
import { VsCodeInterfaceAdapter } from './VsCodeInterfaceAdapter';
import { VsCodeFileSystemAdapter } from './FileSystemAdapter';
import { SpecsTreeProvider } from './TreeProviders/SpecsTreeProvider';
import { GuidelinesTreeProvider } from './TreeProviders/GuidelinesTreeProvider';
import { registerChatParticipant } from './ChatParticipant';
import { GUIDELINES_PATHS } from '@spec-driven/core';
import { CopilotEngineAdapter } from '@spec-driven/adapter-copilot';

export async function activate(context: vscode.ExtensionContext) {
    console.log('SpecDrivenAgentic is activating...');

    // Initialize adapters
    const fileSystemAdapter = new VsCodeFileSystemAdapter();
    const interfaceAdapter = new VsCodeInterfaceAdapter(fileSystemAdapter);

    // Wire up Copilot adapter without memory/session persistence
    const copilotAdapter = new CopilotEngineAdapter({});
    interfaceAdapter.setEngineAdapter(copilotAdapter);

    // Note: Agent skills are created explicitly via /configure command, not on startup

    const workspaceRoot = fileSystemAdapter.getWorkspaceRoot() ?? '';

    // Register tree views
    const specsProvider = new SpecsTreeProvider(interfaceAdapter);
    const guidelinesProvider = new GuidelinesTreeProvider(fileSystemAdapter);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('specdriven.specs', specsProvider),
        vscode.window.registerTreeDataProvider('specdriven.guidelines', guidelinesProvider)
    );

    // Register spec tree commands
    SpecsTreeProvider.registerCommands(context, specsProvider, workspaceRoot);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('specdriven.openGuidelines', async () => {
            const items = [
                { label: '$(person) AGENTS', description: 'AI agent instructions', path: GUIDELINES_PATHS.agents },
                { label: '$(symbol-structure) Architecture', description: 'System structure and diagrams', path: GUIDELINES_PATHS.architecture },
                { label: '$(law) Contributing', description: 'Coding standards', path: GUIDELINES_PATHS.contributing },
                { label: '$(beaker) Testing', description: 'Testing strategy', path: GUIDELINES_PATHS.testing },
                { label: '$(shield) Security', description: 'Security policy', path: GUIDELINES_PATHS.security },
                { label: '$(paintcan) Styleguide', description: 'Code style conventions', path: GUIDELINES_PATHS.styleguide },
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select guideline document to open',
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

        vscode.commands.registerCommand('specdriven.openGuidelinesDoc', async (docPath: string) => {
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
        vscode.commands.registerCommand('specdriven.refreshGuidelines', () => {
            guidelinesProvider.refresh();
        })
    );

    // Register @spec chat participant
    registerChatParticipant(context, interfaceAdapter);

    console.log('SpecDrivenAgentic activated!');
}

export function deactivate() {
    console.log('SpecDrivenAgentic deactivated.');
}
