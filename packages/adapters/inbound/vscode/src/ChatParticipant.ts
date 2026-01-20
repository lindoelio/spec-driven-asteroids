/**
 * @spec Chat Participant
 *
 * Registers the @spec chat participant for GitHub Copilot Chat.
 * Handles the full planning flow: Requirements → Design → Tasks.
 */

import * as vscode from 'vscode';
import type { VsCodeInterfaceAdapter } from './VsCodeInterfaceAdapter';

interface ConversationState {
    specId: string | null;
    phase: 'idle' | 'gathering' | 'requirements' | 'design' | 'tasks';
    featureName: string | null;
    context: {
        userInputs: string[];
        technologies?: string[];
        issueContext?: IssueContext;
    };
}

interface IssueContext {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria?: string[];
}

/**
 * Metadata returned with each chat response for followup handling.
 */
interface SpecChatResultMetadata {
    command?: string;
    phase?: 'requirements' | 'design' | 'tasks' | 'complete';
    specId?: string;
    success?: boolean;
    /** Info about next task to suggest */
    nextTask?: {
        id: string;
        title: string;
        phase: number;
    };

}

// Per-conversation state management
// Note: Since VS Code Chat API doesn't provide a unique session ID yet,
// we use a singleton state that resets when history is empty (new chat).
let activeState: ConversationState = {
    specId: null,
    phase: 'idle',
    featureName: null,
    context: { userInputs: [] },
};

function getState(context: vscode.ChatContext): ConversationState {
    // If history is empty, it's a new conversation session -> reset state
    if (context.history.length === 0) {
        activeState = {
            specId: null,
            phase: 'idle',
            featureName: null,
            context: { userInputs: [] },
        };
    }

    return activeState;
}

export function registerChatParticipant(
    extensionContext: vscode.ExtensionContext,
    interfaceAdapter: VsCodeInterfaceAdapter
): void {
    // Track the last result for followup provider
    let lastResult: SpecChatResultMetadata = {};

    const participant = vscode.chat.createChatParticipant(
        'specdriven.spec',
        async (
            request: vscode.ChatRequest,
            context: vscode.ChatContext,
            stream: vscode.ChatResponseStream,
            token: vscode.CancellationToken
        ) => {
            const command = request.command;
            const userMessage = request.prompt;
            const state = getState(context);

            // Reset result metadata
            lastResult = { command };

            // Note: Steering initialization is now deferred to specific commands (design, tasks)
            // or post-requirements phase to allow requirements to shape the steering.

            try {
                switch (command) {
                    case 'plan':
                        lastResult = await handlePlanCommand(stream, userMessage, interfaceAdapter, state);
                        break;

                    case 'requirements':
                        lastResult = await handleRequirementsCommand(stream, userMessage, interfaceAdapter, state);
                        break;

                    case 'design':
                        lastResult = await handleDesignCommand(stream, userMessage, interfaceAdapter, state);
                        break;

                    case 'tasks':
                        lastResult = await handleTasksCommand(stream, userMessage, interfaceAdapter, state);
                        break;

                    case 'reverse':
                        await handleReverseCommand(stream, userMessage, interfaceAdapter);
                        lastResult = { command: 'reverse', success: true };
                        break;

                    case 'configure':
                        lastResult = await handleConfigureCommand(stream, userMessage, interfaceAdapter);
                        break;

                    case 'status':
                        lastResult = await handleStatusCommand(stream, interfaceAdapter, state);
                        break;

                    default:
                        await handleDefaultCommand(stream, userMessage, interfaceAdapter, state);
                        lastResult = { command: 'default' };
                        break;
                }
            } catch (error) {
                stream.markdown(`**Error**: ${error instanceof Error ? error.message : String(error)}`);
                lastResult.success = false;
            }

            return { metadata: lastResult };
        }
    );

    // Add followup provider for handoff buttons
    participant.followupProvider = {
        provideFollowups(
            result: vscode.ChatResult,
            context: vscode.ChatContext,
            token: vscode.CancellationToken
        ): vscode.ProviderResult<vscode.ChatFollowup[]> {
            const metadata = result.metadata as SpecChatResultMetadata | undefined;
            if (!metadata || metadata.success === false) {
                return [];
            }

            const followups: vscode.ChatFollowup[] = [];
            const specId = metadata.specId || activeState.specId;

            // Handle status command with pending tasks
            if (metadata.command === 'status' && metadata.nextTask) {
                followups.push({
                    prompt: `Implement task ${metadata.nextTask.id} of ${specId}`,
                    label: `Continue: Task ${metadata.nextTask.id} - ${metadata.nextTask.title}`,
                });
                followups.push({
                    prompt: `Implement phase ${metadata.nextTask.phase} of ${specId}`,
                    label: `Implement Phase ${metadata.nextTask.phase}`,
                });
                return followups;
            }

            switch (metadata.phase) {
                case 'requirements':
                    // After requirements: show revise instructions, approve button
                    followups.push(
                        {
                            prompt: '',
                            label: 'Approve & Generate Design',
                            command: 'design',
                        }
                    );
                    break;

                case 'design':
                    // After design: show revise instructions, approve button
                    followups.push(
                        {
                            prompt: '',
                            label: 'Approve & Generate Tasks',
                            command: 'tasks',
                        }
                    );
                    break;

                case 'tasks':
                    // After tasks: show revise instructions, start implementation button
                    followups.push(
                        {
                            prompt: `Implement phase 1 of ${specId}`,
                            label: 'Start Implementation (Phase 1)',
                        }
                    );
                    break;

                case 'complete':
                    // Spec complete, offer to view or start new
                    followups.push(
                        {
                            prompt: '',
                            label: 'View Spec Status',
                            command: 'status',
                        },
                        {
                            prompt: '',
                            label: 'Plan New Feature',
                            command: 'plan',
                        }
                    );
                    break;
            }

            return followups;
        },
    };

    participant.iconPath = new vscode.ThemeIcon('notebook');

    extensionContext.subscriptions.push(participant);
}

async function ensureSteeringInitialized(
    stream: vscode.ChatResponseStream,
    adapter: VsCodeInterfaceAdapter,
    requirements?: string
): Promise<void> {
    const steeringPaths = {
        product: '.spec/steering/product.md',
        tech: '.spec/steering/tech.md',
        architecture: '.spec/steering/architecture.md',
        conventions: '.spec/steering/conventions.md',
        testing: '.spec/steering/testing.md',
    } as const;

    const missing: (keyof typeof steeringPaths)[] = [];

    for (const key of Object.keys(steeringPaths) as Array<keyof typeof steeringPaths>) {
        if (!await adapter.fileSystem.exists(steeringPaths[key])) {
            missing.push(key);
        }
    }

    if (missing.length === 0) {
        return;
    }

    if (missing.length === 5) {
        stream.markdown(`**Project steering**: initializing steering documents...\n\n`);
    } else {
        stream.markdown(`**Project steering**: updating missing steering documents...\n\n`);
    }

    if (missing.includes('product')) {
        // Product steering might need user intent which is now passed via requirements content usually
        await adapter.generateProductSteering(requirements);
    }
    if (missing.includes('tech')) {
        await adapter.generateTechSteering(requirements);
    }
    if (missing.includes('architecture')) {
        await adapter.generateArchitectureSteering(requirements);
    }
    if (missing.includes('conventions')) {
        await adapter.generateConventionsSteering(requirements);
    }
    if (missing.includes('testing')) {
        await adapter.generateTestingSteering(requirements);
    }

    const touched = missing.map(doc => `${doc}.md`);
    stream.markdown(`**Project steering generated/touched**: ${touched.join(', ')}\n\n`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Command Handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function handlePlanCommand(
    stream: vscode.ChatResponseStream,
    userMessage: string,
    adapter: VsCodeInterfaceAdapter,
    state: ConversationState
): Promise<SpecChatResultMetadata> {
    if (!userMessage.trim()) {
        stream.markdown(`# 📋 Start Planning a Feature

Please describe the feature you want to build. I'll help you create:

1. **Requirements** (using EARS syntax)
2. **Design** (architecture + Mermaid diagrams)
3. **Tasks** (atomic implementation steps)

**Example**: \`@spec /plan User authentication with OAuth\`

---

**Pro tips:**
- Include a Jira/Linear issue ID if available: \`@spec /plan PROJ-123 OAuth login\`
- Be specific about users and behaviors for better requirements
`);
        return { command: 'plan', success: true };
    }

    stream.markdown(`# 📋 Planning: ${userMessage}\n\n`);
    stream.progress('Initializing spec...');

    // Check for issue ID in the message
    const issueMatch = userMessage.match(/^([A-Z]+-\d+|#\d+)\s+(.+)$/);
    let featureName = userMessage;
    let issueId: string | null = null;

    if (issueMatch) {
        issueId = issueMatch[1];
        featureName = issueMatch[2];
        stream.markdown(`Detected issue: \`${issueId}\`\n\n`);
    }

    // Create the spec
    const session = await adapter.startSpec(featureName);

    // Update state
    state.specId = session.specId;
    state.featureName = featureName;
    state.phase = 'gathering';
    state.context.userInputs = [userMessage];

    stream.markdown(`Spec created: \`${session.specId}\`\n\n`);

    // Analyse request clarity
    stream.progress('Analyzing request...');
    const analysis = await adapter.analyzeRequest(userMessage);

    if (analysis.isClear) {
        // Request is clear, proceed directly
        stream.markdown(`**Analysis**: The request is clear. Generating requirements...\n\n`);

        // Auto-trigger requirements generation
        // But first, populate global state context
        const planningContext = await adapter.gatherPlanningContext(featureName, userMessage);
        if (planningContext.technologies?.length) {
            state.context.technologies = planningContext.technologies;
        }

        return await handleRequirementsCommand(stream, '', adapter, state);
    } else {
        // Request is ambiguous, ask for clarification
        stream.markdown(`I need a few more details to create a solid spec:\n\n`);

        if (analysis.missingInfo && analysis.missingInfo.length > 0) {
            for (const question of analysis.missingInfo) {
                stream.markdown(`- ${question}\n`);
            }
        } else {
            // Fallback questions if none returned
            stream.markdown(`- Who are the primary users?\n`);
            stream.markdown(`- Are there specific constraints?\n`);
        }

        stream.markdown(`\n*Reply with details, or say "generate" to proceed anyway.*\n`);
        return { command: 'plan', specId: state.specId ?? undefined, success: true };
    }

    /*
    // Gather context
    stream.progress('Gathering context...');
    const planningContext = await adapter.gatherPlanningContext(featureName, userMessage);

    if (planningContext.technologies && planningContext.technologies.length > 0) {
        stream.markdown(`🔍 **Detected technologies**: ${planningContext.technologies.join(', ')}\n\n`);
        state.context.technologies = planningContext.technologies;
    }

    // Show steering status
    const steering = await adapter.getSteering();
    if (!steering.product && !steering.tech) {
        stream.markdown(`**Note**: No steering documents found. Run \`SpecDriven: Initialize Steering Documents\` for better results.\n\n`);
    }

    stream.markdown(`---\n\n`);
    stream.markdown(`## 📝 Requirements Gathering\n\n`);
    stream.markdown(`To create comprehensive requirements, please tell me more about this feature:\n\n`);
    stream.markdown(`1. **Problem Statement**: What problem does this solve?\n`);
    stream.markdown(`2. **Users**: Who will use this feature? (roles, personas)\n`);
    stream.markdown(`3. **Key Behaviors**: What should users be able to do?\n`);
    stream.markdown(`4. **Constraints**: Any technical or business constraints?\n`);
    stream.markdown(`5. **Edge Cases**: What could go wrong?\n\n`);
    stream.markdown(`---\n\n`);
    stream.markdown(`*Reply with the details, or say "generate" to proceed with what we have.*\n`);
    stream.markdown(`*Use \`@spec /requirements <details>\` to add more context and generate the requirements doc.*\n`);
    */
}

async function handleRequirementsCommand(
    stream: vscode.ChatResponseStream,
    userMessage: string,
    adapter: VsCodeInterfaceAdapter,
    state: ConversationState
): Promise<SpecChatResultMetadata> {
    if (!state.specId) {
        stream.markdown(`No active spec. Use \`@spec /plan <feature>\` to start planning first.\n`);
        return { command: 'requirements', success: false };
    }

    stream.markdown(`# 📝 Generating Requirements\n\n`);
    stream.progress('Analyzing input and generating EARS requirements...');

    // Add user input to context
    if (userMessage.trim()) {
        state.context.userInputs.push(userMessage);
    }

    // Combine all user inputs
    const combinedInput = state.context.userInputs.join('\n\n');

    try {
        // Generate requirements via adapter
        const result = await adapter.generateRequirements(
            state.specId,
            combinedInput,
            {
                technologies: state.context.technologies,
                issueContext: state.context.issueContext,
            }
        );

        state.phase = 'requirements';

        stream.markdown(`# 📝 Requirements Generated\n\n`);
        stream.markdown(`Saved to: \`.spec/specs/${state.specId}/requirements.md\`\n\n`);
        stream.markdown(`---\n\n`);

        if (result.summary) {
            stream.markdown(`### Document Overview\n\n`);
            stream.markdown(result.summary);
        } else {
            stream.markdown(`### Preview\n\n`);
            stream.markdown(result.content.substring(0, 1500) + (result.content.length > 1500 ? '\n\n*... (truncated, see full file)*' : ''));
        }

        stream.markdown(`\n\n---\n\n`);
        stream.markdown(`Review the requirements. To revise, type: \`@spec /requirements <your changes>\`\n`);

        return {
            command: 'requirements',
            phase: 'requirements',
            specId: state.specId,
            success: true,
        };

    } catch (error) {
        stream.markdown(`**Error:** Failed to generate requirements: ${error instanceof Error ? error.message : String(error)}\n`);
        return { command: 'requirements', specId: state.specId, success: false };
    }
}

async function handleDesignCommand(
    stream: vscode.ChatResponseStream,
    userMessage: string,
    adapter: VsCodeInterfaceAdapter,
    state: ConversationState
): Promise<SpecChatResultMetadata> {
    if (!state.specId) {
        stream.markdown(`No active spec. Use \`@spec /plan <feature>\` to start planning first.\n`);
        return { command: 'design', success: false };
    }

    // Check if requirements exist
    const requirements = await adapter.getRequirements(state.specId);
    if (!requirements) {
        stream.markdown(`No requirements found. Use \`@spec /requirements\` first.\n`);
        return { command: 'design', specId: state.specId, success: false };
    }

    // Ensure project steering exists before design starts
    await ensureSteeringInitialized(stream, adapter, requirements);

    stream.markdown(`# 🏗️ Generating Design\n\n`);
    stream.progress('Analyzing requirements and generating architecture...');

    try {
        // Generate design via adapter
        const result = await adapter.generateDesign(
            state.specId,
            requirements + (userMessage ? `\n\nAdditional context: ${userMessage}` : ''),
            {
                technologies: state.context.technologies,
            }
        );

        state.phase = 'design';

        stream.markdown(`# 🏗️ Design Generated\n\n`);
        stream.markdown(`Saved to: \`.spec/specs/${state.specId}/design.md\`\n\n`);

        if (result.impactAnalysis) {
            stream.markdown(`### Impact Analysis\n\n`);
            stream.markdown(`- **Risk Level**: ${result.impactAnalysis.riskLevel ?? 'unknown'}\n`);

            const affectedFiles = result.impactAnalysis.affectedFiles ?? [];
            stream.markdown(`- **Files Affected**: ${affectedFiles.length}\n\n`);

            if (affectedFiles.length > 0) {
                stream.markdown(`**Potentially affected files:**\n`);
                for (const file of affectedFiles.slice(0, 5)) {
                    stream.markdown(`- \`${file}\`\n`);
                }
                if (affectedFiles.length > 5) {
                    stream.markdown(`- *... and ${affectedFiles.length - 5} more*\n`);
                }
                stream.markdown(`\n`);
            }
        }

        stream.markdown(`---\n\n`);

        if (result.summary) {
            stream.markdown(`### Document Overview\n\n`);
            stream.markdown(result.summary);
        } else {
            stream.markdown(`### Preview\n\n`);
            stream.markdown(result.content.substring(0, 1500) + (result.content.length > 1500 ? '\n\n*... (truncated, see full file)*' : ''));
        }

        stream.markdown(`\n\n---\n\n`);
        stream.markdown(`Review the design. To revise, type: \`@spec /design <your changes>\`\n`);

        return {
            command: 'design',
            phase: 'design',
            specId: state.specId,
            success: true,
        };

    } catch (error) {
        stream.markdown(`**Error:** Failed to generate design: ${error instanceof Error ? error.message : String(error)}\n`);
        return { command: 'design', specId: state.specId, success: false };
    }
}

async function handleTasksCommand(
    stream: vscode.ChatResponseStream,
    userMessage: string,
    adapter: VsCodeInterfaceAdapter,
    state: ConversationState
): Promise<SpecChatResultMetadata> {
    if (!state.specId) {
        stream.markdown(`No active spec. Use \`@spec /plan <feature>\` to start planning first.\n`);
        return { command: 'tasks', success: false };
    }

    // Check if design exists
    const design = await adapter.getDesign(state.specId);
    if (!design) {
        stream.markdown(`No design found. Use \`@spec /design\` first.\n`);
        return { command: 'tasks', specId: state.specId, success: false };
    }

    stream.markdown(`# 📋 Generating Tasks\n\n`);
    stream.progress('Decomposing design into atomic tasks...');

    const useTdd = userMessage.toLowerCase().includes('tdd');

    try {
        // Generate tasks via adapter
        const result = await adapter.generateTasks(
            state.specId,
            design,
            { suggestTdd: useTdd }
        );

        state.phase = 'tasks';

        stream.markdown(`# ✅ Tasks Generated\n\n`);
        stream.markdown(`Saved to: \`.spec/specs/${state.specId}/tasks.md\`\n\n`);
        stream.markdown(`---\n\n`);

        if (result.summary) {
            stream.markdown(`### Implementation Plan Overview\n\n`);
            stream.markdown(result.summary);
        } else {
            stream.markdown(`### Preview\n\n`);
            stream.markdown(result.content.substring(0, 2000) + (result.content.length > 2000 ? '\n\n*... (truncated, see full file)*' : ''));
        }

        stream.markdown(`\n\n---\n\n`);
        stream.markdown(`**Spec complete.** Review the tasks. To revise, type: \`@spec /tasks <your changes>\`\n`);

        return {
            command: 'tasks',
            phase: 'tasks',
            specId: state.specId,
            success: true,
        };

    } catch (error) {
        stream.markdown(`**Error:** Failed to generate tasks: ${error instanceof Error ? error.message : String(error)}\n`);
        return { command: 'tasks', specId: state.specId, success: false };
    }
}



/**
 * Implement a specific task.
 */


async function handleReverseCommand(
    stream: vscode.ChatResponseStream,
    userMessage: string,
    adapter: VsCodeInterfaceAdapter
): Promise<void> {
    stream.markdown(`# Reverse Engineering\n\n`);
    stream.markdown(`This feature analyzes existing code and generates specs.\n\n`);
    stream.markdown(`**Usage**:\n`);
    stream.markdown(`1. Select a file or folder in the Explorer\n`);
    stream.markdown(`2. Run \`SpecDriven: Reverse Engineer Spec\` from the Command Palette\n`);
    stream.markdown(`3. Or: \`@spec /reverse path/to/code\`\n\n`);
    stream.markdown(`*This feature requires the engine adapter to be configured.*\n`);
}

async function handleConfigureCommand(
    stream: vscode.ChatResponseStream,
    userMessage: string,
    adapter: VsCodeInterfaceAdapter
): Promise<SpecChatResultMetadata> {
    stream.markdown(`# Configure Steering\n\n`);
    stream.progress('Analyzing project...');

    // Check existing steering
    const existingSteering = await adapter.getSteering();
    const hasExisting = existingSteering.product || existingSteering.tech ||
        existingSteering.architecture || existingSteering.conventions || existingSteering.testing;

    if (hasExisting) {
        stream.markdown(`**Updating** existing steering documents...\n\n`);
    } else {
        stream.markdown(`**Initializing** steering for this project...\n\n`);
    }

    try {
        // Generate all steering documents
        const results = await adapter.generateAllSteering();

        // Show summaries
        stream.markdown(`## Generated Documents\n\n`);

        stream.markdown(`### Product Vision\n`);
        stream.markdown(`${results.product.summary}\n\n`);

        stream.markdown(`### Technology Stack\n`);
        stream.markdown(`${results.tech.summary}\n\n`);

        stream.markdown(`### Architecture\n`);
        stream.markdown(`${results.architecture.summary}\n\n`);

        stream.markdown(`### Coding Conventions\n`);
        stream.markdown(`${results.conventions.summary}\n\n`);

        stream.markdown(`### Testing Strategy\n`);
        stream.markdown(`${results.testing.summary}\n\n`);

        stream.markdown(`---\n\n`);
        stream.markdown(`**Steering files created in:** \`.spec/steering/\`\n\n`);
        stream.markdown(`- [product.md](.spec/steering/product.md)\n`);
        stream.markdown(`- [tech.md](.spec/steering/tech.md)\n`);
        stream.markdown(`- [architecture.md](.spec/steering/architecture.md)\n`);
        stream.markdown(`- [conventions.md](.spec/steering/conventions.md)\n`);
        stream.markdown(`- [testing.md](.spec/steering/testing.md)\n\n`);
        stream.markdown(`Review and customize these documents to match your project's specific needs.\n`);

        return {
            command: 'configure',
            success: true,
        };
    } catch (error) {
        stream.markdown(`**Error**: ${error instanceof Error ? error.message : String(error)}\n`);
        return {
            command: 'configure',
            success: false,
        };
    }
}

async function handleStatusCommand(
    stream: vscode.ChatResponseStream,
    adapter: VsCodeInterfaceAdapter,
    state: ConversationState
): Promise<SpecChatResultMetadata> {
    stream.markdown(`# Status\n\n`);

    // Steering status
    const steering = await adapter.getSteering();
    stream.markdown(`## Steering Documents\n\n`);
    stream.markdown(`- Product: ${steering.product ? 'Present' : 'Missing'}\n`);
    stream.markdown(`- Tech: ${steering.tech ? 'Present' : 'Missing'}\n`);
    stream.markdown(`- Architecture: ${steering.architecture ? 'Present' : 'Missing'}\n`);
    stream.markdown(`- Conventions: ${steering.conventions ? 'Present' : 'Missing'}\n`);
    stream.markdown(`- Testing: ${steering.testing ? 'Present' : 'Missing'}\n\n`);

    // Specs status
    const specs = await adapter.getSpecs();
    stream.markdown(`## Specs (${specs.length})\n\n`);

    let nextTaskInfo: { id: string; title: string; phase: number } | undefined;
    let activeSpecId: string | undefined;

    if (specs.length === 0) {
        stream.markdown(`*No specs yet. Use \`@spec /plan\` to create one.*\n`);
    } else {
        for (const spec of specs) {
            const progress = spec.taskCount > 0
                ? `${spec.completedTaskCount}/${spec.taskCount} tasks`
                : 'No tasks';
            stream.markdown(`- **${spec.featureName}** (\`${spec.id}\`): ${progress}\n`);

            // Find the next pending task for the first spec with pending tasks
            if (!nextTaskInfo && spec.taskCount > spec.completedTaskCount) {
                activeSpecId = spec.id;
                const tasks = await adapter.getTasks(spec.id);
                const pendingTask = tasks.find(t => t.status === 'pending' || t.status === 'in-progress');
                if (pendingTask) {
                    const phase = parseInt(pendingTask.id.split('.')[0]) || 1;
                    nextTaskInfo = {
                        id: pendingTask.id,
                        title: pendingTask.title,
                        phase,
                    };
                }
            }
        }
    }

    return {
        command: 'status',
        specId: activeSpecId || state.specId || undefined,
        nextTask: nextTaskInfo,
        success: true,
    };
}



async function attemptContextRecovery(
    adapter: VsCodeInterfaceAdapter,
    state: ConversationState
): Promise<boolean> {
    const specs = await adapter.getSpecs();
    const candidates = [];

    // Find specs that have pending requirements
    for (const spec of specs) {
        const reqs = await adapter.getRequirements(spec.id);
        if (reqs && reqs.includes('<!-- To be generated -->')) {
            candidates.push(spec);
        }
    }

    // If we find exactly one pending spec, assume it's the active one
    if (candidates.length === 1) {
        const spec = candidates[0];
        state.specId = spec.id;
        state.featureName = spec.featureName;
        state.phase = 'gathering';
        // Note: We can't easily recover previous user inputs, but we can allow "generate" to proceed
        return true;
    }

    return false;
}

async function handleDefaultCommand(
    stream: vscode.ChatResponseStream,
    userMessage: string,
    adapter: VsCodeInterfaceAdapter,
    state: ConversationState
): Promise<void> {
    // Try to recover context if we received "generate" but have no spec
    if (!state.specId && (userMessage.toLowerCase() === 'generate' || userMessage.toLowerCase() === 'proceed')) {
        const recovered = await attemptContextRecovery(adapter, state);
        if (recovered) {
            stream.markdown(`**Recovered session for:** \`${state.specId}\`\n\n`);
            await handleRequirementsCommand(stream, '', adapter, state);
            return;
        }
    }

    // If there's an active spec in gathering phase, treat input as additional context
    if (state.specId && state.phase === 'gathering' && userMessage.trim()) {
        // User is providing more context for requirements
        if (userMessage.toLowerCase() === 'generate' || userMessage.toLowerCase() === 'proceed') {
            await handleRequirementsCommand(stream, '', adapter, state);
            return;
        }

        // Add to context
        state.context.userInputs.push(userMessage);

        // Re-analyze request with added context to see if we can auto-proceed
        // Combine all inputs to see if it makes a clear request now
        const fullContext = state.context.userInputs.join('\n\n');

        stream.progress('Analyzing updated context...');
        const analysis = await adapter.analyzeRequest(fullContext);

        if (analysis.isClear) {
            stream.markdown(`**Context added.** The request is now clear. Generating requirements...\n\n`);
            await handleRequirementsCommand(stream, '', adapter, state);
        } else {
            stream.markdown(`**Context added.**\n\n`);
            // Only ask recovering questions if we haven't asked too many times,
            // but for now let's just show the prompt to continue or generate.
            stream.markdown(`I've updated the context. You can providing more details or just say "generate" to start.\n`);
        }
        return;
    }

    // Default help response
    stream.markdown(`# SpecDriven Assistant

I help you build software with discipline: **Requirements → Design → Tasks → Code**.

## Commands

| Command | Description |
|---------|-------------|
| \`/plan <feature>\` | Start planning a new feature |
| \`/requirements\` | Generate requirements (EARS syntax) |
| \`/design\` | Generate architecture & diagrams |
| \`/tasks\` | Generate implementation tasks |
| \`/reverse\` | Generate specs from existing code |
| \`/status\` | Show current progress |

## Implementation (Use Agent Mode)

To implement tasks, use **Copilot Agent mode** directly:

1. Open your spec's \`tasks.md\` file as context
2. Ask Copilot to implement specific tasks

**Example prompts:**
- "Implement task 1.1 from the spec"
- "Implement all pending tasks in phase 1"
- "Read .spec/specs/my-feature/tasks.md and implement task 2.1"

Copilot reads \`.github/copilot-instructions.md\` automatically to understand the workflow.

## Quick Start

1. **Initialize steering**: Run \`SpecDriven: Initialize Steering Documents\`
2. **Plan a feature**: \`@spec /plan User login with OAuth\`
3. **Generate requirements**: \`@spec /requirements\`
4. **Generate design**: \`@spec /design\`
5. **Generate tasks**: \`@spec /tasks\`
6. **Implement**: Use Copilot Agent mode with tasks.md as context

## Pro Tips

- Include issue IDs: \`@spec /plan PROJ-123 OAuth login\`
- Add "tdd" to tasks command for test-first approach: \`@spec /tasks tdd\`
- Check steering docs for project-specific guidance

---

`);

    // Show current state if active
    if (state.specId) {
        stream.markdown(`## Current Session\n\n`);
        stream.markdown(`- **Spec**: \`${state.specId}\`\n`);
        stream.markdown(`- **Feature**: ${state.featureName}\n`);
        stream.markdown(`- **Phase**: ${state.phase}\n\n`);
    }

    stream.markdown(`*How can I help you today?*\n`);
}
