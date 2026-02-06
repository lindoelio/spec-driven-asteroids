/**
 * Guidelines Domain Entity
 *
 * Represents community-standard guideline files that guide AI agent behavior.
 * These files live at the repository root for maximum compatibility with
 * all AI coding assistants (GitHub Copilot, Claude, OpenCode, Cursor, etc.).
 *
 * Uses industry-standard file names:
 * - AGENTS.md - Primary AI agent instructions, project overview, tech stack
 * - ARCHITECTURE.md - System architecture and component relationships
 * - CONTRIBUTING.md - Coding conventions and contribution workflow
 * - TESTING.md - Testing strategy, patterns, and coverage requirements
 * - SECURITY.md - Security policies and vulnerability handling
 * - STYLEGUIDE.md - Naming conventions, patterns, and code style
 */

import {
    loadGuidelinesTemplate,
    loadAgentSkillTemplate,
} from '../lib/ResourceLoader.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collection of guideline documents.
 * All files are at the repository root.
 */
export interface GuidelinesDocs {
    /** AGENTS.md - Primary AI agent instructions, project overview, tech stack */
    agents?: string;

    /** ARCHITECTURE.md - System architecture and component relationships */
    architecture?: string;

    /** CONTRIBUTING.md - Coding conventions and contribution workflow */
    contributing?: string;

    /** TESTING.md - Testing strategy, patterns, and coverage requirements */
    testing?: string;

    /** SECURITY.md - Security policies and vulnerability handling */
    security?: string;

    /** STYLEGUIDE.md - Naming conventions, patterns, and code style */
    styleguide?: string;
}

/**
 * Guideline types for type-safe operations.
 */
export type GuidelineType = keyof GuidelinesDocs;

// ═══════════════════════════════════════════════════════════════════════════════
// Repository Insights Types (AI-Driven Analysis)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Represents a node in the file tree.
 */
export interface FileNode {
    /** Relative path from workspace root */
    path: string;
    /** Type of the node */
    type: 'file' | 'directory';
    /** File size in bytes (0 for directories) */
    size: number;
    /** File extension without the dot (empty for directories) */
    extension: string;
}

/**
 * Represents the complete file tree of a repository.
 */
export interface FileTree {
    /** All nodes in the tree */
    nodes: FileNode[];
    /** Total number of files (excluding directories) */
    totalFiles: number;
    /** Maximum depth traversed */
    maxDepth: number;
}

/**
 * Technology stack discovered by AI analysis.
 */
export interface TechStack {
    /** Programming languages detected */
    languages: string[];
    /** Frameworks and libraries detected */
    frameworks: string[];
    /** Development tools (build, lint, etc.) */
    tools: string[];
    /** Additional metadata as key-value pairs */
    metadata: Array<{ key: string; value: string }>;
}

/**
 * A pattern discovered in the codebase by AI analysis.
 */
export interface DiscoveredPattern {
    /** Category of the pattern (e.g., 'naming', 'architecture', 'testing') */
    category: string;
    /** Description of the discovered pattern */
    description: string;
    /** File paths or code snippets that evidence this pattern */
    evidence: string[];
    /** AI recommendation for standardizing this pattern */
    recommendation: string;
}

/**
 * Analysis of an existing documentation file.
 */
export interface DocumentAnalysis {
    /** Path to the document */
    path: string;
    /** Topics covered in this document */
    topics: string[];
    /** Paths to other documents that cover the same topics */
    duplicatesTopicsIn: string[];
    /** True if this document is superseded by the new standard guidelines */
    supersededByStandard: boolean;
}

/**
 * A conflict detected between documents.
 */
export interface Conflict {
    /** The topic that has conflicting guidance */
    topic: string;
    /** Paths to documents with conflicting content */
    documentPaths: string[];
    /** AI-suggested resolution */
    suggestedResolution: string;
}

/**
 * Comprehensive insights about a repository, produced by AI analysis.
 * This structure is technology-agnostic; the AI determines what's relevant.
 */
export interface RepositoryInsights {
    /** Discovered technology stack */
    techStack: TechStack;
    /** Patterns discovered in the codebase */
    patterns: DiscoveredPattern[];
    /** Analysis of existing documentation */
    existingDocs: DocumentAnalysis[];
    /** Conflicts detected between documents */
    conflicts: Conflict[];
    /** Paths to documents that should be marked obsolete */
    obsoletePaths: string[];
    /** High-level summary of the repository structure */
    structureSummary: string;
}

/**
 * Document Responsibility Matrix.
 * Defines what each guideline document contains and what it should NOT contain.
 * Used to ensure no overlap between documents.
 */
export const DOCUMENT_RESPONSIBILITY_MATRIX: Record<
    GuidelineType,
    { contains: string[]; excludes: string[] }
> = {
    agents: {
        contains: [
            'Agent persona & behavior',
            'Senior engineer principles',
            'Project vision & goals',
            'Tech stack summary (high-level)',
            'Workflow reference (pointers only)',
            'Decision-making principles',
        ],
        excludes: [
            'Detailed code conventions',
            'Testing patterns',
            'Security rules',
            'Architecture diagrams',
            'Git workflow details',
        ],
    },
    architecture: {
        contains: [
            'System overview',
            'C4 diagrams (Context, Container, Component)',
            'Data flow diagrams',
            'Package structure',
            'Architecture Decision Records (ADRs)',
        ],
        excludes: [
            'Build commands',
            'Code conventions',
            'Testing notes',
            'Documentation rules',
            'Workflow steps',
        ],
    },
    contributing: {
        contains: [
            'Git workflow',
            'PR process',
            'Branch naming',
            'Commit message format',
            'Code review process',
        ],
        excludes: [
            'Detailed code style',
            'Testing patterns',
            'Architecture diagrams',
            'Security policies',
        ],
    },
    styleguide: {
        contains: [
            'Naming conventions',
            'Code formatting rules',
            'Import/export patterns',
            'Error handling patterns',
            'Design patterns',
        ],
        excludes: [
            'Git workflow',
            'Testing strategy',
            'Security policies',
            'Architecture decisions',
        ],
    },
    testing: {
        contains: [
            'Test philosophy',
            'Test types and when to use each',
            'Coverage expectations',
            'Test organization',
            'Test frameworks',
        ],
        excludes: [
            'Code style details',
            'Git workflow',
            'Architecture diagrams',
            'Security policies',
        ],
    },
    security: {
        contains: [
            'Authentication requirements',
            'Authorization requirements',
            'Data protection policies',
            'Vulnerability handling',
            'Secrets management',
        ],
        excludes: [
            'Code style details',
            'Testing patterns',
            'Architecture diagrams',
            'Git workflow',
        ],
    },
};

/**
 * Configuration for engine-specific skill files.
 * Different AI engines have different conventions for skill/instruction files.
 */
export interface EngineSkillConfig {
    /** The base directory for all skills (e.g., '.spec/skills') */
    skillBaseDirectory: string;

    /** The directory path for the primary skill file (e.g., '.spec/skills/spec-driven-task-implementer') */
    skillDirectory: string;

    /** The skill file name (e.g., 'SKILL.md') */
    skillFileName: string;

    /** The skill name used in the file content */
    skillName: string;

    /** Optional: Path to custom instructions file (e.g., '.github/copilot-instructions.md') */
    customInstructionsPath?: string;
}

/**
 * Result of generating a single guideline file.
 * Provides rich information about what happened for streaming feedback.
 */
export interface GuidelineGenerationResult {
    /** The file name (e.g., "AGENTS.md") */
    fileName: string;

    /** The generated content */
    content: string;

    /** True if the file was newly created (didn't exist before) */
    wasCreated: boolean;

    /** True if the content was actually modified */
    wasModified: boolean;

    /** Count of <!-- REVIEW: --> markers that need user attention */
    placeholderCount: number;

    /** Brief summary of what was generated */
    summary?: string;
}

/**
 * Result of the full configure operation.
 * Used for streaming feedback during guideline initialization.
 */
export interface ConfigureResult {
    /** Analysis of the project's technology stack */
    projectAnalysis: {
        languages: string[];
        frameworks: string[];
        testFrameworks: string[];
        linters: string[];
        buildTools: string[];
        packageManager: string | null;
    };

    /** Results for each guideline file */
    guidelines: GuidelineGenerationResult[];

    /** Copilot/engine integration files that were created */
    copilotFiles: { path: string; wasCreated: boolean }[];

    /** Count of newly created files */
    totalCreated: number;

    /** Count of updated files */
    totalUpdated: number;

    /** Total placeholder count across all files */
    totalPlaceholders: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Guideline file paths at repository root.
 * These are community-standard locations recognized by all AI tools.
 */
export const GUIDELINES_PATHS = {
    agents: 'AGENTS.md',
    architecture: 'ARCHITECTURE.md',
    contributing: 'CONTRIBUTING.md',
    testing: 'TESTING.md',
    security: 'SECURITY.md',
    styleguide: 'STYLEGUIDE.md',
} as const;

/**
 * Markers used to identify SpecDriven-managed sections in guideline files.
 * These allow intelligent merging without overwriting user content.
 */
export const SPECDRIVEN_SECTION_MARKERS = {
    start: '<!-- SpecDriven:managed:start -->',
    end: '<!-- SpecDriven:managed:end -->',
    legacy: '<!-- SpecDriven Instructions -->',
} as const;

/**
 * Marker to identify SpecDriven instructions in copilot-instructions.md.
 */
export const SPECDRIVEN_INSTRUCTIONS_MARKER = SPECDRIVEN_SECTION_MARKERS.legacy;

// ═══════════════════════════════════════════════════════════════════════════════
// Template Getters (Lazy Loading from Resource Files)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the AGENTS.md template.
 * Primary AI agent instructions with project overview and tech stack.
 */
export function getAgentsTemplate(): string {
    return loadGuidelinesTemplate('agents');
}

/**
 * Get the ARCHITECTURE.md template.
 * System architecture and component relationships.
 */
export function getArchitectureTemplate(): string {
    return loadGuidelinesTemplate('architecture');
}

/**
 * Get the CONTRIBUTING.md template.
 * Coding conventions and contribution workflow.
 */
export function getContributingTemplate(): string {
    return loadGuidelinesTemplate('contributing');
}

/**
 * Get the TESTING.md template.
 * Testing strategy, patterns, and coverage requirements.
 */
export function getTestingTemplate(): string {
    return loadGuidelinesTemplate('testing');
}

/**
 * Get the SECURITY.md template.
 * Security policies and vulnerability handling.
 */
export function getSecurityTemplate(): string {
    return loadGuidelinesTemplate('security');
}

/**
 * Get the STYLEGUIDE.md template.
 * Naming conventions, patterns, and code style.
 */
export function getStyleguideTemplate(): string {
    return loadGuidelinesTemplate('styleguide');
}

/**
 * Get a guideline template by type.
 */
export function getGuidelineTemplate(type: GuidelineType): string {
    switch (type) {
        case 'agents':
            return getAgentsTemplate();
        case 'architecture':
            return getArchitectureTemplate();
        case 'contributing':
            return getContributingTemplate();
        case 'testing':
            return getTestingTemplate();
        case 'security':
            return getSecurityTemplate();
        case 'styleguide':
            return getStyleguideTemplate();
        default:
            throw new Error(`Unknown guideline type: ${type}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Skill Templates
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Agent Skill template with customizable skill name.
 * @param skillName - The name of the skill (e.g., 'spec-driven-task-implementer')
 */
export function generateAgentSkillTemplate(skillName: string = 'spec-driven-task-implementer'): string {
    return loadAgentSkillTemplate(skillName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if content contains SpecDriven managed sections.
 */
export function hasSpecDrivenSection(content: string): boolean {
    return (
        content.includes(SPECDRIVEN_SECTION_MARKERS.start) ||
        content.includes(SPECDRIVEN_SECTION_MARKERS.legacy)
    );
}

/**
 * Extract SpecDriven managed sections from content.
 * Returns the content between start and end markers.
 */
export function extractSpecDrivenSection(content: string): string | null {
    const startMarker = SPECDRIVEN_SECTION_MARKERS.start;
    const endMarker = SPECDRIVEN_SECTION_MARKERS.end;

    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        return null;
    }

    return content.substring(startIndex + startMarker.length, endIndex).trim();
}

/**
 * Remove SpecDriven managed sections from content.
 * Returns the content without the managed sections.
 */
export function removeSpecDrivenSection(content: string): string {
    const startMarker = SPECDRIVEN_SECTION_MARKERS.start;
    const endMarker = SPECDRIVEN_SECTION_MARKERS.end;

    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        return content;
    }

    const before = content.substring(0, startIndex).trimEnd();
    const after = content.substring(endIndex + endMarker.length).trimStart();

    return (before + '\n\n' + after).trim();
}

/**
 * Wrap content in SpecDriven managed section markers.
 */
export function wrapInSpecDrivenSection(content: string): string {
    return `${SPECDRIVEN_SECTION_MARKERS.start}\n${content}\n${SPECDRIVEN_SECTION_MARKERS.end}`;
}
