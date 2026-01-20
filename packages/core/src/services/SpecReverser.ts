/**
 * SpecReverser Service
 *
 * Reverse engineers specs from existing code by analyzing file structure,
 * identifying patterns, and clustering related files into logical features.
 */

import type { IEnginePort, FileReference } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { SpecDetail, TraceabilityLink } from '../domain/Spec.js';
import type { Task } from '../domain/Task.js';

export interface SpecReverserDependencies {
    engine: IEnginePort;
    fileSystem: IFileSystemPort;
}

export interface ReverseEngineerOptions {
    /** Maximum depth to scan directories */
    maxDepth?: number;
    /** File patterns to include (glob-like) */
    includePatterns?: string[];
    /** File patterns to exclude */
    excludePatterns?: string[];
    /** Whether to generate tasks for existing code */
    generateTasks?: boolean;
    /** Target language for analysis hints */
    language?: string;
}

export interface FeatureCluster {
    /** Suggested feature name */
    name: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** Files belonging to this feature */
    files: string[];
    /** Detected patterns (MVC, repository, etc.) */
    patterns: string[];
    /** Entry points or main files */
    entryPoints: string[];
    /** Dependencies between files */
    internalDependencies: Array<{ from: string; to: string }>;
    /** External dependencies (packages) */
    externalDependencies: string[];
}

export interface AnalysisResult {
    /** Identified feature clusters */
    clusters: FeatureCluster[];
    /** Files that couldn't be clustered */
    orphanedFiles: string[];
    /** Overall project structure insights */
    projectInsights: {
        detectedFrameworks: string[];
        architecturePattern?: string;
        testFramework?: string;
        buildTool?: string;
    };
}

const DEFAULT_OPTIONS: ReverseEngineerOptions = {
    maxDepth: 10,
    includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.java', '**/*.go', '**/*.rs'],
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**'],
    generateTasks: true,
};

/**
 * SpecReverser analyzes existing code and generates specs.
 */
export class SpecReverser {
    constructor(private readonly deps: SpecReverserDependencies) { }

    // ═══════════════════════════════════════════════════════════════════════════
    // Main API
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Reverse engineer specs from a code path.
     */
    async reverseEngineer(
        targetPath: string,
        options: ReverseEngineerOptions = {}
    ): Promise<SpecDetail[]> {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        // Step 1: Scan and collect files
        const files = await this.scanDirectory(targetPath, opts);

        if (files.length === 0) {
            return [];
        }

        // Step 2: Analyze and cluster files into features
        const analysis = await this.analyzeAndCluster(files, opts);

        // Step 3: Generate specs for each cluster
        const specs: SpecDetail[] = [];

        for (const cluster of analysis.clusters) {
            const spec = await this.generateSpecFromCluster(cluster, analysis.projectInsights, opts);
            specs.push(spec);
        }

        return specs;
    }

    /**
     * Analyze a directory without generating full specs.
     * Useful for preview before committing to reverse engineering.
     */
    async analyze(
        targetPath: string,
        options: ReverseEngineerOptions = {}
    ): Promise<AnalysisResult> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const files = await this.scanDirectory(targetPath, opts);
        return this.analyzeAndCluster(files, opts);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // File Scanning
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Scan directory and collect relevant files.
     */
    private async scanDirectory(
        targetPath: string,
        options: ReverseEngineerOptions
    ): Promise<string[]> {
        const files: string[] = [];
        await this.scanRecursive(targetPath, files, 0, options);
        return files;
    }

    private async scanRecursive(
        path: string,
        files: string[],
        depth: number,
        options: ReverseEngineerOptions
    ): Promise<void> {
        if (depth > (options.maxDepth ?? 10)) {
            return;
        }

        try {
            const entries = await this.deps.fileSystem.readDirectory(path);

            for (const entry of entries) {
                const fullPath = `${path}/${entry.name}`;

                // Skip excluded patterns
                if (this.matchesAnyPattern(fullPath, options.excludePatterns ?? [])) {
                    continue;
                }

                if (entry.type === 'directory') {
                    await this.scanRecursive(fullPath, files, depth + 1, options);
                } else if (entry.type === 'file') {
                    if (this.matchesAnyPattern(fullPath, options.includePatterns ?? [])) {
                        files.push(fullPath);
                    }
                }
            }
        } catch {
            // Directory doesn't exist or can't be read
        }
    }

    /**
     * Simple glob-like pattern matching.
     */
    private matchesAnyPattern(path: string, patterns: string[]): boolean {
        for (const pattern of patterns) {
            if (this.matchesPattern(path, pattern)) {
                return true;
            }
        }
        return false;
    }

    private matchesPattern(path: string, pattern: string): boolean {
        // Convert glob to regex
        const regexPattern = pattern
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/{{GLOBSTAR}}/g, '.*');

        const regex = new RegExp(regexPattern);
        return regex.test(path);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Analysis & Clustering
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Analyze files and cluster them into logical features.
     */
    private async analyzeAndCluster(
        files: string[],
        _options: ReverseEngineerOptions
    ): Promise<AnalysisResult> {
        // Read file contents for analysis
        const fileContents = await this.readFileContents(files);

        // Detect project insights
        const projectInsights = this.detectProjectInsights(files, fileContents);

        // Build dependency graph
        const dependencies = this.buildDependencyGraph(fileContents);

        // Cluster files by various heuristics
        const clusters = this.clusterFiles(files, fileContents, dependencies, projectInsights);

        // Find orphaned files
        const clusteredFiles = new Set(clusters.flatMap(c => c.files));
        const orphanedFiles = files.filter(f => !clusteredFiles.has(f));

        return {
            clusters,
            orphanedFiles,
            projectInsights,
        };
    }

    /**
     * Read contents of files for analysis.
     */
    private async readFileContents(files: string[]): Promise<Map<string, string>> {
        const contents = new Map<string, string>();

        for (const file of files) {
            try {
                const content = await this.deps.fileSystem.readFile(file);
                contents.set(file, content);
            } catch {
                // Skip files that can't be read
            }
        }

        return contents;
    }

    /**
     * Detect project-level insights from files.
     */
    private detectProjectInsights(
        files: string[],
        contents: Map<string, string>
    ): AnalysisResult['projectInsights'] {
        const insights: AnalysisResult['projectInsights'] = {
            detectedFrameworks: [],
        };

        // Detect by file patterns
        const hasPackageJson = files.some(f => f.endsWith('package.json'));
        const hasPyprojectToml = files.some(f => f.endsWith('pyproject.toml'));
        const hasCargoToml = files.some(f => f.endsWith('Cargo.toml'));
        const hasGoMod = files.some(f => f.endsWith('go.mod'));

        // Detect frameworks from content
        for (const [file, content] of contents) {
            // React
            if (content.includes('from \'react\'') || content.includes('from "react"')) {
                if (!insights.detectedFrameworks.includes('React')) {
                    insights.detectedFrameworks.push('React');
                }
            }
            // Vue
            if (content.includes('from \'vue\'') || file.endsWith('.vue')) {
                if (!insights.detectedFrameworks.includes('Vue')) {
                    insights.detectedFrameworks.push('Vue');
                }
            }
            // Express
            if (content.includes('from \'express\'') || content.includes('require(\'express\')')) {
                if (!insights.detectedFrameworks.includes('Express')) {
                    insights.detectedFrameworks.push('Express');
                }
            }
            // Next.js
            if (content.includes('from \'next\'') || content.includes('next/')) {
                if (!insights.detectedFrameworks.includes('Next.js')) {
                    insights.detectedFrameworks.push('Next.js');
                }
            }
            // Django
            if (content.includes('from django') || content.includes('import django')) {
                if (!insights.detectedFrameworks.includes('Django')) {
                    insights.detectedFrameworks.push('Django');
                }
            }
            // FastAPI
            if (content.includes('from fastapi') || content.includes('import fastapi')) {
                if (!insights.detectedFrameworks.includes('FastAPI')) {
                    insights.detectedFrameworks.push('FastAPI');
                }
            }
        }

        // Detect architecture pattern
        const hasControllers = files.some(f => f.includes('/controllers/') || f.includes('/controller'));
        const hasServices = files.some(f => f.includes('/services/') || f.includes('/service'));
        const hasRepositories = files.some(f => f.includes('/repositories/') || f.includes('/repository'));
        const hasModels = files.some(f => f.includes('/models/') || f.includes('/entities/'));
        const hasPorts = files.some(f => f.includes('/ports/'));
        const hasAdapters = files.some(f => f.includes('/adapters/'));

        if (hasPorts && hasAdapters) {
            insights.architecturePattern = 'Hexagonal (Ports & Adapters)';
        } else if (hasControllers && hasServices && hasRepositories) {
            insights.architecturePattern = 'Layered (Controller-Service-Repository)';
        } else if (hasControllers && hasModels) {
            insights.architecturePattern = 'MVC';
        }

        // Detect test framework
        const hasJest = files.some(f => f.includes('.test.') || f.includes('.spec.'));
        const hasPytest = files.some(f => f.includes('test_') || f.includes('_test.py'));

        if (hasJest) {
            insights.testFramework = 'Jest/Vitest';
        } else if (hasPytest) {
            insights.testFramework = 'pytest';
        }

        // Detect build tool
        if (hasPackageJson) {
            insights.buildTool = 'npm/pnpm';
        } else if (hasPyprojectToml) {
            insights.buildTool = 'Python (pyproject.toml)';
        } else if (hasCargoToml) {
            insights.buildTool = 'Cargo';
        } else if (hasGoMod) {
            insights.buildTool = 'Go Modules';
        }

        return insights;
    }

    /**
     * Build a dependency graph from import statements.
     */
    private buildDependencyGraph(
        contents: Map<string, string>
    ): Map<string, Set<string>> {
        const graph = new Map<string, Set<string>>();

        for (const [file, content] of contents) {
            const deps = new Set<string>();

            // TypeScript/JavaScript imports
            const tsImports = content.matchAll(/import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g);
            for (const match of tsImports) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    deps.add(this.resolveRelativePath(file, importPath));
                }
            }

            // Python imports
            const pyImports = content.matchAll(/from\s+(\S+)\s+import|import\s+(\S+)/g);
            for (const match of pyImports) {
                const importPath = match[1] ?? match[2];
                if (importPath && !importPath.includes('.')) {
                    // Local module import
                    deps.add(importPath);
                }
            }

            graph.set(file, deps);
        }

        return graph;
    }

    /**
     * Resolve a relative import path.
     */
    private resolveRelativePath(fromFile: string, importPath: string): string {
        const dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
        const parts = importPath.split('/');
        let resolved = dir;

        for (const part of parts) {
            if (part === '.') {
                continue;
            } else if (part === '..') {
                resolved = resolved.substring(0, resolved.lastIndexOf('/'));
            } else {
                resolved = `${resolved}/${part}`;
            }
        }

        // Add common extensions
        if (!resolved.includes('.')) {
            resolved += '.ts'; // Default to TypeScript
        }

        return resolved;
    }

    /**
     * Cluster files into logical features.
     */
    private clusterFiles(
        files: string[],
        contents: Map<string, string>,
        dependencies: Map<string, Set<string>>,
        _insights: AnalysisResult['projectInsights']
    ): FeatureCluster[] {
        const clusters: FeatureCluster[] = [];
        const assigned = new Set<string>();

        // Strategy 1: Cluster by directory structure
        const dirClusters = this.clusterByDirectory(files);

        for (const [dirName, dirFiles] of dirClusters) {
            // Skip if too small or too large
            if (dirFiles.length < 2 || dirFiles.length > 50) {
                continue;
            }

            // Analyze the cluster
            const cluster = this.analyzeCluster(dirName, dirFiles, contents, dependencies);
            if (cluster.confidence > 0.5) {
                clusters.push(cluster);
                dirFiles.forEach(f => assigned.add(f));
            }
        }

        // Strategy 2: Cluster by naming convention (e.g., UserController, UserService, UserRepository)
        const nameClusters = this.clusterByNaming(files.filter(f => !assigned.has(f)));

        for (const [name, nameFiles] of nameClusters) {
            if (nameFiles.length >= 2) {
                const cluster = this.analyzeCluster(name, nameFiles, contents, dependencies);
                if (cluster.confidence > 0.4) {
                    clusters.push(cluster);
                    nameFiles.forEach(f => assigned.add(f));
                }
            }
        }

        // Strategy 3: Cluster by dependency connectivity
        const unassigned = files.filter(f => !assigned.has(f));
        const depClusters = this.clusterByDependencies(unassigned, dependencies);

        for (const [name, depFiles] of depClusters) {
            if (depFiles.length >= 2) {
                const cluster = this.analyzeCluster(name, depFiles, contents, dependencies);
                clusters.push(cluster);
            }
        }

        return clusters;
    }

    /**
     * Cluster files by directory.
     */
    private clusterByDirectory(files: string[]): Map<string, string[]> {
        const clusters = new Map<string, string[]>();

        for (const file of files) {
            // Use the parent directory as the cluster key
            const parts = file.split('/');
            if (parts.length >= 2) {
                const dir = parts[parts.length - 2];
                if (!clusters.has(dir)) {
                    clusters.set(dir, []);
                }
                clusters.get(dir)!.push(file);
            }
        }

        return clusters;
    }

    /**
     * Cluster files by naming convention.
     */
    private clusterByNaming(files: string[]): Map<string, string[]> {
        const clusters = new Map<string, string[]>();

        // Extract base names (e.g., "User" from "UserController.ts")
        const patterns = [
            /^(.+?)(?:Controller|Service|Repository|Model|Entity|Handler|Manager|Provider|Factory|Helper|Util)(?:\.ts|\.js|\.tsx|\.jsx)?$/,
            /^(.+?)(?:_controller|_service|_repository|_model|_handler)(?:\.py|\.rb)?$/,
        ];

        for (const file of files) {
            const fileName = file.split('/').pop() ?? '';

            for (const pattern of patterns) {
                const match = fileName.match(pattern);
                if (match) {
                    const baseName = match[1];
                    if (!clusters.has(baseName)) {
                        clusters.set(baseName, []);
                    }
                    clusters.get(baseName)!.push(file);
                    break;
                }
            }
        }

        return clusters;
    }

    /**
     * Cluster files by dependency connectivity.
     */
    private clusterByDependencies(
        files: string[],
        dependencies: Map<string, Set<string>>
    ): Map<string, string[]> {
        const clusters = new Map<string, string[]>();
        const fileSet = new Set(files);
        const visited = new Set<string>();

        let clusterIndex = 0;

        for (const file of files) {
            if (visited.has(file)) {
                continue;
            }

            // BFS to find connected files
            const connected: string[] = [];
            const queue = [file];

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) {
                    continue;
                }
                visited.add(current);

                if (fileSet.has(current)) {
                    connected.push(current);

                    // Add dependencies
                    const deps = dependencies.get(current);
                    if (deps) {
                        for (const dep of deps) {
                            if (fileSet.has(dep) && !visited.has(dep)) {
                                queue.push(dep);
                            }
                        }
                    }
                }
            }

            if (connected.length > 0) {
                const name = this.inferClusterName(connected);
                clusters.set(name || `cluster-${clusterIndex++}`, connected);
            }
        }

        return clusters;
    }

    /**
     * Infer a cluster name from its files.
     */
    private inferClusterName(files: string[]): string {
        // Find common directory
        const dirs = files.map(f => {
            const parts = f.split('/');
            return parts.slice(0, -1).join('/');
        });

        // Find longest common prefix
        if (dirs.length === 0) return 'feature';

        let common = dirs[0];
        for (const dir of dirs) {
            while (!dir.startsWith(common) && common.length > 0) {
                common = common.substring(0, common.lastIndexOf('/'));
            }
        }

        const lastPart = common.split('/').pop();
        return lastPart || 'feature';
    }

    /**
     * Analyze a cluster of files.
     */
    private analyzeCluster(
        name: string,
        files: string[],
        contents: Map<string, string>,
        dependencies: Map<string, Set<string>>
    ): FeatureCluster {
        const patterns: string[] = [];
        const entryPoints: string[] = [];
        const internalDeps: Array<{ from: string; to: string }> = [];
        const externalDeps = new Set<string>();

        // Detect patterns
        const hasController = files.some(f => f.toLowerCase().includes('controller'));
        const hasService = files.some(f => f.toLowerCase().includes('service'));
        const hasRepository = files.some(f => f.toLowerCase().includes('repository'));
        const hasModel = files.some(f => f.toLowerCase().includes('model') || f.toLowerCase().includes('entity'));
        const hasTest = files.some(f => f.includes('.test.') || f.includes('.spec.') || f.includes('_test.'));

        if (hasController && hasService) patterns.push('MVC/Layered');
        if (hasRepository) patterns.push('Repository Pattern');
        if (hasModel) patterns.push('Domain Model');
        if (hasTest) patterns.push('Has Tests');

        // Find entry points (files with main, index, or app)
        for (const file of files) {
            const fileName = file.split('/').pop()?.toLowerCase() ?? '';
            if (fileName.includes('index') || fileName.includes('main') || fileName.includes('app')) {
                entryPoints.push(file);
            }
        }

        // Build internal dependency list
        const fileSet = new Set(files);
        for (const file of files) {
            const deps = dependencies.get(file);
            if (deps) {
                for (const dep of deps) {
                    if (fileSet.has(dep)) {
                        internalDeps.push({ from: file, to: dep });
                    }
                }
            }

            // Extract external dependencies
            const content = contents.get(file);
            if (content) {
                const imports = content.matchAll(/from\s+['"]([^.][^'"]+)['"]/g);
                for (const match of imports) {
                    if (!match[1].startsWith('.')) {
                        externalDeps.add(match[1].split('/')[0]);
                    }
                }
            }
        }

        // Calculate confidence based on cohesion
        const cohesion = internalDeps.length / Math.max(files.length, 1);
        const hasPatterns = patterns.length > 0;
        const confidence = Math.min(0.3 + (cohesion * 0.3) + (hasPatterns ? 0.3 : 0) + (entryPoints.length > 0 ? 0.1 : 0), 1);

        return {
            name: this.formatClusterName(name),
            confidence,
            files,
            patterns,
            entryPoints,
            internalDependencies: internalDeps,
            externalDependencies: Array.from(externalDeps),
        };
    }

    /**
     * Format cluster name for display.
     */
    private formatClusterName(name: string): string {
        // Convert kebab-case or snake_case to Title Case
        return name
            .replace(/[-_]/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Spec Generation
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Generate a spec from a feature cluster.
     */
    private async generateSpecFromCluster(
        cluster: FeatureCluster,
        projectInsights: AnalysisResult['projectInsights'],
        options: ReverseEngineerOptions
    ): Promise<SpecDetail> {
        const specId = cluster.name.toLowerCase().replace(/\s+/g, '-');
        const specPath = `.spec/specs/${specId}`;

        // Read cluster file contents for analysis
        const fileContents: FileReference[] = [];
        for (const file of cluster.files.slice(0, 10)) { // Limit to 10 files
            try {
                const content = await this.deps.fileSystem.readFile(file);
                fileContents.push({
                    path: file,
                    content: content.substring(0, 5000), // Limit content size
                    language: this.inferLanguage(file),
                });
            } catch {
                // Skip files that can't be read
            }
        }

        // Generate requirements via engine
        const requirements = await this.generateRequirements(cluster, fileContents, projectInsights);

        // Generate design via engine
        const design = await this.generateDesign(cluster, fileContents, projectInsights);

        // Generate tasks if requested
        const tasks: Task[] = options.generateTasks
            ? await this.generateTasks(cluster, fileContents, specId)
            : [];

        // Create spec directory and write files
        await this.deps.fileSystem.createDirectory(specPath);
        await this.deps.fileSystem.writeFile(`${specPath}/requirements.md`, requirements);
        await this.deps.fileSystem.writeFile(`${specPath}/design.md`, design);

        if (tasks.length > 0) {
            const tasksContent = this.serializeTasks(tasks, cluster.name);
            await this.deps.fileSystem.writeFile(`${specPath}/tasks.md`, tasksContent);
        }

        // Build traceability links
        const traceability: TraceabilityLink[] = tasks.map((task, index) => ({
            from: { type: 'task' as const, id: task.id },
            to: { type: 'requirement' as const, id: `REQ-${index + 1}` },
            relationship: 'implements' as const,
        }));

        return {
            id: specId,
            featureName: cluster.name,
            status: 'draft',
            currentPhase: 'requirements',
            createdAt: new Date(),
            updatedAt: new Date(),
            taskCount: tasks.length,
            completedTaskCount: 0,
            path: specPath,
            requirements,
            design,
            tasks,
            traceability,
        };
    }

    /**
     * Generate requirements document from cluster analysis.
     */
    private async generateRequirements(
        cluster: FeatureCluster,
        fileContents: FileReference[],
        projectInsights: AnalysisResult['projectInsights']
    ): Promise<string> {
        // Build context for engine
        this.buildRequirementsPrompt(cluster, fileContents, projectInsights);

        const result = await this.deps.engine.prompt(
            { type: 'reverse-requirements', systemPrompt: this.getRequirementsSystemPrompt() },
            { files: fileContents }
        );

        // If engine returns placeholder, use a structured template
        if (result.includes('[Prompt ready')) {
            return this.generateRequirementsTemplate(cluster, projectInsights);
        }

        return result;
    }

    /**
     * Generate design document from cluster analysis.
     */
    private async generateDesign(
        cluster: FeatureCluster,
        fileContents: FileReference[],
        projectInsights: AnalysisResult['projectInsights']
    ): Promise<string> {
        const result = await this.deps.engine.prompt(
            { type: 'reverse-design', systemPrompt: this.getDesignSystemPrompt() },
            { files: fileContents }
        );

        // If engine returns placeholder, use a structured template
        if (result.includes('[Prompt ready')) {
            return this.generateDesignTemplate(cluster, fileContents, projectInsights);
        }

        return result;
    }

    /**
     * Generate tasks from existing code.
     */
    private async generateTasks(
        cluster: FeatureCluster,
        _fileContents: FileReference[],
        specId: string
    ): Promise<Task[]> {
        const tasks: Task[] = [];
        let taskIndex = 1;

        // Create documentation task
        tasks.push({
            id: `${taskIndex}`,
            specId,
            title: 'Document feature requirements',
            description: `Review and complete the auto-generated requirements for ${cluster.name}.`,
            status: 'pending',
            type: 'document',
            priority: 1,
        });
        taskIndex++;

        // Create test tasks for untested files
        const untestedFiles = cluster.files.filter(f =>
            !f.includes('.test.') && !f.includes('.spec.') && !f.includes('_test.')
        );

        if (untestedFiles.length > 0) {
            tasks.push({
                id: `${taskIndex}`,
                specId,
                title: 'Add missing tests',
                description: `Add unit tests for ${untestedFiles.length} untested files in ${cluster.name}.`,
                status: 'pending',
                type: 'test',
                priority: 2,
                targetFiles: untestedFiles.slice(0, 5).map(f => f.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1')),
            });
            taskIndex++;
        }

        // Create refactor task if patterns indicate technical debt
        if (cluster.files.length > 10) {
            tasks.push({
                id: `${taskIndex}`,
                specId,
                title: 'Review and refactor',
                description: `Review ${cluster.name} for potential refactoring opportunities.`,
                status: 'pending',
                type: 'refactor',
                priority: 3,
            });
            taskIndex++;
        }

        return tasks;
    }

    /**
     * Serialize tasks to markdown format.
     */
    private serializeTasks(tasks: Task[], featureName: string): string {
        const lines: string[] = [
            `# Tasks: ${featureName}`,
            '',
            '> Auto-generated from reverse engineering. Review and modify as needed.',
            '',
            '## Task List',
            '',
        ];

        for (const task of tasks) {
            lines.push(`### Task ${task.id}: ${task.title}`);
            lines.push('');
            lines.push(`- **Status**: ${task.status}`);
            lines.push(`- **Type**: ${task.type}`);
            lines.push(`- **Priority**: ${task.priority}`);
            if (task.targetFiles?.length) {
                lines.push(`- **Files**: ${task.targetFiles.join(', ')}`);
            }
            lines.push('');
            lines.push(task.description);
            lines.push('');
        }

        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Prompt Building
    // ═══════════════════════════════════════════════════════════════════════════

    private buildRequirementsPrompt(
        cluster: FeatureCluster,
        fileContents: FileReference[],
        projectInsights: AnalysisResult['projectInsights']
    ): string {
        const fileList = fileContents.map(f => `- ${f.path}`).join('\n');
        return `Analyze the following code files and generate a requirements document.

Feature: ${cluster.name}
Files (${cluster.files.length}):
${fileList}
Patterns Detected: ${cluster.patterns.join(', ') || 'None'}
Frameworks: ${projectInsights.detectedFrameworks.join(', ') || 'None'}

Generate requirements in EARS format covering:
1. What the feature does (functional requirements)
2. How it should perform (non-functional requirements)
3. Any constraints or dependencies`;
    }

    private getRequirementsSystemPrompt(): string {
        return `You are a requirements analyst reverse engineering specifications from existing code.
Analyze the provided code and generate a requirements document using EARS syntax.
Focus on:
1. Core functionality
2. Edge cases visible in the code
3. Non-functional requirements (performance, security)
4. Dependencies and constraints

Use this format:
# Requirements: [Feature Name]

## Overview
[Brief description]

## Functional Requirements
### FR-001: [Name]
**EARS Pattern**: [When/If/The system shall...]

## Non-Functional Requirements
### NFR-001: [Name]
[Requirement]`;
    }

    private getDesignSystemPrompt(): string {
        return `You are a software architect reverse engineering design from existing code.
Analyze the provided code and generate a design document.
Include:
1. Architecture overview with Mermaid diagrams
2. Component descriptions
3. Data models
4. API contracts
5. Integration points`;
    }

    /**
     * Generate a requirements template when engine is not available.
     */
    private generateRequirementsTemplate(
        cluster: FeatureCluster,
        projectInsights: AnalysisResult['projectInsights']
    ): string {
        return `# Requirements: ${cluster.name}

> Auto-generated from reverse engineering. Review and complete.

## Overview

This feature was reverse-engineered from ${cluster.files.length} source files.

**Detected Patterns**: ${cluster.patterns.join(', ') || 'None detected'}
**Frameworks**: ${projectInsights.detectedFrameworks.join(', ') || 'None detected'}
**Architecture**: ${projectInsights.architecturePattern || 'Not detected'}

## Functional Requirements

### FR-001: Core Functionality

**EARS Pattern**: The system shall provide ${cluster.name} functionality.

> TODO: Detail the specific functionality based on code analysis.

## Non-Functional Requirements

### NFR-001: Performance

> TODO: Define performance requirements.

### NFR-002: Maintainability

> TODO: Define maintainability requirements.

## Dependencies

${cluster.externalDependencies.map(dep => `- ${dep}`).join('\n') || '- None detected'}

## Entry Points

${cluster.entryPoints.map(ep => `- ${ep}`).join('\n') || '- None detected'}
`;
    }

    /**
     * Generate a design template when engine is not available.
     */
    private generateDesignTemplate(
        cluster: FeatureCluster,
        _fileContents: FileReference[],
        _projectInsights: AnalysisResult['projectInsights']
    ): string {
        let mermaidDiagram = 'graph TB\n';
        for (let i = 0; i < Math.min(cluster.files.length, 5); i++) {
            const fileName = cluster.files[i].split('/').pop()?.replace(/\.[^.]+$/, '') ?? `File${i}`;
            mermaidDiagram += `    ${fileName}[${fileName}]\n`;
        }
        if (cluster.internalDependencies.length > 0) {
            for (const dep of cluster.internalDependencies.slice(0, 10)) {
                const from = dep.from.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'A';
                const to = dep.to.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'B';
                mermaidDiagram += `    ${from} --> ${to}\n`;
            }
        }

        return `# Design: ${cluster.name}

> Auto-generated from reverse engineering. Review and complete.

## Overview

This design document describes the architecture of ${cluster.name}.

## Architecture

\`\`\`mermaid
${mermaidDiagram}\`\`\`

## Components

${cluster.files.slice(0, 10).map(f => `### ${f.split('/').pop()}\n\n- **Path**: ${f}\n- **Purpose**: TODO\n`).join('\n')}

## Patterns

${cluster.patterns.map(p => `- ${p}`).join('\n') || '- None detected'}

## Dependencies

### Internal
${cluster.internalDependencies.slice(0, 10).map(d => `- ${d.from.split('/').pop()} → ${d.to.split('/').pop()}`).join('\n') || '- None'}

### External
${cluster.externalDependencies.map(d => `- ${d}`).join('\n') || '- None'}
`;
    }

    /**
     * Infer programming language from file extension.
     */
    private inferLanguage(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescriptreact',
            js: 'javascript',
            jsx: 'javascriptreact',
            py: 'python',
            rb: 'ruby',
            java: 'java',
            go: 'go',
            rs: 'rust',
            cpp: 'cpp',
            c: 'c',
            cs: 'csharp',
        };
        return languageMap[ext ?? ''] ?? 'plaintext';
    }
}
