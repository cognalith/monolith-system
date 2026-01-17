-- ============================================================================
-- PHASE 5E: FULL AUTONOMY MIGRATION
-- Cognalith Inc. | Monolith System
--
-- Creates tables for autonomous CoS operation:
-- - Exception escalations (CEO-only items)
-- - Baked amendments archive
-- - CoS self-monitoring
-- - Revert logging
-- - Consecutive failure tracking
-- ============================================================================

-- ============================================================================
-- 1. EXCEPTION ESCALATIONS TABLE
-- CEO-only escalation items (Skills/Persona mods, consecutive failures, cross-agent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exception_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id UUID REFERENCES monolith_amendments(id) ON DELETE SET NULL,
    agent_role VARCHAR(50) NOT NULL,
    reason VARCHAR(100) NOT NULL,  -- skills_layer_mod, persona_layer_mod, consecutive_failures, cross_agent_pattern
    analysis JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'dismissed')),
    resolved_by VARCHAR(100),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exception_escalations_status ON exception_escalations(status);
CREATE INDEX IF NOT EXISTS idx_exception_escalations_agent ON exception_escalations(agent_role);
CREATE INDEX IF NOT EXISTS idx_exception_escalations_reason ON exception_escalations(reason);
CREATE INDEX IF NOT EXISTS idx_exception_escalations_created ON exception_escalations(created_at);

COMMENT ON TABLE exception_escalations IS 'Exception-only escalations requiring CEO approval';

-- ============================================================================
-- 2. BAKED AMENDMENTS TABLE
-- Archive of amendments that have been baked into standard_knowledge
-- ============================================================================
CREATE TABLE IF NOT EXISTS baked_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_amendment_id UUID NOT NULL,  -- Reference to original (may be deleted later)
    agent_role VARCHAR(50) NOT NULL,
    amendment_type VARCHAR(50),
    trigger_pattern TEXT,
    instruction_delta TEXT,
    baked_changes JSONB NOT NULL,
    previous_version_hash VARCHAR(64),
    new_version_hash VARCHAR(64),
    evaluation_history JSONB,
    total_successes INTEGER DEFAULT 0,
    total_evaluations INTEGER DEFAULT 0,
    baked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baked_amendments_agent ON baked_amendments(agent_role);
CREATE INDEX IF NOT EXISTS idx_baked_amendments_baked_at ON baked_amendments(baked_at);
CREATE INDEX IF NOT EXISTS idx_baked_amendments_original ON baked_amendments(original_amendment_id);

COMMENT ON TABLE baked_amendments IS 'Archive of amendments baked into standard knowledge';

-- ============================================================================
-- 3. COS MONITORING TABLE
-- Rolling window tracking of CoS amendment outcomes
-- ============================================================================
CREATE TABLE IF NOT EXISTS cos_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id UUID REFERENCES monolith_amendments(id) ON DELETE SET NULL,
    agent_role VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    evaluation_details JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cos_monitoring_recent ON cos_monitoring(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_cos_monitoring_agent ON cos_monitoring(agent_role);
CREATE INDEX IF NOT EXISTS idx_cos_monitoring_success ON cos_monitoring(success);

COMMENT ON TABLE cos_monitoring IS 'CoS self-monitoring - tracks amendment success/failure for rolling window';

-- ============================================================================
-- 4. REVERT LOG TABLE
-- Detailed logging of all amendment reversions
-- ============================================================================
CREATE TABLE IF NOT EXISTS revert_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id UUID NOT NULL,  -- Keep even if amendment deleted
    agent_role VARCHAR(50) NOT NULL,
    reason VARCHAR(100) NOT NULL,  -- auto_revert, manual, no_improvement, escalated
    trigger_pattern TEXT,
    metrics JSONB DEFAULT '{}',
    escalated BOOLEAN DEFAULT FALSE,
    escalation_id UUID REFERENCES exception_escalations(id) ON DELETE SET NULL,
    reverted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revert_log_agent ON revert_log(agent_role);
CREATE INDEX IF NOT EXISTS idx_revert_log_reason ON revert_log(reason);
CREATE INDEX IF NOT EXISTS idx_revert_log_reverted ON revert_log(reverted_at);

COMMENT ON TABLE revert_log IS 'Detailed log of all amendment reversions with reasoning';

-- ============================================================================
-- 5. CONSECUTIVE FAILURES TABLE
-- Tracks consecutive failures per agent for escalation triggering
-- ============================================================================
CREATE TABLE IF NOT EXISTS consecutive_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_role VARCHAR(50) NOT NULL UNIQUE,
    failure_count INTEGER DEFAULT 0,
    failure_pattern TEXT,  -- The pattern that's failing
    last_failure_at TIMESTAMPTZ,
    escalated BOOLEAN DEFAULT FALSE,
    escalation_id UUID REFERENCES exception_escalations(id) ON DELETE SET NULL,
    reset_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consecutive_failures_agent ON consecutive_failures(agent_role);

COMMENT ON TABLE consecutive_failures IS 'Tracks consecutive amendment failures per agent';

-- ============================================================================
-- 6. CEO ALERTS TABLE
-- Alerts generated by CoS self-monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS ceo_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100) NOT NULL,  -- cos_low_success_rate, cross_agent_decline, etc.
    severity VARCHAR(20) DEFAULT 'HIGH' CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    message TEXT NOT NULL,
    metrics JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceo_alerts_status ON ceo_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ceo_alerts_type ON ceo_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_ceo_alerts_created ON ceo_alerts(created_at);

COMMENT ON TABLE ceo_alerts IS 'CEO alerts from CoS self-monitoring';

-- ============================================================================
-- 7. ALTER MONOLITH_AMENDMENTS TABLE
-- Add columns for baking and auto-approval tracking
-- ============================================================================
ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS is_baked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS baked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS escalation_id UUID REFERENCES exception_escalations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_amendments_is_baked ON monolith_amendments(is_baked);
CREATE INDEX IF NOT EXISTS idx_amendments_auto_approved ON monolith_amendments(auto_approved);

-- ============================================================================
-- 8. UPDATE TRIGGER FOR CONSECUTIVE_FAILURES
-- ============================================================================
DROP TRIGGER IF EXISTS update_consecutive_failures_updated_at ON consecutive_failures;
CREATE TRIGGER update_consecutive_failures_updated_at
    BEFORE UPDATE ON consecutive_failures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE exception_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE baked_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cos_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE revert_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE consecutive_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceo_alerts ENABLE ROW LEVEL SECURITY;

-- Default policies (service role full access)
CREATE POLICY "Service role has full access to exception_escalations"
    ON exception_escalations FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to baked_amendments"
    ON baked_amendments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to cos_monitoring"
    ON cos_monitoring FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to revert_log"
    ON revert_log FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to consecutive_failures"
    ON consecutive_failures FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to ceo_alerts"
    ON ceo_alerts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. VIEWS FOR DASHBOARD
-- ============================================================================

-- Active exception escalations view
CREATE OR REPLACE VIEW pending_exception_escalations AS
SELECT
    e.id,
    e.agent_role,
    e.reason,
    e.analysis,
    e.status,
    e.created_at,
    a.trigger_pattern,
    a.instruction_delta,
    a.amendment_type
FROM exception_escalations e
LEFT JOIN monolith_amendments a ON e.amendment_id = a.id
WHERE e.status = 'pending'
ORDER BY e.created_at ASC;

-- CoS health metrics view
CREATE OR REPLACE VIEW cos_health_metrics AS
SELECT
    COUNT(*) as total_amendments,
    COUNT(*) FILTER (WHERE success = true) as successful,
    COUNT(*) FILTER (WHERE success = false) as failed,
    CASE
        WHEN COUNT(*) > 0 THEN
            ROUND(COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric, 3)
        ELSE 0
    END as success_rate,
    MAX(recorded_at) as last_recorded
FROM cos_monitoring
WHERE recorded_at > NOW() - INTERVAL '7 days';

-- Autonomy stats view
CREATE OR REPLACE VIEW autonomy_stats AS
SELECT
    COUNT(*) FILTER (WHERE auto_approved = true) as autonomous_amendments,
    COUNT(*) FILTER (WHERE auto_approved = false AND approval_status = 'approved') as manual_approvals,
    COUNT(*) FILTER (WHERE escalation_id IS NOT NULL) as escalated_amendments,
    COUNT(*) FILTER (WHERE is_baked = true) as baked_amendments,
    COUNT(*) as total_amendments
FROM monolith_amendments
WHERE created_at > NOW() - INTERVAL '30 days';
