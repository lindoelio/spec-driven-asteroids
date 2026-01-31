/**
 * Repository Analysis Strategy
 *
 * Prompts the AI to select relevant files from a file tree for analysis.
 * This is the first step in AI-driven guideline generation.
 */

import type { PromptStrategy } from './PromptStrategy.js';
import type { FileTree } from '../domain/Guidelines.js';

export interface RepositoryAnalysisStrategyOptions {
    fileTree: FileTree;
}

export class RepositoryAnalysisStrategy implements PromptStrategy {
    type = 'repository-analysis';
    systemPrompt: string;

    constructor(options: RepositoryAnalysisStrategyOptions) {
        const { fileTree } = options;

        // Format file tree for the prompt
        const treeDescription = this.formatFileTree(fileTree);

        this.systemPrompt = `You are a senior software architect analyzing a repository to generate development guidelines.

## Task

Given the file tree below, identify which files should be read to understand:
1. **Technology stack** (languages, frameworks, build tools)
2. **Code patterns and conventions** (naming, structure, error handling)
3. **Existing documentation** that might conflict with new guidelines
4. **Project structure** (package boundaries, module organization)

## File Tree

\`\`\`
${treeDescription}
\`\`\`

**Total files**: ${fileTree.totalFiles}

## Selection Criteria

Select files that are:
- Configuration files (package.json, tsconfig.json, pyproject.toml, etc.)
- Main entry points (index.ts, main.ts, app.ts)
- Existing documentation (*.md files at root or docs/)
- Representative source files (1-2 examples per major directory)
- Test configuration (jest.config.*, vitest.config.*, etc.)

Do NOT select:
- Generated files (dist/, build/, coverage/)
- All source files (just select representative samples)
- Lock files (package-lock.json, pnpm-lock.yaml)

## Output Format

Return a JSON array of file paths to read:

\`\`\`json
["path/to/file1.ts", "path/to/file2.md", ...]
\`\`\`

Select between 10-30 files maximum for efficient analysis.`;
    }

    private formatFileTree(tree: FileTree): string {
        // Group by directory for readability
        const dirs = new Map<string, string[]>();

        for (const node of tree.nodes) {
            const parts = node.path.split('/');
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
            const name = parts[parts.length - 1];

            if (!dirs.has(dir)) {
                dirs.set(dir, []);
            }

            const suffix = node.type === 'directory' ? '/' : '';
            dirs.get(dir)!.push(`${name}${suffix}`);
        }

        // Format as tree-like structure
        const lines: string[] = [];
        const sortedDirs = Array.from(dirs.keys()).sort();

        for (const dir of sortedDirs.slice(0, 50)) { // Limit to prevent token overflow
            lines.push(`${dir}/`);
            const files = dirs.get(dir)!.slice(0, 20); // Limit files per dir
            for (const file of files) {
                lines.push(`  ${file}`);
            }
            if (dirs.get(dir)!.length > 20) {
                lines.push(`  ... and ${dirs.get(dir)!.length - 20} more`);
            }
        }

        if (sortedDirs.length > 50) {
            lines.push(`... and ${sortedDirs.length - 50} more directories`);
        }

        return lines.join('\n');
    }
}
