/**
 * Resource Loader
 *
 * Loads resource files (templates) from the resources directory.
 * Resources are bundled with the package and loaded at runtime.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Base path for resources directory.
 * Uses __dirname which is available in CommonJS.
 * In development: packages/core/src/resources
 * In production: packages/core/dist/resources (needs to be copied during build)
 */
const RESOURCE_BASE_CANDIDATES = [
    // Core package runtime (dist/lib -> dist/resources)
    join(__dirname, '..', 'resources'),
    // Bundled extension runtime (extension root/resources)
    join(__dirname, 'resources'),
    // Bundled extension runtime (extension root/dist/resources)
    join(__dirname, 'dist', 'resources'),
];

/**
 * Guideline types for the new guidelines system.
 */
export type GuidelinesTemplateType =
    | 'agents'
    | 'architecture'
    | 'contributing'
    | 'testing'
    | 'security'
    | 'styleguide';

/**
 * Resource paths relative to the resources directory.
 */
export const RESOURCE_PATHS = {
    templates: {
        guidelines: {
            agents: 'templates/guidelines/AGENTS.md',
            architecture: 'templates/guidelines/ARCHITECTURE.md',
            contributing: 'templates/guidelines/CONTRIBUTING.md',
            testing: 'templates/guidelines/TESTING.md',
            security: 'templates/guidelines/SECURITY.md',
            styleguide: 'templates/guidelines/STYLEGUIDE.md',
        },
        skills: {
            requirementsWriter: 'templates/skills/spec-driven-requirements-writer.md',
            technicalDesigner: 'templates/skills/spec-driven-technical-designer.md',
            taskDecomposer: 'templates/skills/spec-driven-task-decomposer.md',
            taskImplementer: 'templates/skills/spec-driven-task-implementer.md',
        },
    },
} as const;

/**
 * Cache for loaded resources to avoid repeated file reads.
 */
const resourceCache = new Map<string, string>();

/**
 * Load a resource file by its relative path.
 * Results are cached for performance.
 *
 * @param relativePath - Path relative to the resources directory
 * @returns The file content as a string
 * @throws Error if the file cannot be read
 */
export function loadResource(relativePath: string): string {
    // Check cache first
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
        `Failed to load resource: ${relativePath}. ` +
        `Attempted paths: ${attemptedPaths}. ` +
        `Error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
}

/**
 * Load a guidelines template file.
 * Guidelines are community-standard files at the repository root.
 */
export function loadGuidelinesTemplate(type: GuidelinesTemplateType): string {
    return loadResource(RESOURCE_PATHS.templates.guidelines[type]);
}

/**
 * Load an agent skill template file.
 * These are the phase-specific agent skills.
 */
export function loadAgentSkillTemplateByType(
    type: 'requirementsWriter' | 'technicalDesigner' | 'taskDecomposer' | 'taskImplementer'
): string {
    return loadResource(RESOURCE_PATHS.templates.skills[type]);
}

/**
 * Load the task implementer skill template.
 * @param skillName - The skill name to substitute in the template
 */
export function loadAgentSkillTemplate(skillName: string = 'spec-driven-task-implementer'): string {
    const template = loadResource(RESOURCE_PATHS.templates.skills.taskImplementer);
    return template.replace(/\{\{SKILL_NAME\}\}/g, skillName);
}

/**
 * Clear the resource cache.
 * Useful for testing or when resources are updated at runtime.
 */
export function clearResourceCache(): void {
    resourceCache.clear();
}

/**
 * Get the base path for resources (for debugging/testing).
 */
export function getResourcesBasePath(): string {
    return RESOURCE_BASE_CANDIDATES[0];
}

/**
 * Get all resource base candidates (for debugging/testing).
 */
export function getResourceBaseCandidates(): string[] {
    return [...RESOURCE_BASE_CANDIDATES];
}
