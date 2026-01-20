/**
 * MCP Client
 *
 * Client for interacting with Model Context Protocol servers.
 * Provides persistent memory and context management.
 */

import type { Checkpoint, IFileSystemPort } from '@spec-driven/core';

export interface McpClientOptions {
    /** URL of the MCP server (e.g., 'http://localhost:3000') */
    serverUrl?: string;

    /** Fallback to local file storage if server unavailable */
    fallbackPath?: string;

    /** File system port for local fallback storage */
    fileSystem?: IFileSystemPort;
}

interface StateFile {
    checkpoints: Record<string, Checkpoint>;
    memory: Record<string, unknown>[];
    lastUpdated: string;
}

/**
 * McpClient provides MCP server integration for persistent memory.
 */
export class McpClient {
    private serverUrl: string | null;
    private fallbackPath: string;
    private fileSystem: IFileSystemPort | null;
    private connected = false;
    private stateCache: StateFile | null = null;

    constructor(options: McpClientOptions = {}) {
        this.serverUrl = options.serverUrl ?? null;
        this.fallbackPath = options.fallbackPath ?? '.spec/state.json';
        this.fileSystem = options.fileSystem ?? null;
    }

    /**
     * Set the file system for fallback storage.
     */
    setFileSystem(fileSystem: IFileSystemPort): void {
        this.fileSystem = fileSystem;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Connection
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Attempt to connect to the MCP server.
     */
    async connect(): Promise<boolean> {
        if (!this.serverUrl) {
            console.log('[McpClient] No server URL configured, using fallback');
            return false;
        }

        try {
            // TODO: Implement actual MCP connection handshake
            // For now, we simulate a connection check
            console.log(`[McpClient] Connecting to ${this.serverUrl}...`);
            this.connected = true;
            return true;
        } catch (error) {
            console.error('[McpClient] Connection failed:', error);
            this.connected = false;
            return false;
        }
    }

    /**
     * Check if connected to MCP server.
     */
    isConnected(): boolean {
        return this.connected;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Checkpoint Operations
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Save a checkpoint to memory.
     */
    async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
        if (this.connected && this.serverUrl) {
            await this.sendToServer('checkpoint/save', checkpoint);
        } else {
            await this.saveToFallback(checkpoint);
        }
    }

    /**
     * Load a checkpoint from memory.
     */
    async loadCheckpoint(specId: string): Promise<Checkpoint | null> {
        if (this.connected && this.serverUrl) {
            return this.queryServer<Checkpoint>('checkpoint/load', { specId });
        } else {
            return this.loadFromFallback(specId);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Memory Query
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Query memory for relevant context.
     */
    async queryMemory(query: string): Promise<Record<string, unknown>[]> {
        if (this.connected && this.serverUrl) {
            const result = await this.queryServer<Record<string, unknown>[]>('memory/query', { query });
            return result ?? [];
        }
        return [];
    }

    /**
     * Store an entity in the knowledge graph.
     */
    async storeEntity(
        name: string,
        entityType: string,
        observations: string[]
    ): Promise<void> {
        if (this.connected && this.serverUrl) {
            await this.sendToServer('entities/create', {
                entities: [{ name, entityType, observations }],
            });
        }
    }

    /**
     * Create a relation between entities.
     */
    async createRelation(
        from: string,
        to: string,
        relationType: string
    ): Promise<void> {
        if (this.connected && this.serverUrl) {
            await this.sendToServer('relations/create', {
                relations: [{ from, to, relationType }],
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Issue Tracker Integration
    // ═══════════════════════════════════════════════════════════════════════════

    private availableIssueTrackers: Set<IssueTrackerType> = new Set();

    /**
     * Check if a Jira/Linear MCP is available.
     */
    async hasIssueTracker(): Promise<boolean> {
        if (this.availableIssueTrackers.size > 0) {
            return true;
        }

        // Probe for available MCP tools
        await this.discoverIssueTrackers();
        return this.availableIssueTrackers.size > 0;
    }

    /**
     * Discover available issue tracker MCP tools.
     */
    private async discoverIssueTrackers(): Promise<void> {
        if (!this.connected || !this.serverUrl) {
            return;
        }

        // Try to list available tools from MCP server
        const tools = await this.queryServer<McpToolList>('tools/list', {});

        if (tools?.tools) {
            for (const tool of tools.tools) {
                // Detect Jira MCP
                if (tool.name.toLowerCase().includes('jira') ||
                    tool.name === 'mcp_atlassian_jira_get_issue') {
                    this.availableIssueTrackers.add('jira');
                }
                // Detect Linear MCP
                if (tool.name.toLowerCase().includes('linear') ||
                    tool.name === 'mcp_linear_get_issue') {
                    this.availableIssueTrackers.add('linear');
                }
                // Detect GitHub Issues MCP
                if (tool.name === 'mcp_github_get_issue' ||
                    (tool.name.toLowerCase().includes('github') && tool.name.toLowerCase().includes('issue'))) {
                    this.availableIssueTrackers.add('github');
                }
            }
        }
    }

    /**
     * Get available issue tracker types.
     */
    async getAvailableTrackers(): Promise<IssueTrackerType[]> {
        await this.discoverIssueTrackers();
        return Array.from(this.availableIssueTrackers);
    }

    /**
     * Fetch issue details from tracker.
     */
    async fetchIssue(issueId: string, trackerType?: IssueTrackerType): Promise<IssueDetails | null> {
        if (!await this.hasIssueTracker()) {
            return null;
        }

        // Determine tracker type from issue ID format if not specified
        const tracker = trackerType ?? this.inferTrackerType(issueId);

        if (!tracker) {
            console.log(`[McpClient] Could not determine tracker type for: ${issueId}`);
            return null;
        }

        switch (tracker) {
            case 'jira':
                return this.fetchJiraIssue(issueId);
            case 'linear':
                return this.fetchLinearIssue(issueId);
            case 'github':
                return this.fetchGitHubIssue(issueId);
            default:
                return null;
        }
    }

    /**
     * Fetch issue from Jira via MCP.
     */
    private async fetchJiraIssue(issueKey: string): Promise<IssueDetails | null> {
        const result = await this.queryServer<JiraIssueResponse>('tools/call', {
            name: 'mcp_atlassian_jira_get_issue',
            arguments: { issueKey },
        });

        if (!result?.issue) {
            return null;
        }

        const issue = result.issue;
        return {
            id: issue.key,
            title: issue.fields?.summary ?? '',
            description: issue.fields?.description ?? '',
            status: issue.fields?.status?.name ?? 'unknown',
            assignee: issue.fields?.assignee?.displayName,
            labels: issue.fields?.labels ?? [],
            acceptanceCriteria: this.extractAcceptanceCriteria(issue.fields?.description),
            tracker: 'jira',
            url: `https://jira.atlassian.com/browse/${issue.key}`,
        };
    }

    /**
     * Fetch issue from Linear via MCP.
     */
    private async fetchLinearIssue(issueId: string): Promise<IssueDetails | null> {
        const result = await this.queryServer<LinearIssueResponse>('tools/call', {
            name: 'mcp_linear_get_issue',
            arguments: { issueId },
        });

        if (!result?.issue) {
            return null;
        }

        const issue = result.issue;
        return {
            id: issue.identifier,
            title: issue.title ?? '',
            description: issue.description ?? '',
            status: issue.state?.name ?? 'unknown',
            assignee: issue.assignee?.name,
            labels: issue.labels?.map((l: LinearLabel) => l.name) ?? [],
            acceptanceCriteria: [],
            tracker: 'linear',
            url: issue.url,
        };
    }

    /**
     * Fetch issue from GitHub via MCP.
     */
    private async fetchGitHubIssue(issueNumber: string): Promise<IssueDetails | null> {
        // Parse owner/repo/number format
        const match = issueNumber.match(/^([^/]+)\/([^#]+)#(\d+)$/) ??
            issueNumber.match(/^#?(\d+)$/);

        if (!match) {
            return null;
        }

        const result = await this.queryServer<GitHubIssueResponse>('tools/call', {
            name: 'mcp_github_get_issue',
            arguments: {
                issue_number: parseInt(match[match.length - 1], 10),
            },
        });

        if (!result?.issue) {
            return null;
        }

        const issue = result.issue;
        return {
            id: `#${issue.number}`,
            title: issue.title ?? '',
            description: issue.body ?? '',
            status: issue.state ?? 'open',
            assignee: issue.assignee?.login,
            labels: issue.labels?.map(l => typeof l === 'string' ? l : l.name) ?? [],
            acceptanceCriteria: this.extractAcceptanceCriteria(issue.body),
            tracker: 'github',
            url: issue.html_url,
        };
    }

    /**
     * Infer tracker type from issue ID format.
     */
    private inferTrackerType(issueId: string): IssueTrackerType | null {
        // JIRA: PROJECT-123 format
        if (/^[A-Z]+-\d+$/.test(issueId)) {
            return 'jira';
        }
        // Linear: ABC-123 or ABC123 format (shorter project codes)
        if (/^[A-Z]{2,4}-?\d+$/.test(issueId)) {
            return this.availableIssueTrackers.has('linear') ? 'linear' : 'jira';
        }
        // GitHub: #123 or owner/repo#123 format
        if (/^#?\d+$/.test(issueId) || /^[^/]+\/[^#]+#\d+$/.test(issueId)) {
            return 'github';
        }
        return null;
    }

    /**
     * Extract acceptance criteria from issue description.
     */
    private extractAcceptanceCriteria(description?: string): string[] {
        if (!description) {
            return [];
        }

        const criteria: string[] = [];

        // Look for common acceptance criteria patterns
        const patterns = [
            // "Acceptance Criteria:" section
            /acceptance\s+criteria[:\s]*\n([\s\S]*?)(?=\n\n|\n#|$)/gi,
            // "AC:" section
            /\bAC[:\s]*\n([\s\S]*?)(?=\n\n|\n#|$)/gi,
            // Numbered criteria: "1. Given... When... Then..."
            /\d+\.\s*(?:given|when|then)[^\n]*/gi,
            // Checkbox items: "- [ ] ..."
            /[-*]\s*\[[ x]\]\s*[^\n]+/gi,
        ];

        for (const pattern of patterns) {
            const matches = description.match(pattern);
            if (matches) {
                criteria.push(...matches.map(m => m.trim()));
            }
        }

        // Deduplicate
        return [...new Set(criteria)];
    }

    /**
     * Attempt to detect issue ID from git branch name.
     */
    async detectIssueFromBranch(branchName: string): Promise<IssueDetection | null> {
        // Common patterns: feature/JIRA-123, fix/123, issue-456, feat/ABC-123-description
        const patterns: Array<{ regex: RegExp; tracker: IssueTrackerType | 'unknown' }> = [
            { regex: /([A-Z]+-\d+)/, tracker: 'jira' },           // JIRA-123
            { regex: /([A-Z]{2,4}-\d+)/, tracker: 'linear' },     // ABC-123 (Linear)
            { regex: /#(\d+)/, tracker: 'github' },               // #123
            { regex: /issue[_-]?(\d+)/i, tracker: 'github' },     // issue-123
            { regex: /(\d{4,})/, tracker: 'unknown' },            // 4+ digit number
        ];

        for (const { regex, tracker } of patterns) {
            const match = branchName.match(regex);
            if (match) {
                return {
                    issueId: match[1],
                    trackerType: tracker === 'unknown' ? null : tracker,
                    confidence: tracker === 'unknown' ? 'low' : 'high',
                };
            }
        }

        return null;
    }

    /**
     * Full workflow: detect issue from branch and fetch details.
     */
    async getIssueFromCurrentBranch(branchName: string): Promise<IssueDetails | null> {
        const detection = await this.detectIssueFromBranch(branchName);

        if (!detection) {
            return null;
        }

        // Try to fetch the issue
        const details = await this.fetchIssue(detection.issueId, detection.trackerType ?? undefined);

        if (details) {
            return details;
        }

        // If detection was uncertain, try other trackers
        if (detection.confidence === 'low' || !detection.trackerType) {
            const trackers = await this.getAvailableTrackers();
            for (const tracker of trackers) {
                const result = await this.fetchIssue(detection.issueId, tracker);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    private async sendToServer(endpoint: string, data: unknown): Promise<void> {
        // TODO: Implement actual MCP JSON-RPC call
        console.log(`[McpClient] POST ${endpoint}:`, data);
    }

    private async queryServer<T>(endpoint: string, params: unknown): Promise<T | null> {
        // TODO: Implement actual MCP JSON-RPC call
        console.log(`[McpClient] GET ${endpoint}:`, params);
        return null;
    }

    /**
     * Save checkpoint to local fallback file.
     */
    private async saveToFallback(checkpoint: Checkpoint): Promise<void> {
        if (!this.fileSystem) {
            console.log('[McpClient] No file system configured, cannot save checkpoint');
            return;
        }

        try {
            // Load existing state
            const state = await this.loadStateFile();

            // Update checkpoint
            state.checkpoints[checkpoint.specId] = checkpoint;
            state.lastUpdated = new Date().toISOString();

            // Save state file
            await this.saveStateFile(state);
            console.log(`[McpClient] Saved checkpoint to fallback: ${checkpoint.specId}`);
        } catch (error) {
            console.error('[McpClient] Failed to save checkpoint:', error);
        }
    }

    /**
     * Load checkpoint from local fallback file.
     */
    private async loadFromFallback(specId: string): Promise<Checkpoint | null> {
        if (!this.fileSystem) {
            console.log('[McpClient] No file system configured, cannot load checkpoint');
            return null;
        }

        try {
            const state = await this.loadStateFile();
            const checkpoint = state.checkpoints[specId];

            if (checkpoint) {
                // Restore Date object
                checkpoint.timestamp = new Date(checkpoint.timestamp);
                return checkpoint;
            }
            return null;
        } catch (error) {
            console.error('[McpClient] Failed to load checkpoint:', error);
            return null;
        }
    }

    /**
     * Load the state file from disk.
     */
    private async loadStateFile(): Promise<StateFile> {
        if (this.stateCache) {
            return this.stateCache;
        }

        if (!this.fileSystem) {
            return this.createEmptyState();
        }

        try {
            if (await this.fileSystem.exists(this.fallbackPath)) {
                const content = await this.fileSystem.readFile(this.fallbackPath);
                this.stateCache = JSON.parse(content) as StateFile;
                return this.stateCache;
            }
        } catch {
            // File doesn't exist or is invalid
        }

        return this.createEmptyState();
    }

    /**
     * Save the state file to disk.
     */
    private async saveStateFile(state: StateFile): Promise<void> {
        if (!this.fileSystem) {
            return;
        }

        this.stateCache = state;
        const content = JSON.stringify(state, null, 2);
        await this.fileSystem.writeFile(this.fallbackPath, content);
    }

    /**
     * Create an empty state file.
     */
    private createEmptyState(): StateFile {
        return {
            checkpoints: {},
            memory: [],
            lastUpdated: new Date().toISOString(),
        };
    }

    /**
     * Query local memory from fallback.
     */
    async queryLocalMemory(query: string): Promise<Record<string, unknown>[]> {
        const state = await this.loadStateFile();
        const lowerQuery = query.toLowerCase();

        // Simple keyword matching in memory entries
        return state.memory.filter(entry => {
            const entryStr = JSON.stringify(entry).toLowerCase();
            return entryStr.includes(lowerQuery);
        });
    }

    /**
     * Add an entry to local memory.
     */
    async addToLocalMemory(entry: Record<string, unknown>): Promise<void> {
        if (!this.fileSystem) {
            return;
        }

        const state = await this.loadStateFile();
        state.memory.push(entry);
        state.lastUpdated = new Date().toISOString();
        await this.saveStateFile(state);
    }

    /**
     * Clear local memory cache (force reload from disk).
     */
    clearCache(): void {
        this.stateCache = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type IssueTrackerType = 'jira' | 'linear' | 'github';

export interface IssueDetails {
    id: string;
    title: string;
    description: string;
    status: string;
    assignee?: string;
    labels?: string[];
    acceptanceCriteria?: string[];
    tracker?: IssueTrackerType;
    url?: string;
}

export interface IssueDetection {
    issueId: string;
    trackerType: IssueTrackerType | null;
    confidence: 'high' | 'low';
}

// MCP Response Types
interface McpToolList {
    tools: Array<{ name: string; description?: string }>;
}

interface JiraIssueResponse {
    issue: {
        key: string;
        fields?: {
            summary?: string;
            description?: string;
            status?: { name: string };
            assignee?: { displayName: string };
            labels?: string[];
        };
    };
}

interface LinearIssueResponse {
    issue: {
        identifier: string;
        title?: string;
        description?: string;
        state?: { name: string };
        assignee?: { name: string };
        labels?: Array<{ name: string }>;
        url?: string;
    };
}

interface LinearLabel {
    name: string;
}

interface GitHubIssueResponse {
    issue: {
        number: number;
        title?: string;
        body?: string;
        state?: string;
        assignee?: { login: string };
        labels?: Array<string | { name: string }>;
        html_url?: string;
    };
}
