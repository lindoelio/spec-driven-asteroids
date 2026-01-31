/**
 * Error Explainer Utility
 *
 * Provides user-friendly error explanations.
 * Uses templates for known errors and can fall back to AI for complex cases.
 */

/**
 * Known error patterns and their user-friendly explanations.
 */
const KNOWN_ERRORS: { pattern: RegExp; explanation: string }[] = [
    {
        pattern: /ENOENT/,
        explanation: "We couldn't find a required file. Make sure you're in the right workspace.",
    },
    {
        pattern: /EACCES|EPERM/,
        explanation: "We don't have permission to write to this location. Check your file permissions.",
    },
    {
        pattern: /Failed to load resource/,
        explanation: 'The extension resources seem to be missing. Try reinstalling the extension.',
    },
    {
        pattern: /ENOSPC/,
        explanation: "There's not enough disk space to complete this operation.",
    },
    {
        pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/,
        explanation: "We couldn't connect to a required service. Check your network connection.",
    },
    {
        pattern: /JSON.*parse|Unexpected token/i,
        explanation: 'We encountered malformed data. The file might be corrupted.',
    },
    {
        pattern: /Engine not available/,
        explanation: "The AI engine isn't connected. Make sure GitHub Copilot is active.",
    },
];

/**
 * Error explainer that provides friendly, actionable error messages.
 */
export class ErrorExplainer {
    /**
     * Generate a user-friendly explanation for an error.
     * Uses templates for known errors, can use AI for complex cases.
     *
     * @param error The error to explain
     * @param context What the user was doing when the error occurred
     * @returns A friendly explanation string
     */
    async explain(error: Error, context: string): Promise<string> {
        const message = error.message || String(error);

        // Check for known error patterns
        for (const { pattern, explanation } of KNOWN_ERRORS) {
            if (pattern.test(message)) {
                return explanation;
            }
        }

        // For unknown errors, provide a generic but helpful response
        // In the future, this could use AI for more context-aware explanations
        return this.fallbackExplanation(error, context);
    }

    /**
     * Fallback explanation for unknown errors.
     */
    private fallbackExplanation(error: Error, context: string): string {
        const shortMessage = error.message.length > 100
            ? error.message.substring(0, 100) + '...'
            : error.message;

        return `Something went wrong while ${context}: ${shortMessage}. Try running the command again.`;
    }

    /**
     * Get a quick, one-line error summary.
     */
    getQuickSummary(error: Error): string {
        const message = error.message || String(error);

        // Check for known patterns and return short summaries
        if (/ENOENT/.test(message)) return 'File not found';
        if (/EACCES|EPERM/.test(message)) return 'Permission denied';
        if (/ENOSPC/.test(message)) return 'Disk full';
        if (/ECONNREFUSED|ENOTFOUND/.test(message)) return 'Connection failed';
        if (/Engine not available/.test(message)) return 'AI not connected';

        // Truncate long messages
        if (message.length > 50) {
            return message.substring(0, 47) + '...';
        }

        return message;
    }
}
