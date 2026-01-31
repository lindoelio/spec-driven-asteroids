/**
 * Repository Insights Strategy
 *
 * Prompts the AI to analyze repository contents and produce comprehensive insights.
 * This is the second step in AI-driven guideline generation.
 */

import type { PromptStrategy } from './PromptStrategy.js';
import type { FileTree, RepositoryInsights } from '../domain/Guidelines.js';

export interface RepositoryInsightsStrategyOptions {
    fileTree: FileTree;
    fileContents: Map<string, string>;
}

export class RepositoryInsightsStrategy implements PromptStrategy {
    type = 'repository-insights';
    systemPrompt: string;

    constructor(options: RepositoryInsightsStrategyOptions) {
        const { fileTree, fileContents } = options;

        // Format file contents for the prompt
        const contentsDescription = this.formatFileContents(fileContents);

        this.systemPrompt = `You are a senior software architect analyzing a repository to generate development guidelines.

## Task

Analyze the provided file contents and produce comprehensive insights about:
1. **Technology Stack** - Languages, frameworks, tools
2. **Code Patterns** - Naming conventions, architecture patterns, error handling
3. **Existing Documentation** - What topics are covered, where duplicates exist
4. **Conflicts** - Inconsistencies between documents or code patterns
5. **Obsolete Content** - Documentation that should be removed or updated

## Repository Statistics

- Total files: ${fileTree.totalFiles}
- Max depth: ${fileTree.maxDepth}

## File Contents

${contentsDescription}

## Output Format

Return a JSON object matching this structure:

\`\`\`json
{
  "techStack": {
    "languages": ["TypeScript", "JavaScript"],
    "frameworks": ["React", "Express"],
    "tools": ["ESLint", "Prettier", "Vitest"],
    "metadata": [
      {"key": "packageManager", "value": "pnpm"},
      {"key": "nodeVersion", "value": "18+"}
    ]
  },
  "patterns": [
    {
      "category": "naming",
      "description": "Files use kebab-case, classes use PascalCase",
      "evidence": ["src/my-component.ts", "src/MyClass.ts"],
      "recommendation": "Document in STYLEGUIDE.md"
    }
  ],
  "existingDocs": [
    {
      "path": "README.md",
      "topics": ["installation", "usage", "api"],
      "duplicatesTopicsIn": [],
      "supersededByStandard": false
    }
  ],
  "conflicts": [
    {
      "topic": "testing strategy",
      "documentPaths": ["CONTRIBUTING.md", "README.md"],
      "suggestedResolution": "Consolidate testing guidance into TESTING.md"
    }
  ],
  "obsoletePaths": [],
  "structureSummary": "Monorepo with packages/ structure, hexagonal architecture"
}
\`\`\`

Be thorough but concise. Focus on patterns that should be documented in guidelines.`;
    }

    private formatFileContents(contents: Map<string, string>): string {
        const lines: string[] = [];

        for (const [path, content] of contents) {
            // Truncate very long files
            const truncated = content.length > 3000
                ? content.slice(0, 3000) + '\n... (truncated)'
                : content;

            lines.push(`### ${path}\n\n\`\`\`\n${truncated}\n\`\`\`\n`);
        }

        return lines.join('\n');
    }
}

/**
 * Parse the AI response into a RepositoryInsights object.
 */
export function parseRepositoryInsights(response: string): RepositoryInsights {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
        response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
        return getDefaultInsights();
    }

    try {
        const json = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(json);

        return {
            techStack: {
                languages: parsed.techStack?.languages ?? [],
                frameworks: parsed.techStack?.frameworks ?? [],
                tools: parsed.techStack?.tools ?? [],
                metadata: parsed.techStack?.metadata ?? [],
            },
            patterns: parsed.patterns ?? [],
            existingDocs: parsed.existingDocs ?? [],
            conflicts: parsed.conflicts ?? [],
            obsoletePaths: parsed.obsoletePaths ?? [],
            structureSummary: parsed.structureSummary ?? '',
        };
    } catch {
        return getDefaultInsights();
    }
}

function getDefaultInsights(): RepositoryInsights {
    return {
        techStack: {
            languages: [],
            frameworks: [],
            tools: [],
            metadata: [],
        },
        patterns: [],
        existingDocs: [],
        conflicts: [],
        obsoletePaths: [],
        structureSummary: 'Unable to analyze repository',
    };
}
