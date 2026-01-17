-- ============================================================================
-- Phase 6G: Finance Team Seeding
-- ============================================================================
--
-- This migration seeds the complete Finance Team organizational structure:
--   1. Finance Team record in monolith_teams
--   2. CFO as team lead with updated hierarchy
--   3. 2 subordinate agents (expense_tracking_lead, revenue_analytics_lead)
--   4. Finance Knowledge Bot configuration
--   5. Agent memory initialization for new agents
--
-- Part of the Neural Stack Phase 6G implementation.
-- ============================================================================

-- ============================================================================
-- 1. INSERT/UPDATE FINANCE TEAM RECORD
-- ============================================================================

INSERT INTO monolith_teams (team_id, team_name, team_lead_role)
VALUES ('finance', 'Finance Team', 'cfo')
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  team_lead_role = EXCLUDED.team_lead_role,
  updated_at = NOW();

-- ============================================================================
-- 2. UPDATE CFO WITH TEAM RELATIONSHIP
-- ============================================================================

UPDATE monolith_agents
SET
  team_id = 'finance',
  is_team_lead = true,
  reports_to = 'cos',
  updated_at = NOW()
WHERE role = 'cfo';

-- ============================================================================
-- 3. INSERT 2 SUBORDINATE AGENTS
-- ============================================================================

-- 3.1 Expense Tracking Lead
INSERT INTO monolith_agents (
  role,
  team_id,
  is_team_lead,
  reports_to,
  is_knowledge_bot,
  persona,
  skills,
  knowledge,
  model_config
)
VALUES (
  'expense_tracking_lead',
  'finance',
  false,
  'cfo',
  false,
  '{
    "identity": "Expense Tracking Lead",
    "purpose": "Manage expense tracking, budget monitoring, cost analysis, and spend optimization to ensure financial efficiency and compliance",
    "authority_level": "team_member",
    "specialty": "Expense Management, Budget Tracking, Cost Analysis, Spend Optimization"
  }'::jsonb,
  '{
    "core": ["browser", "notion", "excel", "quickbooks"],
    "optional": ["expensify", "concur", "ramp", "brex"],
    "restricted": ["Revenue forecasting", "Investment decisions", "Audit finalization"]
  }'::jsonb,
  '{
    "base": "Expert in expense management, budget tracking, and cost optimization. Responsible for expense categorization, budget variance analysis, cost center management, spend optimization initiatives, and expense policy enforcement. Skilled in vendor spend analysis, contract cost tracking, subscription management, and identifying cost reduction opportunities.",
    "standard": "Maintain accurate expense records with proper categorization, monitor budget vs actual on weekly basis, flag variances exceeding 10%, document all cost optimization recommendations, and report expense metrics monthly to CFO.",
    "amendments": []
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model_id": "claude-sonnet-4-20250514",
    "temperature": 0.2,
    "max_tokens": 4096
  }'::jsonb
)
ON CONFLICT (role) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  is_team_lead = EXCLUDED.is_team_lead,
  reports_to = EXCLUDED.reports_to,
  is_knowledge_bot = EXCLUDED.is_knowledge_bot,
  persona = EXCLUDED.persona,
  skills = EXCLUDED.skills,
  knowledge = EXCLUDED.knowledge,
  model_config = EXCLUDED.model_config,
  updated_at = NOW();

-- 3.2 Revenue Analytics Lead
INSERT INTO monolith_agents (
  role,
  team_id,
  is_team_lead,
  reports_to,
  is_knowledge_bot,
  persona,
  skills,
  knowledge,
  model_config
)
VALUES (
  'revenue_analytics_lead',
  'finance',
  false,
  'cfo',
  false,
  '{
    "identity": "Revenue Analytics Lead",
    "purpose": "Lead revenue analytics, financial modeling, KPI tracking, and profitability analysis to drive data-driven financial decisions",
    "authority_level": "team_member",
    "specialty": "Revenue Forecasting, Financial Modeling, KPI Tracking, Profitability Analysis"
  }'::jsonb,
  '{
    "core": ["browser", "notion", "excel", "stripe", "analytics"],
    "optional": ["tableau", "looker", "metabase", "powerbi"],
    "restricted": ["Expense approval", "Budget allocation", "Vendor contracts"]
  }'::jsonb,
  '{
    "base": "Expert in revenue analytics, financial modeling, and SaaS metrics. Responsible for MRR/ARR tracking, revenue forecasting, cohort analysis, customer lifetime value calculations, and profitability analysis. Skilled in building financial models, scenario planning, sensitivity analysis, and identifying revenue optimization opportunities.",
    "standard": "Maintain accurate revenue dashboards updated daily, provide weekly KPI reports, conduct monthly cohort analysis, update forecasts quarterly, and alert CFO to any revenue anomalies or significant trend changes immediately.",
    "amendments": []
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model_id": "claude-sonnet-4-20250514",
    "temperature": 0.2,
    "max_tokens": 4096
  }'::jsonb
)
ON CONFLICT (role) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  is_team_lead = EXCLUDED.is_team_lead,
  reports_to = EXCLUDED.reports_to,
  is_knowledge_bot = EXCLUDED.is_knowledge_bot,
  persona = EXCLUDED.persona,
  skills = EXCLUDED.skills,
  knowledge = EXCLUDED.knowledge,
  model_config = EXCLUDED.model_config,
  updated_at = NOW();

-- ============================================================================
-- 4. INSERT/UPDATE FINANCE KNOWLEDGE BOT
-- ============================================================================

INSERT INTO monolith_knowledge_bots (role, team_id, reports_to, research_focus, subordinate_specialties)
VALUES (
  'finance_knowledge_bot',
  'finance',
  'cfo',
  '["expense management", "revenue analytics", "financial forecasting", "budget optimization"]'::jsonb,
  '{
    "expense_tracking_lead": ["Expense Categorization", "Budget Variance Analysis", "Cost Center Optimization", "Spend Analytics"],
    "revenue_analytics_lead": ["Revenue Forecasting", "Financial Modeling", "SaaS Metrics", "Profitability Analysis"]
  }'::jsonb
)
ON CONFLICT (role) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  reports_to = EXCLUDED.reports_to,
  research_focus = EXCLUDED.research_focus,
  subordinate_specialties = EXCLUDED.subordinate_specialties,
  updated_at = NOW();

-- ============================================================================
-- 5. INITIALIZE AGENT MEMORY FOR NEW AGENTS
-- ============================================================================

INSERT INTO monolith_agent_memory (agent_role, knowledge_version, current_trend)
VALUES
  ('expense_tracking_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('revenue_analytics_lead', 'v1.0.0', 'INSUFFICIENT_DATA')
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
--   - Finance Team record created/updated in monolith_teams
--   - CFO updated as team lead reporting to CoS
--   - 2 subordinate agents created with full persona, skills, knowledge, model_config
--   - Finance Knowledge Bot configured with subordinate specialties
--   - Agent memory initialized for all new subordinate roles
--
-- Next steps:
--   1. Run this migration against Supabase
--   2. Verify team hierarchy with: SELECT role, team_id, reports_to, is_team_lead FROM monolith_agents WHERE team_id = 'finance';
--   3. Implement agent TypeScript classes in agents/roles/finance/
-- ============================================================================
