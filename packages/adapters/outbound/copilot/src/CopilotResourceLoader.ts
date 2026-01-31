/**
 * Copilot Resource Loader
 *
 * Loads Copilot-specific templates from the adapter's resources directory.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Base path candidates for Copilot resources.
 * Supports both development and bundled extension contexts.
 */
const RESOURCE_BASE_CANDIDATES = [
    // Copilot adapter dist (development)
    join(__dirname, '..', 'resources'),
    // VS Code extension bundled (copilot-resources folder)
    join(__dirname, 'copilot-resources'),
    // Alternative bundled location
    join(__dirname, 'dist', 'copilot-resources'),
];

/**
 * Resource paths relative to the Copilot resources directory.
 */
export const COPILOT_RESOURCE_PATHS = {
    copilotInstructions: 'templates/copilot-instructions.md',
    copilotInstructionsAppend: 'templates/copilot-instructions-append.md',
} as const;

/**
 * Cache for loaded resources to avoid repeated file reads.
 */
const resourceCache = new Map<string, string>();

/**
 * Load a Copilot resource file by its relative path.
 * Results are cached for performance.
 *
 * @param relativePath - Path relative to the Copilot resources directory
 * @returns The file content as a string
 * @throws Error if the file cannot be read
 */
export function loadCopilotResource(relativePath: string): string {
    if (resourceCache.has(relativePath)) {
        return resourceCache.get(relativePath)!;
    }

    let lastError: unknown;
    for (const base of RESOURCE_BASE_CANDIDATES) {
        const fullPath = join(base, relativePath);
        if (!existsSync(fullPath)) {
            continue;
        }
        try {
            const content = readFileSync(fullPath, 'utf-8');
            resourceCache.set(relativePath, content);
            return content;
        } catch (error) {
            lastError = error;
        }
    }

    const attemptedPaths = RESOURCE_BASE_CANDIDATES
        .map(base => join(base, relativePath))
        .join(', ');

    throw new Error(
        `Failed to load Copilot resource: ${relativePath}. ` +
        `Attempted paths: ${attemptedPaths}. ` +
        `Error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
}

/**
 * Load the Copilot instructions template.
 */
export function loadCopilotInstructionsTemplate(): string {
    return loadCopilotResource(COPILOT_RESOURCE_PATHS.copilotInstructions);
}

/**
 * Load the Copilot instructions append section.
 */
export function loadCopilotInstructionsAppend(): string {
    return loadCopilotResource(COPILOT_RESOURCE_PATHS.copilotInstructionsAppend);
}

/**
 * Clear the resource cache.
 * Useful for testing or when resources are updated at runtime.
 */
export function clearCopilotResourceCache(): void {
    resourceCache.clear();
}
