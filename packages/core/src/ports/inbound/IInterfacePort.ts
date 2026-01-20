/**
 * Inbound Port: Interface Port
 *
 * Defines how user interfaces (VS Code, CLI, Web) interact with the core domain.
 * All inbound adapters must implement this interface.
 */

import type { SpecSummary, SpecDetail } from '../../domain/Spec.js';
import type { Task, TaskStatus } from '../../domain/Task.js';
import type { SteeringDocs } from '../../domain/Steering.js';

/**
 * Session representing an active spec creation/editing workflow.
 */
export interface SpecSession {
    specId: string;
    featureName: string;
    phase: 'requirements' | 'design' | 'tasks' | 'implementation';
    createdAt: Date;
}

/**
 * IInterfacePort defines the contract for all user-facing adapters.
 *
 * This is the primary inbound port through which external interfaces
 * drive the core domain logic.
 */
export interface IInterfacePort {
    // ═══════════════════════════════════════════════════════════════════════════
    // Spec Lifecycle
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Start a new spec session for a feature.
     */
    startSpec(featureName: string): Promise<SpecSession>;

    /**
     * Get all specs in the workspace.
     */
    getSpecs(): Promise<SpecSummary[]>;

    /**
     * Get detailed spec information by ID.
     */
    getSpec(specId: string): Promise<SpecDetail>;

    /**
     * Delete a spec and its artifacts.
     */
    deleteSpec(specId: string): Promise<void>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Task Management
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get all tasks for a spec.
     */
    getTasks(specId: string): Promise<Task[]>;

    /**
     * Update the status of a task.
     */
    updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;

    /**
     * Mark a task as the current focus for implementation.
     */
    focusTask(taskId: string): Promise<void>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Steering
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get current steering documents.
     */
    getSteering(): Promise<SteeringDocs>;

    /**
     * Auto-generate steering from project analysis.
     */
    generateSteering(projectPath: string): Promise<SteeringDocs>;

    /**
     * Update a steering document.
     */
    updateSteering(docType: keyof SteeringDocs, content: string): Promise<void>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Reverse Engineering
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Reverse engineer specs from existing code.
     * Analyzes code and generates requirements/design/tasks.
     */
    reverseEngineer(targetPath: string): Promise<SpecDetail[]>;
}
