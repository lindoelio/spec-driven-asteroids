/**
 * Response Builder Utility
 *
 * Helps construct natural, collaborative responses with consistent patterns.
 * Uses "we" voice and liberal emoji usage for a friendly, agentic feel.
 */

import * as vscode from 'vscode';

/**
 * Minimal project analysis info needed for response building.
 */
export interface ProjectAnalysisInfo {
    languages: string[];
    frameworks: string[];
    testFrameworks: string[];
    linters: string[];
    buildTools: string[];
    packageManager: string | null;
}

/**
 * Icons used throughout responses.
 */
export const Icons = {
    created: '✨',
    updated: '🔄',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    pending: '⏳',
    rocket: '🚀',
    search: '🔍',
    document: '📄',
    folder: '📁',
    lightbulb: '💡',
    wrench: '🔧',
    target: '🎯',
    clipboard: '📋',
    chart: '📊',
    construction: '🚧',
    wave: '👋',
    seedling: '🌱',
    party: '🎉',
    thinking: '🤔',
    robot: '🤖',
} as const;

/**
 * Response builder for constructing natural, streaming chat responses.
 */
export class ResponseBuilder {
    constructor(private stream: vscode.ChatResponseStream) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // Natural Language Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Describe a project's technology stack in natural language.
     */
    describeStack(analysis: ProjectAnalysisInfo): string {
        const parts: string[] = [];

        if (analysis.languages.length) {
            parts.push(`**${analysis.languages.join('/')}**`);
        }

        if (analysis.frameworks.length) {
            parts.push(`with ${this.listify(analysis.frameworks)}`);
        }

        return parts.join(' ') || 'your project';
    }

    /**
     * Convert an array to a natural language list.
     * e.g., ["a", "b", "c"] -> "a, b, and c"
     */
    listify(items: string[], conjunction = 'and'): string {
        if (items.length === 0) return '';
        if (items.length === 1) return items[0];
        if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
        return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
    }

    /**
     * Pluralize a word based on count.
     */
    pluralize(count: number, singular: string, plural?: string): string {
        return count === 1 ? singular : (plural || `${singular}s`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Collaborative Voice Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Start an action with collaborative voice.
     */
    starting(action: string): void {
        this.stream.markdown(`Let's ${action}...\n\n`);
    }

    /**
     * Report something we found.
     */
    found(description: string): void {
        this.stream.markdown(`${Icons.search} We found ${description}.\n\n`);
    }

    /**
     * Show progress indicator for ongoing work.
     */
    doing(action: string): void {
        this.stream.progress(action);
    }

    /**
     * Report successful completion.
     */
    done(description: string): void {
        this.stream.markdown(`${Icons.success} ${description}\n`);
    }

    /**
     * Report an item was created.
     */
    created(item: string, detail?: string): void {
        const suffix = detail ? ` — ${detail}` : '';
        this.stream.markdown(`${Icons.created} **${item}** created${suffix}\n`);
    }

    /**
     * Report an item was updated.
     */
    updated(item: string, detail?: string): void {
        const suffix = detail ? ` — ${detail}` : '';
        this.stream.markdown(`${Icons.updated} **${item}** updated${suffix}\n`);
    }

    /**
     * Start a new section with a title.
     */
    section(title: string): void {
        this.stream.markdown(`\n**${title}**\n\n`);
    }

    /**
     * Show next steps for the user.
     */
    nextSteps(steps: string[]): void {
        this.stream.markdown(`\n---\n\n`);
        this.stream.markdown(`${Icons.lightbulb} **What's next:**\n\n`);
        steps.forEach(step => this.stream.markdown(`- ${step}\n`));
    }

    /**
     * Show a helpful tip.
     */
    tip(message: string): void {
        this.stream.markdown(`\n${Icons.lightbulb} **Tip:** ${message}\n`);
    }

    /**
     * Show a warning message.
     */
    warning(message: string): void {
        this.stream.markdown(`${Icons.warning} ${message}\n`);
    }

    /**
     * Show an error message.
     */
    error(message: string): void {
        this.stream.markdown(`${Icons.error} ${message}\n`);
    }

    /**
     * Write markdown directly to the stream.
     */
    markdown(content: string): void {
        this.stream.markdown(content);
    }

    /**
     * Show a celebration message.
     */
    celebrate(message: string): void {
        this.stream.markdown(`${Icons.party} ${message}\n`);
    }

    /**
     * Get the underlying stream for direct access.
     */
    getStream(): vscode.ChatResponseStream {
        return this.stream;
    }
}
