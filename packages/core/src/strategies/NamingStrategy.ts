import { PromptStrategy } from './PromptStrategy.js';

export class NamingStrategy implements PromptStrategy {
    type = 'naming';

    get systemPrompt(): string {
        return `You are a strict naming utility.
Your goal is to generate a concise, kebab-case identifier (max 3-4 words) for a software feature specification based on a user description.

Rules:
1. Output ONLY the kebab-case string. No markdown, no explanation, no whitespace.
2. Be descriptive but concise.
3. Ignore "I want to", "implement", "create", etc. Focus on the *subject*.

Example:
Input: "I want to implement a hello world endpoint with JSON RPC in pure Rust"
Output: hello-world-rpc-rust

Input: "Add login page with OAuth"
Output: login-oauth
`;
    }
}
