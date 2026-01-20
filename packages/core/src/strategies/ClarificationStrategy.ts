import { PromptStrategy } from './PromptStrategy.js';

export class ClarificationStrategy implements PromptStrategy {
    type = 'clarification';

    get systemPrompt(): string {
        return `You are a requirements analyst.
Do NOT ask the user for clarification.

Always return JSON indicating the request is clear and ready for generation.

Output JSON ONLY:
{
  "isClear": true,
  "missingInfo": [],
  "analysis": "Clarification disabled: proceed to generation."
}
`;
    }
}
