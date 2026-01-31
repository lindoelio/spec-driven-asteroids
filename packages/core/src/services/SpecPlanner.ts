/**
 * SpecPlanner Service
 *
 * Orchestrates the planning phase for the Spec-Driven workflow:
 *
 * Requirements → Design → Tasks
 *
 * Guidelines are expected to be available at repository root and are injected
 * through the engine context when needed.
 */

import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import { Spec } from '../domain/Spec.js';
import type { GuidelinesDocs, EngineSkillConfig } from '../domain/Guidelines.js';
import { generateAgentSkillTemplate } from '../domain/Guidelines.js';
import { ContextGrounder, type ImpactAnalysis } from './ContextGrounder.js';
import { EarsStrategy, type IssueContext } from '../strategies/EarsStrategy.js';
import { DesignStrategy } from '../strategies/DesignStrategy.js';
import { TaskDecomposerStrategy } from '../strategies/TaskDecomposerStrategy.js';
import { NamingStrategy } from '../strategies/NamingStrategy.js';
import { DEFAULT_SKILL_CONFIG } from './GuidelinesGenerator.js';

export interface SpecPlannerDependencies {
    engine: IEnginePort;
    fileSystem: IFileSystemPort;
    skillConfig?: EngineSkillConfig; // Optional, for engine-specific skill paths
}

export interface PlanningContext {
    guidelines?: GuidelinesDocs;
    issueContext?: IssueContext;
    technologies?: string[];
}

export interface ClarificationResult {
    isClear: boolean;
    missingInfo: string[];
    analysis: string;
}

export interface PlanningResult {
    spec: Spec;
    phase: 'requirements' | 'design' | 'tasks';
    content: string;
    summary?: string;
    impactAnalysis?: ImpactAnalysis;
}

/**
 * SpecPlanner handles the creation and planning of specs.
 */
export class SpecPlanner {
    private contextGrounder: ContextGrounder;
    private skillConfig: EngineSkillConfig;

    constructor(private readonly deps: SpecPlannerDependencies) {
        this.contextGrounder = new ContextGrounder({
            fileSystem: deps.fileSystem,
            engine: deps.engine, // Pass engine for AI-powered context gathering
        });
        this.skillConfig = deps.skillConfig ?? DEFAULT_SKILL_CONFIG;
    }

    /**
     * Set the skill config for engine-specific paths.
     */
    setSkillConfig(config: EngineSkillConfig): void {
        this.skillConfig = config;
    }

    private parseResponse(response: string): { summary: string; content: string } {
        const summaryMatch = response.match(/<summary>([\s\S]*?)<\/summary>/);
        const docMatch = response.match(/<document>([\s\S]*?)<\/document>/);

        if (summaryMatch && docMatch) {
            let content = docMatch[1].trim();
            // Remove markdown code block delimiters if present at start/end
            content = content.replace(/^```markdown\s*/, '').replace(/```$/, '').trim();
            return {
                summary: summaryMatch[1].trim(),
                content
            };
        }

        // Fallback for non-XML response (e.g. legacy or malformed)
        return {
            summary: 'Content generated successfully.',
            content: response.trim()
        };
    }

    /**
     * Start a new spec session with context grounding.
     */
    async createSpec(featureName: string, userDescription: string = ''): Promise<Spec> {
        let id: string;

        try {
            // Try to generate a semantic ID using LLM if available
            id = await this.generateSemanticSpecId(featureName);
        } catch (e) {
            // Fallback to slug if LLM fails
            id = this.generateSlugSpecId(featureName);
        }

        const spec = new Spec(id, featureName);

        // Create spec directory
        const specPath = `.spec/changes/${id}`;
        await this.deps.fileSystem.createDirectory(specPath);

        // Save initial requirements file (no meta.json)
        // This persists the feature name in the document itself
        await this.deps.fileSystem.writeFile(
            `${specPath}/requirements.md`,
            `# ${featureName}\n\n${userDescription}\n\n<!-- To be generated -->`
        );

        return spec;
    }

    /**
     * Gather context before requirements generation.
     */
    async gatherContext(featureName: string, userDescription: string): Promise<PlanningContext> {
        const grounded = await this.contextGrounder.gatherContext(featureName, userDescription);

        return {
            technologies: grounded.technologies,
        };
    }

    /**
     * Analyze if the request is clear enough to proceed.
     */
    async analyzeRequest(description: string): Promise<ClarificationResult> {
        const length = description.length;
        return {
            isClear: true,
            missingInfo: [],
            analysis: `Clarification disabled: always proceed with generation. (${length} chars)`
        };
    }

    /**
     * Generate requirements using EARS strategy.
     *
     * WORKFLOW: Guidelines → Requirements → Design → Tasks
     * Guidelines should be generated BEFORE calling this method.
     */
    async generateRequirements(
        spec: Spec,
        userInput: string,
        context: PlanningContext = {}
    ): Promise<PlanningResult> {
        // Guidelines are optional but recommended

        // Create strategy with context
        const strategy = new EarsStrategy({
            technologies: context.technologies,
            issueContext: context.issueContext,
        });

        const promptContext = {
            specId: spec.id,
            guidelines: context.guidelines,
            history: [{ role: 'user' as const, content: userInput }],
        };

        const result = await this.deps.engine.prompt(strategy, promptContext);
        const { summary, content } = this.parseResponse(result);

        // Write requirements.md
        const reqPath = `.spec/changes/${spec.id}/requirements.md`;
        await this.deps.fileSystem.writeFile(reqPath, content);

        // Update spec status
        spec.advancePhase();

        return {
            spec,
            phase: 'requirements',
            content,
            summary,
        };
    }

    /**
     * Generate design from requirements with impact analysis.
     */
    async generateDesign(
        spec: Spec,
        requirements: string,
        context: PlanningContext = {}
    ): Promise<PlanningResult> {
        // Perform impact analysis
        const impactAnalysis = await this.contextGrounder.analyzeImpact(requirements);

        // Create strategy with context
        const strategy = new DesignStrategy({
            technologies: context.technologies,
            impactAnalysis,
        });

        const promptContext = {
            specId: spec.id,
            guidelines: context.guidelines,
            history: [{ role: 'user' as const, content: requirements }],
        };

        const result = await this.deps.engine.prompt(strategy, promptContext);
        const { summary, content } = this.parseResponse(result);

        // Write design.md
        const designPath = `.spec/changes/${spec.id}/design.md`;
        await this.deps.fileSystem.writeFile(designPath, content);

        // Update spec status
        spec.advancePhase();

        return {
            spec,
            phase: 'design',
            content,
            summary,
            impactAnalysis,
        };
    }

    /**
     * Decompose design into tasks.
     */
    async generateTasks(
        spec: Spec,
        design: string,
        options: { suggestTdd?: boolean; requirements?: string } = {}
    ): Promise<PlanningResult> {
        const strategy = new TaskDecomposerStrategy({ suggestTdd: options.suggestTdd });

        // Include both requirements and design for better task context
        const inputContent = options.requirements
            ? `## Requirements\n\n${options.requirements}\n\n## Design\n\n${design}`
            : design;

        const promptContext = {
            specId: spec.id,
            history: [{ role: 'user' as const, content: inputContent }],
        };

        const result = await this.deps.engine.prompt(strategy, promptContext);
        const { summary, content } = this.parseResponse(result);

        // Write tasks.md
        const tasksPath = `.spec/changes/${spec.id}/tasks.md`;
        await this.deps.fileSystem.writeFile(tasksPath, content);

        // Ensure Agent Skill exists for implementation
        await this.ensureAgentSkill();

        // Update spec status
        spec.advancePhase();

        return {
            spec,
            phase: 'tasks',
            content,
            summary,
        };
    }

    /**
     * Ensure the SpecDriven Agent Skill exists.
     * Uses the configured skill path from the inbound adapter.
     */
    private async ensureAgentSkill(): Promise<void> {
        const skillPath = `${this.skillConfig.skillDirectory}/${this.skillConfig.skillFileName}`;

        // Only create if it doesn't exist
        if (await this.deps.fileSystem.exists(skillPath)) {
            return;
        }

        await this.deps.fileSystem.createDirectory(this.skillConfig.skillDirectory);
        await this.deps.fileSystem.writeFile(skillPath, generateAgentSkillTemplate(this.skillConfig.skillName));
    }

    /**
     * Load an existing spec from disk.
     */
    async loadSpec(specId: string): Promise<Spec | null> {
        const specPath = `.spec/changes/${specId}`;
        const reqPath = `${specPath}/requirements.md`;
        const designPath = `${specPath}/design.md`;
        const tasksPath = `${specPath}/tasks.md`;

        if (!await this.deps.fileSystem.exists(specPath)) {
            return null;
        }

        let featureName = specId.replace(/-/g, ' '); // Fallback
        let status: any = 'draft';

        // Try to get feature name from requirements
        if (await this.deps.fileSystem.exists(reqPath)) {
            const content = await this.deps.fileSystem.readFile(reqPath);
            const match = content.match(/^#\s+(.+)$/m);
            if (match) {
                featureName = match[1].trim();
            }
        }

        // Infer status
        if (await this.deps.fileSystem.exists(tasksPath)) {
            status = 'in-progress'; // Simplified; typically check individual tasks
        } else if (await this.deps.fileSystem.exists(designPath)) {
            status = 'approved';
        }

        return new Spec(specId, featureName, status);
    }

    /**
     * Read requirements from a spec.
     */
    async readRequirements(specId: string): Promise<string | null> {
        const path = `.spec/changes/${specId}/requirements.md`;
        if (!await this.deps.fileSystem.exists(path)) {
            return null;
        }
        return this.deps.fileSystem.readFile(path);
    }

    /**
     * Read design from a spec.
     */
    async readDesign(specId: string): Promise<string | null> {
        const path = `.spec/changes/${specId}/design.md`;
        if (!await this.deps.fileSystem.exists(path)) {
            return null;
        }
        return this.deps.fileSystem.readFile(path);
    }

    /**
     * Read tasks from a spec.
     */
    async readTasks(specId: string): Promise<string | null> {
        const path = `.spec/changes/${specId}/tasks.md`;
        if (!await this.deps.fileSystem.exists(path)) {
            return null;
        }
        return this.deps.fileSystem.readFile(path);
    }

    private generateSlugSpecId(featureName: string): string {
        const slug = featureName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        // Limit length to 50 chars for slug fallback
        return slug.substring(0, 50);
    }

    private async generateSemanticSpecId(featureName: string): Promise<string> {
        if (!this.deps.engine) {
            throw new Error('No engine available');
        }

        const strategy = new NamingStrategy();
        const response = await this.deps.engine.prompt(strategy, {
            history: [{ role: 'user', content: featureName }]
        });

        // Clean up response
        let id = response.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

        // Ensure it's not empty and reasonable length
        if (!id || id.length < 3) {
            throw new Error('Generated ID too short');
        }

        return id;
    }
}
