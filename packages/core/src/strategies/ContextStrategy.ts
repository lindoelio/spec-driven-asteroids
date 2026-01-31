/**
 * ContextStrategy
 *
 * Prompt strategy for AI-powered context gathering.
 * Used by ContextAgent to dynamically identify relevant files and context.
 */

import type { PromptStrategy } from './PromptStrategy.js';

export interface ContextStrategyOptions {
    technologies?: string[];
    workspaceStructure?: string;
}

export class ContextStrategy implements PromptStrategy {
    type = 'context';

    constructor(private readonly options: ContextStrategyOptions = {}) {}

    get systemPrompt(): string {
        const techContext = this.options.technologies?.length
            ? `\n\nDetected technologies: ${this.options.technologies.join(', ')}`
            : '';

        const workspaceContext = this.options.workspaceStructure
            ? `\n\nWorkspace structure:\n${this.options.workspaceStructure}`
            : '';

        return `You are a context-gathering assistant for a Spec-Driven Development workflow.

Your task is to analyze a feature request and identify:
1. **Relevant files** - Which existing files in the codebase are likely related to this feature
2. **Key components** - What classes, functions, or modules might be affected
3. **Integration points** - Where this feature will need to connect with existing code
4. **Potential risks** - What areas might have complex dependencies

${techContext}${workspaceContext}

## Output Format

Respond with a structured analysis:

<analysis>
## Relevant Files
- \`path/to/file.ts\` - Reason this file is relevant
- \`path/to/another.ts\` - Reason

## Key Components
- ComponentName - What it does and why it's relevant
- FunctionName - What it does and why it's relevant

## Integration Points
- Where the new feature connects to existing code
- APIs or interfaces that will be used

## Potential Risks
- High: [description] (affects many files)
- Medium: [description] (moderate complexity)
- Low: [description] (isolated change)

## Recommended Approach
Brief suggestion for implementation approach based on context.
</analysis>

Be concise but thorough. Focus on actionable context that helps with planning.`;
    }
}
