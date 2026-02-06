import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import { TaskDecomposerStrategy } from '../strategies/TaskDecomposerStrategy.js';
import { BaseAgent } from './BaseAgent.js';
import type { AgentContext } from './AgentContext.js';
import type { ValidationResult } from './AgentResult.js';
import { loadAgentSkillTemplateByType } from '../lib/ResourceLoader.js';

export class TasksAgent extends BaseAgent {
    readonly name = 'spec-driven-task-decomposer';
    readonly phase = 'tasks' as const;
    readonly skillPath = '.spec/skills/spec-driven-task-decomposer/SKILL.md';

    constructor(engine: IEnginePort, fileSystem: IFileSystemPort) {
        super(engine, fileSystem);
    }

    getSkillContent(): string {
        return loadAgentSkillTemplateByType('taskDecomposer');
    }

    protected buildSystemPrompt(context: AgentContext): string {
        const guidelinesContext = this.buildGuidelinesContext(context.guidelines);
        const strategy = new TaskDecomposerStrategy({
            suggestTdd: context.options?.suggestTdd,
        });

        return `${strategy.systemPrompt}\n\n## Guidelines Context\n${guidelinesContext}`;
    }

    validateInput(context: AgentContext): ValidationResult {
        const errors: string[] = [];
        if (!context.previousPhaseOutput) {
            errors.push('Design document required as input');
        } else if (!context.previousPhaseOutput.includes('DES-')) {
            errors.push('Design must contain numbered design elements');
        }
        return { valid: errors.length === 0, errors };
    }

    validateOutput(result: string): ValidationResult {
        const errors: string[] = [];
        if (!/- \[ \] \d+\.\d+/.test(result)) {
            errors.push('Tasks must use checkbox format with hierarchical IDs');
        }
        if (!result.includes('_Implements:')) {
            errors.push('Tasks must include traceability (_Implements: DES-X_)');
        }
        if (!result.includes('Final Checkpoint')) {
            errors.push('Missing Final Checkpoint task');
        }
        return { valid: errors.length === 0, errors };
    }
}
