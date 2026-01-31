/**
 * GuidelinesGenerator Service
 *
 * Creates and maintains community-standard guideline files at repository root.
 * Uses AI if an engine is available, otherwise falls back to template + analysis.
 */

import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import {
    type GuidelinesDocs,
    type GuidelineType,
    type EngineSkillConfig,
    type GuidelineGenerationResult,
    type ConfigureResult,
    type RepositoryInsights,
    GUIDELINES_PATHS,
    getGuidelineTemplate,
    generateAgentSkillTemplate,
    SPECDRIVEN_SECTION_MARKERS,
    extractSpecDrivenSection,
    wrapInSpecDrivenSection,
    hasSpecDrivenSection,
} from '../domain/Guidelines.js';
import { GuidelinesStrategy, type ProjectAnalysisContext } from '../strategies/GuidelinesStrategy.js';
import { loadAgentSkillTemplateByType } from '../lib/ResourceLoader.js';

export interface GuidelinesGeneratorDependencies {
    fileSystem: IFileSystemPort;
    engine?: IEnginePort;
    skillConfig?: EngineSkillConfig;
}

export interface ProjectAnalysis {
    languages: string[];
    frameworks: string[];
    dependencies: { name: string; version: string; purpose?: string }[];
    devDependencies: { name: string; version: string; purpose?: string }[];
    buildTools: string[];
    testFrameworks: string[];
    linters: string[];
    packageManager: string | null;
}

export interface MergeResult {
    content: string;
    wasExisting: boolean;
    sectionsAdded: string[];
    sectionsUpdated: string[];
}

/**
 * Default skill config for GitHub Copilot.
 */
export const DEFAULT_SKILL_CONFIG: EngineSkillConfig = {
    skillDirectory: '.github/skills/sdd-task-implementer',
    skillFileName: 'SKILL.md',
    skillName: 'sdd-task-implementer',
    customInstructionsPath: '.github/copilot-instructions.md',
};

export class GuidelinesGenerator {
    private engine: IEnginePort | null = null;
    private skillConfig: EngineSkillConfig;

    constructor(private readonly deps: GuidelinesGeneratorDependencies) {
        this.engine = deps.engine ?? null;
        this.skillConfig = deps.skillConfig ?? DEFAULT_SKILL_CONFIG;
    }

    setSkillConfig(config: EngineSkillConfig): void {
        this.skillConfig = config;
    }

    setEngine(engine: IEnginePort): void {
        this.engine = engine;
    }

    /**
     * Check if the engine supports AI-driven analysis.
     * This checks if the engine has the new analysis methods.
     */
    private supportsAIDrivenAnalysis(): boolean {
        if (!this.engine) return false;
        // Check if the engine has the new AI-driven methods
        return (
            typeof this.engine.selectRelevantFiles === 'function' &&
            typeof this.engine.analyzeRepository === 'function' &&
            typeof this.engine.synthesizeGuideline === 'function'
        );
    }

    /**
     * Initialize guidelines using AI-driven codebase exploration.
     * Falls back to template-based generation if AI is unavailable.
     */
    async initializeGuidelinesAIDriven(
        onProgress?: (result: GuidelineGenerationResult) => void
    ): Promise<ConfigureResult> {
        // If AI-driven analysis is not available, fall back to template-based
        if (!this.supportsAIDrivenAnalysis()) {
            console.warn('AI-driven analysis not available, falling back to template-based generation');
            return this.initializeGuidelinesWithProgress(onProgress);
        }

        const results: GuidelineGenerationResult[] = [];
        const copilotFiles: { path: string; wasCreated: boolean }[] = [];

        // Phase 1: Collect raw file tree
        const fileTree = await this.deps.fileSystem.listFilesRecursive(10);

        // Phase 2: AI selects relevant files
        const relevantPaths = await this.engine!.selectRelevantFiles(fileTree);

        // Phase 3: Read selected file contents
        const contents = new Map<string, string>();
        for (const path of relevantPaths) {
            try {
                const content = await this.deps.fileSystem.readFile(path);
                contents.set(path, content);
            } catch {
                // Skip files we can't read
            }
        }

        // Phase 4: AI analyzes repository
        const insights = await this.engine!.analyzeRepository(fileTree, contents);

        // Phase 5: AI synthesizes each guideline
        const guidelineTypes: GuidelineType[] = [
            'agents', 'architecture', 'contributing',
            'testing', 'security', 'styleguide'
        ];

        for (const type of guidelineTypes) {
            const path = GUIDELINES_PATHS[type];
            const existed = await this.deps.fileSystem.exists(path);

            // Generate using AI
            const content = await this.engine!.synthesizeGuideline(type, insights);
            const placeholderCount = (content.match(/<!-- REVIEW:|<!-- TBD:/g) || []).length;

            // Merge with existing content
            const merged = await this.mergeGuideline(type, content);

            const result: GuidelineGenerationResult = {
                fileName: path,
                content: merged.content,
                wasCreated: !existed,
                wasModified: true,
                placeholderCount,
                summary: `AI-generated from repository analysis`,
            };

            results.push(result);
            onProgress?.(result);
        }

        // Phase 6: Handle obsolete docs (mark for user review)
        if (insights.obsoletePaths.length > 0) {
            console.log('Obsolete documentation detected:', insights.obsoletePaths);
            // Note: We don't automatically delete, just report
        }

        // Ensure copilot skill file
        const skillPath = `${this.skillConfig.skillDirectory}/${this.skillConfig.skillFileName}`;
        const skillExisted = await this.deps.fileSystem.exists(skillPath);
        await this.ensureAgentSkill();
        copilotFiles.push({ path: skillPath, wasCreated: !skillExisted });

        if (this.skillConfig.customInstructionsPath) {
            const instructionsExisted = await this.deps.fileSystem.exists(this.skillConfig.customInstructionsPath);
            copilotFiles.push({
                path: this.skillConfig.customInstructionsPath,
                wasCreated: !instructionsExisted
            });
        }

        const totalCreated = results.filter(r => r.wasCreated).length;
        const totalUpdated = results.filter(r => !r.wasCreated).length;
        const totalPlaceholders = results.reduce((sum, r) => sum + r.placeholderCount, 0);

        return {
            projectAnalysis: this.insightsToProjectAnalysis(insights),
            guidelines: results,
            copilotFiles,
            totalCreated,
            totalUpdated,
            totalPlaceholders,
        };
    }

    /**
     * Convert RepositoryInsights to the legacy ProjectAnalysis format.
     */
    private insightsToProjectAnalysis(insights: RepositoryInsights): ConfigureResult['projectAnalysis'] {
        return {
            languages: insights.techStack.languages,
            frameworks: insights.techStack.frameworks,
            testFrameworks: insights.techStack.tools.filter(t =>
                t.toLowerCase().includes('test') || t.toLowerCase().includes('jest') ||
                t.toLowerCase().includes('vitest') || t.toLowerCase().includes('mocha')
            ),
            linters: insights.techStack.tools.filter(t =>
                t.toLowerCase().includes('lint') || t.toLowerCase().includes('eslint') ||
                t.toLowerCase().includes('prettier') || t.toLowerCase().includes('biome')
            ),
            buildTools: insights.techStack.tools.filter(t =>
                t.toLowerCase().includes('build') || t.toLowerCase().includes('vite') ||
                t.toLowerCase().includes('webpack') || t.toLowerCase().includes('tsc')
            ),
            packageManager: insights.techStack.metadata.find(m => m.key === 'packageManager')?.value ?? null,
        };
    }

    /**
     * Initialize guideline files, creating or updating as needed.
     */
    async initializeGuidelines(): Promise<GuidelinesDocs> {
        const results = await this.generateAllGuidelines();
        await this.ensureAgentSkill();
        return results;
    }

    /**
     * Progress callback type for streaming feedback.
     */
    // Defined inline to avoid circular dependencies

    /**
     * Initialize guidelines with progress callbacks for streaming feedback.
     * This method provides real-time updates as each file is processed.
     */
    async initializeGuidelinesWithProgress(
        onProgress?: (result: GuidelineGenerationResult) => void
    ): Promise<ConfigureResult> {
        const analysis = await this.analyzeProject();
        const results: GuidelineGenerationResult[] = [];
        const copilotFiles: { path: string; wasCreated: boolean }[] = [];

        // Process each guideline type with progress reporting
        const guidelineTypes: GuidelineType[] = [
            'agents', 'architecture', 'contributing',
            'testing', 'security', 'styleguide'
        ];

        for (const type of guidelineTypes) {
            const path = GUIDELINES_PATHS[type];
            const existed = await this.deps.fileSystem.exists(path);

            // Generate the guideline
            const genResult = await this.generateGuidelineByType(type);

            // Count placeholders (<!-- REVIEW: --> markers)
            const placeholderCount = (genResult.content.match(/<!-- REVIEW:/g) || []).length;

            const result: GuidelineGenerationResult = {
                fileName: path,
                content: genResult.content,
                wasCreated: !existed,
                wasModified: true, // We always write, so it's modified
                placeholderCount,
                summary: genResult.summary,
            };

            results.push(result);
            onProgress?.(result);
        }

        // Ensure copilot skill file
        const skillPath = `${this.skillConfig.skillDirectory}/${this.skillConfig.skillFileName}`;
        const skillExisted = await this.deps.fileSystem.exists(skillPath);
        await this.ensureAgentSkill();
        copilotFiles.push({ path: skillPath, wasCreated: !skillExisted });

        // Note: copilot-instructions.md is handled by the adapter (CopilotGuidelinesHelper)
        // We report it here for the UI but the adapter handles the actual write
        if (this.skillConfig.customInstructionsPath) {
            const instructionsExisted = await this.deps.fileSystem.exists(this.skillConfig.customInstructionsPath);
            copilotFiles.push({
                path: this.skillConfig.customInstructionsPath,
                wasCreated: !instructionsExisted
            });
        }

        // Generate README.md if it doesn't exist
        const readmeResult = await this.ensureReadme(analysis, onProgress);
        if (readmeResult) {
            results.push(readmeResult);
        }

        // Generate README.md for each package in monorepo
        const packageReadmes = await this.ensurePackageReadmes(analysis, onProgress);
        results.push(...packageReadmes);

        const totalCreated = results.filter(r => r.wasCreated).length;
        const totalUpdated = results.filter(r => !r.wasCreated).length;
        const totalPlaceholders = results.reduce((sum, r) => sum + r.placeholderCount, 0);

        return {
            projectAnalysis: {
                languages: analysis.languages,
                frameworks: analysis.frameworks,
                testFrameworks: analysis.testFrameworks,
                linters: analysis.linters,
                buildTools: analysis.buildTools,
                packageManager: analysis.packageManager,
            },
            guidelines: results,
            copilotFiles,
            totalCreated,
            totalUpdated,
            totalPlaceholders,
        };
    }

    /**
     * Generate a specific guideline by type.
     * Helper for initializeGuidelinesWithProgress.
     */
    private async generateGuidelineByType(type: GuidelineType): Promise<{ content: string; summary: string }> {
        switch (type) {
            case 'agents':
                return this.generateAgentsGuideline();
            case 'architecture':
                return this.generateArchitectureGuideline();
            case 'contributing':
                return this.generateContributingGuideline();
            case 'testing':
                return this.generateTestingGuideline();
            case 'security':
                return this.generateSecurityGuideline();
            case 'styleguide':
                return this.generateStyleguideGuideline();
            default:
                throw new Error(`Unknown guideline type: ${type}`);
        }
    }

    /**
     * Generate all guideline files.
     */
    async generateAllGuidelines(userInquiry?: string): Promise<GuidelinesDocs> {
        const agents = await this.generateAgentsGuideline(userInquiry);
        const architecture = await this.generateArchitectureGuideline();
        const contributing = await this.generateContributingGuideline();
        const testing = await this.generateTestingGuideline();
        const security = await this.generateSecurityGuideline();
        const styleguide = await this.generateStyleguideGuideline();

        await this.ensureAgentSkill();

        return {
            agents: agents.content,
            architecture: architecture.content,
            contributing: contributing.content,
            testing: testing.content,
            security: security.content,
            styleguide: styleguide.content,
        };
    }

    /**
     * Load existing guidelines from disk.
     */
    async loadGuidelines(): Promise<GuidelinesDocs> {
        const docs: GuidelinesDocs = {};

        if (await this.deps.fileSystem.exists(GUIDELINES_PATHS.agents)) {
            docs.agents = await this.deps.fileSystem.readFile(GUIDELINES_PATHS.agents);
        }
        if (await this.deps.fileSystem.exists(GUIDELINES_PATHS.architecture)) {
            docs.architecture = await this.deps.fileSystem.readFile(GUIDELINES_PATHS.architecture);
        }
        if (await this.deps.fileSystem.exists(GUIDELINES_PATHS.contributing)) {
            docs.contributing = await this.deps.fileSystem.readFile(GUIDELINES_PATHS.contributing);
        }
        if (await this.deps.fileSystem.exists(GUIDELINES_PATHS.testing)) {
            docs.testing = await this.deps.fileSystem.readFile(GUIDELINES_PATHS.testing);
        }
        if (await this.deps.fileSystem.exists(GUIDELINES_PATHS.security)) {
            docs.security = await this.deps.fileSystem.readFile(GUIDELINES_PATHS.security);
        }
        if (await this.deps.fileSystem.exists(GUIDELINES_PATHS.styleguide)) {
            docs.styleguide = await this.deps.fileSystem.readFile(GUIDELINES_PATHS.styleguide);
        }

        return docs;
    }

    /**
     * Generate AGENTS.md guideline.
     */
    async generateAgentsGuideline(userInquiry?: string): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();
        const existing = await this.loadGuidelines();

        let content = this.formatAgentsGuideline(analysis, userInquiry);
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('agents', analysis, existing, userInquiry);
            content = result.content;
            summary = result.summary;
        }

        const merged = await this.mergeGuideline('agents', content);

        return { content: merged.content, summary };
    }

    /**
     * Generate ARCHITECTURE.md guideline.
     */
    async generateArchitectureGuideline(): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();
        const existing = await this.loadGuidelines();

        let content = this.formatArchitectureGuideline(analysis);
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('architecture', analysis, existing);
            content = result.content;
            summary = result.summary;
        }

        const merged = await this.mergeGuideline('architecture', content);

        return { content: merged.content, summary };
    }

    /**
     * Generate CONTRIBUTING.md guideline.
     */
    async generateContributingGuideline(): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();
        const existing = await this.loadGuidelines();

        let content = this.formatContributingGuideline(analysis);
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('contributing', analysis, existing);
            content = result.content;
            summary = result.summary;
        }

        const merged = await this.mergeGuideline('contributing', content);

        return { content: merged.content, summary };
    }

    /**
     * Generate TESTING.md guideline.
     */
    async generateTestingGuideline(): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();
        const existing = await this.loadGuidelines();

        let content = this.formatTestingGuideline(analysis);
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('testing', analysis, existing);
            content = result.content;
            summary = result.summary;
        }

        const merged = await this.mergeGuideline('testing', content);

        return { content: merged.content, summary };
    }

    /**
     * Generate SECURITY.md guideline.
     */
    async generateSecurityGuideline(): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();
        const existing = await this.loadGuidelines();

        let content = this.formatSecurityGuideline();
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('security', analysis, existing);
            content = result.content;
            summary = result.summary;
        }

        const merged = await this.mergeGuideline('security', content);

        return { content: merged.content, summary };
    }

    /**
     * Generate STYLEGUIDE.md guideline.
     */
    async generateStyleguideGuideline(): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();
        const existing = await this.loadGuidelines();

        let content = this.formatStyleguideGuideline(analysis);
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('styleguide', analysis, existing);
            content = result.content;
            summary = result.summary;
        }

        const merged = await this.mergeGuideline('styleguide', content);

        return { content: merged.content, summary };
    }

    /**
     * Check if guidelines are initialized.
     */
    async isInitialized(): Promise<boolean> {
        const exists = await Promise.all([
            this.deps.fileSystem.exists(GUIDELINES_PATHS.agents),
            this.deps.fileSystem.exists(GUIDELINES_PATHS.contributing),
            this.deps.fileSystem.exists(GUIDELINES_PATHS.testing),
        ]);
        return exists.some(Boolean);
    }

    /**
     * Merge generated guideline content into existing file.
     * If file exists, only managed section is updated. Otherwise full content written.
     */
    async mergeGuideline(type: GuidelineType, generatedContent: string): Promise<MergeResult> {
        const path = GUIDELINES_PATHS[type];
        const managedContent = this.extractManagedContent(generatedContent);

        if (!await this.deps.fileSystem.exists(path)) {
            await this.deps.fileSystem.writeFile(path, generatedContent);
            return {
                content: generatedContent,
                wasExisting: false,
                sectionsAdded: [type],
                sectionsUpdated: [],
            };
        }

        const existingContent = await this.deps.fileSystem.readFile(path);
        const updatedContent = this.replaceManagedSection(existingContent, managedContent);

        await this.deps.fileSystem.writeFile(path, updatedContent);

        return {
            content: updatedContent,
            wasExisting: true,
            sectionsAdded: [],
            sectionsUpdated: [type],
        };
    }

    /**
     * Ensure the SpecDriven Agent Skills exist.
     * Creates all phase-specific skills: task-implementer, requirements-writer,
     * technical-designer, and task-decomposer.
     * Note: Custom instructions (e.g., copilot-instructions.md) are handled
     * by the specific adapter (e.g., CopilotGuidelinesHelper in the Copilot adapter).
     */
    async ensureAgentSkill(): Promise<void> {
        // Create the main task implementer skill
        const skillPath = `${this.skillConfig.skillDirectory}/${this.skillConfig.skillFileName}`;
        if (!await this.deps.fileSystem.exists(skillPath)) {
            await this.deps.fileSystem.createDirectory(this.skillConfig.skillDirectory);
            await this.deps.fileSystem.writeFile(skillPath, generateAgentSkillTemplate(this.skillConfig.skillName));
        }

        // Create all other agent skills
        const agentSkills = [
            {
                dir: '.github/skills/sdd-requirements-writer',
                file: 'SKILL.md',
                content: loadAgentSkillTemplateByType('requirementsWriter'),
            },
            {
                dir: '.github/skills/sdd-technical-designer',
                file: 'SKILL.md',
                content: loadAgentSkillTemplateByType('technicalDesigner'),
            },
            {
                dir: '.github/skills/sdd-task-decomposer',
                file: 'SKILL.md',
                content: loadAgentSkillTemplateByType('taskDecomposer'),
            },
        ];

        for (const skill of agentSkills) {
            const path = `${skill.dir}/${skill.file}`;
            if (!await this.deps.fileSystem.exists(path)) {
                await this.deps.fileSystem.createDirectory(skill.dir);
                await this.deps.fileSystem.writeFile(path, skill.content);
            }
        }
    }

    /**
     * Ensure README.md exists at the project root.
     * Creates a contextualized README if it doesn't exist.
     */
    private async ensureReadme(
        analysis: ProjectAnalysis,
        onProgress?: (result: GuidelineGenerationResult) => void
    ): Promise<GuidelineGenerationResult | null> {
        const readmePath = 'README.md';

        if (await this.deps.fileSystem.exists(readmePath)) {
            return null; // Don't overwrite existing README
        }

        const content = this.generateReadmeContent(analysis);
        await this.deps.fileSystem.writeFile(readmePath, content);

        const placeholderCount = (content.match(/<!-- REVIEW:/g) || []).length;

        const result: GuidelineGenerationResult = {
            fileName: readmePath,
            content,
            wasCreated: true,
            wasModified: true,
            placeholderCount,
            summary: 'Generated project README.',
        };

        onProgress?.(result);
        return result;
    }

    /**
     * Ensure README.md exists for each package in a monorepo.
     */
    private async ensurePackageReadmes(
        analysis: ProjectAnalysis,
        onProgress?: (result: GuidelineGenerationResult) => void
    ): Promise<GuidelineGenerationResult[]> {
        const results: GuidelineGenerationResult[] = [];

        // Detect monorepo packages
        const packageDirs = await this.detectMonorepoPackages();

        for (const packageDir of packageDirs) {
            const readmePath = `${packageDir}/README.md`;

            if (await this.deps.fileSystem.exists(readmePath)) {
                continue; // Don't overwrite existing README
            }

            const packageName = packageDir.split('/').pop() || packageDir;
            const content = this.generatePackageReadmeContent(packageName, packageDir, analysis);
            await this.deps.fileSystem.writeFile(readmePath, content);

            const placeholderCount = (content.match(/<!-- REVIEW:/g) || []).length;

            const result: GuidelineGenerationResult = {
                fileName: readmePath,
                content,
                wasCreated: true,
                wasModified: true,
                placeholderCount,
                summary: `Generated README for ${packageName}.`,
            };

            results.push(result);
            onProgress?.(result);
        }

        return results;
    }

    /**
     * Detect monorepo package directories.
     */
    private async detectMonorepoPackages(): Promise<string[]> {
        const packages: string[] = [];

        // Check for pnpm-workspace.yaml or packages/ directory
        const hasWorkspaceYaml = await this.deps.fileSystem.exists('pnpm-workspace.yaml');
        const hasPackagesDir = await this.deps.fileSystem.exists('packages');

        if (!hasWorkspaceYaml && !hasPackagesDir) {
            return packages;
        }

        // Look for package.json files in common monorepo locations
        const searchDirs = ['packages', 'apps', 'libs'];

        for (const searchDir of searchDirs) {
            if (!await this.deps.fileSystem.exists(searchDir)) {
                continue;
            }

            try {
                const entries = await this.deps.fileSystem.readDirectory(searchDir);

                for (const entry of entries) {
                    if (entry.type === 'directory') {
                        const packageJsonPath = `${searchDir}/${entry.name}/package.json`;
                        if (await this.deps.fileSystem.exists(packageJsonPath)) {
                            packages.push(`${searchDir}/${entry.name}`);
                        }
                    }
                }
            } catch {
                // Ignore errors reading directories
            }
        }

        return packages;
    }

    /**
     * Generate README.md content for the project root.
     */
    private generateReadmeContent(analysis: ProjectAnalysis): string {
        const projectName = this.detectProjectName(analysis);
        const languages = analysis.languages.join(', ') || 'TBD';
        const frameworks = analysis.frameworks.join(', ') || 'N/A';

        const installCmd = analysis.packageManager === 'pnpm' ? 'pnpm install'
            : analysis.packageManager === 'yarn' ? 'yarn install'
                : 'npm install';

        return `# ${projectName}

<!-- REVIEW: Add project description -->

## Tech Stack

- **Languages**: ${languages}
- **Frameworks**: ${frameworks}

## Getting Started

### Prerequisites

<!-- REVIEW: List prerequisites -->

### Installation

\`\`\`bash
${installCmd}
\`\`\`

### Development

\`\`\`bash
# <!-- REVIEW: Add development command -->
\`\`\`

### Testing

\`\`\`bash
# <!-- REVIEW: Add test command -->
\`\`\`

## Documentation

- [Contributing Guidelines](.spec/guidelines/CONTRIBUTING.md)
- [Architecture](.spec/guidelines/ARCHITECTURE.md)
- [Testing Strategy](.spec/guidelines/TESTING.md)
- [Security Policy](.spec/guidelines/SECURITY.md)

## License

<!-- REVIEW: Add license information -->
`;
    }

    /**
     * Generate README.md content for a package in a monorepo.
     */
    private generatePackageReadmeContent(packageName: string, _packageDir: string, _analysis: ProjectAnalysis): string {
        return `# ${packageName}

<!-- REVIEW: Add package description -->

## Overview

This package is part of the monorepo.

## Usage

\`\`\`typescript
// <!-- REVIEW: Add usage example -->
\`\`\`

## API

<!-- REVIEW: Document public API -->

## Development

See the [root README](../../README.md) for development setup.

## License

See the [root LICENSE](../../LICENSE) for license information.
`;
    }

    /**
     * Detect project name from package.json or directory name.
     */
    private detectProjectName(_analysis: ProjectAnalysis): string {
        // This would ideally read from package.json, but for now use a placeholder
        // that users can customize
        return '<!-- REVIEW: Project Name -->';
    }

    /**
     * Extract managed section content from a full guideline file.
     */
    private extractManagedContent(generatedContent: string): string {
        const extracted = extractSpecDrivenSection(generatedContent);
        if (extracted) return extracted;

        if (hasSpecDrivenSection(generatedContent)) {
            return generatedContent;
        }

        return generatedContent;
    }

    /**
     * Replace or append managed section in existing content.
     */
    private replaceManagedSection(existingContent: string, managedContent: string): string {
        const startMarker = SPECDRIVEN_SECTION_MARKERS.start;
        const endMarker = SPECDRIVEN_SECTION_MARKERS.end;

        const startIndex = existingContent.indexOf(startMarker);
        const endIndex = existingContent.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const before = existingContent.substring(0, startIndex + startMarker.length);
            const after = existingContent.substring(endIndex);
            return `${before}\n${managedContent}\n${after}`.trim() + '\n';
        }

        const appended = existingContent.trimEnd();
        return `${appended}\n\n${wrapInSpecDrivenSection(managedContent)}\n`;
    }

    private async generateWithAI(
        guidelineType: GuidelineType,
        analysis: ProjectAnalysis,
        existingGuidelines: GuidelinesDocs,
        userInquiry?: string
    ): Promise<{ summary: string; content: string }> {
        if (!this.engine) {
            throw new Error('Engine not available for AI generation');
        }

        const analysisContext: ProjectAnalysisContext = {
            ...analysis,
            projectStructure: await this.getProjectStructure(),
            codeSnippets: guidelineType === 'contributing' ? await this.gatherCodeSnippets() : undefined,
        };

        const strategy = new GuidelinesStrategy({
            guidelineType,
            projectAnalysis: analysisContext,
            existingGuidelines,
            userInquiry,
        });

        const response = await this.engine.prompt(strategy, {
            guidelines: existingGuidelines,
            history: [
                {
                    role: 'user',
                    content: `Generate ${guidelineType.toUpperCase()} guideline based on project analysis and existing documents.`,
                },
            ],
        });

        return this.parseResponse(response);
    }

    private parseResponse(response: string): { summary: string; content: string } {
        const summaryMatch = response.match(/<summary>([\s\S]*?)<\/summary>/);
        const docMatch = response.match(/<document>([\s\S]*?)<\/document>/);

        if (summaryMatch && docMatch) {
            let content = docMatch[1].trim();
            const mdMatch = content.match(/```markdown\n([\s\S]*?)```/);
            if (mdMatch) {
                content = mdMatch[1].trim();
            } else {
                const codeMatch = content.match(/```\n?([\s\S]*?)```/);
                if (codeMatch) content = codeMatch[1].trim();
            }

            // Fix malformed mermaid blocks (missing code fences)
            content = this.fixMalformedMermaidBlocks(content);

            return {
                summary: summaryMatch[1].trim(),
                content,
            };
        }

        return {
            summary: 'Content generated successfully.',
            content: this.fixMalformedMermaidBlocks(response.trim()),
        };
    }

    /**
     * Fix malformed mermaid blocks that are missing code fences.
     * Detects lines starting with 'mermaid' or diagram keywords without preceding backticks.
     */
    private fixMalformedMermaidBlocks(content: string): string {
        const lines = content.split('\n');
        const result: string[] = [];
        let inMermaidBlock = false;
        let mermaidIndent = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Check if this looks like a mermaid block start without proper fence
            const mermaidKeywords = ['graph ', 'flowchart ', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie ', 'C4Context', 'C4Container', 'C4Component'];
            const isMermaidStart = mermaidKeywords.some(kw => trimmedLine.startsWith(kw));
            const prevLine = i > 0 ? lines[i - 1].trim() : '';
            const prevIsFence = prevLine === '```mermaid' || prevLine === '```';

            if (isMermaidStart && !prevIsFence && !inMermaidBlock) {
                // Found a mermaid block without opening fence
                mermaidIndent = line.match(/^(\s*)/)?.[1] || '';
                result.push(mermaidIndent + '```mermaid');
                result.push(line);
                inMermaidBlock = true;
            } else if (inMermaidBlock) {
                // Check if we've left the mermaid block (empty line or new section)
                if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('|') || trimmedLine.startsWith('<!--')) {
                    result.push(mermaidIndent + '```');
                    result.push(line);
                    inMermaidBlock = false;
                } else {
                    result.push(line);
                }
            } else {
                result.push(line);
            }
        }

        // Close any unclosed mermaid block
        if (inMermaidBlock) {
            result.push(mermaidIndent + '```');
        }

        return result.join('\n');
    }

    private formatAgentsGuideline(analysis: ProjectAnalysis, userInquiry?: string): string {
        const template = getGuidelineTemplate('agents');

        const languages = this.formatList(analysis.languages, '- TBD');
        const frameworks = this.formatList(analysis.frameworks, '- TBD');
        const buildTools = this.formatList(analysis.buildTools, '- TBD');

        const dependencyRows = analysis.dependencies.length > 0
            ? analysis.dependencies.map(d => `| ${d.name} | ${d.version} | ${d.purpose ?? ''} |`).join('\n')
            : '| | | |';

        return template
            .replace('{{PROJECT_DESCRIPTION}}', userInquiry ? userInquiry : '<!-- REVIEW: Add project description -->')
            .replace('{{PROJECT_GOALS}}', '<!-- REVIEW: Add goals -->')
            .replace('{{PROJECT_NON_GOALS}}', '<!-- REVIEW: Add non-goals -->')
            .replace('{{LANGUAGES}}', languages)
            .replace('{{FRAMEWORKS}}', frameworks)
            .replace('{{DEPENDENCIES}}', dependencyRows)
            .replace('{{BUILD_TOOLS}}', buildTools);
    }

    private formatContributingGuideline(analysis: ProjectAnalysis): string {
        const template = getGuidelineTemplate('contributing');

        const formattingRules = analysis.linters.length > 0
            ? analysis.linters.map(l => `- ${l}`).join('\n')
            : '- <!-- REVIEW: Define formatter and lint rules -->';

        return template
            .replace('{{SETUP_INSTRUCTIONS}}', '<!-- REVIEW: Add setup instructions -->')
            .replace('{{FORMATTING_RULES}}', formattingRules)
            .replace('{{FILE_NAMING}}', 'kebab-case')
            .replace('{{FILE_EXAMPLE}}', 'user-profile.ts')
            .replace('{{FUNCTION_NAMING}}', 'camelCase')
            .replace('{{FUNCTION_EXAMPLE}}', 'getUserProfile')
            .replace('{{VARIABLE_NAMING}}', 'camelCase')
            .replace('{{VARIABLE_EXAMPLE}}', 'userProfile')
            .replace('{{CONSTANT_NAMING}}', 'SCREAMING_SNAKE_CASE')
            .replace('{{CONSTANT_EXAMPLE}}', 'MAX_RETRIES')
            .replace('{{CLASS_NAMING}}', 'PascalCase')
            .replace('{{CLASS_EXAMPLE}}', 'UserService')
            .replace('{{ERROR_HANDLING_CONVENTIONS}}', '<!-- REVIEW: Describe error handling -->')
            .replace('{{COMMENT_CONVENTIONS}}', '<!-- REVIEW: Comment guidelines -->')
            .replace('{{API_DOC_CONVENTIONS}}', '<!-- REVIEW: API docs guidelines -->')
            .replace('{{BRANCH_NAMING}}', '<!-- REVIEW: Define branch naming -->')
            .replace('{{COMMIT_FORMAT}}', '<!-- REVIEW: Define commit format -->')
            .replace('{{PR_GUIDELINES}}', '<!-- REVIEW: Define PR guidelines -->')
            .replace('{{REVIEW_PROCESS}}', '<!-- REVIEW: Define review process -->');
    }

    private formatTestingGuideline(analysis: ProjectAnalysis): string {
        const template = getGuidelineTemplate('testing');

        const testFrameworks = analysis.testFrameworks.length > 0
            ? analysis.testFrameworks.map(f => `- ${f}`).join('\n')
            : '- <!-- REVIEW: Define test frameworks -->';

        return template
            .replace('{{TEST_FRAMEWORKS}}', testFrameworks)
            .replace('{{TEST_FILE_STRUCTURE}}', '<!-- REVIEW: Describe test file structure -->')
            .replace('{{TEST_NAMING}}', '<!-- REVIEW: Describe test naming -->')
            .replace('{{UNIT_TEST_GUIDELINES}}', '<!-- REVIEW: Unit test guidelines -->')
            .replace('{{INTEGRATION_TEST_GUIDELINES}}', '<!-- REVIEW: Integration test guidelines -->')
            .replace('{{E2E_TEST_GUIDELINES}}', '<!-- REVIEW: E2E test guidelines -->')
            .replace('{{COVERAGE_REQUIREMENTS}}', '<!-- REVIEW: Coverage requirements -->')
            .replace('{{PREFERRED_TEST_PATTERNS}}', '<!-- REVIEW: Preferred test patterns -->')
            .replace('{{TEST_ANTI_PATTERNS}}', '<!-- REVIEW: Test anti-patterns -->')
            .replace('{{RUN_ALL_TESTS}}', 'pnpm test')
            .replace('{{RUN_UNIT_TESTS}}', 'pnpm test:unit')
            .replace('{{RUN_INTEGRATION_TESTS}}', 'pnpm test:integration')
            .replace('{{RUN_WITH_COVERAGE}}', 'pnpm test -- --coverage')
            .replace('{{RUN_E2E_TESTS}}', 'pnpm test:e2e')
            .replace('{{CI_CD_TESTING}}', '<!-- REVIEW: CI/CD testing workflow -->')
            .replace('{{MOCKING_STRATEGY}}', '<!-- REVIEW: Mocking strategy -->')
            .replace('{{TEST_DATA_APPROACH}}', '<!-- REVIEW: Test data approach -->');
    }

    private formatSecurityGuideline(): string {
        const template = getGuidelineTemplate('security');

        return template
            .replace('{{SUPPORTED_VERSIONS}}', 'Current | Yes')
            .replace('{{VULNERABILITY_REPORTING}}', 'Please open a private security advisory or contact the maintainers.')
            .replace('{{AUTHENTICATION_REQUIREMENTS}}', '<!-- REVIEW: Define authentication requirements -->')
            .replace('{{AUTHORIZATION_REQUIREMENTS}}', '<!-- REVIEW: Define authorization requirements -->')
            .replace('{{DATA_PROTECTION_REQUIREMENTS}}', '<!-- REVIEW: Define data protection requirements -->')
            .replace('{{INPUT_VALIDATION_REQUIREMENTS}}', '<!-- REVIEW: Define input validation requirements -->')
            .replace('{{OUTPUT_ENCODING_REQUIREMENTS}}', '<!-- REVIEW: Define output encoding requirements -->')
            .replace('{{SECRETS_MANAGEMENT}}', '<!-- REVIEW: Define secrets management -->')
            .replace('{{SECURITY_LOGGING}}', '<!-- REVIEW: Define security logging -->')
            .replace('{{DEPENDENCY_MANAGEMENT}}', '<!-- REVIEW: Define dependency management -->')
            .replace('{{VULNERABILITY_SCANNING}}', '<!-- REVIEW: Define vulnerability scanning -->')
            .replace('{{INCIDENT_RESPONSE}}', '<!-- REVIEW: Define incident response -->');
    }

    private formatStyleguideGuideline(analysis: ProjectAnalysis): string {
        const template = getGuidelineTemplate('styleguide');

        const linters = analysis.linters.length > 0
            ? analysis.linters.join(', ')
            : '<!-- REVIEW: Configure linter -->';

        return template
            .replace('{{FILE_NAMING}}', 'kebab-case')
            .replace('{{FILE_EXAMPLE}}', 'user-profile.ts')
            .replace('{{TEST_FILE_NAMING}}', '*.test.ts or *.spec.ts')
            .replace('{{TEST_FILE_EXAMPLE}}', 'user-profile.test.ts')
            .replace('{{COMPONENT_FILE_NAMING}}', 'PascalCase')
            .replace('{{COMPONENT_FILE_EXAMPLE}}', 'UserProfile.tsx')
            .replace('{{DIRECTORY_NAMING}}', 'kebab-case')
            .replace('{{DIRECTORY_EXAMPLE}}', 'user-management/')
            .replace('{{VARIABLE_NAMING}}', 'camelCase')
            .replace('{{VARIABLE_EXAMPLE}}', 'userProfile')
            .replace('{{CONSTANT_NAMING}}', 'SCREAMING_SNAKE_CASE')
            .replace('{{CONSTANT_EXAMPLE}}', 'MAX_RETRIES')
            .replace('{{FUNCTION_NAMING}}', 'camelCase')
            .replace('{{FUNCTION_EXAMPLE}}', 'getUserProfile')
            .replace('{{CLASS_NAMING}}', 'PascalCase')
            .replace('{{CLASS_EXAMPLE}}', 'UserService')
            .replace('{{INTERFACE_NAMING}}', 'PascalCase with I prefix (optional)')
            .replace('{{INTERFACE_EXAMPLE}}', 'IUserService or UserService')
            .replace('{{TYPE_NAMING}}', 'PascalCase')
            .replace('{{TYPE_EXAMPLE}}', 'UserProfile')
            .replace('{{ENUM_NAMING}}', 'PascalCase')
            .replace('{{ENUM_EXAMPLE}}', 'UserRole')
            .replace('{{PRIVATE_NAMING}}', 'camelCase (no underscore prefix)')
            .replace('{{PRIVATE_EXAMPLE}}', 'private userId')
            .replace('{{SPECIAL_NAMING_CASES}}', '<!-- REVIEW: Document any special naming cases -->')
            .replace('{{DIRECTORY_STRUCTURE}}', '<!-- REVIEW: Document directory structure -->')
            .replace('{{MODULE_ORGANIZATION}}', '<!-- REVIEW: Describe module organization -->')
            .replace('{{IMPORT_ORDER}}', '1. Node.js built-ins\n2. External dependencies\n3. Internal modules\n4. Relative imports')
            .replace('{{EXPORT_PATTERNS}}', '<!-- REVIEW: Describe export patterns -->')
            .replace('{{PREFERRED_PATTERNS}}', '<!-- REVIEW: List preferred design patterns -->')
            .replace('{{ANTI_PATTERNS}}', '<!-- REVIEW: List anti-patterns to avoid -->')
            .replace('{{FORMATTING_RULES}}', '<!-- REVIEW: Define formatting rules -->')
            .replace('{{LINE_LENGTH_RULES}}', '<!-- REVIEW: Define line length rules -->')
            .replace('{{SPACING_RULES}}', '<!-- REVIEW: Define spacing rules -->')
            .replace('{{COMMENT_STYLE}}', '<!-- REVIEW: Define comment style -->')
            .replace('{{DOCUMENTATION_STYLE}}', '<!-- REVIEW: Define documentation style -->')
            .replace('{{TODO_CONVENTIONS}}', '<!-- REVIEW: Define TODO/FIXME conventions -->')
            .replace('{{ERROR_PATTERNS}}', '<!-- REVIEW: Define error handling patterns -->')
            .replace('{{LOGGING_CONVENTIONS}}', '<!-- REVIEW: Define logging conventions -->')
            .replace('{{TYPE_ANNOTATION_RULES}}', '<!-- REVIEW: Define type annotation rules -->')
            .replace('{{TYPE_GUARD_RULES}}', '<!-- REVIEW: Define type guard rules -->')
            .replace('{{ASYNC_PATTERNS}}', '<!-- REVIEW: Define async/await patterns -->')
            .replace('{{LANGUAGE_SPECIFIC_CONVENTIONS}}', '<!-- REVIEW: Add language-specific conventions -->')
            .replace('{{LINTER_CONFIG}}', linters)
            .replace('{{FORMATTER_CONFIG}}', '<!-- REVIEW: Define formatter config -->')
            .replace('{{PRECOMMIT_HOOKS}}', '<!-- REVIEW: Define pre-commit hooks -->');
    }

    private formatArchitectureGuideline(analysis: ProjectAnalysis): string {
        const template = getGuidelineTemplate('architecture');

        const languages = analysis.languages.join(', ') || 'TBD';
        const frameworks = analysis.frameworks.join(', ') || 'TBD';

        // Build architecture overview from analysis
        const overview = analysis.frameworks.length > 0
            ? `This project uses ${frameworks} built with ${languages}.`
            : analysis.languages.length > 0
                ? `This project is built with ${languages}.`
                : '<!-- REVIEW: Add architecture overview -->';

        // System description for mermaid diagrams
        const systemDesc = analysis.frameworks[0] || 'Application';

        // Build package boundaries table from detected structure
        const packageBoundaries = this.buildPackageBoundariesTable(analysis);

        return template
            .replace('{{ARCHITECTURE_OVERVIEW}}', overview)
            .replace('{{SYSTEM_DESCRIPTION}}', systemDesc)
            .replace('{{EXT_SYSTEM_1_DESC}}', '<!-- REVIEW: Describe external systems -->')
            .replace('{{CORE_TECH}}', languages)
            .replace('{{ADAPTERS_TECH}}', languages)
            .replace('{{DOMAIN_TECH}}', languages)
            .replace('{{SERVICE_TECH}}', languages)
            .replace('{{PORTS_TECH}}', 'Interfaces')
            .replace('{{PACKAGE_BOUNDARIES}}', packageBoundaries)
            .replace('{{ADRS}}', '<!-- REVIEW: Add architecture decisions -->');
    }

    private buildPackageBoundariesTable(analysis: ProjectAnalysis): string {
        // Default boundaries based on common patterns
        const rows: string[] = [];

        if (analysis.frameworks.some(f => f.toLowerCase().includes('express') || f.toLowerCase().includes('fastify'))) {
            rows.push('| api | HTTP endpoints and middleware | core |');
            rows.push('| core | Business logic | - |');
            rows.push('| db | Database access | core |');
        } else if (analysis.frameworks.some(f => f.toLowerCase().includes('react') || f.toLowerCase().includes('vue'))) {
            rows.push('| components | UI components | hooks, utils |');
            rows.push('| hooks | Custom React hooks | utils |');
            rows.push('| utils | Shared utilities | - |');
        } else {
            rows.push('| core | Business logic | - |');
            rows.push('| adapters | External integrations | core |');
        }

        return rows.length > 0 ? rows.join('\n') : '| core | Business logic | - |';
    }

    private formatList(items: string[], emptyFallback: string): string {
        if (!items || items.length === 0) return emptyFallback;
        return items.map(i => `- ${i}`).join('\n');
    }

    private async gatherCodeSnippets(): Promise<string[]> {
        const snippets: string[] = [];

        try {
            const candidates = [
                'src/index.ts',
                'src/main.ts',
                'src/app.ts',
                'index.ts',
                'main.ts',
            ];

            for (const candidate of candidates) {
                if (await this.deps.fileSystem.exists(candidate)) {
                    const content = await this.deps.fileSystem.readFile(candidate);
                    snippets.push(content.slice(0, 1000));
                    if (snippets.length >= 2) break;
                }
            }
        } catch {
            // Ignore errors in snippet gathering
        }

        return snippets;
    }

    private async getProjectStructure(): Promise<string> {
        try {
            const root = this.deps.fileSystem.getWorkspaceRoot();
            if (!root) return '';

            const structure: string[] = [];
            const topLevel = await this.deps.fileSystem.readDirectory('');

            for (const entry of topLevel.slice(0, 15)) {
                const name = entry.name;
                if (!name.startsWith('.') && name !== 'node_modules') {
                    structure.push(name);
                }
            }

            return structure.join('\n');
        } catch {
            return '';
        }
    }

    async analyzeProject(): Promise<ProjectAnalysis> {
        const analysis: ProjectAnalysis = {
            languages: [],
            frameworks: [],
            dependencies: [],
            devDependencies: [],
            buildTools: [],
            testFrameworks: [],
            linters: [],
            packageManager: null,
        };

        analysis.packageManager = await this.detectPackageManager();

        await this.analyzeNodeProject(analysis);
        await this.analyzePythonProject(analysis);
        await this.analyzeRustProject(analysis);
        await this.analyzeGoProject(analysis);
        await this.analyzeJavaProject(analysis);

        return analysis;
    }

    private async detectPackageManager(): Promise<string | null> {
        if (await this.deps.fileSystem.exists('pnpm-lock.yaml')) return 'pnpm';
        if (await this.deps.fileSystem.exists('yarn.lock')) return 'yarn';
        if (await this.deps.fileSystem.exists('package-lock.json')) return 'npm';
        if (await this.deps.fileSystem.exists('bun.lockb')) return 'bun';
        if (await this.deps.fileSystem.exists('Pipfile.lock')) return 'pipenv';
        if (await this.deps.fileSystem.exists('poetry.lock')) return 'poetry';
        if (await this.deps.fileSystem.exists('Cargo.lock')) return 'cargo';
        if (await this.deps.fileSystem.exists('go.sum')) return 'go mod';
        return null;
    }

    private async analyzeNodeProject(analysis: ProjectAnalysis): Promise<void> {
        if (!await this.deps.fileSystem.exists('package.json')) return;

        const pkgContent = await this.deps.fileSystem.readFile('package.json');
        let pkg: Record<string, unknown>;
        try {
            pkg = JSON.parse(pkgContent);
        } catch {
            return;
        }

        analysis.languages.push('TypeScript/JavaScript');

        const deps = (pkg.dependencies ?? {}) as Record<string, string>;
        const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
        const allDeps = { ...deps, ...devDeps };

        const frameworkMap: Record<string, string> = {
            react: 'React',
            next: 'Next.js',
            vue: 'Vue.js',
            nuxt: 'Nuxt',
            '@angular/core': 'Angular',
            svelte: 'Svelte',
            express: 'Express',
            '@nestjs/core': 'NestJS',
            fastify: 'Fastify',
            hono: 'Hono',
            electron: 'Electron',
            'react-native': 'React Native',
        };
        for (const [pkgName, name] of Object.entries(frameworkMap)) {
            if (allDeps[pkgName]) analysis.frameworks.push(name);
        }

        const buildToolMap: Record<string, string> = {
            vite: 'Vite',
            webpack: 'Webpack',
            esbuild: 'esbuild',
            rollup: 'Rollup',
            parcel: 'Parcel',
            turbo: 'Turborepo',
            tsup: 'tsup',
            typescript: 'TypeScript',
        };
        for (const [pkgName, name] of Object.entries(buildToolMap)) {
            if (allDeps[pkgName]) analysis.buildTools.push(name);
        }

        const testMap: Record<string, string> = {
            jest: 'Jest',
            vitest: 'Vitest',
            mocha: 'Mocha',
            '@testing-library/react': 'React Testing Library',
            cypress: 'Cypress',
            playwright: 'Playwright',
            '@playwright/test': 'Playwright',
        };
        for (const [pkgName, name] of Object.entries(testMap)) {
            if (allDeps[pkgName]) analysis.testFrameworks.push(name);
        }

        const linterMap: Record<string, string> = {
            eslint: 'ESLint',
            '@biomejs/biome': 'Biome',
            prettier: 'Prettier',
            stylelint: 'Stylelint',
        };
        for (const [pkgName, name] of Object.entries(linterMap)) {
            if (allDeps[pkgName]) analysis.linters.push(name);
        }

        for (const [name, version] of Object.entries(deps).slice(0, 15)) {
            analysis.dependencies.push({
                name,
                version: String(version),
                purpose: this.guessDepPurpose(name),
            });
        }
        for (const [name, version] of Object.entries(devDeps).slice(0, 10)) {
            analysis.devDependencies.push({
                name,
                version: String(version),
                purpose: this.guessDepPurpose(name),
            });
        }
    }

    private async analyzePythonProject(analysis: ProjectAnalysis): Promise<void> {
        if (await this.deps.fileSystem.exists('pyproject.toml')) {
            analysis.languages.push('Python');

            const content = await this.deps.fileSystem.readFile('pyproject.toml');

            if (content.includes('django')) analysis.frameworks.push('Django');
            if (content.includes('flask')) analysis.frameworks.push('Flask');
            if (content.includes('fastapi')) analysis.frameworks.push('FastAPI');
            if (content.includes('pytest')) analysis.testFrameworks.push('pytest');
            if (content.includes('ruff')) analysis.linters.push('Ruff');
            if (content.includes('black')) analysis.linters.push('Black');
            if (content.includes('mypy')) analysis.linters.push('mypy');
        }

        if (await this.deps.fileSystem.exists('requirements.txt')) {
            if (!analysis.languages.includes('Python')) {
                analysis.languages.push('Python');
            }

            const content = await this.deps.fileSystem.readFile('requirements.txt');
            const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));

            for (const line of lines.slice(0, 15)) {
                const match = line.match(/^([a-zA-Z0-9_-]+)([<>=!]+)?(.+)?$/);
                if (match) {
                    analysis.dependencies.push({
                        name: match[1],
                        version: match[3]?.trim() ?? 'latest',
                    });
                }
            }
        }
    }

    private async analyzeRustProject(analysis: ProjectAnalysis): Promise<void> {
        if (!await this.deps.fileSystem.exists('Cargo.toml')) return;

        analysis.languages.push('Rust');
        analysis.buildTools.push('Cargo');

        const content = await this.deps.fileSystem.readFile('Cargo.toml');

        if (content.includes('actix-web')) analysis.frameworks.push('Actix Web');
        if (content.includes('axum')) analysis.frameworks.push('Axum');
        if (content.includes('rocket')) analysis.frameworks.push('Rocket');
        if (content.includes('tokio')) analysis.frameworks.push('Tokio');
        if (content.includes('tauri')) analysis.frameworks.push('Tauri');
    }

    private async analyzeGoProject(analysis: ProjectAnalysis): Promise<void> {
        if (!await this.deps.fileSystem.exists('go.mod')) return;

        analysis.languages.push('Go');

        const content = await this.deps.fileSystem.readFile('go.mod');

        if (content.includes('gin-gonic')) analysis.frameworks.push('Gin');
        if (content.includes('echo')) analysis.frameworks.push('Echo');
        if (content.includes('fiber')) analysis.frameworks.push('Fiber');
        if (content.includes('gorilla/mux')) analysis.frameworks.push('Gorilla Mux');
    }

    private async analyzeJavaProject(analysis: ProjectAnalysis): Promise<void> {
        if (await this.deps.fileSystem.exists('pom.xml')) {
            analysis.languages.push('Java');
            analysis.buildTools.push('Maven');

            const content = await this.deps.fileSystem.readFile('pom.xml');
            if (content.includes('spring-boot')) analysis.frameworks.push('Spring Boot');
            if (content.includes('quarkus')) analysis.frameworks.push('Quarkus');
            if (content.includes('junit')) analysis.testFrameworks.push('JUnit');
        }

        if (await this.deps.fileSystem.exists('build.gradle') ||
            await this.deps.fileSystem.exists('build.gradle.kts')) {
            if (!analysis.languages.includes('Java')) {
                analysis.languages.push('Java/Kotlin');
            }
            analysis.buildTools.push('Gradle');
        }
    }

    private guessDepPurpose(name: string): string {
        const purposes: Record<string, string> = {
            react: 'UI Framework',
            'react-dom': 'React DOM Renderer',
            next: 'Full-stack Framework',
            express: 'Web Server',
            axios: 'HTTP Client',
            lodash: 'Utilities',
            zod: 'Schema Validation',
            prisma: 'ORM',
            '@prisma/client': 'Database Client',
            'drizzle-orm': 'ORM',
            mongoose: 'MongoDB ODM',
            tailwindcss: 'CSS Framework',
            zustand: 'State Management',
            redux: 'State Management',
            '@tanstack/react-query': 'Data Fetching',
            swr: 'Data Fetching',
        };
        return purposes[name] ?? '';
    }
}
