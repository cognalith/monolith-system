-- ============================================================================
-- Phase 6A: Team Hierarchy Schema Migration
-- ============================================================================
--
-- This migration introduces team-based organizational structure to support:
-- - Team groupings (tech, marketing, product, operations, finance, people)
-- - Reporting relationships (reports_to hierarchy)
-- - Team lead designation and knowledge bot flags
-- - Team lead review tracking for performance oversight
--
-- Part of the Neural Stack architecture for the Monolith System.
-- ============================================================================

-- ============================================================================
-- 1. MONOLITH_TEAMS TABLE
-- ============================================================================
-- Core table for defining organizational teams

CREATE TABLE IF NOT EXISTS monolith_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,        -- 'tech', 'marketing', 'product', etc.
  team_name TEXT NOT NULL,             -- 'Technology Team'
  team_lead_role TEXT NOT NULL,        -- 'cto', 'cmo', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast team lookups
CREATE INDEX IF NOT EXISTS idx_monolith_teams_team_id ON monolith_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_monolith_teams_team_lead ON monolith_teams(team_lead_role);

-- ============================================================================
-- 2. AGENT TABLE UPDATES
-- ============================================================================
-- Add hierarchy and team membership columns to existing agents table

ALTER TABLE monolith_agents ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES monolith_teams(team_id);
ALTER TABLE monolith_agents ADD COLUMN IF NOT EXISTS reports_to TEXT;
ALTER TABLE monolith_agents ADD COLUMN IF NOT EXISTS is_team_lead BOOLEAN DEFAULT FALSE;
ALTER TABLE monolith_agents ADD COLUMN IF NOT EXISTS is_knowledge_bot BOOLEAN DEFAULT FALSE;

-- Indexes for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_monolith_agents_team_id ON monolith_agents(team_id);
CREATE INDEX IF NOT EXISTS idx_monolith_agents_reports_to ON monolith_agents(reports_to);
CREATE INDEX IF NOT EXISTS idx_monolith_agents_is_team_lead ON monolith_agents(is_team_lead) WHERE is_team_lead = TRUE;
CREATE INDEX IF NOT EXISTS idx_monolith_agents_is_knowledge_bot ON monolith_agents(is_knowledge_bot) WHERE is_knowledge_bot = TRUE;

-- ============================================================================
-- 3. TEAM LEAD REVIEWS TABLE
-- ============================================================================
-- Tracks team lead performance reviews of their subordinates

CREATE TABLE IF NOT EXISTS monolith_team_lead_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_lead_role TEXT NOT NULL,
  subordinate_role TEXT NOT NULL,
  review_date DATE NOT NULL,
  tasks_reviewed INTEGER,
  avg_variance_percent NUMERIC,
  trend_direction TEXT,              -- 'IMPROVING', 'STABLE', 'DECLINING'
  trend_slope NUMERIC,
  cos_score_assigned NUMERIC,
  amendment_generated BOOLEAN DEFAULT FALSE,
  amendment_id UUID REFERENCES monolith_amendments(id),
  escalated_to_cos BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for review queries
CREATE INDEX IF NOT EXISTS idx_team_lead_reviews_team_lead ON monolith_team_lead_reviews(team_lead_role);
CREATE INDEX IF NOT EXISTS idx_team_lead_reviews_subordinate ON monolith_team_lead_reviews(subordinate_role);
CREATE INDEX IF NOT EXISTS idx_team_lead_reviews_date ON monolith_team_lead_reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_lead_reviews_escalated ON monolith_team_lead_reviews(escalated_to_cos) WHERE escalated_to_cos = TRUE;
CREATE INDEX IF NOT EXISTS idx_team_lead_reviews_trend ON monolith_team_lead_reviews(trend_direction);

-- Composite index for common query pattern: get recent reviews by team lead
CREATE INDEX IF NOT EXISTS idx_team_lead_reviews_lead_date ON monolith_team_lead_reviews(team_lead_role, review_date DESC);

-- ============================================================================
-- 4. SEED DATA: 6 ORGANIZATIONAL TEAMS
-- ============================================================================

INSERT INTO monolith_teams (team_id, team_name, team_lead_role) VALUES
  ('tech', 'Technology Team', 'cto'),
  ('marketing', 'Marketing Team', 'cmo'),
  ('product', 'Product Team', 'cpo'),
  ('operations', 'Operations Team', 'coo'),
  ('finance', 'Finance Team', 'cfo'),
  ('people', 'People Team', 'chro')
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  team_lead_role = EXCLUDED.team_lead_role,
  updated_at = NOW();

-- ============================================================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================================================
-- Automatically update the updated_at timestamp on monolith_teams

CREATE OR REPLACE FUNCTION update_monolith_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_monolith_teams_updated_at ON monolith_teams;
CREATE TRIGGER trigger_monolith_teams_updated_at
  BEFORE UPDATE ON monolith_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_monolith_teams_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
-- - Created monolith_teams table with 6 seeded teams
-- - Added team_id, reports_to, is_team_lead, is_knowledge_bot to monolith_agents
-- - Created monolith_team_lead_reviews for performance tracking
-- - Added appropriate indexes for query performance
-- - Added trigger for automatic updated_at maintenance
-- ============================================================================
