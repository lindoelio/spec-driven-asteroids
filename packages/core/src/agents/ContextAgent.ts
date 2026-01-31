/**
 * ContextAgent
 *
 * AI-powered agent that dynamically gathers relevant context for planning.
 * Uses LLM to intelligently identify files and components related to a feature.
 */

import type { IEnginePort } from '../ports/outbound/IEnginePort.js';
import type { IFileSystemPort } from '../ports/outbound/IFileSystemPort.js';
import { ContextStrategy } from '../strategies/ContextStrategy.js';

export interface ContextAgentResult {
    relevantFiles: Array<{ path: string; reason: string }>;
    keyComponents: Array<{ name: string; description: string }>;
    integrationPoints: string[];
    risks: Array<{ level: 'high' | 'medium' | 'low'; description: string }>;
    recommendedApproach?: string;
    rawAnalysis: string;
}

export interface ContextAgentDependencies {
    engine: IEnginePort;
    fileSystem: IFileSystemPort;
}

export class ContextAgent {
    constructor(private readonly deps: ContextAgentDependencies) {}

    /**
     * Analyze a feature request and gather relevant context using AI.
     */
    async gatherContext(
        featureName: string,
        userDescription: string,
        options: { technologies?: string[]; workspaceStructure?: string } = {}
    ): Promise<ContextAgentResult> {
        const strategy = new ContextStrategy({
            technologies: options.technologies,
            workspaceStructure: options.workspaceStructure,
        });

        const promptContext = {
            history: [{
                role: 'user' as const,
                content: `Feature: ${featureName}\n\nDescription: ${userDescription}`
            }],
        };

        const response = await this.deps.engine.prompt(strategy, promptContext);

        return this.parseAnalysis(response);
    }

    /**
     * Parse the AI response into structured context.
     */
    private parseAnalysis(response: string): ContextAgentResult {
        const result: ContextAgentResult = {
            relevantFiles: [],
            keyComponents: [],
            integrationPoints: [],
            risks: [],
            rawAnalysis: response,
        };

        // Extract analysis block
        const analysisMatch = response.match(/<analysis>([\s\S]*?)<\/analysis>/);
        const content = analysisMatch ? analysisMatch[1] : response;

        // Parse relevant files section
        const filesSection = content.match(/## Relevant Files\s*([\s\S]*?)(?=##|$)/);
        if (filesSection) {
            const fileLines = filesSection[1].match(/- `([^`]+)`\s*-\s*(.+)/g) || [];
            for (const line of fileLines) {
                const match = line.match(/- `([^`]+)`\s*-\s*(.+)/);
                if (match) {
                    result.relevantFiles.push({ path: match[1], reason: match[2].trim() });
                }
            }
        }

        // Parse key components section
        const componentsSection = content.match(/## Key Components\s*([\s\S]*?)(?=##|$)/);
        if (componentsSection) {
            const componentLines = componentsSection[1].match(/- (\w+)\s*-\s*(.+)/g) || [];
            for (const line of componentLines) {
                const match = line.match(/- (\w+)\s*-\s*(.+)/);
                if (match) {
                    result.keyComponents.push({ name: match[1], description: match[2].trim() });
                }
            }
        }

        // Parse integration points section
        const integrationSection = content.match(/## Integration Points\s*([\s\S]*?)(?=##|$)/);
        if (integrationSection) {
            const points = integrationSection[1].match(/- (.+)/g) || [];
            result.integrationPoints = points.map(p => p.replace(/^- /, '').trim());
        }

        // Parse risks section
        const risksSection = content.match(/## Potential Risks\s*([\s\S]*?)(?=##|$)/);
        if (risksSection) {
            const riskLines = risksSection[1].match(/- (High|Medium|Low):\s*(.+)/gi) || [];
            for (const line of riskLines) {
                const match = line.match(/- (High|Medium|Low):\s*(.+)/i);
                if (match) {
                    result.risks.push({
                        level: match[1].toLowerCase() as 'high' | 'medium' | 'low',
                        description: match[2].trim(),
                    });
                }
            }
        }

        // Parse recommended approach
        const approachSection = content.match(/## Recommended Approach\s*([\s\S]*?)(?=##|$)/);
        if (approachSection) {
            result.recommendedApproach = approachSection[1].trim();
        }

        return result;
    }
}
