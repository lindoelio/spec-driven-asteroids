/**
 * Guidelines Prompt Strategy
 *
 * Guides the AI to generate community-standard guideline documents.
 * Outputs content suitable for AGENTS.md, CONTRIBUTING.md, etc.
 *
 * Uses the Document Responsibility Matrix to ensure no overlap between
 * documents, with each document having a focused scope.
 */

import type { PromptStrategy } from './PromptStrategy.js';
import {
    DOCUMENT_RESPONSIBILITY_MATRIX,
    type GuidelineType,
    type RepositoryInsights,
} from '../domain/Guidelines.js';

export interface ProjectAnalysisContext {
    languages: string[];
    frameworks: string[];
    dependencies: { name: string; version: string; purpose?: string }[];
    devDependencies: { name: string; version: string; purpose?: string }[];
    buildTools: string[];
    testFrameworks: string[];
    linters: string[];
    packageManager: string | null;
    codeSnippets?: string[];
    projectStructure?: string;
}

export interface GuidelinesStrategyOptions {
    guidelineType: GuidelineType;
    projectAnalysis: ProjectAnalysisContext;
    /** AI-driven repository insights (optional, enhances generation) */
    repositoryInsights?: RepositoryInsights;
    existingGuidelines?: {
        agents?: string;
        architecture?: string;
        contributing?: string;
        testing?: string;
        security?: string;
        styleguide?: string;
    };
    userInquiry?: string;
}

export class GuidelinesStrategy implements PromptStrategy {
    type = 'guidelines';
    systemPrompt: string;

    constructor(options: GuidelinesStrategyOptions) {
        const { guidelineType, projectAnalysis, repositoryInsights, existingGuidelines, userInquiry } = options;

        const analysisContext = this.formatAnalysisContext(projectAnalysis);
        const insightsContext = this.formatRepositoryInsights(repositoryInsights);
        const responsibilityContext = this.formatResponsibilityMatrix(guidelineType);
        const existingContext = this.formatExistingContext(existingGuidelines);
        const inquiryContext = userInquiry
            ? `\n\n## User Inquiry\n${userInquiry}`
            : '';

        this.systemPrompt = `You are a senior engineering lead generating a ${guidelineType.toUpperCase()} guideline document.

## Document Responsibility
${responsibilityContext}

## Project Analysis
${analysisContext}
${insightsContext}${existingContext}${inquiryContext}

## Output Rules

1. Output in XML format with <summary> and <document> sections.
2. The <document> must contain Markdown content only.
3. Include SpecDriven managed section markers:
   <!-- SpecDriven:managed:start -->
   ... content ...
   <!-- SpecDriven:managed:end -->
4. Preserve user-authored content outside the managed section.
5. **CRITICAL**: Only include content listed in "This document MUST contain".
6. **CRITICAL**: Do NOT include content listed in "This document MUST NOT contain".
7. Reference other guideline documents instead of duplicating content.

## Output Format

<summary>
Provide a brief summary of what was generated.
</summary>
<document>
\`\`\`markdown
<Guideline content here>
\`\`\`
</document>

Start directly with the XML tags. No preamble.`;
    }

    private formatAnalysisContext(analysis: ProjectAnalysisContext): string {
        const sections: string[] = [];

        if (analysis.languages.length > 0) {
            sections.push(`**Languages**: ${analysis.languages.join(', ')}`);
        }
        if (analysis.frameworks.length > 0) {
            sections.push(`**Frameworks**: ${analysis.frameworks.join(', ')}`);
        }
        if (analysis.buildTools.length > 0) {
            sections.push(`**Build Tools**: ${analysis.buildTools.join(', ')}`);
        }
        if (analysis.testFrameworks.length > 0) {
            sections.push(`**Test Frameworks**: ${analysis.testFrameworks.join(', ')}`);
        }
        if (analysis.linters.length > 0) {
            sections.push(`**Linters/Formatters**: ${analysis.linters.join(', ')}`);
        }
        if (analysis.packageManager) {
            sections.push(`**Package Manager**: ${analysis.packageManager}`);
        }
        if (analysis.dependencies.length > 0) {
            const depList = analysis.dependencies.slice(0, 10)
                .map(d => `- ${d.name}@${d.version}${d.purpose ? ` (${d.purpose})` : ''}`)
                .join('\n');
            sections.push(`**Key Dependencies**:\n${depList}`);
        }
        if (analysis.projectStructure) {
            sections.push(`**Project Structure**:\n\`\`\`\n${analysis.projectStructure}\n\`\`\``);
        }
        if (analysis.codeSnippets?.length) {
            sections.push(`**Code Samples**:\n${analysis.codeSnippets.slice(0, 2).map(s => s.slice(0, 500)).join('\n\n')}`);
        }

        return sections.join('\n\n');
    }

    private formatRepositoryInsights(insights?: RepositoryInsights): string {
        if (!insights) return '';

        const sections: string[] = ['\n\n## AI-Discovered Repository Insights'];

        // Tech stack
        if (insights.techStack) {
            const { languages, frameworks, tools, metadata } = insights.techStack;
            if (languages.length > 0 || frameworks.length > 0 || tools.length > 0) {
                sections.push('### Discovered Tech Stack');
                if (languages.length > 0) sections.push(`- **Languages**: ${languages.join(', ')}`);
                if (frameworks.length > 0) sections.push(`- **Frameworks**: ${frameworks.join(', ')}`);
                if (tools.length > 0) sections.push(`- **Tools**: ${tools.join(', ')}`);
                if (metadata.length > 0) {
                    const metaStr = metadata.map(m => `- ${m.key}: ${m.value}`).join('\n');
                    sections.push(`- **Metadata**:\n${metaStr}`);
                }
            }
        }

        // Discovered patterns
        if (insights.patterns.length > 0) {
            sections.push('### Discovered Patterns');
            for (const pattern of insights.patterns.slice(0, 5)) {
                sections.push(`**${pattern.category}**: ${pattern.description}`);
                if (pattern.recommendation) {
                    sections.push(`_Recommendation_: ${pattern.recommendation}`);
                }
            }
        }

        // Conflicts (important for avoiding duplication)
        if (insights.conflicts.length > 0) {
            sections.push('### Detected Conflicts');
            for (const conflict of insights.conflicts) {
                sections.push(`- **${conflict.topic}**: ${conflict.suggestedResolution}`);
            }
        }

        // Structure summary
        if (insights.structureSummary) {
            sections.push(`### Repository Structure Summary\n${insights.structureSummary}`);
        }

        return sections.length > 1 ? sections.join('\n\n') : '';
    }

    private formatResponsibilityMatrix(guidelineType: GuidelineType): string {
        const responsibility = DOCUMENT_RESPONSIBILITY_MATRIX[guidelineType];
        const sections: string[] = [];

        sections.push(`**This document MUST contain:**`);
        for (const item of responsibility.contains) {
            sections.push(`- ${item}`);
        }

        sections.push(`\n**This document MUST NOT contain (use references instead):**`);
        for (const item of responsibility.excludes) {
            sections.push(`- ${item}`);
        }

        // Add cross-references
        const crossRefs = this.getCrossReferences(guidelineType);
        if (crossRefs.length > 0) {
            sections.push(`\n**Reference these documents for excluded content:**`);
            for (const ref of crossRefs) {
                sections.push(`- ${ref}`);
            }
        }

        return sections.join('\n');
    }

    private getCrossReferences(guidelineType: GuidelineType): string[] {
        const refs: string[] = [];
        const excludes = DOCUMENT_RESPONSIBILITY_MATRIX[guidelineType].excludes;

        // Map excluded topics to their home documents
        const topicToDocument: Record<string, string> = {
            'Detailed code conventions': 'STYLEGUIDE.md',
            'Detailed code style': 'STYLEGUIDE.md',
            'Code style details': 'STYLEGUIDE.md',
            'Code conventions': 'STYLEGUIDE.md',
            'Naming conventions': 'STYLEGUIDE.md',
            'Testing patterns': 'TESTING.md',
            'Testing notes': 'TESTING.md',
            'Testing strategy': 'TESTING.md',
            'Security rules': 'SECURITY.md',
            'Security policies': 'SECURITY.md',
            'Architecture diagrams': 'ARCHITECTURE.md',
            'Architecture decisions': 'ARCHITECTURE.md',
            'Git workflow details': 'CONTRIBUTING.md',
            'Git workflow': 'CONTRIBUTING.md',
            'Workflow steps': 'CONTRIBUTING.md',
            'Build commands': 'AGENTS.md',
            'Documentation rules': 'CONTRIBUTING.md',
        };

        const addedDocs = new Set<string>();
        for (const excluded of excludes) {
            const doc = topicToDocument[excluded];
            if (doc && !addedDocs.has(doc)) {
                refs.push(doc);
                addedDocs.add(doc);
            }
        }

        return refs;
    }

    private formatExistingContext(existing?: GuidelinesStrategyOptions['existingGuidelines']): string {
        if (!existing) return '';
        const sections: string[] = [];

        if (existing.agents) sections.push('### Existing AGENTS.md\n' + existing.agents.slice(0, 1000));
        if (existing.architecture) sections.push('### Existing ARCHITECTURE.md\n' + existing.architecture.slice(0, 1000));
        if (existing.contributing) sections.push('### Existing CONTRIBUTING.md\n' + existing.contributing.slice(0, 1000));
        if (existing.testing) sections.push('### Existing TESTING.md\n' + existing.testing.slice(0, 1000));
        if (existing.security) sections.push('### Existing SECURITY.md\n' + existing.security.slice(0, 1000));
        if (existing.styleguide) sections.push('### Existing STYLEGUIDE.md\n' + existing.styleguide.slice(0, 1000));

        if (sections.length === 0) return '';
        return `\n\n## Existing Guidelines\n${sections.join('\n\n')}`;
    }
}
