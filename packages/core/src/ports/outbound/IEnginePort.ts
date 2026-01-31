/**
 * Outbound Port: Engine Port
 *
 * Defines how the core domain interacts with agentic engines
 * (GitHub Copilot, Codex, OpenCode, etc.).
 */

import type { PromptStrategy } from '../../strategies/PromptStrategy.js';
import type { GuidelinesDocs, GuidelineType, FileTree, RepositoryInsights } from '../../domain/Guidelines.js';

/**
 * Context provided to the engine for generating responses.
 */
export interface PromptContext {
    /** The spec being worked on */
    specId?: string;

    /** Relevant file contents to include in context */
    files?: FileReference[];

    /** Guideline documents content (root-level standards) */
    guidelines?: GuidelinesDocs;

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

    // ═══════════════════════════════════════════════════════════════════════════
    // AI-Driven Repository Analysis
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Ask the AI to select which files are relevant for analysis.
     * The AI examines the file tree and returns paths to files that should be read.
     *
     * @param fileTree - The complete file tree of the repository
     * @returns Array of file paths that the AI determines are relevant for analysis
     */
    selectRelevantFiles(fileTree: FileTree): Promise<string[]>;

    /**
     * Ask the AI to analyze repository contents and produce insights.
     * The AI examines file contents and produces a technology-agnostic analysis.
     *
     * @param fileTree - The complete file tree for context
     * @param contents - Map of file paths to their contents
     * @returns Comprehensive repository insights including tech stack, patterns, and conflicts
     */
    analyzeRepository(
        fileTree: FileTree,
        contents: Map<string, string>
    ): Promise<RepositoryInsights>;

    /**
     * Ask the AI to synthesize a specific guideline document.
     * The AI uses repository insights to generate focused, non-duplicating content.
     *
     * @param type - The type of guideline to generate
     * @param insights - Repository insights from prior analysis
     * @returns The generated guideline content as markdown
     */
    synthesizeGuideline(
        type: GuidelineType,
        insights: RepositoryInsights
    ): Promise<string>;
}
