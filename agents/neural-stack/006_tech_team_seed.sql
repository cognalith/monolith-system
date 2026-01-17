-- ============================================================================
-- Phase 6C: Tech Team Seeding
-- ============================================================================
--
-- This migration seeds the complete Tech Team organizational structure:
--   1. Tech Team record in monolith_teams
--   2. CTO as team lead with updated hierarchy
--   3. 5 subordinate agents (web_dev_lead, app_dev_lead, devops_lead, qa_lead, infrastructure_lead)
--   4. Tech Knowledge Bot configuration
--   5. Agent memory initialization for new agents
--
-- Part of the Neural Stack Phase 6C implementation.
-- ============================================================================

-- ============================================================================
-- 1. INSERT/UPDATE TECH TEAM RECORD
-- ============================================================================

INSERT INTO monolith_teams (team_id, team_name, team_lead_role)
VALUES ('tech', 'Technology Team', 'cto')
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  team_lead_role = EXCLUDED.team_lead_role,
  updated_at = NOW();

-- ============================================================================
-- 2. UPDATE CTO WITH TEAM RELATIONSHIP
-- ============================================================================

UPDATE monolith_agents
SET
  team_id = 'tech',
  is_team_lead = true,
  reports_to = 'cos',
  updated_at = NOW()
WHERE role = 'cto';

-- ============================================================================
-- 3. INSERT 5 SUBORDINATE AGENTS
-- ============================================================================

-- 3.1 Web Development Lead
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
  'web_dev_lead',
  'tech',
  false,
  'cto',
  false,
  '{
    "identity": "Web Development Lead",
    "purpose": "Lead web development initiatives, ensure modern frontend architecture, and deliver high-quality web applications",
    "authority_level": "team_member",
    "specialty": "Frontend architecture, React ecosystem, web performance optimization"
  }'::jsonb,
  '{
    "core": ["React", "TypeScript", "Vite", "Tailwind CSS", "Next.js", "Web APIs"],
    "optional": ["Vue.js", "Svelte", "GraphQL", "WebSockets", "PWA"],
    "restricted": ["Infrastructure provisioning", "Database administration", "Security policy changes"]
  }'::jsonb,
  '{
    "base": "Expert in modern web development practices, component architecture, and frontend performance optimization. Responsible for web application quality and maintainability.",
    "standard": "Follow established coding standards, implement responsive designs, ensure accessibility compliance (WCAG), and maintain comprehensive test coverage.",
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

-- 3.2 App Development Lead
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
  'app_dev_lead',
  'tech',
  false,
  'cto',
  false,
  '{
    "identity": "App Development Lead",
    "purpose": "Lead mobile and cross-platform application development, ensuring native-quality experiences across iOS and Android",
    "authority_level": "team_member",
    "specialty": "Mobile development, React Native, cross-platform architecture, app store deployment"
  }'::jsonb,
  '{
    "core": ["React Native", "Capacitor", "iOS Development", "Android Development", "EAS Build", "App Store Connect"],
    "optional": ["Flutter", "Swift", "Kotlin", "Expo", "Mobile Analytics"],
    "restricted": ["Infrastructure provisioning", "Web architecture decisions", "Security policy changes"]
  }'::jsonb,
  '{
    "base": "Expert in mobile application development, cross-platform frameworks, and app store optimization. Responsible for mobile app quality and user experience.",
    "standard": "Follow platform-specific guidelines (Apple HIG, Material Design), implement offline-first architecture, ensure app performance optimization, and manage release cycles.",
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

-- 3.3 DevOps Lead
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
  'devops_lead',
  'tech',
  false,
  'cto',
  false,
  '{
    "identity": "DevOps Lead",
    "purpose": "Lead DevOps initiatives, manage CI/CD pipelines, and ensure reliable infrastructure and deployment processes",
    "authority_level": "team_member",
    "specialty": "CI/CD automation, cloud infrastructure, containerization, monitoring and observability"
  }'::jsonb,
  '{
    "core": ["GitHub Actions", "Vercel", "Railway", "Docker", "CI/CD Pipelines", "Monitoring"],
    "optional": ["Kubernetes", "Terraform", "AWS", "GCP", "Prometheus", "Grafana"],
    "restricted": ["Application business logic", "Database schema changes", "Security policy creation"]
  }'::jsonb,
  '{
    "base": "Expert in DevOps practices, infrastructure automation, and deployment pipelines. Responsible for system reliability, deployment efficiency, and infrastructure health.",
    "standard": "Implement infrastructure as code, maintain comprehensive monitoring, ensure zero-downtime deployments, and document all operational procedures.",
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

-- 3.4 QA Lead
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
  'qa_lead',
  'tech',
  false,
  'cto',
  false,
  '{
    "identity": "QA Lead",
    "purpose": "Lead quality assurance initiatives, establish testing strategies, and ensure product quality across all deliverables",
    "authority_level": "team_member",
    "specialty": "Test automation, quality metrics, E2E testing, test strategy and planning"
  }'::jsonb,
  '{
    "core": ["Playwright", "Jest", "E2E Testing", "Test Strategy", "Quality Metrics", "Test Automation"],
    "optional": ["Cypress", "Selenium", "Performance Testing", "Security Testing", "API Testing"],
    "restricted": ["Production deployments", "Infrastructure changes", "Architecture decisions"]
  }'::jsonb,
  '{
    "base": "Expert in quality assurance methodologies, test automation frameworks, and quality metrics. Responsible for ensuring product quality and establishing testing standards.",
    "standard": "Implement comprehensive test coverage, maintain automated test suites, track quality metrics, and establish quality gates for releases.",
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

-- 3.5 Infrastructure Lead
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
  'infrastructure_lead',
  'tech',
  false,
  'cto',
  false,
  '{
    "identity": "Infrastructure Lead",
    "purpose": "Lead IT infrastructure management, ensure security compliance, and maintain organizational technology systems",
    "authority_level": "team_member",
    "specialty": "IT administration, security infrastructure, DNS management, backup systems"
  }'::jsonb,
  '{
    "core": ["Google Workspace", "Security Infrastructure", "DNS Management", "Backup Systems", "IT Administration"],
    "optional": ["Active Directory", "VPN", "Network Security", "Compliance Tools", "Asset Management"],
    "restricted": ["Application development", "Business logic changes", "Financial systems access"]
  }'::jsonb,
  '{
    "base": "Expert in IT infrastructure management, security practices, and organizational technology systems. Responsible for system security, data protection, and IT operations.",
    "standard": "Maintain security compliance, implement backup strategies, manage user access, and ensure infrastructure reliability and security posture.",
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
-- 4. INSERT/UPDATE TECH KNOWLEDGE BOT
-- ============================================================================

INSERT INTO monolith_knowledge_bots (role, team_id, reports_to, research_focus, subordinate_specialties)
VALUES (
  'tech_knowledge_bot',
  'tech',
  'cto',
  '["web development", "mobile development", "DevOps", "QA", "IT security"]'::jsonb,
  '{
    "web_dev_lead": ["React", "TypeScript", "Vite", "Tailwind", "Next.js", "Web Performance"],
    "app_dev_lead": ["React Native", "Capacitor", "iOS", "Android", "EAS", "App Store"],
    "devops_lead": ["GitHub Actions", "Vercel", "Railway", "Docker", "CI/CD", "Monitoring"],
    "qa_lead": ["Playwright", "Jest", "E2E Testing", "Test Strategy", "Quality Metrics"],
    "infrastructure_lead": ["Google Workspace", "Security", "DNS", "Backups", "IT Admin"]
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
  ('web_dev_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('app_dev_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('devops_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('qa_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('infrastructure_lead', 'v1.0.0', 'INSUFFICIENT_DATA')
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
--   - Tech Team record created/updated in monolith_teams
--   - CTO updated as team lead reporting to CoS
--   - 5 subordinate agents created with full persona, skills, knowledge, model_config
--   - Tech Knowledge Bot configured with subordinate specialties
--   - Agent memory initialized for all new subordinate roles
--
-- Next steps:
--   1. Run this migration against Supabase
--   2. Verify team hierarchy with: SELECT role, team_id, reports_to, is_team_lead FROM monolith_agents WHERE team_id = 'tech';
--   3. Implement agent TypeScript classes in agents/roles/tech/
-- ============================================================================
