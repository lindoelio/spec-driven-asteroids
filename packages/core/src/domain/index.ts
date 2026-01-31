// Domain exports
export * from './Spec.js';
export * from './Task.js';
// Guidelines are the canonical documents now.
export {
    type GuidelinesDocs,
    type GuidelineType,
    type EngineSkillConfig,
    type EngineSkillConfig as GuidelinesEngineSkillConfig,
    type GuidelineGenerationResult,
    type ConfigureResult,
    // Repository Insights types (AI-driven analysis)
    type FileNode,
    type FileTree,
    type TechStack,
    type DiscoveredPattern,
    type DocumentAnalysis,
    type Conflict,
    type RepositoryInsights,
    GUIDELINES_PATHS,
    SPECDRIVEN_SECTION_MARKERS,
    SPECDRIVEN_INSTRUCTIONS_MARKER,
    DOCUMENT_RESPONSIBILITY_MATRIX,
    getAgentsTemplate,
    getArchitectureTemplate as getGuidelinesArchitectureTemplate,
    getContributingTemplate,
    getTestingTemplate as getGuidelinesTestingTemplate,
    getSecurityTemplate,
    getStyleguideTemplate,
    getGuidelineTemplate,
    generateAgentSkillTemplate as generateGuidelinesAgentSkillTemplate,
    hasSpecDrivenSection,
    extractSpecDrivenSection,
    removeSpecDrivenSection,
    wrapInSpecDrivenSection,
} from './Guidelines.js';
