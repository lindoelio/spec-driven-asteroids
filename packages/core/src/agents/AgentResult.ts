export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface AgentResult {
    success: boolean;
    content: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    validationErrors?: string[];
}
