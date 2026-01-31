import type { GuidelinesDocs } from '../domain/Guidelines.js';

export interface AgentContext {
    specId: string;
    userInput: string;
    guidelines: GuidelinesDocs;
    previousPhaseOutput?: string;
    technologies?: string[];
    options?: {
        suggestTdd?: boolean;
    };
}
