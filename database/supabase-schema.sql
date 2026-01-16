-- ============================================
-- MONOLITH OS - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- WORKFLOWS table (create first due to FK dependencies)
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    context JSONB DEFAULT '{}',
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER,
    trigger_type VARCHAR(50),
    triggered_by VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_type ON workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflows_created ON workflows(created_at);

-- TASKS table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE,
    content TEXT NOT NULL,
    title VARCHAR(500),
    description TEXT,
    assigned_role VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDING',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    financial_amount DECIMAL(15,2),
    due_date TIMESTAMP WITH TIME ZONE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    metadata JSONB,
    retry_count INTEGER DEFAULT 0,
    priority_score INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_role ON tasks(assigned_role);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_role ON tasks(status, assigned_role);

-- DECISION_LOGS table (used by API routes)
CREATE TABLE IF NOT EXISTS decision_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    role VARCHAR(50),
    role_name VARCHAR(100),
    decision TEXT NOT NULL,
    action TEXT,
    reasoning TEXT,
    rationale TEXT,
    escalated BOOLEAN DEFAULT FALSE,
    escalate_reason TEXT,
    handoff JSONB,
    model_used VARCHAR(100),
    tokens INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    cost DECIMAL(10,6) DEFAULT 0,
    confidence DECIMAL(3,2),
    financial_impact DECIMAL(15,2),
    category VARCHAR(50),
    impact VARCHAR(20),
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_task ON decision_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_decisions_role ON decision_logs(role);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decision_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_decisions_escalated ON decision_logs(escalated);
CREATE INDEX IF NOT EXISTS idx_decisions_role_time ON decision_logs(role, timestamp);

-- ESCALATIONS table
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    decision_id UUID REFERENCES decision_logs(id) ON DELETE SET NULL,
    from_role VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    recommendation TEXT,
    priority VARCHAR(20) DEFAULT 'HIGH',
    status VARCHAR(50) DEFAULT 'pending',
    resolution TEXT,
    resolved_by VARCHAR(100),
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_priority ON escalations(priority);
CREATE INDEX IF NOT EXISTS idx_escalations_from_role ON escalations(from_role);

-- WORKFLOW_STEPS table
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    role_id VARCHAR(50),
    task_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    error TEXT,
    depends_on INTEGER[],
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_wf_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_steps_status ON workflow_steps(status);

-- AGENT_LEARNINGS table
CREATE TABLE IF NOT EXISTS agent_learnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id VARCHAR(50) NOT NULL,
    task_type VARCHAR(100),
    context JSONB NOT NULL,
    outcome JSONB NOT NULL,
    feedback JSONB,
    success BOOLEAN,
    success_rate DECIMAL(3,2),
    total_count INTEGER DEFAULT 1,
    success_count INTEGER DEFAULT 0,
    model_used VARCHAR(100),
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learnings_role ON agent_learnings(role_id);
CREATE INDEX IF NOT EXISTS idx_learnings_type ON agent_learnings(task_type);

-- ============================================
-- AUTOMATIC TIMESTAMP TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_escalations_updated_at ON escalations;
CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON escalations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps;
CREATE TRIGGER update_workflow_steps_updated_at BEFORE UPDATE ON workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- USEFUL VIEWS
-- ============================================

-- Active tasks by role
CREATE OR REPLACE VIEW active_tasks_by_role AS
SELECT
    assigned_role,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_count,
    COUNT(*) FILTER (WHERE priority = 'CRITICAL') as critical_count,
    COUNT(*) FILTER (WHERE priority = 'HIGH') as high_priority_count
FROM tasks
WHERE status NOT IN ('COMPLETED', 'FAILED')
GROUP BY assigned_role;

-- Recent decisions summary (last 24 hours)
CREATE OR REPLACE VIEW recent_decisions_summary AS
SELECT
    role,
    COUNT(*) as decision_count,
    COUNT(*) FILTER (WHERE escalated = true) as escalated_count,
    AVG(latency_ms) as avg_latency_ms,
    SUM(tokens) as total_tokens,
    SUM(cost) as total_cost
FROM decision_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY role;

-- Pending escalations
CREATE OR REPLACE VIEW pending_escalations_view AS
SELECT
    e.*,
    t.content as task_content,
    t.priority as task_priority
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
    e.created_at;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert a sample workflow
INSERT INTO workflows (name, workflow_type, status, description)
VALUES ('Initial Setup', 'System', 'active', 'System initialization workflow')
ON CONFLICT DO NOTHING;

-- Grant permissions (for Supabase anon key access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- SCHEMA COMPLETE
-- ============================================
