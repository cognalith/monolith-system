-- ============================================================================
-- AMENDMENT VERSIONING - Phase 5C Migration
-- Cognalith Inc. | Monolith System
--
-- Extends the amendment system with approval workflow, versioning, and
-- evaluation tracking. CEO approval gate is temporary until trust is built.
-- ============================================================================

-- ============================================================================
-- ADD APPROVAL WORKFLOW COLUMNS TO AMENDMENTS TABLE
-- ============================================================================

-- Add approval_status column for CEO gate
ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved'));

-- Add approval metadata
ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS approved_by TEXT;

ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Add version tracking
ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS parent_amendment_id UUID REFERENCES monolith_amendments(id);

-- Add pattern source tracking
ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS source_pattern JSONB;

ALTER TABLE monolith_amendments
ADD COLUMN IF NOT EXISTS pattern_confidence NUMERIC(4,3) DEFAULT 0.5
    CHECK (pattern_confidence >= 0 AND pattern_confidence <= 1);

-- ============================================================================
-- AMENDMENT EVALUATION TRACKING TABLE
-- Tracks the 5-task evaluation window per amendment
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_amendment_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amendment_id UUID NOT NULL REFERENCES monolith_amendments(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,

    -- Evaluation metrics
    success BOOLEAN NOT NULL,
    time_seconds INTEGER,
    quality_score NUMERIC(3,2),
    agent_feedback TEXT,

    -- Position in evaluation window (1-5)
    evaluation_position INTEGER NOT NULL CHECK (evaluation_position >= 1 AND evaluation_position <= 5),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(amendment_id, evaluation_position)
);

-- Index for evaluation lookups
CREATE INDEX IF NOT EXISTS idx_amendment_eval_amendment ON monolith_amendment_evaluations(amendment_id);
CREATE INDEX IF NOT EXISTS idx_amendment_eval_task ON monolith_amendment_evaluations(task_id);

-- ============================================================================
-- PATTERN DETECTION LOG TABLE
-- Records detected patterns for transparency and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_pattern_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_role TEXT NOT NULL,

    -- Pattern details
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'repeated_failure',
        'time_regression',
        'quality_decline',
        'category_weakness',
        'tool_inefficiency'
    )),
    pattern_data JSONB NOT NULL,
    confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

    -- Context
    task_window JSONB,           -- Task IDs analyzed
    metrics_snapshot JSONB,      -- Metrics at detection time

    -- Resolution
    amendment_generated UUID REFERENCES monolith_amendments(id),
    dismissed BOOLEAN DEFAULT false,
    dismissed_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pattern lookups
CREATE INDEX IF NOT EXISTS idx_pattern_log_agent ON monolith_pattern_log(agent_role);
CREATE INDEX IF NOT EXISTS idx_pattern_log_type ON monolith_pattern_log(pattern_type);
CREATE INDEX IF NOT EXISTS idx_pattern_log_created ON monolith_pattern_log(created_at);

-- ============================================================================
-- KNOWLEDGE LAYER TABLE
-- Stores computed effective knowledge per agent
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_knowledge_layer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_role TEXT UNIQUE NOT NULL,

    -- Knowledge layers (computed from amendments)
    base_knowledge JSONB DEFAULT '{}'::jsonb,      -- Immutable persona knowledge
    standard_knowledge JSONB DEFAULT '{}'::jsonb,  -- Role-specific standards
    amendment_knowledge JSONB DEFAULT '{}'::jsonb, -- CoS-generated amendments

    -- Computed effective knowledge
    effective_knowledge JSONB DEFAULT '{}'::jsonb,

    -- Computation metadata
    last_computed_at TIMESTAMPTZ DEFAULT NOW(),
    amendments_applied INTEGER[] DEFAULT '{}',     -- IDs of amendments in effective
    computation_version INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize knowledge layers for all agents
INSERT INTO monolith_knowledge_layer (agent_role, base_knowledge, standard_knowledge)
SELECT
    agent_role,
    '{}'::jsonb,
    '{}'::jsonb
FROM monolith_agent_memory
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- SAFETY CONSTRAINT TRACKING
-- Records safety constraint violations and enforcement
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_safety_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_role TEXT NOT NULL,

    -- Constraint details
    constraint_type TEXT NOT NULL CHECK (constraint_type IN (
        'max_amendments_exceeded',
        'protected_pattern_violation',
        'auto_revert_triggered',
        'evaluation_timeout',
        'conflicting_amendment'
    )),
    constraint_data JSONB NOT NULL,

    -- Resolution
    action_taken TEXT NOT NULL,
    amendment_id UUID REFERENCES monolith_amendments(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for safety audits
CREATE INDEX IF NOT EXISTS idx_safety_log_agent ON monolith_safety_log(agent_role);
CREATE INDEX IF NOT EXISTS idx_safety_log_type ON monolith_safety_log(constraint_type);

-- ============================================================================
-- VIEWS FOR AMENDMENT MONITORING
-- ============================================================================

-- Active amendments per agent with evaluation progress
CREATE OR REPLACE VIEW monolith_active_amendments AS
SELECT
    a.id,
    a.agent_role,
    a.amendment_type,
    a.trigger_pattern,
    a.instruction_delta,
    a.approval_status,
    a.evaluation_status,
    a.version,
    a.pattern_confidence,
    a.created_at,
    COUNT(e.id) AS evaluations_completed,
    AVG(CASE WHEN e.success THEN 1 ELSE 0 END) AS success_rate,
    AVG(e.quality_score) AS avg_quality
FROM monolith_amendments a
LEFT JOIN monolith_amendment_evaluations e ON a.id = e.amendment_id
WHERE a.is_active = true
GROUP BY a.id, a.agent_role, a.amendment_type, a.trigger_pattern,
         a.instruction_delta, a.approval_status, a.evaluation_status,
         a.version, a.pattern_confidence, a.created_at;

-- Amendment history with outcomes
CREATE OR REPLACE VIEW monolith_amendment_history AS
SELECT
    a.agent_role,
    a.amendment_type,
    a.approval_status,
    a.evaluation_status,
    a.is_active,
    a.success_count,
    a.failure_count,
    CASE
        WHEN a.success_count + a.failure_count > 0
        THEN a.success_count::float / (a.success_count + a.failure_count)
        ELSE 0
    END AS lifetime_success_rate,
    a.created_at,
    a.superseded_at
FROM monolith_amendments a
ORDER BY a.created_at DESC;

-- Pattern detection summary
CREATE OR REPLACE VIEW monolith_pattern_summary AS
SELECT
    agent_role,
    pattern_type,
    COUNT(*) AS total_detected,
    COUNT(*) FILTER (WHERE amendment_generated IS NOT NULL) AS amendments_generated,
    COUNT(*) FILTER (WHERE dismissed = true) AS dismissed,
    AVG(confidence) AS avg_confidence,
    MAX(created_at) AS last_detected
FROM monolith_pattern_log
GROUP BY agent_role, pattern_type;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if agent can accept new amendments (max 10 active)
CREATE OR REPLACE FUNCTION check_amendment_limit(p_agent_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    active_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM monolith_amendments
    WHERE agent_role = p_agent_role
      AND is_active = true;

    RETURN active_count < 10;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-revert amendment after 3 consecutive failures
CREATE OR REPLACE FUNCTION check_auto_revert()
RETURNS TRIGGER AS $$
DECLARE
    failure_count INTEGER;
    amendment_record RECORD;
BEGIN
    -- Only check on failure
    IF NEW.success = false THEN
        -- Count recent consecutive failures
        SELECT COUNT(*) INTO failure_count
        FROM monolith_amendment_evaluations
        WHERE amendment_id = NEW.amendment_id
          AND success = false
          AND evaluation_position >= NEW.evaluation_position - 2
          AND evaluation_position <= NEW.evaluation_position;

        -- Auto-revert if 3 consecutive failures
        IF failure_count >= 3 THEN
            UPDATE monolith_amendments
            SET is_active = false,
                evaluation_status = 'reverted',
                superseded_at = NOW()
            WHERE id = NEW.amendment_id;

            -- Log safety action
            SELECT * INTO amendment_record FROM monolith_amendments WHERE id = NEW.amendment_id;

            INSERT INTO monolith_safety_log (agent_role, constraint_type, constraint_data, action_taken, amendment_id)
            VALUES (
                amendment_record.agent_role,
                'auto_revert_triggered',
                jsonb_build_object(
                    'failure_count', 3,
                    'evaluation_position', NEW.evaluation_position
                ),
                'Amendment auto-reverted after 3 consecutive failures',
                NEW.amendment_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-revert
DROP TRIGGER IF EXISTS trigger_check_auto_revert ON monolith_amendment_evaluations;
CREATE TRIGGER trigger_check_auto_revert
    AFTER INSERT ON monolith_amendment_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION check_auto_revert();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE monolith_amendment_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_pattern_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_knowledge_layer ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_safety_log ENABLE ROW LEVEL SECURITY;

-- Permissive policies (adjust for production)
CREATE POLICY "Allow all for amendment_evaluations" ON monolith_amendment_evaluations FOR ALL USING (true);
CREATE POLICY "Allow all for pattern_log" ON monolith_pattern_log FOR ALL USING (true);
CREATE POLICY "Allow all for knowledge_layer" ON monolith_knowledge_layer FOR ALL USING (true);
CREATE POLICY "Allow all for safety_log" ON monolith_safety_log FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON monolith_amendment_evaluations TO anon, authenticated;
GRANT ALL ON monolith_pattern_log TO anon, authenticated;
GRANT ALL ON monolith_knowledge_layer TO anon, authenticated;
GRANT ALL ON monolith_safety_log TO anon, authenticated;
GRANT SELECT ON monolith_active_amendments TO anon, authenticated;
GRANT SELECT ON monolith_amendment_history TO anon, authenticated;
GRANT SELECT ON monolith_pattern_summary TO anon, authenticated;

-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_knowledge_layer ON monolith_knowledge_layer;
CREATE TRIGGER trigger_update_knowledge_layer
    BEFORE UPDATE ON monolith_knowledge_layer
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE monolith_amendment_evaluations IS 'Tracks 5-task evaluation window for each amendment';
COMMENT ON TABLE monolith_pattern_log IS 'Records detected failure patterns for transparency';
COMMENT ON TABLE monolith_knowledge_layer IS 'Computed effective knowledge per agent from base + standard + amendments';
COMMENT ON TABLE monolith_safety_log IS 'Audit trail for safety constraint enforcement';
COMMENT ON VIEW monolith_active_amendments IS 'Dashboard view of active amendments with evaluation progress';
COMMENT ON FUNCTION check_amendment_limit IS 'Enforces max 10 active amendments per agent';
COMMENT ON FUNCTION check_auto_revert IS 'Auto-reverts amendments after 3 consecutive failures';
