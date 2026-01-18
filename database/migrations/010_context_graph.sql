-- ============================================================================
-- PHASE 9: CONTEXT GRAPH - Database Schema
-- Cognalith Inc. | Monolith System
--
-- Adds context tracking for visualizing agent workflows, task relationships,
-- and system-wide execution patterns.
-- ============================================================================

-- ============================================================================
-- CONTEXT NODES TABLE
-- Represents entities in the context graph (tasks, agents, decisions, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_context_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Node identification
    node_type TEXT NOT NULL, -- 'task', 'agent', 'decision', 'blocker', 'milestone'
    node_id TEXT NOT NULL,   -- Reference ID (task_id, agent_role, etc.)

    -- Node metadata
    label TEXT NOT NULL,
    description TEXT,
    status TEXT,

    -- Visual properties
    weight INTEGER DEFAULT 1,  -- Importance/size in graph
    color TEXT,                -- Hex color for visualization
    icon TEXT,                 -- Icon identifier

    -- Position (for saved layouts)
    position_x FLOAT,
    position_y FLOAT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique nodes
    UNIQUE(node_type, node_id)
);

CREATE INDEX IF NOT EXISTS idx_context_nodes_type ON monolith_context_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_context_nodes_status ON monolith_context_nodes(status);

-- ============================================================================
-- CONTEXT EDGES TABLE
-- Represents relationships between nodes (dependencies, assignments, flows)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_context_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Edge endpoints
    source_node_id UUID REFERENCES monolith_context_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES monolith_context_nodes(id) ON DELETE CASCADE,

    -- Edge type and metadata
    edge_type TEXT NOT NULL, -- 'depends_on', 'assigned_to', 'blocked_by', 'escalated_to', 'spawned', 'completed_before'
    label TEXT,
    weight INTEGER DEFAULT 1,

    -- Visual properties
    color TEXT,
    style TEXT DEFAULT 'solid', -- 'solid', 'dashed', 'dotted'
    animated BOOLEAN DEFAULT false,

    -- Edge metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate edges
    UNIQUE(source_node_id, target_node_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_context_edges_source ON monolith_context_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_context_edges_target ON monolith_context_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_context_edges_type ON monolith_context_edges(edge_type);

-- ============================================================================
-- EXECUTION TRACES TABLE
-- Records the execution path through the system for analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_execution_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Trace identification
    trace_id UUID NOT NULL,  -- Groups related events
    sequence_num INTEGER NOT NULL,

    -- Event details
    event_type TEXT NOT NULL, -- 'task_created', 'task_started', 'task_completed', 'task_blocked', 'decision_requested', 'escalation'

    -- References
    task_id UUID,
    agent_role TEXT,

    -- Event data
    event_data JSONB DEFAULT '{}',

    -- Token tracking for this event
    tokens_used INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,

    -- Timing
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_traces_trace ON monolith_execution_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_execution_traces_task ON monolith_execution_traces(task_id);
CREATE INDEX IF NOT EXISTS idx_execution_traces_agent ON monolith_execution_traces(agent_role);
CREATE INDEX IF NOT EXISTS idx_execution_traces_type ON monolith_execution_traces(event_type);
CREATE INDEX IF NOT EXISTS idx_execution_traces_time ON monolith_execution_traces(created_at DESC);

-- ============================================================================
-- AGENT CONTEXT SNAPSHOTS TABLE
-- Captures agent state at points in time for context window management
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_agent_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Agent identification
    agent_role TEXT NOT NULL,

    -- Context window tracking
    context_tokens INTEGER DEFAULT 0,
    max_context_tokens INTEGER DEFAULT 128000, -- Model-dependent
    context_utilization NUMERIC(5,2) DEFAULT 0,

    -- Current state
    active_task_id UUID,
    pending_tasks INTEGER DEFAULT 0,
    blocked_tasks INTEGER DEFAULT 0,
    completed_today INTEGER DEFAULT 0,

    -- Memory/context summary
    working_memory JSONB DEFAULT '{}',  -- Key facts being tracked
    recent_outputs TEXT[],               -- Last N task outputs for reference

    -- Performance metrics
    avg_task_duration_ms INTEGER,
    success_rate NUMERIC(5,2),

    -- Timestamps
    snapshot_at TIMESTAMPTZ DEFAULT NOW(),

    -- One snapshot per agent per time period
    UNIQUE(agent_role, snapshot_at)
);

CREATE INDEX IF NOT EXISTS idx_agent_context_role ON monolith_agent_context(agent_role);
CREATE INDEX IF NOT EXISTS idx_agent_context_time ON monolith_agent_context(snapshot_at DESC);

-- ============================================================================
-- WORKFLOW PATTERNS TABLE
-- Stores recognized workflow patterns for optimization
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_workflow_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Pattern identification
    pattern_name TEXT NOT NULL UNIQUE,
    description TEXT,

    -- Pattern definition
    trigger_conditions JSONB NOT NULL,  -- When this pattern applies
    expected_sequence TEXT[],            -- Expected task/agent sequence
    typical_duration_hours NUMERIC(6,2),

    -- Pattern statistics
    times_matched INTEGER DEFAULT 0,
    avg_completion_time_hours NUMERIC(6,2),
    success_rate NUMERIC(5,2),

    -- Optimization hints
    bottleneck_points JSONB,
    optimization_suggestions TEXT[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GRAPH VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Current task dependency graph
CREATE OR REPLACE VIEW v_task_dependency_graph AS
SELECT
    t.id,
    t.task_id,
    t.title,
    t.assigned_agent,
    t.status,
    t.priority,
    t.created_at,
    d.depends_on_task_id,
    d.dependency_type,
    d.status as dependency_status,
    dt.title as blocking_task_title,
    dt.status as blocking_task_status
FROM monolith_task_queue t
LEFT JOIN monolith_task_dependencies d ON t.id = d.task_id
LEFT JOIN monolith_task_queue dt ON d.depends_on_task_id = dt.id
WHERE t.status NOT IN ('completed', 'cancelled', 'failed');

-- View: Agent workload distribution
CREATE OR REPLACE VIEW v_agent_workload AS
SELECT
    assigned_agent,
    COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'blocked') as blocked_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_24h,
    COALESCE(SUM(tokens_total), 0) as total_tokens_used,
    COALESCE(SUM(execution_cost_usd), 0) as total_cost_usd,
    AVG(priority) as avg_priority
FROM monolith_task_queue
WHERE status NOT IN ('cancelled', 'failed')
GROUP BY assigned_agent;

-- View: Execution flow summary
CREATE OR REPLACE VIEW v_execution_flow AS
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    event_type,
    agent_role,
    COUNT(*) as event_count,
    SUM(tokens_used) as tokens_used,
    SUM(cost_usd) as cost_usd,
    AVG(duration_ms) as avg_duration_ms
FROM monolith_execution_traces
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), event_type, agent_role
ORDER BY hour DESC;

-- ============================================================================
-- FUNCTIONS FOR GRAPH OPERATIONS
-- ============================================================================

-- Function to create or update a context node
CREATE OR REPLACE FUNCTION upsert_context_node(
    p_node_type TEXT,
    p_node_id TEXT,
    p_label TEXT,
    p_description TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_weight INTEGER DEFAULT 1,
    p_color TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO monolith_context_nodes (node_type, node_id, label, description, status, weight, color)
    VALUES (p_node_type, p_node_id, p_label, p_description, p_status, p_weight, p_color)
    ON CONFLICT (node_type, node_id)
    DO UPDATE SET
        label = EXCLUDED.label,
        description = COALESCE(EXCLUDED.description, monolith_context_nodes.description),
        status = COALESCE(EXCLUDED.status, monolith_context_nodes.status),
        weight = EXCLUDED.weight,
        color = COALESCE(EXCLUDED.color, monolith_context_nodes.color),
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a context edge
CREATE OR REPLACE FUNCTION create_context_edge(
    p_source_type TEXT,
    p_source_id TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_edge_type TEXT,
    p_label TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_source_node_id UUID;
    v_target_node_id UUID;
    v_edge_id UUID;
BEGIN
    -- Get source node
    SELECT id INTO v_source_node_id
    FROM monolith_context_nodes
    WHERE node_type = p_source_type AND node_id = p_source_id;

    IF v_source_node_id IS NULL THEN
        RAISE EXCEPTION 'Source node not found: % %', p_source_type, p_source_id;
    END IF;

    -- Get target node
    SELECT id INTO v_target_node_id
    FROM monolith_context_nodes
    WHERE node_type = p_target_type AND node_id = p_target_id;

    IF v_target_node_id IS NULL THEN
        RAISE EXCEPTION 'Target node not found: % %', p_target_type, p_target_id;
    END IF;

    -- Create edge
    INSERT INTO monolith_context_edges (source_node_id, target_node_id, edge_type, label, metadata)
    VALUES (v_source_node_id, v_target_node_id, p_edge_type, p_label, p_metadata)
    ON CONFLICT (source_node_id, target_node_id, edge_type) DO UPDATE SET
        label = COALESCE(EXCLUDED.label, monolith_context_edges.label),
        metadata = EXCLUDED.metadata
    RETURNING id INTO v_edge_id;

    RETURN v_edge_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record execution trace
CREATE OR REPLACE FUNCTION record_execution_trace(
    p_trace_id UUID,
    p_event_type TEXT,
    p_task_id UUID DEFAULT NULL,
    p_agent_role TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT '{}',
    p_tokens_used INTEGER DEFAULT 0,
    p_cost_usd NUMERIC DEFAULT 0,
    p_duration_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_sequence INTEGER;
    v_id UUID;
BEGIN
    -- Get next sequence number for this trace
    SELECT COALESCE(MAX(sequence_num), 0) + 1 INTO v_sequence
    FROM monolith_execution_traces
    WHERE trace_id = p_trace_id;

    INSERT INTO monolith_execution_traces (
        trace_id, sequence_num, event_type, task_id, agent_role,
        event_data, tokens_used, cost_usd, duration_ms
    ) VALUES (
        p_trace_id, v_sequence, p_event_type, p_task_id, p_agent_role,
        p_event_data, p_tokens_used, p_cost_usd, p_duration_ms
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE monolith_context_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_context_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_execution_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_agent_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_workflow_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for context_nodes" ON monolith_context_nodes FOR ALL USING (true);
CREATE POLICY "Allow all for context_edges" ON monolith_context_edges FOR ALL USING (true);
CREATE POLICY "Allow all for execution_traces" ON monolith_execution_traces FOR ALL USING (true);
CREATE POLICY "Allow all for agent_context" ON monolith_agent_context FOR ALL USING (true);
CREATE POLICY "Allow all for workflow_patterns" ON monolith_workflow_patterns FOR ALL USING (true);

GRANT ALL ON monolith_context_nodes TO anon, authenticated;
GRANT ALL ON monolith_context_edges TO anon, authenticated;
GRANT ALL ON monolith_execution_traces TO anon, authenticated;
GRANT ALL ON monolith_agent_context TO anon, authenticated;
GRANT ALL ON monolith_workflow_patterns TO anon, authenticated;
GRANT ALL ON v_task_dependency_graph TO anon, authenticated;
GRANT ALL ON v_agent_workload TO anon, authenticated;
GRANT ALL ON v_execution_flow TO anon, authenticated;

-- ============================================================================
-- SEED AGENT NODES
-- ============================================================================
INSERT INTO monolith_context_nodes (node_type, node_id, label, description, weight, color) VALUES
    ('agent', 'ceo', 'CEO', 'Chief Executive Officer - Strategic decisions', 10, '#FFD700'),
    ('agent', 'cfo', 'CFO', 'Chief Financial Officer - Financial operations', 8, '#4CAF50'),
    ('agent', 'cto', 'CTO', 'Chief Technology Officer - Technology strategy', 8, '#2196F3'),
    ('agent', 'coo', 'COO', 'Chief Operating Officer - Operations', 8, '#9C27B0'),
    ('agent', 'cmo', 'CMO', 'Chief Marketing Officer - Marketing strategy', 7, '#FF9800'),
    ('agent', 'cpo', 'CPO', 'Chief Product Officer - Product development', 7, '#00BCD4'),
    ('agent', 'cos', 'CoS', 'Chief of Staff - Coordination', 9, '#E91E63'),
    ('agent', 'ciso', 'CISO', 'Chief Information Security Officer - Security', 7, '#F44336'),
    ('agent', 'clo', 'CLO', 'General Counsel - Legal affairs', 6, '#795548'),
    ('agent', 'chro', 'CHRO', 'Chief Human Resources Officer - HR', 6, '#607D8B'),
    ('agent', 'devops', 'DevOps', 'DevOps & Infrastructure Lead', 6, '#3F51B5'),
    ('agent', 'qa', 'QA', 'QA Lead - Quality assurance', 5, '#009688'),
    ('agent', 'swe', 'SWE', 'Software Engineer - Development', 5, '#673AB7')
ON CONFLICT (node_type, node_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE monolith_context_nodes IS 'Nodes in the context graph representing tasks, agents, and other entities.';
COMMENT ON TABLE monolith_context_edges IS 'Edges representing relationships between context nodes.';
COMMENT ON TABLE monolith_execution_traces IS 'Detailed execution traces for analyzing system behavior.';
COMMENT ON TABLE monolith_agent_context IS 'Snapshots of agent context state for memory management.';
COMMENT ON TABLE monolith_workflow_patterns IS 'Recognized workflow patterns for optimization.';
COMMENT ON VIEW v_task_dependency_graph IS 'Current task dependency relationships.';
COMMENT ON VIEW v_agent_workload IS 'Agent workload distribution summary.';
COMMENT ON VIEW v_execution_flow IS 'Hourly execution flow metrics.';
