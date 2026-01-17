-- ============================================================================
-- TEAM HIERARCHY SCHEMA - Phase 6A Migration
-- Cognalith Inc. | Monolith System
--
-- This migration creates the data foundation for Team Lead review cycles
-- and team hierarchy management as defined in Phase 6A.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TEAM REVIEWS TABLE
-- Records of Team Lead review cycles for subordinates
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_team_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Team identification
    team_id TEXT NOT NULL,  -- 'executive', 'technology', 'operations', etc.
    team_lead_role TEXT NOT NULL,  -- Role of the Team Lead conducting review
    subordinate_role TEXT NOT NULL,  -- Role being reviewed

    -- Review timing
    review_date TIMESTAMPTZ DEFAULT NOW(),

    -- Performance snapshot at review time
    trend_direction TEXT,  -- 'improving', 'stable', 'declining'
    variance_at_review NUMERIC(10,4),  -- Avg variance at time of review
    tasks_analyzed INTEGER DEFAULT 0,  -- Number of tasks analyzed

    -- Amendment tracking
    amendment_generated BOOLEAN DEFAULT false,
    amendment_id UUID,  -- References monolith_amendments(id) if generated

    -- Escalation tracking
    escalated_to_cos BOOLEAN DEFAULT false,
    escalation_reason TEXT,

    -- Review notes and context
    review_notes TEXT,
    review_type TEXT DEFAULT 'scheduled',  -- 'scheduled', 'manual', 'triggered'

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign key to amendments (if exists)
    CONSTRAINT fk_amendment
        FOREIGN KEY (amendment_id)
        REFERENCES monolith_amendments(id)
        ON DELETE SET NULL
);

-- Indexes for team review queries
CREATE INDEX IF NOT EXISTS idx_team_reviews_team_id ON monolith_team_reviews(team_id);
CREATE INDEX IF NOT EXISTS idx_team_reviews_team_lead ON monolith_team_reviews(team_lead_role);
CREATE INDEX IF NOT EXISTS idx_team_reviews_subordinate ON monolith_team_reviews(subordinate_role);
CREATE INDEX IF NOT EXISTS idx_team_reviews_date ON monolith_team_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_team_reviews_team_date ON monolith_team_reviews(team_id, review_date);
CREATE INDEX IF NOT EXISTS idx_team_reviews_escalated ON monolith_team_reviews(escalated_to_cos);

-- ============================================================================
-- TEAM CONFIGURATION TABLE
-- Stores team hierarchy configuration (allows dynamic updates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_team_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    team_id TEXT UNIQUE NOT NULL,
    team_name TEXT NOT NULL,
    team_lead_role TEXT NOT NULL,
    subordinates JSONB DEFAULT '[]'::jsonb,  -- Array of subordinate role IDs
    knowledge_bot_id TEXT,
    description TEXT,

    -- Configuration flags
    is_active BOOLEAN DEFAULT true,
    auto_review_enabled BOOLEAN DEFAULT true,
    review_frequency_days INTEGER DEFAULT 7,  -- Days between automatic reviews

    -- Thresholds
    variance_alert_threshold NUMERIC(5,2) DEFAULT 15.0,  -- Variance % to trigger alert
    escalation_threshold NUMERIC(5,2) DEFAULT 25.0,  -- Variance % to escalate to CoS

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for team config lookups
CREATE INDEX IF NOT EXISTS idx_team_config_team_id ON monolith_team_config(team_id);
CREATE INDEX IF NOT EXISTS idx_team_config_lead ON monolith_team_config(team_lead_role);
CREATE INDEX IF NOT EXISTS idx_team_config_active ON monolith_team_config(is_active);

-- ============================================================================
-- KNOWLEDGE BOT TABLE
-- Team-specific knowledge assistants
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_knowledge_bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    bot_id TEXT UNIQUE NOT NULL,  -- e.g., 'tech-kb', 'finance-kb'
    team_id TEXT NOT NULL,
    bot_name TEXT NOT NULL,
    description TEXT,

    -- Knowledge configuration
    knowledge_domains JSONB DEFAULT '[]'::jsonb,  -- Array of domain strings
    system_prompt TEXT,  -- Custom system prompt for the KB

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_query_at TIMESTAMPTZ,
    total_queries INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for knowledge bot lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_bots_team ON monolith_knowledge_bots(team_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bots_active ON monolith_knowledge_bots(is_active);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE monolith_team_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_team_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_knowledge_bots ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for anon access (adjust for production)
CREATE POLICY "Allow all for team_reviews" ON monolith_team_reviews FOR ALL USING (true);
CREATE POLICY "Allow all for team_config" ON monolith_team_config FOR ALL USING (true);
CREATE POLICY "Allow all for knowledge_bots" ON monolith_knowledge_bots FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON monolith_team_reviews TO anon, authenticated;
GRANT ALL ON monolith_team_config TO anon, authenticated;
GRANT ALL ON monolith_knowledge_bots TO anon, authenticated;

-- ============================================================================
-- INITIALIZE DEFAULT TEAM CONFIGURATIONS
-- ============================================================================
INSERT INTO monolith_team_config (team_id, team_name, team_lead_role, subordinates, knowledge_bot_id, description)
VALUES
    ('executive', 'Executive Team', 'ceo', '["cfo", "coo", "cto", "cmo", "chro", "ciso", "clo"]'::jsonb, 'executive-kb', 'C-Suite executives reporting directly to CEO'),
    ('technology', 'Technology Team', 'cto', '["devops", "data", "qa", "ciso"]'::jsonb, 'tech-kb', 'Technology, infrastructure, and security teams'),
    ('operations', 'Operations Team', 'coo', '["cos", "cpo", "cco"]'::jsonb, 'ops-kb', 'Operations, product, and compliance teams'),
    ('finance', 'Finance Team', 'cfo', '["cro"]'::jsonb, 'finance-kb', 'Finance and revenue teams'),
    ('marketing', 'Marketing Team', 'cmo', '[]'::jsonb, 'marketing-kb', 'Marketing and communications teams'),
    ('hr', 'Human Resources Team', 'chro', '[]'::jsonb, 'hr-kb', 'Human resources and talent teams')
ON CONFLICT (team_id) DO UPDATE SET
    team_name = EXCLUDED.team_name,
    team_lead_role = EXCLUDED.team_lead_role,
    subordinates = EXCLUDED.subordinates,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- INITIALIZE KNOWLEDGE BOTS
-- ============================================================================
INSERT INTO monolith_knowledge_bots (bot_id, team_id, bot_name, description, knowledge_domains)
VALUES
    ('executive-kb', 'executive', 'Executive Knowledge Bot', 'Strategic and executive decision support', '["strategy", "leadership", "governance", "board_relations"]'::jsonb),
    ('tech-kb', 'technology', 'Technology Knowledge Bot', 'Technical architecture and engineering support', '["architecture", "devops", "security", "data_engineering", "quality_assurance"]'::jsonb),
    ('ops-kb', 'operations', 'Operations Knowledge Bot', 'Operational excellence and process support', '["process_optimization", "compliance", "product_management", "project_management"]'::jsonb),
    ('finance-kb', 'finance', 'Finance Knowledge Bot', 'Financial planning and analysis support', '["financial_planning", "revenue_operations", "budgeting", "forecasting"]'::jsonb),
    ('marketing-kb', 'marketing', 'Marketing Knowledge Bot', 'Marketing strategy and campaign support', '["brand_strategy", "content_marketing", "demand_generation", "analytics"]'::jsonb),
    ('hr-kb', 'hr', 'HR Knowledge Bot', 'Human resources and talent management support', '["talent_acquisition", "employee_relations", "compensation", "learning_development"]'::jsonb)
ON CONFLICT (bot_id) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    bot_name = EXCLUDED.bot_name,
    description = EXCLUDED.description,
    knowledge_domains = EXCLUDED.knowledge_domains,
    updated_at = NOW();

-- ============================================================================
-- UPDATE TRIGGER FOR TIMESTAMPS
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_team_reviews ON monolith_team_reviews;
CREATE TRIGGER trigger_update_team_reviews
    BEFORE UPDATE ON monolith_team_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_team_config ON monolith_team_config;
CREATE TRIGGER trigger_update_team_config
    BEFORE UPDATE ON monolith_team_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_knowledge_bots ON monolith_knowledge_bots;
CREATE TRIGGER trigger_update_knowledge_bots
    BEFORE UPDATE ON monolith_knowledge_bots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE monolith_team_reviews IS 'Records of Team Lead review cycles for subordinate performance monitoring.';
COMMENT ON TABLE monolith_team_config IS 'Team hierarchy configuration including subordinates and review settings.';
COMMENT ON TABLE monolith_knowledge_bots IS 'Team-specific knowledge assistants for domain expertise.';
