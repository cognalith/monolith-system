-- ============================================================================
-- PHASE 7: TASK ORCHESTRATION ENGINE - Database Schema
-- Cognalith Inc. | Monolith System
--
-- Creates the data foundation for task queuing, dependencies, and CEO decisions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TASK QUEUE TABLE
-- Central queue for all tasks in the system
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_task_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task identification
    task_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,

    -- Assignment
    assigned_agent TEXT NOT NULL,
    assigned_team TEXT NOT NULL,
    created_by TEXT,

    -- Priority & scheduling
    priority INTEGER DEFAULT 50,
    due_date TIMESTAMPTZ,
    estimated_hours NUMERIC(5,2),

    -- Status tracking
    status TEXT DEFAULT 'queued',
    status_reason TEXT,

    -- Execution tracking
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_hours NUMERIC(5,2),

    -- Blocker tracking
    blocked_by_task_id UUID,
    blocked_by_agent TEXT,
    blocked_type TEXT,
    blocked_at TIMESTAMPTZ,
    blocked_context JSONB,

    -- Escalation tracking
    escalation_type TEXT,
    escalation_reason TEXT,
    escalated_at TIMESTAMPTZ,
    escalation_resolved_at TIMESTAMPTZ,
    escalation_resolution TEXT,

    -- Deliverables
    deliverables JSONB DEFAULT '[]'::jsonb,
    outputs JSONB DEFAULT '[]'::jsonb,

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMPTZ,

    -- Metadata
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_blocked_task
        FOREIGN KEY (blocked_by_task_id)
        REFERENCES monolith_task_queue(id)
        ON DELETE SET NULL
);

-- Indexes for queue queries
CREATE INDEX IF NOT EXISTS idx_task_queue_agent ON monolith_task_queue(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_task_queue_team ON monolith_task_queue(assigned_team);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON monolith_task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON monolith_task_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_queue_blocked ON monolith_task_queue(blocked_by_task_id) WHERE blocked_by_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_queue_escalated ON monolith_task_queue(escalation_type) WHERE escalation_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_queue_queued ON monolith_task_queue(assigned_agent, priority DESC) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_task_queue_active ON monolith_task_queue(assigned_agent) WHERE status = 'active';

-- ============================================================================
-- TASK DEPENDENCIES TABLE
-- Tracks task-to-task dependencies
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    task_id UUID NOT NULL REFERENCES monolith_task_queue(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES monolith_task_queue(id) ON DELETE CASCADE,

    dependency_type TEXT DEFAULT 'blocks',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(task_id, depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task ON monolith_task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON monolith_task_dependencies(depends_on_task_id);

-- ============================================================================
-- CEO DECISIONS TABLE
-- Queue of decisions requiring Frank's input
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_ceo_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    task_id UUID NOT NULL REFERENCES monolith_task_queue(id) ON DELETE CASCADE,

    decision_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,

    options JSONB,

    requesting_agent TEXT NOT NULL,
    agent_recommendation TEXT,
    agent_reasoning TEXT,

    status TEXT DEFAULT 'pending',

    decision TEXT,
    decision_notes TEXT,
    decided_at TIMESTAMPTZ,

    priority INTEGER DEFAULT 50,
    deadline TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceo_decisions_pending ON monolith_ceo_decisions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ceo_decisions_priority ON monolith_ceo_decisions(priority DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ceo_decisions_task ON monolith_ceo_decisions(task_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE monolith_task_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_ceo_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for task_queue" ON monolith_task_queue FOR ALL USING (true);
CREATE POLICY "Allow all for task_dependencies" ON monolith_task_dependencies FOR ALL USING (true);
CREATE POLICY "Allow all for ceo_decisions" ON monolith_ceo_decisions FOR ALL USING (true);

GRANT ALL ON monolith_task_queue TO anon, authenticated;
GRANT ALL ON monolith_task_dependencies TO anon, authenticated;
GRANT ALL ON monolith_ceo_decisions TO anon, authenticated;

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_task_queue ON monolith_task_queue;
CREATE TRIGGER trigger_update_task_queue
    BEFORE UPDATE ON monolith_task_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ceo_decisions ON monolith_ceo_decisions;
CREATE TRIGGER trigger_update_ceo_decisions
    BEFORE UPDATE ON monolith_ceo_decisions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE monolith_task_queue IS 'Central task queue for all agent work items.';
COMMENT ON TABLE monolith_task_dependencies IS 'Task-to-task dependency tracking.';
COMMENT ON TABLE monolith_ceo_decisions IS 'Queue of decisions requiring CEO (Frank) input.';
