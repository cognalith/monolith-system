-- ============================================================================
-- Phase 6H: People Team Seeding
-- ============================================================================
--
-- This migration seeds the complete People Team organizational structure:
--   1. People Team record in monolith_teams
--   2. CHRO as team lead with updated hierarchy
--   3. 2 subordinate agents (hiring_lead, compliance_lead)
--   4. People Knowledge Bot configuration
--   5. Agent memory initialization for new agents
--
-- Part of the Neural Stack Phase 6H implementation.
-- ============================================================================

-- ============================================================================
-- 1. INSERT/UPDATE PEOPLE TEAM RECORD
-- ============================================================================

INSERT INTO monolith_teams (team_id, team_name, team_lead_role)
VALUES ('people', 'People Team', 'chro')
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  team_lead_role = EXCLUDED.team_lead_role,
  updated_at = NOW();

-- ============================================================================
-- 2. UPDATE CHRO WITH TEAM RELATIONSHIP
-- ============================================================================

UPDATE monolith_agents
SET
  team_id = 'people',
  is_team_lead = true,
  reports_to = 'cos',
  updated_at = NOW()
WHERE role = 'chro';

-- ============================================================================
-- 3. INSERT 2 SUBORDINATE AGENTS
-- ============================================================================

-- 3.1 Hiring Lead
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
  'hiring_lead',
  'people',
  false,
  'chro',
  false,
  '{
    "identity": "Hiring Lead",
    "purpose": "Lead talent acquisition efforts, manage recruiting processes, screen candidates, and ensure smooth onboarding experiences",
    "authority_level": "team_member",
    "specialty": "Talent Acquisition, Recruiting, Candidate Screening, Onboarding"
  }'::jsonb,
  '{
    "core": ["browser", "notion", "greenhouse", "linkedin_recruiter"],
    "optional": ["lever", "indeed", "workable", "calendly"],
    "restricted": ["Compliance decisions", "Policy enforcement", "Legal matters"]
  }'::jsonb,
  '{
    "base": "Expert in talent acquisition, recruiting processes, and candidate experience. Responsible for job posting and candidate sourcing, resume screening and initial assessments, interview coordination and scheduling, offer management and negotiation support, and new hire onboarding facilitation. Skilled in active sourcing strategies, employer branding, candidate relationship management, and pipeline optimization.",
    "standard": "Maintain accurate ATS records, provide timely candidate communication, conduct structured interviews, document hiring decisions with rationale, and report recruiting metrics weekly.",
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

-- 3.2 Compliance Lead
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
  'compliance_lead',
  'people',
  false,
  'chro',
  false,
  '{
    "identity": "Compliance Lead",
    "purpose": "Ensure HR compliance with labor laws, enforce company policies, maintain workplace safety standards, and manage regulatory requirements",
    "authority_level": "team_member",
    "specialty": "HR Compliance, Policy Enforcement, Labor Law, Workplace Safety"
  }'::jsonb,
  '{
    "core": ["browser", "notion", "docusign", "bamboohr"],
    "optional": ["zenefits", "gusto", "paychex", "compliance_tools"],
    "restricted": ["Hiring decisions", "Compensation changes", "Termination authority"]
  }'::jsonb,
  '{
    "base": "Expert in HR compliance, labor law, and workplace safety regulations. Responsible for employment law compliance monitoring, policy documentation and updates, labor law adherence, workplace safety management, audit preparation and response, and training program compliance. Skilled in EEOC requirements, OSHA compliance, FMLA/ADA administration, I-9 verification, and records management.",
    "standard": "Maintain up-to-date policy documentation, track regulatory changes, conduct compliance audits quarterly, document all compliance activities, and report compliance status monthly.",
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
-- 4. INSERT/UPDATE PEOPLE KNOWLEDGE BOT
-- ============================================================================

INSERT INTO monolith_knowledge_bots (role, team_id, reports_to, research_focus, subordinate_specialties)
VALUES (
  'people_knowledge_bot',
  'people',
  'chro',
  '["hiring best practices", "compliance requirements", "employee engagement", "performance management", "diversity and inclusion", "HR technology trends"]'::jsonb,
  '{
    "hiring_lead": ["Sourcing strategies", "Interview techniques", "Candidate experience", "Offer management", "Onboarding optimization"],
    "compliance_lead": ["Labor law updates", "Policy documentation", "Audit preparation", "Training requirements", "Workplace safety"]
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
  ('hiring_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('compliance_lead', 'v1.0.0', 'INSUFFICIENT_DATA')
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
--   - People Team record created/updated in monolith_teams
--   - CHRO updated as team lead reporting to CoS
--   - 2 subordinate agents created with full persona, skills, knowledge, model_config
--   - People Knowledge Bot configured with subordinate specialties
--   - Agent memory initialized for all new subordinate roles
--
-- Next steps:
--   1. Run this migration against Supabase
--   2. Verify team hierarchy with: SELECT role, team_id, reports_to, is_team_lead FROM monolith_agents WHERE team_id = 'people';
--   3. Implement agent TypeScript classes in agents/roles/people/
-- ============================================================================
