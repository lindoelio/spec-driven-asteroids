/**
 * Outbound Port: Engine Port
 *
 * Defines how the core domain interacts with agentic engines
 * (GitHub Copilot, Codex, OpenCode, etc.).
 */

import type { PromptStrategy } from '../../strategies/PromptStrategy.js';

/**
 * Context provided to the engine for generating responses.
 */
export interface PromptContext {
    /** The spec being worked on */
    specId?: string;

    /** Relevant file contents to include in context */
    files?: FileReference[];

    /** Steering documents content */
    steering?: {
        product?: string;
        tech?: string;
        conventions?: string;
    };

    /** Previous conversation history */
    history?: ConversationMessage[];

    /** Memory/checkpoint data from MCP */
    memory?: Record<string, unknown>;
}

export interface FileReference {
    path: string;
    content: string;
    language?: string;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Checkpoint data for persistent memory.
 */
export interface Checkpoint {
    specId: string;
    phase: string;
    summary: string;
    decisions: Record<string, string>;
    timestamp: Date;
}

/**
 * IEnginePort defines the contract for all agentic engine adapters.
 *
 * This is the primary outbound port through which the core domain
 * communicates with AI services.
 */
export interface IEnginePort {
    // ═══════════════════════════════════════════════════════════════════════════
    // Core Prompting
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Send a prompt to the engine and get a complete response.
     */
    prompt(strategy: PromptStrategy, context: PromptContext): Promise<string>;

    /**
     * Send a prompt and stream the response for interactive flows.
     */
    streamPrompt(
        strategy: PromptStrategy,
        context: PromptContext
    ): AsyncIterable<string>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Context Management
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Inject files into the engine's context window.
     * Used to ensure relevant code is visible to the AI.
     */
    injectContext(files: FileReference[]): Promise<void>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Memory (MCP)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Save a checkpoint to persistent memory.
     */
    saveCheckpoint(checkpoint: Checkpoint): Promise<void>;

    /**
     * Load the most recent checkpoint for a spec.
     */
    loadCheckpoint(specId: string): Promise<Checkpoint | null>;

    /**
     * Query memory for relevant past decisions.
     */
    queryMemory(query: string): Promise<Record<string, unknown>[]>;
}
