/**
 * AUTHORIZATION ESCALATION FRAMEWORK - Type Definitions
 * Cognalith Inc. | Monolith System - Phase 5B
 *
 * Non-negotiable financial safety layer. These types are HARDCODED.
 * No agent can escalate its own authority. No amendment can modify
 * Financial Escalation triggers.
 */

import type { AgentRole } from './types';

// ============================================================================
// ESCALATION TIERS
// ============================================================================

export type EscalationTier =
  | 'TIER_0_ROUTINE'    // Config, settings, read-only — full autonomy
  | 'TIER_1_SENSITIVE'  // Free API keys, integrations — autonomy + logging
  | 'TIER_2_FINANCIAL'  // Payments, subscriptions — prepare only, Frank authenticates
  | 'TIER_3_STRATEGIC'; // New vendors, >$100, annual commits — recommend only, Frank decides

export type TriggerType =
  | 'payment_form'
  | 'subscription'
  | 'oauth_new_service'
  | 'cloud_provision'
  | 'api_key_billing'
  | 'strategic_decision'
  | 'cost_threshold'
  | 'new_vendor';

export type FrankDecision = 'APPROVED' | 'DENIED' | 'MODIFIED' | 'DEFERRED';

export type EscalationOutcome = 'COMPLETED' | 'CANCELLED' | 'PARTIAL' | 'FAILED';

export type CostFrequency = 'one-time' | 'monthly' | 'annual';

// ============================================================================
// ESCALATION REQUEST/RESPONSE INTERFACES
// ============================================================================

export interface EscalationTrigger {
  type: TriggerType;
  url?: string;
  pattern_matched?: string;
  screenshot_path?: string;  // Playwright screenshot of current state
}

export interface EscalationCostEstimate {
  action: string;            // "Subscribe to Railway Pro plan"
  cost_estimate?: number;    // In CAD
  cost_frequency?: CostFrequency;
  vendor?: string;
}

export interface MonaRecommendation {
  should_proceed: boolean;
  reasoning: string;
  alternatives?: string[];   // Cheaper options MonA found
}

export interface EscalationRequest {
  task_id: string;
  agent_role: AgentRole;
  tier: EscalationTier;
  trigger: EscalationTrigger;
  request: EscalationCostEstimate;
  mona_recommendation: MonaRecommendation;
}

export interface EscalationResponse {
  decision: FrankDecision;
  notes?: string;
  modified_action?: string;    // If Frank changes the plan
  resume_instructions?: string; // What MonA should do after auth
}

// ============================================================================
// DATABASE RECORD INTERFACES
// ============================================================================

export interface EscalationLogRecord {
  id: string;
  task_id: string | null;
  agent_role: AgentRole;
  escalation_tier: EscalationTier;

  // Trigger details
  trigger_type: TriggerType;
  trigger_url: string | null;
  trigger_pattern: string | null;
  screenshot_path: string | null;

  // MonA's preparation
  action_requested: string;
  vendor: string | null;
  cost_estimate_cad: number | null;
  cost_frequency: CostFrequency | null;
  mona_recommendation: string | null;
  mona_should_proceed: boolean | null;
  mona_alternatives: string[] | null;
  mona_prepared_at: string;

  // Frank's decision
  frank_decision: FrankDecision | null;
  frank_notes: string | null;
  frank_modified_action: string | null;
  frank_resume_instructions: string | null;
  frank_decided_at: string | null;

  // Outcome
  outcome: EscalationOutcome | null;
  outcome_notes: string | null;
  completed_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface EscalationLogInsert {
  task_id?: string;
  agent_role: AgentRole;
  escalation_tier: EscalationTier;
  trigger_type: TriggerType;
  trigger_url?: string;
  trigger_pattern?: string;
  screenshot_path?: string;
  action_requested: string;
  vendor?: string;
  cost_estimate_cad?: number;
  cost_frequency?: CostFrequency;
  mona_recommendation?: string;
  mona_should_proceed?: boolean;
  mona_alternatives?: string[];
}

export interface EscalationLogUpdate {
  frank_decision?: FrankDecision;
  frank_notes?: string;
  frank_modified_action?: string;
  frank_resume_instructions?: string;
  frank_decided_at?: string;
  outcome?: EscalationOutcome;
  outcome_notes?: string;
  completed_at?: string;
}

// ============================================================================
// MODEL CONFIGURATION INTERFACES
// ============================================================================

export type ModelProvider = 'anthropic' | 'openai' | 'google';

export interface ModelConfig {
  provider: ModelProvider;
  model_id: string;
  extended_thinking: boolean;
  temperature: number;
  max_tokens: number;
}

export interface AgentConfig {
  id: string;
  agent_role: AgentRole;
  provider: ModelProvider;
  model_id: string;
  extended_thinking: boolean;
  temperature: number;
  max_tokens: number;
  experiment_group: string | null;
  experiment_config: Record<string, unknown>;
  monthly_token_budget: number | null;
  tokens_used_this_month: number;
  budget_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentConfigUpdate {
  provider?: ModelProvider;
  model_id?: string;
  extended_thinking?: boolean;
  temperature?: number;
  max_tokens?: number;
  experiment_group?: string;
  experiment_config?: Record<string, unknown>;
  monthly_token_budget?: number;
  tokens_used_this_month?: number;
  budget_reset_at?: string;
}

// ============================================================================
// MONTHLY SPEND VIEW TYPE
// ============================================================================

export interface MonthlyEscalationSpend {
  month: string;
  total_escalations: number;
  approved_count: number;
  denied_count: number;
  approved_spend_cad: number | null;
  monthly_recurring_cad: number | null;
  annual_committed_cad: number | null;
}

// ============================================================================
// FINANCIAL ESCALATION TRIGGERS (HARDCODED - NOT CONFIGURABLE)
// ============================================================================

export const FINANCIAL_ESCALATION_TRIGGERS = {
  // URL patterns that trigger escalation
  URL_PATTERNS: [
    /checkout/i,
    /billing/i,
    /subscribe/i,
    /payment/i,
    /upgrade/i,
    /pricing/i,
    /cart/i,
    /purchase/i,
  ] as const,

  // Form field patterns
  FORM_PATTERNS: [
    /credit.?card/i,
    /card.?number/i,
    /cvv/i,
    /cvc/i,
    /expir/i,
    /billing.?address/i,
    /payment.?method/i,
  ] as const,

  // Button/action patterns
  ACTION_PATTERNS: [
    /purchase/i,
    /buy.?now/i,
    /start.?trial/i,
    /upgrade.?plan/i,
    /add.?to.?cart/i,
    /complete.?order/i,
    /confirm.?payment/i,
    /place.?order/i,
  ] as const,

  // Cloud provisioning patterns
  CLOUD_PATTERNS: [
    /create.?instance/i,
    /launch/i,
    /provision/i,
    /deploy/i,
    /spin.?up/i,
    /start.?cluster/i,
  ] as const,

  // API/Auth with potential billing
  API_PATTERNS: [
    /generate.?api.?key/i,
    /create.?token/i,
    /oauth/i,
    /authorize/i,
    /connect.?account/i,
  ] as const,

  // Cost keywords
  COST_KEYWORDS: [
    '$',
    'USD',
    'CAD',
    '/month',
    '/year',
    '/mo',
    '/yr',
    'billed',
    'invoice',
    'per seat',
    'per user',
  ] as const,
} as const;

// ============================================================================
// TIER DETERMINATION HELPERS
// ============================================================================

export function determineTier(
  triggerType: TriggerType,
  costEstimate?: number,
  isNewVendor?: boolean,
  isAnnualCommit?: boolean
): EscalationTier {
  // Strategic tier: >$100, annual commits, new vendors
  if (
    (costEstimate && costEstimate > 100) ||
    isAnnualCommit ||
    isNewVendor
  ) {
    return 'TIER_3_STRATEGIC';
  }

  // Financial tier: any payment/subscription
  if (
    triggerType === 'payment_form' ||
    triggerType === 'subscription' ||
    triggerType === 'cloud_provision'
  ) {
    return 'TIER_2_FINANCIAL';
  }

  // Sensitive tier: OAuth, API keys that might have billing
  if (
    triggerType === 'oauth_new_service' ||
    triggerType === 'api_key_billing'
  ) {
    return 'TIER_1_SENSITIVE';
  }

  // Routine: everything else
  return 'TIER_0_ROUTINE';
}

// ============================================================================
// TABLE NAME
// ============================================================================

export const ESCALATION_TABLES = {
  escalationLog: 'monolith_escalation_log',
  agentConfig: 'monolith_agent_config',
  monthlySpendView: 'monolith_monthly_escalation_spend',
} as const;
