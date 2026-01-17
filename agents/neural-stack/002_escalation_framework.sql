-- ============================================================================
-- AUTHORIZATION ESCALATION FRAMEWORK - Phase 5B Migration
-- Cognalith Inc. | Monolith System
--
-- Non-negotiable financial safety layer. MonA cannot execute Tier 2-3 actions.
-- This framework is HARDCODED - no agent can escalate its own authority.
-- No amendment can modify Financial Escalation triggers.
-- ============================================================================

-- ============================================================================
-- ESCALATION LOG TABLE
-- Audit trail for all escalation events requiring Frank's authentication
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_escalation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Context
    task_id TEXT,
    agent_role TEXT NOT NULL,
    escalation_tier TEXT NOT NULL CHECK (escalation_tier IN (
        'TIER_0_ROUTINE',
        'TIER_1_SENSITIVE',
        'TIER_2_FINANCIAL',
        'TIER_3_STRATEGIC'
    )),

    -- Trigger details
    trigger_type TEXT NOT NULL,        -- 'payment_form', 'subscription', 'cloud_provision', etc.
    trigger_url TEXT,                  -- Where MonA stopped
    trigger_pattern TEXT,              -- Which pattern matched
    screenshot_path TEXT,              -- Playwright screenshot of current state

    -- MonA's preparation
    action_requested TEXT NOT NULL,    -- What MonA wants to do
    vendor TEXT,                       -- Service/vendor name
    cost_estimate_cad NUMERIC,         -- Estimated cost if known
    cost_frequency TEXT CHECK (cost_frequency IN ('one-time', 'monthly', 'annual')),
    mona_recommendation TEXT,          -- MonA's reasoning
    mona_should_proceed BOOLEAN,       -- MonA's recommendation
    mona_alternatives JSONB,           -- Cheaper alternatives MonA found
    mona_prepared_at TIMESTAMPTZ DEFAULT NOW(),

    -- Frank's decision
    frank_decision TEXT CHECK (frank_decision IN ('APPROVED', 'DENIED', 'MODIFIED', 'DEFERRED')),
    frank_notes TEXT,                  -- Optional notes
    frank_modified_action TEXT,        -- If Frank changes the plan
    frank_resume_instructions TEXT,    -- What MonA should do after auth
    frank_decided_at TIMESTAMPTZ,

    -- Outcome
    outcome TEXT CHECK (outcome IN ('COMPLETED', 'CANCELLED', 'PARTIAL', 'FAILED')),
    outcome_notes TEXT,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit and pending queries
CREATE INDEX IF NOT EXISTS idx_escalation_tier ON monolith_escalation_log(escalation_tier);
CREATE INDEX IF NOT EXISTS idx_escalation_agent ON monolith_escalation_log(agent_role);
CREATE INDEX IF NOT EXISTS idx_escalation_pending ON monolith_escalation_log(frank_decided_at)
    WHERE frank_decided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escalation_created ON monolith_escalation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_escalation_task ON monolith_escalation_log(task_id);

-- ============================================================================
-- AGENT CONFIG TABLE
-- Per-agent model configuration for cost optimization and A/B testing
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_agent_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_role TEXT UNIQUE NOT NULL,

    -- Model Configuration
    provider TEXT NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai', 'google')),
    model_id TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    extended_thinking BOOLEAN DEFAULT false,
    temperature NUMERIC(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 4096,

    -- A/B Testing Support
    experiment_group TEXT,
    experiment_config JSONB DEFAULT '{}'::jsonb,

    -- Cost tracking
    monthly_token_budget INTEGER,      -- Optional token limit
    tokens_used_this_month INTEGER DEFAULT 0,
    budget_reset_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_agent_role
        FOREIGN KEY (agent_role)
        REFERENCES monolith_agent_memory(agent_role)
        ON DELETE CASCADE
);

-- Index for config lookups
CREATE INDEX IF NOT EXISTS idx_agent_config_role ON monolith_agent_config(agent_role);
CREATE INDEX IF NOT EXISTS idx_agent_config_experiment ON monolith_agent_config(experiment_group);

-- ============================================================================
-- MONTHLY SPEND TRACKING VIEW
-- Dashboard widget: Monthly spend via MonA-initiated subscriptions
-- ============================================================================
CREATE OR REPLACE VIEW monolith_monthly_escalation_spend AS
SELECT
    DATE_TRUNC('month', frank_decided_at) AS month,
    COUNT(*) AS total_escalations,
    COUNT(*) FILTER (WHERE frank_decision = 'APPROVED') AS approved_count,
    COUNT(*) FILTER (WHERE frank_decision = 'DENIED') AS denied_count,
    SUM(cost_estimate_cad) FILTER (WHERE frank_decision = 'APPROVED') AS approved_spend_cad,
    SUM(cost_estimate_cad) FILTER (WHERE frank_decision = 'APPROVED' AND cost_frequency = 'monthly') AS monthly_recurring_cad,
    SUM(cost_estimate_cad) FILTER (WHERE frank_decision = 'APPROVED' AND cost_frequency = 'annual') AS annual_committed_cad
FROM monolith_escalation_log
WHERE frank_decided_at IS NOT NULL
GROUP BY DATE_TRUNC('month', frank_decided_at)
ORDER BY month DESC;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE monolith_escalation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_agent_config ENABLE ROW LEVEL SECURITY;

-- Permissive policies (adjust for production)
CREATE POLICY "Allow all for escalation_log" ON monolith_escalation_log FOR ALL USING (true);
CREATE POLICY "Allow all for agent_config" ON monolith_agent_config FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON monolith_escalation_log TO anon, authenticated;
GRANT ALL ON monolith_agent_config TO anon, authenticated;
GRANT SELECT ON monolith_monthly_escalation_spend TO anon, authenticated;

-- ============================================================================
-- INITIALIZE AGENT CONFIGS WITH DEFAULT MODEL SETTINGS
-- ============================================================================
INSERT INTO monolith_agent_config (agent_role, provider, model_id, extended_thinking, temperature)
VALUES
    -- Executive tier - Sonnet by default, Opus when critical
    ('ceo', 'anthropic', 'claude-sonnet-4-20250514', false, 0.7),
    ('cfo', 'anthropic', 'claude-sonnet-4-20250514', false, 0.5),  -- Lower temp for financial
    ('cto', 'anthropic', 'claude-sonnet-4-20250514', false, 0.7),
    ('coo', 'anthropic', 'claude-sonnet-4-20250514', false, 0.6),
    ('cmo', 'anthropic', 'claude-sonnet-4-20250514', false, 0.8),  -- Higher temp for creative
    ('chro', 'anthropic', 'claude-sonnet-4-20250514', false, 0.7),
    ('clo', 'anthropic', 'claude-sonnet-4-20250514', false, 0.4),  -- Low temp for legal precision
    ('ciso', 'anthropic', 'claude-sonnet-4-20250514', false, 0.5),
    ('cos', 'anthropic', 'claude-sonnet-4-20250514', false, 0.6),  -- CoS needs balanced
    ('cco', 'anthropic', 'claude-sonnet-4-20250514', false, 0.7),
    ('cpo', 'anthropic', 'claude-sonnet-4-20250514', false, 0.7),
    ('cro', 'anthropic', 'claude-sonnet-4-20250514', false, 0.7),
    -- Operations tier - can drop to Haiku for simple tasks
    ('devops', 'anthropic', 'claude-sonnet-4-20250514', false, 0.5),
    ('data', 'anthropic', 'claude-sonnet-4-20250514', false, 0.5),
    ('qa', 'anthropic', 'claude-sonnet-4-20250514', false, 0.4)
ON CONFLICT (agent_role) DO UPDATE SET
    provider = EXCLUDED.provider,
    model_id = EXCLUDED.model_id,
    extended_thinking = EXCLUDED.extended_thinking,
    temperature = EXCLUDED.temperature;

-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_escalation_log ON monolith_escalation_log;
CREATE TRIGGER trigger_update_escalation_log
    BEFORE UPDATE ON monolith_escalation_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_agent_config ON monolith_agent_config;
CREATE TRIGGER trigger_update_agent_config
    BEFORE UPDATE ON monolith_agent_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE monolith_escalation_log IS 'Audit trail for financial/strategic escalations requiring Frank authentication. HARDCODED SAFETY - no agent can modify.';
COMMENT ON TABLE monolith_agent_config IS 'Per-agent model configuration for cost optimization, A/B testing, and future extended thinking.';
COMMENT ON VIEW monolith_monthly_escalation_spend IS 'Dashboard view: Monthly spend via MonA-initiated subscriptions.';
