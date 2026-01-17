/**
 * NEURAL STACK TYPE DEFINITIONS
 * Cognalith Inc. | Monolith System - Phase 5A
 *
 * TypeScript interfaces matching the Supabase schema for Neural Stack
 * evolutionary optimization system.
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export type AgentRole =
  | 'ceo' | 'cfo' | 'cto' | 'coo' | 'cmo' | 'chro'
  | 'clo' | 'ciso' | 'cos' | 'cco' | 'cpo' | 'cro'
  | 'devops' | 'data' | 'qa';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';

export type AmendmentType = 'append' | 'replace' | 'remove';

export type AmendmentTarget =
  | 'time_estimation'
  | 'task_approach'
  | 'tool_usage'
  | 'validation'
  | 'escalation'
  | 'decomposition';

export type EvaluationStatus = 'pending' | 'evaluating' | 'success' | 'failed' | 'reverted';

export type ReviewPhase = 'collect' | 'analyze' | 'trend' | 'score' | 'decide' | 'log';

export type SnapshotType = 'daily' | 'weekly' | 'after_task' | 'after_review';

// ============================================================================
// DELIVERABLE INTERFACE
// Section 3.2 of Neural Stack Spec
// ============================================================================

export interface Deliverable {
  id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  acceptance_criteria: string[];
  due_date: string | null;  // ISO timestamp
  completed: boolean;
  completed_at: string | null;
  artifacts: string[];  // File paths, URLs, etc.
  created_at: string;
  updated_at: string;
}

export interface DeliverableInsert {
  task_id?: string | null;
  title: string;
  description?: string | null;
  acceptance_criteria?: string[];
  due_date?: string | null;
  completed?: boolean;
  completed_at?: string | null;
  artifacts?: string[];
}

export interface DeliverableUpdate {
  task_id?: string | null;
  title?: string;
  description?: string | null;
  acceptance_criteria?: string[];
  due_date?: string | null;
  completed?: boolean;
  completed_at?: string | null;
  artifacts?: string[];
}

// ============================================================================
// TASK HISTORY INTERFACE
// Section 3.3 TaskHistoryEntry of Neural Stack Spec
// ============================================================================

export interface TaskHistoryEntry {
  id: string;
  task_id: string;
  agent_role: AgentRole;
  title: string;
  description: string | null;
  deliverable_titles: string[];

  // Difficulty and estimation
  difficulty: Difficulty | null;
  estimated_hours: number | null;

  // Timestamps (all UTC)
  started_at: string | null;
  completed_at: string | null;

  // Computed metrics (auto-calculated by trigger)
  actual_hours: number | null;
  variance: number | null;
  variance_percent: number | null;

  // CoS evaluation
  cos_score: number | null;  // 0-100
  cos_notes: string | null;
  cos_reviewed_at: string | null;

  // Metadata
  knowledge_version: string | null;
  model_used: string | null;
  tokens_used: number;

  created_at: string;
  updated_at: string;
}

export interface TaskHistoryInsert {
  task_id: string;
  agent_role: AgentRole;
  title: string;
  description?: string | null;
  deliverable_titles?: string[];
  difficulty?: Difficulty | null;
  estimated_hours?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  cos_score?: number | null;
  cos_notes?: string | null;
  knowledge_version?: string | null;
  model_used?: string | null;
  tokens_used?: number;
}

export interface TaskHistoryUpdate {
  completed_at?: string | null;
  cos_score?: number | null;
  cos_notes?: string | null;
  cos_reviewed_at?: string | null;
  difficulty?: Difficulty | null;
  estimated_hours?: number | null;
}

// ============================================================================
// AGENT MEMORY INTERFACE
// Section 3.3 AgentMemory of Neural Stack Spec
// ============================================================================

export interface MetricsByDifficulty {
  [difficulty: number]: {
    task_count: number;
    avg_variance_percent: number;
    avg_cos_score: number;
  };
}

export interface AgentMemory {
  id: string;
  agent_role: AgentRole;

  // Knowledge versioning
  knowledge_version: string | null;
  knowledge_base: string | null;
  knowledge_standard: string | null;
  knowledge_effective: string | null;

  // Performance metrics
  avg_variance_percent: number;
  variance_trend_slope: number;
  on_time_delivery_rate: number;
  avg_cos_score: number;
  deliverable_completion_rate: number;

  // Metrics by difficulty
  metrics_by_difficulty: MetricsByDifficulty;

  // Amendment tracking
  total_amendments: number;
  successful_amendments: number;
  failed_amendments: number;
  reverted_amendments: number;
  active_amendment_count: number;

  // CoS review tracking
  last_cos_review: string | null;
  next_cos_review: string | null;
  tasks_since_last_review: number;

  // Trend status
  current_trend: TrendDirection;
  trend_calculated_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface AgentMemoryUpdate {
  knowledge_version?: string;
  knowledge_base?: string;
  knowledge_standard?: string;
  knowledge_effective?: string;
  avg_variance_percent?: number;
  variance_trend_slope?: number;
  on_time_delivery_rate?: number;
  avg_cos_score?: number;
  deliverable_completion_rate?: number;
  metrics_by_difficulty?: MetricsByDifficulty;
  total_amendments?: number;
  successful_amendments?: number;
  failed_amendments?: number;
  reverted_amendments?: number;
  active_amendment_count?: number;
  last_cos_review?: string;
  next_cos_review?: string;
  tasks_since_last_review?: number;
  current_trend?: TrendDirection;
  trend_calculated_at?: string;
}

// ============================================================================
// AMENDMENT INTERFACE
// Section 2.3 Amendment Format of Neural Stack Spec
// ============================================================================

export interface PerformanceSnapshot {
  avg_variance: number;
  trend: number;
  cos_score?: number;
  on_time_rate?: number;
  task_count?: number;
}

export interface Amendment {
  id: string;
  amendment_id: string;  // Human-readable ID (e.g., amend-001)
  agent_role: AgentRole;

  // Trigger information
  trigger_reason: string;
  trigger_pattern: string | null;

  // Amendment details
  amendment_type: AmendmentType;
  target_area: AmendmentTarget;
  content: string;

  // Performance snapshots
  performance_before: PerformanceSnapshot;
  performance_after: PerformanceSnapshot | null;

  // Evaluation
  evaluation_window_tasks: number;
  tasks_evaluated: number;
  evaluation_status: EvaluationStatus;
  evaluated_at: string | null;

  // Status
  is_active: boolean;
  reverted: boolean;
  reverted_at: string | null;
  revert_reason: string | null;

  // Versioning
  version: number;
  previous_amendment_id: string | null;

  // Safety Axioms compliance
  approved_by: 'cos_auto' | 'ceo_manual' | null;
  approval_required: boolean;

  created_at: string;
  updated_at: string;
}

export interface AmendmentInsert {
  amendment_id: string;
  agent_role: AgentRole;
  trigger_reason: string;
  trigger_pattern?: string | null;
  amendment_type: AmendmentType;
  target_area: AmendmentTarget;
  content: string;
  performance_before: PerformanceSnapshot;
  evaluation_window_tasks?: number;
  approved_by?: 'cos_auto' | 'ceo_manual';
  approval_required?: boolean;
  previous_amendment_id?: string | null;
}

export interface AmendmentUpdate {
  performance_after?: PerformanceSnapshot;
  tasks_evaluated?: number;
  evaluation_status?: EvaluationStatus;
  evaluated_at?: string;
  is_active?: boolean;
  reverted?: boolean;
  reverted_at?: string;
  revert_reason?: string;
}

// ============================================================================
// COS REVIEW INTERFACE
// Section 4.1 Review Cycle of Neural Stack Spec
// ============================================================================

export interface CosReview {
  id: string;
  agent_role: AgentRole;

  // Review phases
  phase: ReviewPhase;

  // Collected data
  tasks_analyzed: number;
  task_ids_analyzed: string[];

  // Analysis results
  calculated_trend: TrendDirection | null;
  trend_slope: number | null;
  avg_variance_percent: number | null;

  // Scoring (Section 4.1: on-time 40%, quality 30%, accuracy 30%)
  on_time_score: number | null;  // 0-40
  quality_score: number | null;  // 0-30
  accuracy_score: number | null;  // 0-30
  total_score: number | null;  // 0-100

  // Decision
  intervention_required: boolean;
  amendment_generated_id: string | null;
  decision_notes: string | null;

  // Timing
  review_started_at: string;
  review_completed_at: string | null;

  created_at: string;
}

export interface CosReviewInsert {
  agent_role: AgentRole;
  phase: ReviewPhase;
  tasks_analyzed?: number;
  task_ids_analyzed?: string[];
  calculated_trend?: TrendDirection;
  trend_slope?: number;
  avg_variance_percent?: number;
  on_time_score?: number;
  quality_score?: number;
  accuracy_score?: number;
  total_score?: number;
  intervention_required?: boolean;
  amendment_generated_id?: string;
  decision_notes?: string;
  review_completed_at?: string;
}

// ============================================================================
// PERFORMANCE SNAPSHOT INTERFACE
// For trend visualization
// ============================================================================

export interface PerformanceSnapshotRecord {
  id: string;
  agent_role: AgentRole;
  snapshot_type: SnapshotType;

  // Metrics at snapshot time
  avg_variance_percent: number | null;
  variance_trend_slope: number | null;
  on_time_delivery_rate: number | null;
  avg_cos_score: number | null;
  deliverable_completion_rate: number | null;

  // Task counts
  total_tasks_completed: number;
  tasks_since_last_snapshot: number;

  // Amendment state
  active_amendments: number;

  // Metadata
  triggered_by: string | null;

  snapshot_at: string;
  created_at: string;
}

export interface PerformanceSnapshotInsert {
  agent_role: AgentRole;
  snapshot_type: SnapshotType;
  avg_variance_percent?: number;
  variance_trend_slope?: number;
  on_time_delivery_rate?: number;
  avg_cos_score?: number;
  deliverable_completion_rate?: number;
  total_tasks_completed?: number;
  tasks_since_last_snapshot?: number;
  active_amendments?: number;
  triggered_by?: string;
}

// ============================================================================
// TREND ANALYSIS TYPES
// Section 4.2 Trend Detection Algorithm
// ============================================================================

export interface TrendResult {
  direction: TrendDirection;
  slope?: number;
  tasksAnalyzed?: number;
  confidence?: number;
}

export interface TrendDataPoint {
  taskNumber: number;
  variancePercent: number;
  cosScore: number;
  timestamp: string;
}

// ============================================================================
// INTERVENTION RULES
// Section 4.3 Intervention Rules
// ============================================================================

export interface InterventionDecision {
  shouldIntervene: boolean;
  reason: string;
  suggestedAmendment?: {
    type: AmendmentType;
    target: AmendmentTarget;
    content: string;
  };
  waitingForEvaluation?: boolean;
  tasksUntilNextReview?: number;
}

// ============================================================================
// DATABASE TABLE NAMES (with prefix)
// ============================================================================

export const NEURAL_STACK_TABLES = {
  deliverables: 'monolith_deliverables',
  taskHistory: 'monolith_task_history',
  agentMemory: 'monolith_agent_memory',
  amendments: 'monolith_amendments',
  cosReviews: 'monolith_cos_reviews',
  performanceSnapshots: 'monolith_performance_snapshots',
} as const;

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DatabaseResult<T> = {
  data: T | null;
  error: Error | null;
};

export type DatabaseListResult<T> = {
  data: T[];
  error: Error | null;
};
