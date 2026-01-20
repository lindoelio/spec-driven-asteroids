/**
 * SteeringGenerator Service
 *
 * Analyzes a project and generates steering documents using AI.
 */

import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import {
    type SteeringDocs,
    type EngineSkillConfig,
    STEERING_PATHS,
    getProductTemplate,
    getTechTemplate,
    getArchitectureTemplate,
    getConventionsTemplate,
    getTestingTemplate,
    generateAgentSkillTemplate,
    getCopilotInstructionsTemplate,
    getCopilotInstructionsAppend,
    SPECDRIVEN_INSTRUCTIONS_MARKER,
} from '../domain/Steering.js';
import { SteeringStrategy, type ProjectAnalysisContext } from '../strategies/SteeringStrategy.js';

export interface SteeringGeneratorDependencies {
    fileSystem: IFileSystemPort;
    engine?: IEnginePort; // Optional, for AI-assisted generation
    skillConfig?: EngineSkillConfig; // Optional, for engine-specific skill paths
}

/**
 * Default skill config for GitHub Copilot.
 */
export const DEFAULT_SKILL_CONFIG: EngineSkillConfig = {
    skillDirectory: '.github/skills/spec-driven-implementation',
    skillFileName: 'SKILL.md',
    skillName: 'spec-driven-implementation',
    customInstructionsPath: '.github/copilot-instructions.md',
};

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

/**
 * SteeringGenerator creates and manages steering documents.
 * Uses AI when an engine is available, falls back to templates otherwise.
 */
export class SteeringGenerator {
    private engine: IEnginePort | null = null;
    private skillConfig: EngineSkillConfig;

    constructor(private readonly deps: SteeringGeneratorDependencies) {
        this.engine = deps.engine ?? null;
        this.skillConfig = deps.skillConfig ?? DEFAULT_SKILL_CONFIG;
    }

    /**
     * Set the skill config for engine-specific paths.
     */
    setSkillConfig(config: EngineSkillConfig): void {
        this.skillConfig = config;
    }

    /**
     * Set the engine adapter for AI-powered generation.
     */
    setEngine(engine: IEnginePort): void {
        this.engine = engine;
    }

    /**
     * Initialize steering with default templates.
     */
    async initializeSteering(): Promise<SteeringDocs> {
        await this.deps.fileSystem.createDirectory(STEERING_PATHS.root);

        const productTemplate = getProductTemplate();
        const techTemplate = getTechTemplate();
        const architectureTemplate = getArchitectureTemplate();
        const conventionsTemplate = getConventionsTemplate();
        const testingTemplate = getTestingTemplate();

        await this.deps.fileSystem.writeFile(STEERING_PATHS.product, productTemplate);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.tech, techTemplate);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.architecture, architectureTemplate);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.conventions, conventionsTemplate);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.testing, testingTemplate);

        // Also create the Agent Skill for Copilot
        await this.ensureAgentSkill();

        return {
            product: productTemplate,
            tech: techTemplate,
            architecture: architectureTemplate,
            conventions: conventionsTemplate,
            testing: testingTemplate,
        };
    }

    /**
     * Ensure the SpecDriven Agent Skill exists.
     * Uses the configured skill path from the inbound adapter.
     */
    async ensureAgentSkill(): Promise<void> {
        const skillPath = `${this.skillConfig.skillDirectory}/${this.skillConfig.skillFileName}`;

        // Create skill file if it doesn't exist
        if (!await this.deps.fileSystem.exists(skillPath)) {
            await this.deps.fileSystem.createDirectory(this.skillConfig.skillDirectory);
            await this.deps.fileSystem.writeFile(skillPath, generateAgentSkillTemplate(this.skillConfig.skillName));
        }

        // Also handle custom instructions file if configured
        if (this.skillConfig.customInstructionsPath) {
            await this.ensureCustomInstructions(this.skillConfig.customInstructionsPath);
        }
    }

    /**
     * Ensure SpecDriven instructions are in the custom instructions file.
     * If file exists, append our section (if not already present).
     * If file doesn't exist, create it with our template.
     */
    private async ensureCustomInstructions(path: string): Promise<void> {
        const dir = path.substring(0, path.lastIndexOf('/'));

        if (await this.deps.fileSystem.exists(path)) {
            // File exists - check if our instructions are already there
            const content = await this.deps.fileSystem.readFile(path);

            if (!content.includes(SPECDRIVEN_INSTRUCTIONS_MARKER)) {
                // Append our instructions
                await this.deps.fileSystem.writeFile(path, content + getCopilotInstructionsAppend());
            }
            // If marker exists, instructions are already present - do nothing
        } else {
            // File doesn't exist - create it
            if (dir) {
                await this.deps.fileSystem.createDirectory(dir);
            }
            await this.deps.fileSystem.writeFile(path, getCopilotInstructionsTemplate());
        }
    }

    /**
     * Load existing steering documents.
     */
    async loadSteering(): Promise<SteeringDocs> {
        const docs: SteeringDocs = {};

        if (await this.deps.fileSystem.exists(STEERING_PATHS.product)) {
            docs.product = await this.deps.fileSystem.readFile(STEERING_PATHS.product);
        }
        if (await this.deps.fileSystem.exists(STEERING_PATHS.tech)) {
            docs.tech = await this.deps.fileSystem.readFile(STEERING_PATHS.tech);
        }
        if (await this.deps.fileSystem.exists(STEERING_PATHS.architecture)) {
            docs.architecture = await this.deps.fileSystem.readFile(STEERING_PATHS.architecture);
        }
        if (await this.deps.fileSystem.exists(STEERING_PATHS.conventions)) {
            docs.conventions = await this.deps.fileSystem.readFile(STEERING_PATHS.conventions);
        }
        if (await this.deps.fileSystem.exists(STEERING_PATHS.testing)) {
            docs.testing = await this.deps.fileSystem.readFile(STEERING_PATHS.testing);
        }

        return docs;
    }

    /**
     * Check if steering is initialized.
     */
    async isInitialized(): Promise<boolean> {
        return this.deps.fileSystem.exists(STEERING_PATHS.root);
    }

    /**
     * Auto-generate tech.md by analyzing the project.
     * Uses AI if engine is available, otherwise falls back to template.
     */
    async generateTechSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();

        let content: string;
        let summary = 'Generated from template.';

        if (this.engine) {
            // AI-powered generation
            const result = await this.generateWithAI('tech', analysis, requirements);
            content = result.content;
            summary = result.summary;
        } else {
            // Fallback to template-based generation
            content = this.formatTechSteering(analysis);
        }

        // Ensure directory exists
        await this.deps.fileSystem.createDirectory(STEERING_PATHS.root);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.tech, content);

        // Also ensure Agent Skill exists
        await this.ensureAgentSkill();

        return { content, summary };
    }

    /**
     * Generate conventions.md from project analysis.
     * Uses AI if engine is available, otherwise falls back to template.
     */
    async generateConventionsSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();

        let content: string;
        let summary = 'Generated from template.';

        if (this.engine) {
            // AI-powered generation
            const result = await this.generateWithAI('conventions', analysis, requirements);
            content = result.content;
            summary = result.summary;
        } else {
            // Fallback to template-based generation
            content = this.formatConventionsSteering(analysis);
        }

        await this.deps.fileSystem.createDirectory(STEERING_PATHS.root);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.conventions, content);

        return { content, summary };
    }

    /**
     * Generate product.md using AI analysis.
     * Uses AI if engine is available, otherwise falls back to template.
     */
    async generateProductSteering(userInquiry?: string): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();

        let content: string;
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('product', analysis, userInquiry);
            content = result.content;
            summary = result.summary;
        } else {
            content = getProductTemplate();
        }

        await this.deps.fileSystem.createDirectory(STEERING_PATHS.root);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.product, content);

        return { content, summary };
    }

    /**
     * Generate architecture.md using template (no AI).
     */
    async generateArchitectureSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();
        let content: string;
        let summary = 'Generated from template.';

        if (this.engine && requirements) {
            // AI powered generation if we have requirements to base architecture on
            const result = await this.generateWithAI('architecture' as any, analysis, requirements);
            content = result.content;
            summary = result.summary;
        } else {
            content = getArchitectureTemplate();
        }

        await this.deps.fileSystem.createDirectory(STEERING_PATHS.root);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.architecture, content);

        return { content, summary };
    }

    /**
     * Generate testing.md using AI analysis.
     * Uses AI if engine is available, otherwise falls back to template.
     */
    async generateTestingSteering(requirements?: string): Promise<{ content: string; summary: string }> {
        const analysis = await this.analyzeProject();

        let content: string;
        let summary = 'Generated from template.';

        if (this.engine) {
            const result = await this.generateWithAI('testing', analysis, requirements);
            content = result.content;
            summary = result.summary;
        } else {
            content = getTestingTemplate();
        }

        await this.deps.fileSystem.createDirectory(STEERING_PATHS.root);
        await this.deps.fileSystem.writeFile(STEERING_PATHS.testing, content);

        return { content, summary };
    }

    /**
     * Generate all steering documents at once.
     * Uses AI if engine is available, otherwise falls back to templates.
     * @returns Object with all generated docs and summaries
     */
    async generateAllSteering(userInquiry?: string): Promise<{
        product: { content: string; summary: string };
        tech: { content: string; summary: string };
        architecture: { content: string; summary: string };
        conventions: { content: string; summary: string };
        testing: { content: string; summary: string };
    }> {
        // Generate all in sequence (need project analysis for each)
        const product = await this.generateProductSteering(userInquiry);
        const tech = await this.generateTechSteering();
        const architecture = await this.generateArchitectureSteering();
        const conventions = await this.generateConventionsSteering();
        const testing = await this.generateTestingSteering();

        // Ensure Agent Skill exists
        await this.ensureAgentSkill();

        return { product, tech, architecture, conventions, testing };
    }

    /**
     * Generate steering document using AI.
     */
    private async generateWithAI(
        steeringType: 'tech' | 'conventions' | 'product' | 'testing' | 'architecture',
        analysis: ProjectAnalysis,
        inputContext?: string
    ): Promise<{ summary: string; content: string }> {
        if (!this.engine) {
            throw new Error('Engine not available for AI generation');
        }

        // Load existing steering for context
        const existingSteering = await this.loadSteering();

        // Gather additional context for conventions and testing
        const analysisContext: ProjectAnalysisContext = {
            ...analysis,
            codeSnippets: steeringType === 'conventions'
                ? await this.gatherCodeSnippets()
                : undefined,
            projectStructure: await this.getProjectStructure(),
        };

        // Gather global requirements
        const allRequirements = await this.getAllRequirements();
        let combinedRequirements = allRequirements;

        // If inputContext is provided and it's not product steering (which uses it as userInquiry),
        // treat it as specific requirements to append
        if (inputContext && steeringType !== 'product') {
            combinedRequirements = combinedRequirements
                ? `${combinedRequirements}\n\n## Current Focus\n${inputContext}`
                : inputContext;
        }

        const strategy = new SteeringStrategy({
            steeringType,
            projectAnalysis: analysisContext,
            existingSteering,
            userInquiry: steeringType === 'product' ? inputContext : undefined,
            requirements: combinedRequirements,
        });

        const response = await this.engine.prompt(strategy, {
            steering: existingSteering,
        });

        // Extract markdown content from response
        return this.parseResponse(response);
    }

    /**
     * Gather all requirements from any requirements.md files in the workspace.
     */
    private async getAllRequirements(): Promise<string> {
        const exclude = '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**}';
        const requirementFiles = await this.deps.fileSystem.findFiles('**/requirements.md', exclude);

        if (requirementFiles.length === 0) {
            return '';
        }

        const sortedFiles = [...new Set(requirementFiles)].sort();
        let allReqs = '';

        for (const reqPath of sortedFiles) {
            const content = await this.deps.fileSystem.readFile(reqPath);

            let label = `File: ${reqPath}`;
            const specMatch = reqPath.match(/^\.spec\/specs\/([^/]+)\/requirements\.md$/);
            if (specMatch) {
                label = `Spec: ${specMatch[1]}`;
            }

            allReqs += `\n\n### ${label}\n${content}`;
        }

        return allReqs.trim();
    }

    /**
     * Parse AI response (handles XML wrapper).
     */
    private parseResponse(response: string): { summary: string; content: string } {
        const summaryMatch = response.match(/<summary>([\s\S]*?)<\/summary>/);
        const docMatch = response.match(/<document>([\s\S]*?)<\/document>/);

        if (summaryMatch && docMatch) {
            let content = docMatch[1].trim();
            // Clean up Markdown wrapper if present inside tag
            const mdMatch = content.match(/```markdown\n([\s\S]*?)```/);
            if (mdMatch) {
                content = mdMatch[1].trim();
            } else {
                const codeMatch = content.match(/```\n?([\s\S]*?)```/);
                if (codeMatch) content = codeMatch[1].trim();
            }

            return {
                summary: summaryMatch[1].trim(),
                content
            };
        }

        // Fallback
        return {
            summary: 'Content generated successfully.',
            content: this.extractMarkdown(response)
        };
    }

    /**
     * Extract markdown content from AI response (Legacy/Fallback).
     */
    private extractMarkdown(response: string): string {
        // Try to extract content between ```markdown and ```
        const markdownMatch = response.match(/```markdown\n([\s\S]*?)```/);
        if (markdownMatch) {
            return markdownMatch[1].trim();
        }

        // Try to extract content between ``` and ```
        const codeMatch = response.match(/```\n?([\s\S]*?)```/);
        if (codeMatch) {
            return codeMatch[1].trim();
        }

        // Return as-is if no code blocks
        return response.trim();
    }

    /**
     * Gather code snippets for convention inference.
     */
    private async gatherCodeSnippets(): Promise<string[]> {
        const snippets: string[] = [];

        try {
            // Try to find a few representative files
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
                    snippets.push(content.slice(0, 1000)); // First 1000 chars
                    if (snippets.length >= 2) break;
                }
            }
        } catch {
            // Ignore errors in snippet gathering
        }

        return snippets;
    }

    /**
     * Get a simplified project structure.
     */
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

    /**
     * Get project analysis without writing files.
     */
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

        // Detect package manager
        analysis.packageManager = await this.detectPackageManager();

        // Analyze based on project files
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

        // Detect frameworks
        const frameworkMap: Record<string, string> = {
            'react': 'React',
            'next': 'Next.js',
            'vue': 'Vue.js',
            'nuxt': 'Nuxt',
            '@angular/core': 'Angular',
            'svelte': 'Svelte',
            'express': 'Express',
            '@nestjs/core': 'NestJS',
            'fastify': 'Fastify',
            'hono': 'Hono',
            'electron': 'Electron',
            'react-native': 'React Native',
        };
        for (const [pkg, name] of Object.entries(frameworkMap)) {
            if (allDeps[pkg]) analysis.frameworks.push(name);
        }

        // Detect build tools
        const buildToolMap: Record<string, string> = {
            'vite': 'Vite',
            'webpack': 'Webpack',
            'esbuild': 'esbuild',
            'rollup': 'Rollup',
            'parcel': 'Parcel',
            'turbo': 'Turborepo',
            'tsup': 'tsup',
            'typescript': 'TypeScript',
        };
        for (const [pkg, name] of Object.entries(buildToolMap)) {
            if (allDeps[pkg]) analysis.buildTools.push(name);
        }

        // Detect test frameworks
        const testMap: Record<string, string> = {
            'jest': 'Jest',
            'vitest': 'Vitest',
            'mocha': 'Mocha',
            '@testing-library/react': 'React Testing Library',
            'cypress': 'Cypress',
            'playwright': 'Playwright',
            '@playwright/test': 'Playwright',
        };
        for (const [pkg, name] of Object.entries(testMap)) {
            if (allDeps[pkg]) analysis.testFrameworks.push(name);
        }

        // Detect linters
        const linterMap: Record<string, string> = {
            'eslint': 'ESLint',
            '@biomejs/biome': 'Biome',
            'prettier': 'Prettier',
            'stylelint': 'Stylelint',
        };
        for (const [pkg, name] of Object.entries(linterMap)) {
            if (allDeps[pkg]) analysis.linters.push(name);
        }

        // Add dependencies
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
        // Check pyproject.toml
        if (await this.deps.fileSystem.exists('pyproject.toml')) {
            analysis.languages.push('Python');

            const content = await this.deps.fileSystem.readFile('pyproject.toml');

            // Detect frameworks from pyproject.toml
            if (content.includes('django')) analysis.frameworks.push('Django');
            if (content.includes('flask')) analysis.frameworks.push('Flask');
            if (content.includes('fastapi')) analysis.frameworks.push('FastAPI');
            if (content.includes('pytest')) analysis.testFrameworks.push('pytest');
            if (content.includes('ruff')) analysis.linters.push('Ruff');
            if (content.includes('black')) analysis.linters.push('Black');
            if (content.includes('mypy')) analysis.linters.push('mypy');
        }

        // Check requirements.txt
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

        // Detect frameworks
        if (content.includes('actix-web')) analysis.frameworks.push('Actix Web');
        if (content.includes('axum')) analysis.frameworks.push('Axum');
        if (content.includes('rocket')) analysis.frameworks.push('Rocket');
        if (content.includes('tokio')) analysis.frameworks.push('Tokio (async runtime)');
        if (content.includes('tauri')) analysis.frameworks.push('Tauri');
    }

    private async analyzeGoProject(analysis: ProjectAnalysis): Promise<void> {
        if (!await this.deps.fileSystem.exists('go.mod')) return;

        analysis.languages.push('Go');

        const content = await this.deps.fileSystem.readFile('go.mod');

        // Detect frameworks
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
            'react': 'UI Framework',
            'react-dom': 'React DOM Renderer',
            'next': 'Full-stack Framework',
            'express': 'Web Server',
            'axios': 'HTTP Client',
            'lodash': 'Utilities',
            'zod': 'Schema Validation',
            'prisma': 'ORM',
            '@prisma/client': 'Database Client',
            'drizzle-orm': 'ORM',
            'mongoose': 'MongoDB ODM',
            'tailwindcss': 'CSS Framework',
            'zustand': 'State Management',
            'redux': 'State Management',
            '@tanstack/react-query': 'Data Fetching',
            'swr': 'Data Fetching',
        };
        return purposes[name] ?? '';
    }

    private formatTechSteering(analysis: ProjectAnalysis): string {
        const sections: string[] = [
            '# Technology Stack',
            '',
            '*Auto-generated by SpecDriven*',
            '',
        ];

        if (analysis.languages.length > 0) {
            sections.push('## Languages');
            sections.push(...analysis.languages.map(l => `- ${l}`));
            sections.push('');
        }

        if (analysis.frameworks.length > 0) {
            sections.push('## Frameworks');
            sections.push(...analysis.frameworks.map(f => `- ${f}`));
            sections.push('');
        }

        if (analysis.dependencies.length > 0) {
            sections.push('## Key Libraries');
            sections.push('| Library | Version | Purpose |');
            sections.push('|---------|---------|---------|');
            sections.push(...analysis.dependencies.map(
                d => `| ${d.name} | ${d.version} | ${d.purpose ?? ''} |`
            ));
            sections.push('');
        }

        if (analysis.buildTools.length > 0) {
            sections.push('## Build Tools');
            sections.push(...analysis.buildTools.map(t => `- ${t}`));
            sections.push('');
        }

        if (analysis.testFrameworks.length > 0) {
            sections.push('## Testing');
            sections.push(...analysis.testFrameworks.map(t => `- ${t}`));
            sections.push('');
        }

        if (analysis.linters.length > 0) {
            sections.push('## Linting & Formatting');
            sections.push(...analysis.linters.map(l => `- ${l}`));
            sections.push('');
        }

        if (analysis.packageManager) {
            sections.push('## Package Manager');
            sections.push(`- ${analysis.packageManager}`);
            sections.push('');
        }

        sections.push('## Architecture');
        sections.push('<!-- Add architecture notes here -->');
        sections.push('');

        return sections.join('\n');
    }

    private formatConventionsSteering(analysis: ProjectAnalysis): string {
        const sections: string[] = [
            '# Coding Conventions',
            '',
            '*Auto-generated by SpecDriven*',
            '',
        ];

        sections.push('## Code Style');
        if (analysis.linters.includes('ESLint')) {
            sections.push('- ESLint for JavaScript/TypeScript linting');
        }
        if (analysis.linters.includes('Prettier')) {
            sections.push('- Prettier for code formatting');
        }
        if (analysis.linters.includes('Biome')) {
            sections.push('- Biome for linting and formatting');
        }
        if (analysis.linters.length === 0) {
            sections.push('- <!-- Add code style conventions -->');
        }
        sections.push('');

        sections.push('## File Organization');
        if (analysis.frameworks.includes('Next.js')) {
            sections.push('- Next.js App Router structure (`app/` directory)');
        } else if (analysis.frameworks.includes('React')) {
            sections.push('- Feature-based folder structure');
        }
        sections.push('- <!-- Add file organization rules -->');
        sections.push('');

        sections.push('## Testing');
        if (analysis.testFrameworks.length > 0) {
            sections.push(`- Test framework: ${analysis.testFrameworks.join(', ')}`);
        }
        sections.push('- <!-- Add testing conventions -->');
        sections.push('');

        sections.push('## Git');
        sections.push('- Conventional Commits format recommended');
        sections.push('- <!-- Add branching strategy -->');
        sections.push('');

        return sections.join('\n');
    }
}
