import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { AgentContext } from './AgentContext.js';
import type { AgentResult, ValidationResult } from './AgentResult.js';
import type { GuidelinesDocs } from '../domain/Guidelines.js';

export abstract class BaseAgent {
    abstract readonly name: string;
    abstract readonly phase: 'requirements' | 'design' | 'tasks';
    abstract readonly skillPath: string;

    protected constructor(
        protected readonly engine: IEnginePort,
        protected readonly fileSystem: IFileSystemPort
    ) {}

    abstract getSkillContent(): string;
    protected abstract buildSystemPrompt(context: AgentContext): string;
    abstract validateInput(context: AgentContext): ValidationResult;
    abstract validateOutput(result: string): ValidationResult;

    async execute(context: AgentContext): Promise<AgentResult> {
        const inputValidation = this.validateInput(context);
        if (!inputValidation.valid) {
            return {
                success: false,
                content: '',
                validationErrors: inputValidation.errors,
            };
        }

        const promptContext = {
            specId: context.specId,
            history: [{ role: 'user' as const, content: context.userInput }],
        };

        const response = await this.engine.prompt(
            { type: this.phase, systemPrompt: this.buildSystemPrompt(context) },
            promptContext
        );

        const outputValidation = this.validateOutput(response);
        if (!outputValidation.valid) {
            return {
                success: false,
                content: response,
                validationErrors: outputValidation.errors,
            };
        }

        const parsed = this.parseResponse(response);
        return parsed;
    }

    protected buildGuidelinesContext(guidelines: GuidelinesDocs): string {
        const sections: string[] = [];

        if (guidelines.agents) {
            sections.push(`## AGENTS.md\n${guidelines.agents}`);
        }

        if (this.phase === 'design') {
            if (guidelines.architecture) {
                sections.push(`## ARCHITECTURE.md\n${guidelines.architecture}`);
            }
            if (guidelines.contributing) {
                sections.push(`## CONTRIBUTING.md\n${guidelines.contributing}`);
            }
        }

        if (this.phase === 'tasks' && guidelines.testing) {
            sections.push(`## TESTING.md\n${guidelines.testing}`);
        }

        if (this.phase !== 'requirements' && guidelines.security) {
            sections.push(`## SECURITY.md\n${guidelines.security}`);
        }

        return sections.join('\n\n---\n\n');
    }

    protected parseResponse(response: string): AgentResult {
        const summaryMatch = response.match(/<summary>([\s\S]*?)<\/summary>/);
        const docMatch = response.match(/<document>([\s\S]*?)<\/document>/);

        if (summaryMatch && docMatch) {
            let content = docMatch[1].trim();
            content = content.replace(/^```markdown\s*/, '').replace(/```$/, '').trim();
            return {
                success: true,
                summary: summaryMatch[1].trim(),
                content,
            };
        }

        return {
            success: true,
            content: response.trim(),
        };
    }
}
