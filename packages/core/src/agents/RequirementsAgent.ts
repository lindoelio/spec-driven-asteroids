import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import { EarsStrategy } from '../strategies/EarsStrategy.js';
import { BaseAgent } from './BaseAgent.js';
import type { AgentContext } from './AgentContext.js';
import type { ValidationResult } from './AgentResult.js';
import { loadAgentSkillTemplateByType } from '../lib/ResourceLoader.js';

export class RequirementsAgent extends BaseAgent {
    readonly name = 'spec-driven-requirements-writer';
    readonly phase = 'requirements' as const;
    readonly skillPath = '.spec/skills/spec-driven-requirements-writer/SKILL.md';

    constructor(engine: IEnginePort, fileSystem: IFileSystemPort) {
        super(engine, fileSystem);
    }

    getSkillContent(): string {
        return loadAgentSkillTemplateByType('requirementsWriter');
    }

    protected buildSystemPrompt(context: AgentContext): string {
        const guidelinesContext = this.buildGuidelinesContext(context.guidelines);
        const strategy = new EarsStrategy({
            technologies: context.technologies,
        });

        return `${strategy.systemPrompt}\n\n## Guidelines Context\n${guidelinesContext}`;
    }

    validateInput(context: AgentContext): ValidationResult {
        const errors: string[] = [];
        if (!context.userInput || context.userInput.trim().length < 10) {
            errors.push('User input too short for requirements generation');
        }
        return { valid: errors.length === 0, errors };
    }

    validateOutput(result: string): ValidationResult {
        const errors: string[] = [];
        if (!result.includes('## Requirements')) {
            errors.push('Missing Requirements section');
        }
        if (!result.includes('Acceptance Criteria')) {
            errors.push('Missing Acceptance Criteria');
        }
        const hasEarsPattern = /WHEN|WHILE|WHERE|IF.*THEN|SHALL/.test(result);
        if (!hasEarsPattern) {
            errors.push('No EARS patterns detected in output');
        }
        return { valid: errors.length === 0, errors };
    }
}
