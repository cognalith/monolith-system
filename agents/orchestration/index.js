/**
 * MONOLITH OS - Orchestration Module
 * Phase 7: Task Orchestration Engine
 *
 * Centralized exports for the orchestration system components.
 */

// Task Router exports
export {
  TaskRouter,
  DEFAULT_ROUTING_RULES,
  TEAM_LEADS,
  AGENT_TO_TEAM,
  MAX_ACTIVE_PER_AGENT,
  MAX_QUEUED_PER_AGENT,
} from './TaskRouter.js';

// Execution Engine exports
export {
  ExecutionEngine,
  TASK_STATES,
  BLOCKER_TYPES,
  POLL_INTERVAL,
  MAX_RETRY_COUNT,
  TASK_QUEUE_TABLE,
} from './ExecutionEngine.js';

// Resolution System exports
export {
  ResolutionSystem,
  ESCALATION_TYPES,
  AUTO_ESCALATE_AFTER_HOURS,
  DEPENDENCY_RESOLVER_INTERVAL,
  AUTO_ESCALATION_INTERVAL,
  TASK_DEPENDENCIES_TABLE,
  CEO_DECISIONS_TABLE,
} from './ResolutionSystem.js';

// Re-export defaults
import TaskRouterDefault from './TaskRouter.js';
import ExecutionEngineDefault from './ExecutionEngine.js';
import ResolutionSystemDefault from './ResolutionSystem.js';
export { TaskRouterDefault, ExecutionEngineDefault, ResolutionSystemDefault };
