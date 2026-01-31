import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import { DesignStrategy } from '../strategies/DesignStrategy.js';
import { BaseAgent } from './BaseAgent.js';
import type { AgentContext } from './AgentContext.js';
import type { ValidationResult } from './AgentResult.js';
import { loadAgentSkillTemplateByType } from '../lib/ResourceLoader.js';

export class DesignAgent extends BaseAgent {
    readonly name = 'technical-designer';
    readonly phase = 'design' as const;
    readonly skillPath = '.github/skills/sdd-technical-designer/SKILL.md';

    constructor(engine: IEnginePort, fileSystem: IFileSystemPort) {
        super(engine, fileSystem);
    }

    getSkillContent(): string {
        return loadAgentSkillTemplateByType('technicalDesigner');
    }

    protected buildSystemPrompt(context: AgentContext): string {
        const guidelinesContext = this.buildGuidelinesContext(context.guidelines);
        const strategy = new DesignStrategy({
            technologies: context.technologies,
            guidelinesAgents: context.guidelines?.agents,
        });

        return `${strategy.systemPrompt}\n\n## Guidelines Context\n${guidelinesContext}`;
    }

    validateInput(context: AgentContext): ValidationResult {
        const errors: string[] = [];
        if (!context.previousPhaseOutput) {
            errors.push('Requirements document required as input');
        } else if (!context.previousPhaseOutput.includes('Acceptance Criteria')) {
            errors.push('Requirements must contain Acceptance Criteria');
        }
        return { valid: errors.length === 0, errors };
    }

    validateOutput(result: string): ValidationResult {
        const errors: string[] = [];
        if (!result.includes('```mermaid')) {
            errors.push('Design must include Mermaid diagrams');
        }
        if (!result.includes('DES-')) {
            errors.push('Design elements must be numbered (DES-1, DES-2, ...)');
        }
        if (!result.includes('Code Anatomy')) {
            errors.push('Missing Code Anatomy section');
        }
        return { valid: errors.length === 0, errors };
    }
}
