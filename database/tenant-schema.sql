-- MONOLITH OS - Multi-tenancy Database Schema
-- Phase 7: Tenant isolation and usage metering
--
-- This schema adds multi-tenant support to the MONOLITH OS database.
-- Run this migration after the base schema is in place.

-- =============================================================================
-- TENANTS TABLE
-- Core tenant configuration and settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,

    -- Subscription/Plan information
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    plan_limits JSONB DEFAULT '{
        "max_users": 5,
        "max_tasks_per_month": 100,
        "max_agents": 2,
        "max_llm_tokens_per_month": 50000,
        "features": ["basic_tasks", "basic_workflows"]
    }'::jsonb,

    -- Tenant settings
    settings JSONB DEFAULT '{
        "timezone": "UTC",
        "date_format": "YYYY-MM-DD",
        "notifications_enabled": true,
        "audit_retention_days": 90
    }'::jsonb,

    -- Contact and billing
    billing_email VARCHAR(255),
    billing_address JSONB,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    trial_ends_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for slug lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;

-- =============================================================================
-- ADD TENANT_ID TO EXISTING TABLES
-- =============================================================================

-- Add tenant_id to tasks table
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to workflows table
ALTER TABLE workflows
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to decision_logs table
ALTER TABLE decision_logs
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to users table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
    END IF;
END $$;

-- =============================================================================
-- TENANT INDEXES
-- Add indexes for tenant-based queries on existing tables
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON workflows(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decision_logs_tenant_id ON decision_logs(tenant_id) WHERE tenant_id IS NOT NULL;

-- Composite indexes for common tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks(tenant_id, status) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_priority ON tasks(tenant_id, priority) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_status ON workflows(tenant_id, status) WHERE tenant_id IS NOT NULL;

-- =============================================================================
-- USAGE RECORDS TABLE
-- Tracks billable usage for metering and billing
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- What is being metered
    metric_type VARCHAR(50) NOT NULL,
    -- Valid types: LLM_TOKENS, LLM_COST, TASKS_PROCESSED, EMAILS_SENT, BROWSER_SESSIONS

    -- Quantity used
    quantity DECIMAL(20, 6) NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT 'count',

    -- Cost information (if applicable)
    unit_cost DECIMAL(10, 6),
    total_cost DECIMAL(20, 6),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Context about the usage
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Can include: model_name, task_id, agent_id, session_id, etc.

    -- Time tracking
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- For aggregation
    aggregation_key VARCHAR(100),
    is_aggregated BOOLEAN DEFAULT FALSE
);

-- Index for tenant + time range queries (most common for billing)
CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_period
    ON usage_records(tenant_id, period_start, period_end);

-- Index for metric type queries
CREATE INDEX IF NOT EXISTS idx_usage_records_metric_type
    ON usage_records(tenant_id, metric_type, period_start);

-- Index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_usage_records_aggregation
    ON usage_records(tenant_id, aggregation_key, is_aggregated)
    WHERE aggregation_key IS NOT NULL;

-- =============================================================================
-- TENANT MEMBERS TABLE
-- Maps users to tenants with roles
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL,

    -- Role within the tenant
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    -- Valid roles: owner, admin, member, viewer

    -- Permissions (overrides role defaults)
    permissions JSONB DEFAULT '{}'::jsonb,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique membership
    CONSTRAINT unique_tenant_member UNIQUE (tenant_id, user_id)
);

-- Index for user lookups (find which tenants a user belongs to)
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON tenant_members(user_id);

-- Index for tenant member listings
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id, status);

-- =============================================================================
-- API KEYS TABLE
-- Tenant-scoped API keys for programmatic access
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Key identification
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,

    -- Permissions
    scopes JSONB DEFAULT '["read"]'::jsonb,

    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,

    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    total_requests BIGINT DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- Index for key lookups (authentication)
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix) WHERE status = 'active';

-- Index for tenant key management
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id, status);

-- =============================================================================
-- USAGE SUMMARIES TABLE
-- Pre-aggregated usage data for fast reporting
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Time period (day, week, month)
    period_type VARCHAR(10) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Aggregated metrics
    llm_tokens_used BIGINT DEFAULT 0,
    llm_cost DECIMAL(20, 6) DEFAULT 0,
    tasks_processed INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    browser_sessions INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,

    -- Additional metrics as JSONB for flexibility
    additional_metrics JSONB DEFAULT '{}'::jsonb,

    -- Billing
    total_cost DECIMAL(20, 6) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint for period
    CONSTRAINT unique_tenant_period UNIQUE (tenant_id, period_type, period_start)
);

-- Index for tenant billing queries
CREATE INDEX IF NOT EXISTS idx_usage_summaries_tenant_period
    ON usage_summaries(tenant_id, period_type, period_start DESC);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES (Optional - Enable if using Supabase RLS)
-- =============================================================================

-- Enable RLS on tenant tables
-- ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (customize based on your auth setup)
-- CREATE POLICY tenant_isolation ON tasks
--     FOR ALL
--     USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get current month usage for a tenant
CREATE OR REPLACE FUNCTION get_current_month_usage(p_tenant_id UUID)
RETURNS TABLE (
    metric_type VARCHAR(50),
    total_quantity DECIMAL(20, 6),
    total_cost DECIMAL(20, 6)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ur.metric_type,
        SUM(ur.quantity) as total_quantity,
        SUM(COALESCE(ur.total_cost, 0)) as total_cost
    FROM usage_records ur
    WHERE ur.tenant_id = p_tenant_id
      AND ur.period_start >= date_trunc('month', CURRENT_DATE)
      AND ur.period_end <= date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    GROUP BY ur.metric_type;
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant is within plan limits
CREATE OR REPLACE FUNCTION check_tenant_limits(
    p_tenant_id UUID,
    p_metric_type VARCHAR(50),
    p_quantity DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_plan_limits JSONB;
    v_limit_key VARCHAR(100);
    v_current_usage DECIMAL;
    v_limit_value DECIMAL;
BEGIN
    -- Get tenant plan limits
    SELECT plan_limits INTO v_plan_limits
    FROM tenants
    WHERE id = p_tenant_id AND deleted_at IS NULL;

    IF v_plan_limits IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Map metric type to limit key
    v_limit_key := CASE p_metric_type
        WHEN 'LLM_TOKENS' THEN 'max_llm_tokens_per_month'
        WHEN 'TASKS_PROCESSED' THEN 'max_tasks_per_month'
        ELSE NULL
    END;

    IF v_limit_key IS NULL THEN
        RETURN TRUE; -- No limit for this metric
    END IF;

    -- Get limit value
    v_limit_value := (v_plan_limits->>v_limit_key)::DECIMAL;

    IF v_limit_value IS NULL OR v_limit_value <= 0 THEN
        RETURN TRUE; -- Unlimited
    END IF;

    -- Get current usage
    SELECT COALESCE(SUM(quantity), 0) INTO v_current_usage
    FROM usage_records
    WHERE tenant_id = p_tenant_id
      AND metric_type = p_metric_type
      AND period_start >= date_trunc('month', CURRENT_DATE);

    RETURN (v_current_usage + p_quantity) <= v_limit_value;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tenant_members_updated_at
    BEFORE UPDATE ON tenant_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER usage_summaries_updated_at
    BEFORE UPDATE ON usage_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- SEED DATA (Optional - for development)
-- =============================================================================

-- Insert default plans
INSERT INTO tenants (id, name, slug, plan, plan_limits, status)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default', 'enterprise',
     '{"max_users": -1, "max_tasks_per_month": -1, "max_agents": -1, "max_llm_tokens_per_month": -1, "features": ["all"]}'::jsonb,
     'active')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE tenants IS 'Multi-tenant configuration and settings';
COMMENT ON TABLE usage_records IS 'Detailed usage tracking for billing and metering';
COMMENT ON TABLE tenant_members IS 'Maps users to tenants with roles';
COMMENT ON TABLE api_keys IS 'Tenant-scoped API keys for programmatic access';
COMMENT ON TABLE usage_summaries IS 'Pre-aggregated usage data for reporting';

COMMENT ON COLUMN tenants.plan_limits IS 'JSON object containing plan-specific limits';
COMMENT ON COLUMN usage_records.metric_type IS 'Type of usage: LLM_TOKENS, LLM_COST, TASKS_PROCESSED, EMAILS_SENT, BROWSER_SESSIONS';
COMMENT ON COLUMN usage_records.metadata IS 'Additional context: model_name, task_id, agent_id, session_id, etc.';
