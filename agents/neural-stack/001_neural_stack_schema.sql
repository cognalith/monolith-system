-- ============================================================================
-- NEURAL STACK DATA FOUNDATION - Phase 5A Migration
-- Cognalith Inc. | Monolith System
--
-- This migration creates the data foundation for the Neural Stack evolutionary
-- optimization system as defined in the Neural Stack Implementation Spec.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DELIVERABLES TABLE
-- Deliverables exist BEFORE tasks. A task is created to produce deliverables.
-- Section 3.2 of spec
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id TEXT,  -- Links to task once assigned (can be null initially)
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,  -- Array of criteria strings
    due_date TIMESTAMPTZ,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    artifacts JSONB DEFAULT '[]'::jsonb,  -- Array of file paths, URLs, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for deliverables
CREATE INDEX IF NOT EXISTS idx_deliverables_task_id ON monolith_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_completed ON monolith_deliverables(completed);
CREATE INDEX IF NOT EXISTS idx_deliverables_due_date ON monolith_deliverables(due_date);

-- ============================================================================
-- TASK HISTORY TABLE
-- Complete record of all task executions for CoS analysis
-- Section 3.3 TaskHistoryEntry interface
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id TEXT NOT NULL,  -- Original task ID (e.g., cfo-001)
    agent_role TEXT NOT NULL,  -- cfo, cto, coo, etc.
    title TEXT NOT NULL,
    description TEXT,
    deliverable_titles JSONB DEFAULT '[]'::jsonb,  -- Array of deliverable titles

    -- Difficulty and estimation
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),  -- Agent self-assessment
    estimated_hours NUMERIC(10,2),

    -- Timestamps (all UTC)
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Computed metrics
    actual_hours NUMERIC(10,2),  -- Computed from timestamps
    variance NUMERIC(10,2),  -- actual - estimated
    variance_percent NUMERIC(10,4),  -- (actual - estimated) / estimated

    -- CoS evaluation
    cos_score INTEGER CHECK (cos_score BETWEEN 0 AND 100),  -- 0-100 score
    cos_notes TEXT,
    cos_reviewed_at TIMESTAMPTZ,

    -- Metadata
    knowledge_version TEXT,  -- Hash of knowledge at time of execution
    model_used TEXT,  -- LLM model used
    tokens_used INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trend analysis queries
CREATE INDEX IF NOT EXISTS idx_task_history_agent_role ON monolith_task_history(agent_role);
CREATE INDEX IF NOT EXISTS idx_task_history_completed_at ON monolith_task_history(completed_at);
CREATE INDEX IF NOT EXISTS idx_task_history_agent_completed ON monolith_task_history(agent_role, completed_at);
CREATE INDEX IF NOT EXISTS idx_task_history_difficulty ON monolith_task_history(difficulty);
CREATE INDEX IF NOT EXISTS idx_task_history_variance ON monolith_task_history(variance_percent);
CREATE INDEX IF NOT EXISTS idx_task_history_cos_score ON monolith_task_history(cos_score);

-- ============================================================================
-- AGENT MEMORY TABLE
-- Persistent memory state for each agent
-- Section 3.3 AgentMemory interface
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_role TEXT UNIQUE NOT NULL,  -- cfo, cto, coo, etc.

    -- Knowledge versioning
    knowledge_version TEXT,  -- Current knowledge hash
    knowledge_base TEXT,  -- Immutable foundation
    knowledge_standard TEXT,  -- Current operating instructions
    knowledge_effective TEXT,  -- Computed: base + standard + amendments

    -- Performance snapshot (denormalized for quick access)
    avg_variance_percent NUMERIC(10,4) DEFAULT 0,
    variance_trend_slope NUMERIC(10,6) DEFAULT 0,
    on_time_delivery_rate NUMERIC(5,4) DEFAULT 0,  -- 0.0 to 1.0
    avg_cos_score NUMERIC(5,2) DEFAULT 0,
    deliverable_completion_rate NUMERIC(5,4) DEFAULT 0,

    -- Metrics by difficulty (JSONB for flexibility)
    metrics_by_difficulty JSONB DEFAULT '{}'::jsonb,

    -- Amendment tracking
    total_amendments INTEGER DEFAULT 0,
    successful_amendments INTEGER DEFAULT 0,
    failed_amendments INTEGER DEFAULT 0,
    reverted_amendments INTEGER DEFAULT 0,
    active_amendment_count INTEGER DEFAULT 0,  -- Max 10 per Safety Axioms

    -- CoS review tracking
    last_cos_review TIMESTAMPTZ,
    next_cos_review TIMESTAMPTZ,
    tasks_since_last_review INTEGER DEFAULT 0,

    -- Trend status
    current_trend TEXT DEFAULT 'INSUFFICIENT_DATA',  -- IMPROVING, STABLE, DECLINING, INSUFFICIENT_DATA
    trend_calculated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_memory_role ON monolith_agent_memory(agent_role);
CREATE INDEX IF NOT EXISTS idx_agent_memory_trend ON monolith_agent_memory(current_trend);

-- ============================================================================
-- AMENDMENTS TABLE
-- Knowledge layer modifications made by CoS
-- Section 2.3 Amendment Format
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_amendments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amendment_id TEXT UNIQUE NOT NULL,  -- Human-readable ID (e.g., amend-001)
    agent_role TEXT NOT NULL,

    -- Trigger information
    trigger_reason TEXT NOT NULL,  -- e.g., 'downward_trend_5_tasks'
    trigger_pattern TEXT,  -- Pattern detected (from Section 4.4)

    -- Amendment details
    amendment_type TEXT NOT NULL CHECK (amendment_type IN ('append', 'replace', 'remove')),
    target_area TEXT NOT NULL,  -- 'time_estimation', 'task_approach', 'tool_usage', etc.
    content TEXT NOT NULL,  -- The actual amendment instruction

    -- Performance snapshots
    performance_before JSONB NOT NULL,  -- { avg_variance, trend, cos_score, etc. }
    performance_after JSONB,  -- Populated after evaluation window

    -- Evaluation
    evaluation_window_tasks INTEGER DEFAULT 5,  -- Tasks to wait before evaluating
    tasks_evaluated INTEGER DEFAULT 0,
    evaluation_status TEXT DEFAULT 'pending',  -- pending, evaluating, success, failed, reverted
    evaluated_at TIMESTAMPTZ,

    -- Status
    is_active BOOLEAN DEFAULT true,
    reverted BOOLEAN DEFAULT false,
    reverted_at TIMESTAMPTZ,
    revert_reason TEXT,

    -- Versioning
    version INTEGER DEFAULT 1,
    previous_amendment_id UUID,  -- For tracking amendment chains

    -- Safety Axioms compliance
    approved_by TEXT,  -- 'cos_auto' or 'ceo_manual'
    approval_required BOOLEAN DEFAULT false,  -- True if exceeds CoS authority

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_agent_memory
        FOREIGN KEY (agent_role)
        REFERENCES monolith_agent_memory(agent_role)
        ON DELETE CASCADE
);

-- Indexes for amendment queries
CREATE INDEX IF NOT EXISTS idx_amendments_agent_role ON monolith_amendments(agent_role);
CREATE INDEX IF NOT EXISTS idx_amendments_active ON monolith_amendments(is_active);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON monolith_amendments(evaluation_status);
CREATE INDEX IF NOT EXISTS idx_amendments_created ON monolith_amendments(created_at);
CREATE INDEX IF NOT EXISTS idx_amendments_agent_active ON monolith_amendments(agent_role, is_active);

-- ============================================================================
-- COS REVIEWS TABLE
-- Record of all CoS review cycles (Section 4.1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_cos_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_role TEXT NOT NULL,

    -- Review phases
    phase TEXT NOT NULL,  -- 'collect', 'analyze', 'trend', 'score', 'decide', 'log'

    -- Collected data
    tasks_analyzed INTEGER DEFAULT 0,
    task_ids_analyzed JSONB DEFAULT '[]'::jsonb,

    -- Analysis results
    calculated_trend TEXT,  -- IMPROVING, STABLE, DECLINING, INSUFFICIENT_DATA
    trend_slope NUMERIC(10,6),
    avg_variance_percent NUMERIC(10,4),

    -- Scoring
    on_time_score INTEGER,  -- 0-40 (40% weight)
    quality_score INTEGER,  -- 0-30 (30% weight)
    accuracy_score INTEGER,  -- 0-30 (30% weight)
    total_score INTEGER,  -- 0-100

    -- Decision
    intervention_required BOOLEAN DEFAULT false,
    amendment_generated_id UUID,
    decision_notes TEXT,

    -- Timing
    review_started_at TIMESTAMPTZ DEFAULT NOW(),
    review_completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for review history
CREATE INDEX IF NOT EXISTS idx_cos_reviews_agent ON monolith_cos_reviews(agent_role);
CREATE INDEX IF NOT EXISTS idx_cos_reviews_created ON monolith_cos_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_cos_reviews_intervention ON monolith_cos_reviews(intervention_required);

-- ============================================================================
-- PERFORMANCE SNAPSHOTS TABLE
-- Historical snapshots for trend visualization
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_role TEXT NOT NULL,

    -- Snapshot data
    snapshot_type TEXT NOT NULL,  -- 'daily', 'weekly', 'after_task', 'after_review'

    -- Metrics at snapshot time
    avg_variance_percent NUMERIC(10,4),
    variance_trend_slope NUMERIC(10,6),
    on_time_delivery_rate NUMERIC(5,4),
    avg_cos_score NUMERIC(5,2),
    deliverable_completion_rate NUMERIC(5,4),

    -- Task counts
    total_tasks_completed INTEGER DEFAULT 0,
    tasks_since_last_snapshot INTEGER DEFAULT 0,

    -- Amendment state
    active_amendments INTEGER DEFAULT 0,

    -- Metadata
    triggered_by TEXT,  -- 'task_completion', 'cos_review', 'scheduler', etc.

    snapshot_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trend queries
CREATE INDEX IF NOT EXISTS idx_snapshots_agent ON monolith_performance_snapshots(agent_role);
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON monolith_performance_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_agent_time ON monolith_performance_snapshots(agent_role, snapshot_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON monolith_performance_snapshots(snapshot_type);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE monolith_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_cos_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for anon access (adjust for production)
CREATE POLICY "Allow all for deliverables" ON monolith_deliverables FOR ALL USING (true);
CREATE POLICY "Allow all for task_history" ON monolith_task_history FOR ALL USING (true);
CREATE POLICY "Allow all for agent_memory" ON monolith_agent_memory FOR ALL USING (true);
CREATE POLICY "Allow all for amendments" ON monolith_amendments FOR ALL USING (true);
CREATE POLICY "Allow all for cos_reviews" ON monolith_cos_reviews FOR ALL USING (true);
CREATE POLICY "Allow all for performance_snapshots" ON monolith_performance_snapshots FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON monolith_deliverables TO anon, authenticated;
GRANT ALL ON monolith_task_history TO anon, authenticated;
GRANT ALL ON monolith_agent_memory TO anon, authenticated;
GRANT ALL ON monolith_amendments TO anon, authenticated;
GRANT ALL ON monolith_cos_reviews TO anon, authenticated;
GRANT ALL ON monolith_performance_snapshots TO anon, authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate variance
CREATE OR REPLACE FUNCTION calculate_task_variance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.started_at IS NOT NULL AND NEW.completed_at IS NOT NULL THEN
        NEW.actual_hours := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) / 3600;

        IF NEW.estimated_hours IS NOT NULL AND NEW.estimated_hours > 0 THEN
            NEW.variance := NEW.actual_hours - NEW.estimated_hours;
            NEW.variance_percent := (NEW.actual_hours - NEW.estimated_hours) / NEW.estimated_hours;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-calculating variance
DROP TRIGGER IF EXISTS trigger_calculate_variance ON monolith_task_history;
CREATE TRIGGER trigger_calculate_variance
    BEFORE INSERT OR UPDATE ON monolith_task_history
    FOR EACH ROW
    EXECUTE FUNCTION calculate_task_variance();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DROP TRIGGER IF EXISTS trigger_update_deliverables ON monolith_deliverables;
CREATE TRIGGER trigger_update_deliverables
    BEFORE UPDATE ON monolith_deliverables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_agent_memory ON monolith_agent_memory;
CREATE TRIGGER trigger_update_agent_memory
    BEFORE UPDATE ON monolith_agent_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_amendments ON monolith_amendments;
CREATE TRIGGER trigger_update_amendments
    BEFORE UPDATE ON monolith_amendments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- INITIALIZE AGENT MEMORY FOR ALL ROLES
-- ============================================================================
INSERT INTO monolith_agent_memory (agent_role, knowledge_version, current_trend)
VALUES
    ('ceo', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('cfo', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('cto', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('coo', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('cmo', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('chro', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('clo', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('ciso', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('cos', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('cco', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('cpo', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('cro', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('devops', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('data', 'v1.0.0', 'INSUFFICIENT_DATA'),
    ('qa', 'v1.0.0', 'INSUFFICIENT_DATA')
ON CONFLICT (agent_role) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE monolith_deliverables IS 'Deliverables that tasks produce. Deliverables exist before tasks are created.';
COMMENT ON TABLE monolith_task_history IS 'Complete task execution history for CoS trend analysis.';
COMMENT ON TABLE monolith_agent_memory IS 'Persistent agent state including knowledge version and performance metrics.';
COMMENT ON TABLE monolith_amendments IS 'Knowledge layer modifications made by CoS during evolutionary optimization.';
COMMENT ON TABLE monolith_cos_reviews IS 'Record of all Chief of Staff review cycles.';
COMMENT ON TABLE monolith_performance_snapshots IS 'Historical performance snapshots for trend visualization.';
