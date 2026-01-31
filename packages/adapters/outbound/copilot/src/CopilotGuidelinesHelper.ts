/**
 * Copilot Guidelines Helper
 *
 * Handles Copilot-specific guideline operations such as custom instructions.
 * This logic was extracted from core to keep Copilot-specific functionality
 * in the Copilot adapter package.
 */

import type { IFileSystemPort } from '@spec-driven/core';
import {
    loadCopilotInstructionsTemplate,
    loadCopilotInstructionsAppend,
} from './CopilotResourceLoader.js';

/**
 * Marker to identify SpecDriven instructions in copilot-instructions.md.
 */
const SPECDRIVEN_MARKER = '<!-- SpecDriven Instructions -->';

export interface CopilotGuidelinesHelperDeps {
    fileSystem: IFileSystemPort;
}

/**
 * Helper class for managing Copilot-specific guidelines.
 */
export class CopilotGuidelinesHelper {
    constructor(private readonly deps: CopilotGuidelinesHelperDeps) {}

    /**
     * Ensure SpecDriven instructions are in the Copilot custom instructions file.
     *
     * If the file exists and doesn't have SpecDriven instructions, appends them.
     * If the file doesn't exist, creates it with the full template.
     *
     * @param path - Path to the custom instructions file (default: .github/copilot-instructions.md)
     */
    async ensureCustomInstructions(path: string = '.github/copilot-instructions.md'): Promise<void> {
        const dir = path.substring(0, path.lastIndexOf('/'));

        if (await this.deps.fileSystem.exists(path)) {
            const content = await this.deps.fileSystem.readFile(path);

            // Only append if SpecDriven instructions aren't already present
            if (!content.includes(SPECDRIVEN_MARKER)) {
                await this.deps.fileSystem.writeFile(
                    path,
                    content + '\n' + loadCopilotInstructionsAppend()
                );
            }
        } else {
            // Create directory if needed
            if (dir) {
                await this.deps.fileSystem.createDirectory(dir);
            }
            // Create file with full template
            await this.deps.fileSystem.writeFile(path, loadCopilotInstructionsTemplate());
        }
    }

    /**
     * Check if custom instructions file has SpecDriven section.
     *
     * @param path - Path to the custom instructions file
     * @returns true if SpecDriven instructions are present
     */
    async hasSpecDrivenInstructions(path: string = '.github/copilot-instructions.md'): Promise<boolean> {
        if (!await this.deps.fileSystem.exists(path)) {
            return false;
        }

        const content = await this.deps.fileSystem.readFile(path);
        return content.includes(SPECDRIVEN_MARKER);
    }
}
