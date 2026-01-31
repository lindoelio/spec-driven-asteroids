import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import type { GuidelinesDocs } from '../domain/Guidelines.js';
import { RequirementsAgent } from '../agents/RequirementsAgent.js';
import { DesignAgent } from '../agents/DesignAgent.js';
import { TasksAgent } from '../agents/TasksAgent.js';
import type { AgentContext } from '../agents/AgentContext.js';
import type { AgentResult } from '../agents/AgentResult.js';
import { loadAgentSkillTemplateByType } from '../lib/ResourceLoader.js';

export interface AgentOrchestratorDependencies {
    engine: IEnginePort;
    fileSystem: IFileSystemPort;
}

export interface PipelineResult {
    phase: 'requirements' | 'design' | 'tasks' | 'complete';
    requirements?: AgentResult;
    design?: AgentResult;
    tasks?: AgentResult;
    error?: string[];
}

export class AgentOrchestrator {
    private requirementsAgent: RequirementsAgent;
    private designAgent: DesignAgent;
    private tasksAgent: TasksAgent;

    constructor(private readonly deps: AgentOrchestratorDependencies) {
        this.requirementsAgent = new RequirementsAgent(deps.engine, deps.fileSystem);
        this.designAgent = new DesignAgent(deps.engine, deps.fileSystem);
        this.tasksAgent = new TasksAgent(deps.engine, deps.fileSystem);
    }

    async runPipeline(specId: string, userInput: string, guidelines: GuidelinesDocs): Promise<PipelineResult> {
        const requirementsContext: AgentContext = {
            specId,
            userInput,
            guidelines,
        };
        const reqResult = await this.requirementsAgent.execute(requirementsContext);
        if (!reqResult.success) {
            return { phase: 'requirements', error: reqResult.validationErrors };
        }

        const designContext: AgentContext = {
            specId,
            userInput: reqResult.content,
            guidelines,
            previousPhaseOutput: reqResult.content,
        };
        const designResult = await this.designAgent.execute(designContext);
        if (!designResult.success) {
            return { phase: 'design', error: designResult.validationErrors };
        }

        const tasksContext: AgentContext = {
            specId,
            userInput: designResult.content,
            guidelines,
            // Pass both requirements and design to tasks phase for better context
            previousPhaseOutput: `## Requirements\n\n${reqResult.content}\n\n## Design\n\n${designResult.content}`,
        };
        const tasksResult = await this.tasksAgent.execute(tasksContext);

        if (!tasksResult.success) {
            return { phase: 'tasks', error: tasksResult.validationErrors };
        }

        return {
            phase: 'complete',
            requirements: reqResult,
            design: designResult,
            tasks: tasksResult,
        };
    }

    async runPhase(
        phase: 'requirements' | 'design' | 'tasks',
        context: AgentContext
    ): Promise<AgentResult> {
        switch (phase) {
            case 'requirements':
                return this.requirementsAgent.execute(context);
            case 'design':
                return this.designAgent.execute(context);
            case 'tasks':
                return this.tasksAgent.execute(context);
        }
    }

    async ensureAgentSkills(): Promise<void> {
        const agents = [
            {
                path: this.requirementsAgent.skillPath,
                content: loadAgentSkillTemplateByType('requirementsWriter'),
            },
            {
                path: this.designAgent.skillPath,
                content: loadAgentSkillTemplateByType('technicalDesigner'),
            },
            {
                path: this.tasksAgent.skillPath,
                content: loadAgentSkillTemplateByType('taskDecomposer'),
            },
        ];

        for (const agent of agents) {
            if (!await this.deps.fileSystem.exists(agent.path)) {
                const dir = agent.path.substring(0, agent.path.lastIndexOf('/'));
                if (dir) {
                    await this.deps.fileSystem.createDirectory(dir);
                }
                await this.deps.fileSystem.writeFile(agent.path, agent.content);
            }
        }
    }
}
