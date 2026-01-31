/**
 * ContextGrounder Service
 *
 * Searches for relevant documentation and context before planning.
 * Grounding ensures AI responses are based on actual library versions and best practices.
 * 
 * When an AI engine is available, uses ContextAgent for intelligent context gathering.
 * Otherwise falls back to heuristic-based file searching.
 */

import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import { ContextAgent, type ContextAgentResult } from '../agents/ContextAgent.js';

export interface GroundedContext {
    /** Relevant files from the workspace */
    workspaceFiles: WorkspaceFile[];
    /** Documentation snippets from web search */
    externalDocs: ExternalDoc[];
    /** Detected technologies relevant to the feature */
    technologies: string[];
}

export interface WorkspaceFile {
    path: string;
    content: string;
    relevance: 'high' | 'medium' | 'low';
    reason: string;
}

export interface ExternalDoc {
    source: string;
    title: string;
    snippet: string;
    url?: string;
}

export interface ContextGrounderDependencies {
    fileSystem: IFileSystemPort;
    engine?: IEnginePort;
}

/**
 * ContextGrounder gathers relevant context before AI interactions.
 */
export class ContextGrounder {
    private contextAgent: ContextAgent | null = null;

    constructor(private readonly deps: ContextGrounderDependencies) {
        if (deps.engine) {
            this.contextAgent = new ContextAgent({
                engine: deps.engine,
                fileSystem: deps.fileSystem,
            });
        }
    }

    /**
     * Set the engine for AI-powered context gathering.
     */
    setEngine(engine: IEnginePort): void {
        this.contextAgent = new ContextAgent({
            engine,
            fileSystem: this.deps.fileSystem,
        });
    }

    /**
     * Gather context for a feature planning session.
     * Uses AI-powered ContextAgent when engine is available.
     */
    async gatherContext(featureName: string, userDescription: string): Promise<GroundedContext> {
        // Detect technologies first (always use heuristics for this)
        const technologies = await this.detectTechnologies();

        // If AI engine is available, use ContextAgent for intelligent gathering
        if (this.contextAgent) {
            try {
                const aiContext = await this.contextAgent.gatherContext(
                    featureName,
                    userDescription,
                    { technologies }
                );
                return this.mergeAiContext(aiContext, technologies);
            } catch (error) {
                console.warn('[ContextGrounder] AI context gathering failed, falling back to heuristics:', error);
                // Fall through to heuristic approach
            }
        }

        // Fallback: heuristic-based context gathering
        const context: GroundedContext = {
            workspaceFiles: [],
            externalDocs: [],
            technologies,
        };

        // Extract keywords from feature name and description
        const keywords = this.extractKeywords(featureName, userDescription);

        // Scan workspace for relevant files
        context.workspaceFiles = await this.findRelevantFiles(keywords);

        return context;
    }

    /**
     * Merge AI-gathered context into GroundedContext format.
     */
    private mergeAiContext(aiContext: ContextAgentResult, technologies: string[]): GroundedContext {
        return {
            workspaceFiles: aiContext.relevantFiles.map(f => ({
                path: f.path,
                content: '', // Content would need to be loaded separately if needed
                relevance: 'high' as const,
                reason: f.reason,
            })),
            externalDocs: [], // AI doesn't provide external docs currently
            technologies,
        };
    }

    /**
     * Scan codebase for files impacted by a design change.
     */
    async analyzeImpact(designDescription: string): Promise<ImpactAnalysis> {
        const impact: ImpactAnalysis = {
            potentiallyAffectedFiles: [],
            relatedComponents: [],
            riskLevel: 'low',
        };

        // Extract component/class/function names from design
        const identifiers = this.extractIdentifiers(designDescription);

        // Search for files containing these identifiers
        for (const id of identifiers) {
            const files = await this.searchInWorkspace(id);
            for (const file of files) {
                if (!impact.potentiallyAffectedFiles.includes(file)) {
                    impact.potentiallyAffectedFiles.push(file);
                }
            }
        }

        // Determine risk level based on number of affected files
        if (impact.potentiallyAffectedFiles.length > 10) {
            impact.riskLevel = 'high';
        } else if (impact.potentiallyAffectedFiles.length > 5) {
            impact.riskLevel = 'medium';
        }

        return impact;
    }

    /**
     * Extract keywords from feature description.
     */
    private extractKeywords(featureName: string, description: string): string[] {
        const text = `${featureName} ${description}`.toLowerCase();

        // Common tech keywords to look for
        const techKeywords = [
            'auth', 'authentication', 'login', 'oauth', 'jwt',
            'api', 'rest', 'graphql', 'grpc',
            'database', 'db', 'sql', 'postgres', 'mongodb',
            'cache', 'redis', 'session',
            'queue', 'message', 'event', 'webhook',
            'file', 'upload', 'storage', 's3',
            'email', 'notification', 'sms',
            'payment', 'stripe', 'billing',
            'user', 'profile', 'settings',
            'admin', 'dashboard', 'analytics',
            'search', 'filter', 'pagination',
            'test', 'testing', 'mock',
        ];

        const found: string[] = [];
        for (const keyword of techKeywords) {
            if (text.includes(keyword)) {
                found.push(keyword);
            }
        }

        // Also extract capitalized words as potential component names
        const words = description.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g) || [];
        found.push(...words.map(w => w.toLowerCase()));

        return [...new Set(found)];
    }

    /**
     * Find workspace files relevant to keywords.
     */
    private async findRelevantFiles(keywords: string[]): Promise<WorkspaceFile[]> {
        const files: WorkspaceFile[] = [];
        const root = this.deps.fileSystem.getWorkspaceRoot();

        if (!root) return files;

        // Search for common patterns
        const patterns = [
            '**/*.ts',
            '**/*.tsx',
            '**/*.js',
            '**/*.jsx',
            '**/*.py',
            '**/*.rs',
            '**/*.go',
        ];

        try {
            const foundFiles = await this.deps.fileSystem.findFiles(
                '{' + patterns.join(',') + '}',
                '**/node_modules/**'
            );

            // Limit search to avoid scanning too many files
            const filesToScan = foundFiles.slice(0, 50);

            for (const filePath of filesToScan) {
                // Check if filename matches any keyword
                const fileName = filePath.split('/').pop()?.toLowerCase() || '';
                const matchingKeywords = keywords.filter(k => fileName.includes(k));

                if (matchingKeywords.length > 0) {
                    try {
                        const content = await this.deps.fileSystem.readFile(filePath);
                        files.push({
                            path: filePath,
                            content: content.slice(0, 2000), // First 2000 chars
                            relevance: matchingKeywords.length > 2 ? 'high' : 'medium',
                            reason: `Filename matches: ${matchingKeywords.join(', ')}`,
                        });
                    } catch {
                        // Skip files we can't read
                    }
                }
            }
        } catch {
            // Graceful fallback if file search fails
        }

        return files.slice(0, 10); // Limit to 10 most relevant files
    }

    /**
     * Detect technologies in use.
     */
    private async detectTechnologies(): Promise<string[]> {
        const techs: string[] = [];

        // Check package.json
        if (await this.deps.fileSystem.exists('package.json')) {
            try {
                const content = await this.deps.fileSystem.readFile('package.json');
                const pkg = JSON.parse(content);
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };

                if (deps['react']) techs.push('React');
                if (deps['next']) techs.push('Next.js');
                if (deps['vue']) techs.push('Vue');
                if (deps['express']) techs.push('Express');
                if (deps['@nestjs/core']) techs.push('NestJS');
                if (deps['prisma'] || deps['@prisma/client']) techs.push('Prisma');
                if (deps['drizzle-orm']) techs.push('Drizzle');
                if (deps['mongoose']) techs.push('MongoDB/Mongoose');
                if (deps['zod']) techs.push('Zod');
                if (deps['trpc'] || deps['@trpc/server']) techs.push('tRPC');
                if (deps['typescript']) techs.push('TypeScript');
            } catch {
                // Ignore parse errors
            }
        }

        // Check for Python
        if (await this.deps.fileSystem.exists('pyproject.toml') ||
            await this.deps.fileSystem.exists('requirements.txt')) {
            techs.push('Python');
        }

        // Check for Rust
        if (await this.deps.fileSystem.exists('Cargo.toml')) {
            techs.push('Rust');
        }

        // Check for Go
        if (await this.deps.fileSystem.exists('go.mod')) {
            techs.push('Go');
        }

        return techs;
    }

    /**
     * Extract identifiers (class/function names) from text.
     */
    private extractIdentifiers(text: string): string[] {
        const identifiers: string[] = [];

        // Match PascalCase (class names)
        const classNames = text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) || [];
        identifiers.push(...classNames);

        // Match camelCase (function names)
        const funcNames = text.match(/\b[a-z]+(?:[A-Z][a-z]+)+\b/g) || [];
        identifiers.push(...funcNames);

        return [...new Set(identifiers)];
    }

    /**
     * Search workspace for files containing a term.
     */
    private async searchInWorkspace(term: string): Promise<string[]> {
        const results: string[] = [];

        try {
            const files = await this.deps.fileSystem.findFiles(
                '**/*.{ts,tsx,js,jsx,py,rs,go}',
                '**/node_modules/**'
            );

            // Simple search - check first 100 files
            for (const file of files.slice(0, 100)) {
                try {
                    const content = await this.deps.fileSystem.readFile(file);
                    if (content.includes(term)) {
                        results.push(file);
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        } catch {
            // Graceful fallback
        }

        return results.slice(0, 20);
    }
}

export interface ImpactAnalysis {
    potentiallyAffectedFiles: string[];
    relatedComponents: string[];
    riskLevel: 'low' | 'medium' | 'high';
}
