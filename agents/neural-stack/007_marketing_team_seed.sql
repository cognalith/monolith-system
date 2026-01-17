-- ============================================================================
-- Phase 6D: Marketing Team Seeding
-- ============================================================================
--
-- This migration seeds the complete Marketing Team organizational structure:
--   1. Marketing Team record in monolith_teams
--   2. CMO as team lead with updated hierarchy
--   3. 4 subordinate agents (content_lead, social_media_lead, seo_growth_lead, brand_lead)
--   4. Marketing Knowledge Bot configuration
--   5. Agent memory initialization for new agents
--
-- Part of the Neural Stack Phase 6D implementation.
-- ============================================================================

-- ============================================================================
-- 1. INSERT/UPDATE MARKETING TEAM RECORD
-- ============================================================================

INSERT INTO monolith_teams (team_id, team_name, team_lead_role)
VALUES ('marketing', 'Marketing Team', 'cmo')
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  team_lead_role = EXCLUDED.team_lead_role,
  updated_at = NOW();

-- ============================================================================
-- 2. UPDATE CMO WITH TEAM RELATIONSHIP
-- ============================================================================

UPDATE monolith_agents
SET
  team_id = 'marketing',
  is_team_lead = true,
  reports_to = 'cos',
  updated_at = NOW()
WHERE role = 'cmo';

-- ============================================================================
-- 3. INSERT 4 SUBORDINATE AGENTS
-- ============================================================================

-- 3.1 Content Lead
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
  'content_lead',
  'marketing',
  false,
  'cmo',
  false,
  '{
    "identity": "Content Lead",
    "purpose": "Lead content strategy and creation, ensuring high-quality written content across all channels that drives engagement and conversions",
    "authority_level": "team_member",
    "specialty": "Content Strategy, Copywriting, Blog, Email Marketing"
  }'::jsonb,
  '{
    "core": ["browser", "canva", "grammarly", "notion"],
    "optional": ["wordpress", "medium", "substack", "mailchimp", "convertkit"],
    "restricted": ["Brand identity changes", "SEO technical implementation", "Paid advertising spend"]
  }'::jsonb,
  '{
    "base": "Expert in content marketing strategy, long-form copywriting, blog SEO optimization, and email marketing campaigns. Responsible for creating compelling narratives that resonate with target audiences, developing content calendars, and optimizing content for search and engagement. Skilled in lead magnet creation, drip campaigns, and content repurposing across channels.",
    "standard": "Follow brand voice guidelines, implement SEO best practices in all content, maintain editorial calendar, ensure content accessibility, and track content performance metrics.",
    "amendments": []
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model_id": "claude-sonnet-4-20250514",
    "temperature": 0.5,
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

-- 3.2 Social Media Lead
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
  'social_media_lead',
  'marketing',
  false,
  'cmo',
  false,
  '{
    "identity": "Social Media Lead",
    "purpose": "Lead social media strategy and community management, building engaged audiences and driving brand awareness across all social platforms",
    "authority_level": "team_member",
    "specialty": "Social Media Strategy, Community Management, Scheduling"
  }'::jsonb,
  '{
    "core": ["browser", "buffer", "canva", "analytics"],
    "optional": ["hootsuite", "sprout_social", "later", "discord", "slack"],
    "restricted": ["Brand identity changes", "Paid social advertising", "Crisis communications without approval"]
  }'::jsonb,
  '{
    "base": "Expert in social media marketing strategy, platform-specific content optimization, and community building. Responsible for understanding social algorithms, creating viral content, managing community engagement, and scheduling posts for optimal reach. Skilled in social listening, influencer coordination, and real-time engagement tactics.",
    "standard": "Maintain consistent posting schedule, respond to community within SLA, follow platform-specific best practices, track engagement metrics, and escalate potential PR issues immediately.",
    "amendments": []
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model_id": "claude-sonnet-4-20250514",
    "temperature": 0.5,
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

-- 3.3 SEO & Growth Lead
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
  'seo_growth_lead',
  'marketing',
  false,
  'cmo',
  false,
  '{
    "identity": "SEO & Growth Lead",
    "purpose": "Lead SEO strategy and growth initiatives, driving organic traffic and optimizing conversion funnels for maximum business impact",
    "authority_level": "team_member",
    "specialty": "SEO, SEM, Growth Hacking, Analytics, CRO"
  }'::jsonb,
  '{
    "core": ["browser", "google_search_console", "google_analytics", "ahrefs"],
    "optional": ["semrush", "screaming_frog", "hotjar", "optimizely", "google_ads"],
    "restricted": ["Brand messaging changes", "Social media publishing", "Direct content creation"]
  }'::jsonb,
  '{
    "base": "Expert in technical SEO, keyword research, link building strategies, and conversion rate optimization. Responsible for improving organic search visibility, conducting comprehensive SEO audits, implementing structured data, and optimizing landing pages for conversions. Skilled in A/B testing, funnel analysis, growth experiments, and performance marketing analytics.",
    "standard": "Follow white-hat SEO practices only, maintain keyword tracking, submit regular performance reports, conduct monthly technical audits, and document all growth experiments with results.",
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

-- 3.4 Brand Lead
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
  'brand_lead',
  'marketing',
  false,
  'cmo',
  false,
  '{
    "identity": "Brand Lead",
    "purpose": "Lead brand identity and visual design systems, ensuring consistent and compelling brand expression across all touchpoints",
    "authority_level": "team_member",
    "specialty": "Brand Identity, Design Systems, Visual Guidelines"
  }'::jsonb,
  '{
    "core": ["browser", "canva", "figma"],
    "optional": ["adobe_creative_suite", "sketch", "brand_folder", "frontify"],
    "restricted": ["Marketing campaign execution", "SEO implementation", "Direct customer communications"]
  }'::jsonb,
  '{
    "base": "Expert in brand identity development, visual design systems, and brand guidelines creation. Responsible for maintaining brand consistency, developing style guides, creating visual assets, and ensuring brand integrity across all channels. Skilled in logo systems, typography selection, color theory, and brand voice documentation.",
    "standard": "Maintain brand style guide, review all visual assets for brand compliance, update brand guidelines quarterly, conduct brand audits, and provide brand training resources.",
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

-- ============================================================================
-- 4. INSERT/UPDATE MARKETING KNOWLEDGE BOT
-- ============================================================================

INSERT INTO monolith_knowledge_bots (role, team_id, reports_to, research_focus, subordinate_specialties)
VALUES (
  'marketing_knowledge_bot',
  'marketing',
  'cmo',
  '["content marketing", "social media", "SEO", "brand strategy", "growth hacking"]'::jsonb,
  '{
    "content_lead": ["Content Strategy", "Copywriting", "Blog SEO", "Email Marketing", "Lead Magnets"],
    "social_media_lead": ["Social Algorithms", "Community Management", "Viral Content", "Engagement"],
    "seo_growth_lead": ["Technical SEO", "Keyword Research", "Link Building", "Conversion Rate"],
    "brand_lead": ["Brand Identity", "Visual Design", "Brand Voice", "Style Guides"]
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
  ('content_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('social_media_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('seo_growth_lead', 'v1.0.0', 'INSUFFICIENT_DATA'),
  ('brand_lead', 'v1.0.0', 'INSUFFICIENT_DATA')
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
--   - Marketing Team record created/updated in monolith_teams
--   - CMO updated as team lead reporting to CoS
--   - 4 subordinate agents created with full persona, skills, knowledge, model_config
--   - Marketing Knowledge Bot configured with subordinate specialties
--   - Agent memory initialized for all new subordinate roles
--
-- Next steps:
--   1. Run this migration against Supabase
--   2. Verify team hierarchy with: SELECT role, team_id, reports_to, is_team_lead FROM monolith_agents WHERE team_id = 'marketing';
--   3. Implement agent TypeScript classes in agents/roles/marketing/
-- ============================================================================
