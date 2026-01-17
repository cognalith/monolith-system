-- ============================================================================
-- Phase 6E: Product Team Seeding
-- ============================================================================
--
-- This migration seeds the complete Product Team organizational structure:
--   1. Product Team record in monolith_teams
--   2. CPO as team lead with updated hierarchy
--   3. 3 subordinate agents (ux_research_lead, product_analytics_lead, feature_spec_lead)
--   4. Product Knowledge Bot configuration
--   5. Agent memory initialization for new agents
--
-- Part of the Neural Stack Phase 6E implementation.
-- ============================================================================

-- ============================================================================
-- 1. INSERT/UPDATE PRODUCT TEAM RECORD
-- ============================================================================

INSERT INTO monolith_teams (team_id, team_name, team_lead_role)
VALUES ('product', 'Product Team', 'cpo')
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  team_lead_role = EXCLUDED.team_lead_role,
  updated_at = NOW();

-- ============================================================================
-- 2. UPDATE CPO WITH TEAM RELATIONSHIP
-- ============================================================================

UPDATE monolith_agents
SET
  team_id = 'product',
  is_team_lead = true,
  reports_to = 'cos',
  updated_at = NOW()
WHERE role = 'cpo';

-- ============================================================================
-- 3. INSERT 3 SUBORDINATE AGENTS
-- ============================================================================

-- 3.1 UX Research Lead
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
  'ux_research_lead',
  'product',
  false,
  'cpo',
  false,
  '{
    "identity": "UX Research Lead",
    "purpose": "Lead user experience research initiatives, conduct usability testing, and ensure product decisions are grounded in user insights and validated research",
    "authority_level": "team_member",
    "specialty": "User Research, Usability Testing, Interviews, Personas"
  }'::jsonb,
  '{
    "core": ["browser", "figma", "hotjar", "usertesting"],
    "optional": ["maze", "lookback", "optimal_workshop", "dovetail", "miro"],
    "restricted": ["Product roadmap decisions", "Feature prioritization", "Analytics implementation"]
  }'::jsonb,
  '{
    "base": "Expert in qualitative and quantitative user research methodologies, usability testing protocols, and user persona development. Responsible for conducting user interviews, creating journey maps, running A/B tests for UX decisions, and synthesizing research findings into actionable insights. Skilled in survey design, heuristic evaluation, accessibility testing, and research repository management.",
    "standard": "Follow ethical research practices, obtain proper consent for all studies, maintain research participant database, document all findings in research repository, and present insights with clear recommendations.",
    "amendments": []
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model_id": "claude-sonnet-4-20250514",
    "temperature": 0.4,
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

-- 3.2 Product Analytics Lead
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
  'product_analytics_lead',
  'product',
  false,
  'cpo',
  false,
  '{
    "identity": "Product Analytics Lead",
    "purpose": "Lead product analytics initiatives, establish metrics frameworks, and provide data-driven insights to guide product strategy and feature decisions",
    "authority_level": "team_member",
    "specialty": "Product Analytics, Metrics, A/B Testing, Cohort Analysis"
  }'::jsonb,
  '{
    "core": ["browser", "mixpanel", "amplitude", "google_analytics"],
    "optional": ["segment", "heap", "looker", "tableau", "metabase"],
    "restricted": ["User research methodology", "Feature specification", "UX design decisions"]
  }'::jsonb,
  '{
    "base": "Expert in product analytics implementation, metrics framework design, and data-driven decision making. Responsible for defining key product metrics (KPIs, OKRs), setting up event tracking, conducting cohort analysis, running A/B tests, and building dashboards for product health monitoring. Skilled in funnel analysis, retention analysis, user segmentation, and statistical significance testing.",
    "standard": "Maintain data quality standards, document all tracking implementations, ensure GDPR/privacy compliance in analytics, provide weekly metrics reports, and validate all A/B test results for statistical significance.",
    "amendments": []
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model_id": "claude-sonnet-4-20250514",
    "temperature": 0.3,
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

-- 3.3 Feature Spec Lead
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
  'feature_spec_lead',
  'product',
  false,
  'cpo',
  false,
  '{
    "identity": "Feature Spec Lead",
    "purpose": "Lead feature specification and requirements documentation, ensuring clear product requirements and acceptance criteria for development teams",
    "authority_level": "team_member",
    "specialty": "PRDs, User Stories, Acceptance Criteria, Prioritization"
  }'::jsonb,
  '{
    "core": ["browser", "notion", "linear", "figma"],
    "optional": ["jira", "confluence", "productboard", "aha", "miro"],
    "restricted": ["User research execution", "Analytics implementation", "Development implementation"]
  }'::jsonb,
  '{
    "base": "Expert in product requirements documentation, user story writing, and feature prioritization frameworks. Responsible for creating comprehensive PRDs (Product Requirements Documents), writing clear user stories with acceptance criteria, managing feature backlogs, and collaborating with engineering on technical feasibility. Skilled in RICE/ICE prioritization, story mapping, dependency management, and sprint planning coordination.",
    "standard": "Follow PRD templates, ensure all stories have clear acceptance criteria, maintain updated backlog grooming, document all technical constraints, and coordinate with stakeholders for requirement sign-off.",
    "amendments": []
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model_id": "claude-sonnet-4-20250514",
    "temperature": 0.3,
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
-- 4. INSERT/UPDATE PRODUCT KNOWLEDGE BOT
-- ============================================================================

INSERT INTO monolith_knowledge_bots (role, team_id, reports_to, research_focus, subordinate_specialties)
VALUES (
  'product_knowledge_bot',
  'product',
  'cpo',
  '["user research", "product analytics", "feature specification", "product strategy", "agile methodologies"]'::jsonb,
  '{
    "ux_research_lead": ["User Research", "Usability Testing", "Personas", "Journey Mapping"],
    "product_analytics_lead": ["Product Metrics", "A/B Testing", "Cohort Analysis", "Funnel Analysis"],
    "feature_spec_lead": ["PRD Writing", "User Stories", "Acceptance Criteria", "Prioritization"]
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
  ('ux_research_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('product_analytics_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('feature_spec_lead', 'v1.0.0', 'INSUFFICIENT_DATA')
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
--   - Product Team record created/updated in monolith_teams
--   - CPO updated as team lead reporting to CoS
--   - 3 subordinate agents created with full persona, skills, knowledge, model_config
--   - Product Knowledge Bot configured with subordinate specialties
--   - Agent memory initialized for all new subordinate roles
--
-- Next steps:
--   1. Run this migration against Supabase
--   2. Verify team hierarchy with: SELECT role, team_id, reports_to, is_team_lead FROM monolith_agents WHERE team_id = 'product';
--   3. Implement agent TypeScript classes in agents/roles/product/
-- ============================================================================
