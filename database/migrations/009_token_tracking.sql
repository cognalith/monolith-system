-- ============================================================================
-- PHASE 8: TOKEN TRACKING & EFFICIENCY - Database Schema
-- Cognalith Inc. | Monolith System
--
-- Adds token tracking for measuring LLM usage and efficiency across agents
-- ============================================================================

-- ============================================================================
-- ADD TOKEN TRACKING COLUMNS TO TASK QUEUE
-- ============================================================================
ALTER TABLE monolith_task_queue
ADD COLUMN IF NOT EXISTS tokens_estimated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_input INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_output INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS llm_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS execution_cost_usd NUMERIC(10,6) DEFAULT 0;

-- ============================================================================
-- AGENT TOKEN SUMMARY TABLE
-- Aggregated token usage per agent for efficiency tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_agent_token_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Agent identification
    agent_role TEXT NOT NULL,

    -- Time period (daily aggregation)
    stats_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Token counts
    tasks_executed INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,

    total_tokens_estimated INTEGER DEFAULT 0,
    total_tokens_input INTEGER DEFAULT 0,
    total_tokens_output INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,

    total_llm_calls INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(12,6) DEFAULT 0,

    -- Efficiency metrics
    avg_tokens_per_task NUMERIC(10,2) DEFAULT 0,
    estimation_accuracy NUMERIC(5,2) DEFAULT 0, -- percentage

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_role, stats_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_token_stats_role ON monolith_agent_token_stats(agent_role);
CREATE INDEX IF NOT EXISTS idx_agent_token_stats_date ON monolith_agent_token_stats(stats_date DESC);

-- ============================================================================
-- TOKEN USAGE LOG TABLE
-- Detailed log of each LLM call for auditing
-- ============================================================================
CREATE TABLE IF NOT EXISTS monolith_token_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference
    task_id UUID REFERENCES monolith_task_queue(id) ON DELETE SET NULL,
    agent_role TEXT NOT NULL,

    -- LLM details
    model TEXT NOT NULL,
    provider TEXT DEFAULT 'openai', -- openai, anthropic, etc.

    -- Token counts
    tokens_input INTEGER NOT NULL,
    tokens_output INTEGER NOT NULL,
    tokens_total INTEGER NOT NULL,

    -- Cost
    cost_usd NUMERIC(10,6) DEFAULT 0,

    -- Timing
    latency_ms INTEGER,

    -- Context
    call_type TEXT, -- 'task_execution', 'decision', 'research', etc.
    prompt_template TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_task ON monolith_token_usage_log(task_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON monolith_token_usage_log(agent_role);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON monolith_token_usage_log(created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE monolith_agent_token_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE monolith_token_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for agent_token_stats" ON monolith_agent_token_stats FOR ALL USING (true);
CREATE POLICY "Allow all for token_usage_log" ON monolith_token_usage_log FOR ALL USING (true);

GRANT ALL ON monolith_agent_token_stats TO anon, authenticated;
GRANT ALL ON monolith_token_usage_log TO anon, authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE monolith_agent_token_stats IS 'Daily aggregated token usage statistics per agent.';
COMMENT ON TABLE monolith_token_usage_log IS 'Detailed log of each LLM API call with token counts and costs.';
COMMENT ON COLUMN monolith_task_queue.tokens_estimated IS 'Estimated tokens before execution.';
COMMENT ON COLUMN monolith_task_queue.tokens_total IS 'Actual total tokens used (input + output).';
