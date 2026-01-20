/**
 * Spec Domain Entity
 *
 * Represents a feature specification with its lifecycle states.
 */

export type SpecStatus = 'draft' | 'approved' | 'in-progress' | 'done' | 'archived';

export type SpecPhase = 'requirements' | 'design' | 'tasks' | 'implementation';

/**
 * Summary view of a spec (for listings).
 */
export interface SpecSummary {
    id: string;
    featureName: string;
    status: SpecStatus;
    currentPhase: SpecPhase;
    createdAt: Date;
    updatedAt: Date;
    taskCount: number;
    completedTaskCount: number;
}

/**
 * Full spec detail including all artifacts.
 */
export interface SpecDetail extends SpecSummary {
    /** Path to the spec directory */
    path: string;

    /** Raw requirements markdown content */
    requirements?: string;

    /** Raw design markdown content */
    design?: string;

    /** Parsed tasks */
    tasks: import('./Task.js').Task[];

    /** Traceability links */
    traceability: TraceabilityLink[];
}

/**
 * Links between requirements, design elements, and tasks.
 */
export interface TraceabilityLink {
    from: {
        type: 'requirement' | 'design' | 'task';
        id: string;
    };
    to: {
        type: 'requirement' | 'design' | 'task';
        id: string;
    };
    relationship: 'implements' | 'derives-from' | 'tests';
}

/**
 * Spec entity with behavior.
 */
export class Spec {
    constructor(
        public readonly id: string,
        public featureName: string,
        public status: SpecStatus = 'draft',
        public currentPhase: SpecPhase = 'requirements',
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date()
    ) { }

    /**
     * Transition to the next phase.
     */
    advancePhase(): void {
        const phases: SpecPhase[] = ['requirements', 'design', 'tasks', 'implementation'];
        const currentIndex = phases.indexOf(this.currentPhase);
        if (currentIndex < phases.length - 1) {
            this.currentPhase = phases[currentIndex + 1];
            this.updatedAt = new Date();
        }
    }

    /**
     * Mark as approved (ready for implementation).
     */
    approve(): void {
        if (this.status === 'draft') {
            this.status = 'approved';
            this.updatedAt = new Date();
        }
    }

    /**
     * Start implementation.
     */
    startImplementation(): void {
        if (this.status === 'approved') {
            this.status = 'in-progress';
            this.currentPhase = 'implementation';
            this.updatedAt = new Date();
        }
    }

    /**
     * Mark as complete.
     */
    complete(): void {
        this.status = 'done';
        this.updatedAt = new Date();
    }
}
