-- MONOLITH OS - Database Schema
-- PostgreSQL schema for Supabase
-- Version: 2.0.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- ============================================================================
-- TASKS TABLE
-- Central task management for all agent operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE, -- For external system references
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assigned_to VARCHAR(50), -- Role ID (e.g., 'cfo', 'cto')
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'blocked', 'escalated')),
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    financial_amount DECIMAL(15, 2), -- For financial-related tasks
    due_date TIMESTAMP WITH TIME ZONE,
    blocked_by UUID[], -- Array of task IDs blocking this task
    workflow_id UUID, -- Reference to parent workflow
    parent_task_id UUID REFERENCES tasks(id), -- For subtasks/handoffs
    metadata JSONB DEFAULT '{}', -- Flexible additional data
    retry_count INTEGER DEFAULT 0,
    priority_score INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_assigned ON tasks(status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_external_id ON tasks(external_id);

-- ============================================================================
-- DECISIONS TABLE
-- Audit trail for all agent decisions
-- ============================================================================
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    role_id VARCHAR(50) NOT NULL, -- Agent role making the decision
    role_name VARCHAR(100),
    decision TEXT NOT NULL, -- The decision made
    action TEXT, -- Action taken based on decision
    reasoning TEXT, -- Why this decision was made
    escalated BOOLEAN DEFAULT FALSE,
    escalate_reason TEXT,
    handoff JSONB, -- Handoff details if applicable
    model_used VARCHAR(100), -- AI model used
    tokens INTEGER DEFAULT 0, -- Tokens consumed
    latency_ms INTEGER DEFAULT 0, -- Response latency
    cost DECIMAL(10, 6) DEFAULT 0, -- Cost in dollars
    confidence DECIMAL(3, 2), -- Confidence score 0-1
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for decisions
CREATE INDEX IF NOT EXISTS idx_decisions_task_id ON decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_decisions_role_id ON decisions(role_id);
CREATE INDEX IF NOT EXISTS idx_decisions_escalated ON decisions(escalated);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_decisions_model_used ON decisions(model_used);
CREATE INDEX IF NOT EXISTS idx_decisions_role_timestamp ON decisions(role_id, timestamp);

-- ============================================================================
-- ESCALATIONS TABLE
-- Items requiring CEO or human intervention
-- ============================================================================
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
    from_role VARCHAR(50) NOT NULL, -- Role that escalated
    reason TEXT NOT NULL, -- Why it was escalated
    recommendation TEXT, -- Agent's recommendation
    priority VARCHAR(20) DEFAULT 'HIGH' CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    resolution TEXT, -- How it was resolved
    resolved_by VARCHAR(100), -- Who resolved it
    context JSONB DEFAULT '{}', -- Additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for escalations
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_from_role ON escalations(from_role);
CREATE INDEX IF NOT EXISTS idx_escalations_priority ON escalations(priority);
CREATE INDEX IF NOT EXISTS idx_escalations_task_id ON escalations(task_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON escalations(created_at);

-- ============================================================================
-- AGENT LEARNINGS TABLE
-- Machine learning feedback for continuous improvement
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_learnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id VARCHAR(50) NOT NULL, -- Agent role
    task_type VARCHAR(100), -- Type of task (e.g., 'analysis', 'decision')
    context JSONB NOT NULL, -- Input context
    outcome JSONB NOT NULL, -- What happened
    feedback JSONB, -- Human or system feedback
    success BOOLEAN,
    success_rate DECIMAL(3, 2), -- Running success rate
    total_count INTEGER DEFAULT 1,
    success_count INTEGER DEFAULT 0,
    model_used VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent_learnings
CREATE INDEX IF NOT EXISTS idx_learnings_role_id ON agent_learnings(role_id);
CREATE INDEX IF NOT EXISTS idx_learnings_task_type ON agent_learnings(task_type);
CREATE INDEX IF NOT EXISTS idx_learnings_success ON agent_learnings(success);
CREATE INDEX IF NOT EXISTS idx_learnings_role_type ON agent_learnings(role_id, task_type);
CREATE INDEX IF NOT EXISTS idx_learnings_timestamp ON agent_learnings(timestamp);

-- ============================================================================
-- WORKFLOWS TABLE
-- Multi-step workflow management
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type VARCHAR(100) NOT NULL, -- E.g., 'Financial', 'Technical Review'
    name VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'failed', 'cancelled')),
    context JSONB DEFAULT '{}', -- Workflow context/state
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER,
    trigger_type VARCHAR(50), -- manual, scheduled, event
    triggered_by VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for workflows
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_type ON workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);

-- ============================================================================
-- WORKFLOW STEPS TABLE
-- Individual steps within workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    role_id VARCHAR(50), -- Assigned agent role
    task_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
    result JSONB, -- Step result/output
    error TEXT, -- Error if failed
    depends_on INTEGER[], -- Previous step numbers this depends on
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for workflow_steps
CREATE INDEX IF NOT EXISTS idx_wf_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_wf_steps_role_id ON workflow_steps(role_id);
CREATE INDEX IF NOT EXISTS idx_wf_steps_workflow_step ON workflow_steps(workflow_id, step_number);

-- ============================================================================
-- API KEYS TABLE
-- API key management for external access
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA256 hash of the key
    key_prefix VARCHAR(10), -- First few chars for identification
    name VARCHAR(255) NOT NULL, -- Friendly name
    description TEXT,
    permissions JSONB DEFAULT '["read"]', -- Array of permissions
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    rate_limit_window INTEGER DEFAULT 3600, -- Window in seconds
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);

-- ============================================================================
-- RATE LIMITS TABLE
-- Token bucket rate limiting
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL, -- API key ID or IP address
    endpoint VARCHAR(255) NOT NULL, -- API endpoint
    tokens INTEGER NOT NULL DEFAULT 0, -- Current token count
    max_tokens INTEGER NOT NULL DEFAULT 100, -- Maximum tokens
    refill_rate INTEGER NOT NULL DEFAULT 10, -- Tokens per second
    last_refill TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(identifier, endpoint)
);

-- Indexes for rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_id_endpoint ON rate_limits(identifier, endpoint);

-- ============================================================================
-- SESSIONS TABLE
-- Session management for dashboard and API
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255), -- Can be null for anonymous sessions
    data JSONB DEFAULT '{}', -- Session data
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- UPDATE TRIGGERS
-- Automatically update updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_escalations_updated_at ON escalations;
CREATE TRIGGER update_escalations_updated_at
    BEFORE UPDATE ON escalations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps;
CREATE TRIGGER update_workflow_steps_updated_at
    BEFORE UPDATE ON workflow_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS for security (configure policies based on your auth setup)
-- ============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Default policies: allow service role full access
-- Adjust these based on your security requirements

CREATE POLICY "Service role has full access to tasks"
    ON tasks FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to decisions"
    ON decisions FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to escalations"
    ON escalations FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to agent_learnings"
    ON agent_learnings FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to workflows"
    ON workflows FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to workflow_steps"
    ON workflow_steps FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to api_keys"
    ON api_keys FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to rate_limits"
    ON rate_limits FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to sessions"
    ON sessions FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- VIEWS
-- Useful views for common queries
-- ============================================================================

-- Active tasks by role
CREATE OR REPLACE VIEW active_tasks_by_role AS
SELECT
    assigned_to as role,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE priority = 'CRITICAL') as critical,
    COUNT(*) FILTER (WHERE priority = 'HIGH') as high_priority
FROM tasks
WHERE status NOT IN ('completed', 'failed')
GROUP BY assigned_to;

-- Recent decisions summary
CREATE OR REPLACE VIEW recent_decisions_summary AS
SELECT
    role_id,
    COUNT(*) as decision_count,
    COUNT(*) FILTER (WHERE escalated = true) as escalated_count,
    AVG(latency_ms) as avg_latency_ms,
    SUM(tokens) as total_tokens,
    SUM(cost) as total_cost
FROM decisions
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY role_id;

-- Pending escalations
CREATE OR REPLACE VIEW pending_escalations_view AS
SELECT
    e.id,
    e.from_role,
    e.reason,
    e.recommendation,
    e.priority,
    e.created_at,
    t.title as task_title,
    t.description as task_description
FROM escalations e
LEFT JOIN tasks t ON e.task_id = t.id
WHERE e.status = 'pending'
ORDER BY
    CASE e.priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        ELSE 4
    END,
    e.created_at ASC;

-- ============================================================================
-- COMMENTS
-- Document the schema
-- ============================================================================
COMMENT ON TABLE tasks IS 'Central task management for all agent operations';
COMMENT ON TABLE decisions IS 'Audit trail for all agent decisions';
COMMENT ON TABLE escalations IS 'Items requiring CEO or human intervention';
COMMENT ON TABLE agent_learnings IS 'Machine learning feedback for continuous improvement';
COMMENT ON TABLE workflows IS 'Multi-step workflow management';
COMMENT ON TABLE workflow_steps IS 'Individual steps within workflows';
COMMENT ON TABLE api_keys IS 'API key management for external access';
COMMENT ON TABLE rate_limits IS 'Token bucket rate limiting';
COMMENT ON TABLE sessions IS 'Session management for dashboard and API';
