/**
 * GitHub Copilot Engine Adapter
 *
 * Implements IEnginePort using VS Code's Copilot Chat API.
 * This adapter translates core prompt strategies into Copilot-compatible requests.
 */

import type {
    IEnginePort,
    PromptContext,
    FileReference,
    Checkpoint,
    PromptStrategy,
} from '@spec-driven/core';
import { McpClient } from './McpClient.js';
import * as vscode from 'vscode';

export interface CopilotEngineAdapterOptions {
    mcpClient?: McpClient;
}

/**
 * CopilotEngineAdapter bridges core services to GitHub Copilot.
 *
 * Note: This adapter is designed to work within a Chat Participant context.
 * Direct prompting to Copilot is done through the response stream.
 */
export class CopilotEngineAdapter implements IEnginePort {
    private mcpClient: McpClient | null;

    constructor(options: CopilotEngineAdapterOptions = {}) {
        this.mcpClient = options.mcpClient ?? null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Core Prompting
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Prompt the engine and get a complete response.
     *
     * Note: In Copilot context, this is typically done through the chat stream.
     * This method is provided for compatibility and testing.
     */
    async prompt(strategy: PromptStrategy, context: PromptContext): Promise<string> {
        // Build the full prompt from strategy and context
        const fullPrompt = this.buildPrompt(strategy, context);

        try {
            // Select the best available model (prefer gpt-4 family)
            let models = await vscode.lm.selectChatModels({ family: 'gpt-4' });

            // Fallback to any available model if GPT-4 not found
            if (!models || models.length === 0) {
                models = await vscode.lm.selectChatModels();
            }

            if (!models || models.length === 0) {
                return "Error: No Copilot models available. Please ensure GitHub Copilot is installed and active.";
            }

            const model = models[0];
            const messages = [
                vscode.LanguageModelChatMessage.User(fullPrompt)
            ];

            const cancellationToken = new vscode.CancellationTokenSource().token;
            const response = await model.sendRequest(messages, {}, cancellationToken);

            // Consolidate stream
            let text = '';
            for await (const fragment of response.text) {
                text += fragment;
            }
            return text;

        } catch (error) {
            console.error('[CopilotEngineAdapter] Error calling LM:', error);
            // Fallback for when API is not available (e.g. tests or old VS Code)
            return `[Failed to call Copilot: ${error instanceof Error ? error.message : String(error)}]`;
        }
    }

    /**
     * Stream a prompt response for interactive flows.
     */
    async *streamPrompt(
        strategy: PromptStrategy,
        context: PromptContext
    ): AsyncIterable<string> {
        const fullPrompt = this.buildPrompt(strategy, context);

        try {
            let models = await vscode.lm.selectChatModels({ family: 'gpt-4' });
            if (!models || models.length === 0) {
                models = await vscode.lm.selectChatModels();
            }

            if (!models || models.length === 0) {
                yield "Error: No Copilot models available.";
                return;
            }

            const model = models[0];
            const messages = [
                vscode.LanguageModelChatMessage.User(fullPrompt)
            ];

            const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            for await (const fragment of response.text) {
                yield fragment;
            }
        } catch (error) {
            console.error('[CopilotEngineAdapter] Error streaming LM:', error);
            yield `[Error: ${error instanceof Error ? error.message : String(error)}]`;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Context Management
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Inject files into the context.
     * In Copilot, this is handled by including file content in the prompt.
     */
    async injectContext(files: FileReference[]): Promise<void> {
        // Copilot handles context through the chat participant's reference handling
        // This method ensures files are available for the next prompt
        console.log(`[CopilotEngineAdapter] Injecting ${files.length} files into context`);

        // Could store these for the next buildPrompt call
        // For now, files are passed directly through PromptContext
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Memory (MCP)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Save a checkpoint to MCP memory.
     */
    async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
        if (this.mcpClient) {
            await this.mcpClient.saveCheckpoint(checkpoint);
        } else {
            // Fallback: save to local state
            console.log('[CopilotEngineAdapter] MCP not available, checkpoint not persisted');
        }
    }

    /**
     * Load the most recent checkpoint for a spec.
     */
    async loadCheckpoint(specId: string): Promise<Checkpoint | null> {
        if (this.mcpClient) {
            return this.mcpClient.loadCheckpoint(specId);
        }
        return null;
    }

    /**
     * Query memory for relevant past decisions.
     */
    async queryMemory(query: string): Promise<Record<string, unknown>[]> {
        if (this.mcpClient) {
            return this.mcpClient.queryMemory(query);
        }
        return [];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Prompt Building
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Build a complete prompt from strategy and context.
     */
    private buildPrompt(strategy: PromptStrategy, context: PromptContext): string {
        const parts: string[] = [];

        // System prompt from strategy
        parts.push(strategy.systemPrompt);
        parts.push('\n---\n');

        // Steering context
        if (context.steering) {
            if (context.steering.product) {
                parts.push('# Product Context\n');
                parts.push(context.steering.product);
                parts.push('\n');
            }
            if (context.steering.tech) {
                parts.push('# Tech Stack\n');
                parts.push(context.steering.tech);
                parts.push('\n');
            }
            if (context.steering.conventions) {
                parts.push('# Conventions\n');
                parts.push(context.steering.conventions);
                parts.push('\n');
            }
        }

        // File context
        if (context.files?.length) {
            parts.push('# Relevant Files\n');
            for (const file of context.files) {
                parts.push(`## ${file.path}\n`);
                parts.push('```' + (file.language ?? '') + '\n');
                parts.push(file.content);
                parts.push('\n```\n');
            }
        }

        // Memory context
        if (context.memory && Object.keys(context.memory).length > 0) {
            parts.push('# Previous Decisions (from memory)\n');
            parts.push(JSON.stringify(context.memory, null, 2));
            parts.push('\n');
        }

        // Conversation history
        if (context.history?.length) {
            parts.push('# Conversation\n');
            for (const msg of context.history) {
                parts.push(`**${msg.role}**: ${msg.content}\n`);
            }
        }

        return parts.join('');
    }
}
