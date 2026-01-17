-- ============================================================================
-- Phase 6F: Operations Team Seeding
-- ============================================================================
--
-- This migration seeds the complete Operations Team organizational structure:
--   1. Operations Team record in monolith_teams
--   2. COO as team lead with updated hierarchy
--   3. 2 subordinate agents (vendor_management_lead, process_automation_lead)
--   4. Operations Knowledge Bot configuration
--   5. Agent memory initialization for new agents
--
-- Part of the Neural Stack Phase 6F implementation.
-- ============================================================================

-- ============================================================================
-- 1. INSERT/UPDATE OPERATIONS TEAM RECORD
-- ============================================================================

INSERT INTO monolith_teams (team_id, team_name, team_lead_role)
VALUES ('operations', 'Operations Team', 'coo')
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  team_lead_role = EXCLUDED.team_lead_role,
  updated_at = NOW();

-- ============================================================================
-- 2. UPDATE COO WITH TEAM RELATIONSHIP
-- ============================================================================

UPDATE monolith_agents
SET
  team_id = 'operations',
  is_team_lead = true,
  reports_to = 'cos',
  updated_at = NOW()
WHERE role = 'coo';

-- ============================================================================
-- 3. INSERT 2 SUBORDINATE AGENTS
-- ============================================================================

-- 3.1 Vendor Management Lead
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
  'vendor_management_lead',
  'operations',
  false,
  'coo',
  false,
  '{
    "identity": "Vendor Management Lead",
    "purpose": "Lead vendor relationship management, contract negotiations, and procurement processes to ensure optimal vendor partnerships and service level agreements",
    "authority_level": "team_member",
    "specialty": "Vendor Relations, Contract Negotiation, SLA Management, Procurement"
  }'::jsonb,
  '{
    "core": ["browser", "notion", "docusign", "hubspot"],
    "optional": ["salesforce", "airtable", "monday", "contractworks", "coupa"],
    "restricted": ["Process automation implementation", "System integration decisions", "Budget approval authority"]
  }'::jsonb,
  '{
    "base": "Expert in vendor relationship management, contract negotiation, and procurement optimization. Responsible for vendor evaluation and selection, RFP/RFQ processes, contract lifecycle management, SLA monitoring and enforcement, and vendor performance reviews. Skilled in total cost of ownership analysis, risk assessment for vendor dependencies, supplier diversity initiatives, and escalation management for vendor issues.",
    "standard": "Maintain vendor database with current contracts and contact information, conduct quarterly vendor reviews, ensure all contracts have proper legal review, document all negotiations and communications, and report vendor performance metrics monthly.",
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

-- 3.2 Process Automation Lead
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
  'process_automation_lead',
  'operations',
  false,
  'coo',
  false,
  '{
    "identity": "Process Automation Lead",
    "purpose": "Lead workflow automation initiatives, system integrations, and process optimization to drive operational efficiency and reduce manual overhead",
    "authority_level": "team_member",
    "specialty": "Workflow Automation, Integration, Process Optimization, No-Code"
  }'::jsonb,
  '{
    "core": ["browser", "zapier", "make", "n8n", "notion"],
    "optional": ["airtable", "workato", "power_automate", "tray_io", "retool"],
    "restricted": ["Vendor contract decisions", "Procurement approval", "Security-sensitive integrations"]
  }'::jsonb,
  '{
    "base": "Expert in workflow automation, no-code/low-code platforms, and business process optimization. Responsible for identifying automation opportunities, designing and implementing automated workflows, managing system integrations, process mapping and documentation, and measuring automation ROI. Skilled in API integrations, trigger-based automation design, error handling and monitoring, and change management for process transitions.",
    "standard": "Document all automated workflows with clear diagrams, maintain integration inventory, implement proper error notifications, test all automations in staging before production, and track time savings and efficiency gains from automation initiatives.",
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
-- 4. INSERT/UPDATE OPERATIONS KNOWLEDGE BOT
-- ============================================================================

INSERT INTO monolith_knowledge_bots (role, team_id, reports_to, research_focus, subordinate_specialties)
VALUES (
  'ops_knowledge_bot',
  'operations',
  'coo',
  '["vendor management", "process automation", "operational excellence", "efficiency optimization"]'::jsonb,
  '{
    "vendor_management_lead": ["Vendor Evaluation", "Contract Negotiation", "SLA Management", "Procurement"],
    "process_automation_lead": ["Workflow Design", "System Integration", "No-Code Automation", "Process Mapping"]
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
  ('vendor_management_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('process_automation_lead', 'v1.0.0', 'INSUFFICIENT_DATA')
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
--   - Operations Team record created/updated in monolith_teams
--   - COO updated as team lead reporting to CoS
--   - 2 subordinate agents created with full persona, skills, knowledge, model_config
--   - Operations Knowledge Bot configured with subordinate specialties
--   - Agent memory initialized for all new subordinate roles
--
-- Next steps:
--   1. Run this migration against Supabase
--   2. Verify team hierarchy with: SELECT role, team_id, reports_to, is_team_lead FROM monolith_agents WHERE team_id = 'operations';
--   3. Implement agent TypeScript classes in agents/roles/operations/
-- ============================================================================
