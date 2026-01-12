/**
 * MONOLITH OS - Decision Logger
 * Audit trail for all agent decisions
 * Supports Supabase, file-based, and in-memory logging
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

class DecisionLogger {
  constructor(config = {}) {
    this.mode = config.mode || 'memory'; // 'supabase', 'file', 'memory'
    this.decisions = []; // In-memory store
    this.supabase = null;
    this.logFile = config.logFile || './logs/decisions.jsonl';

    this.initialize(config);
  }

  initialize(config) {
    // Try Supabase first
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.mode = 'supabase';
        console.log('[DECISION-LOGGER] Using Supabase storage');
      } catch (error) {
        console.warn('[DECISION-LOGGER] Supabase init failed, falling back to file');
      }
    }

    // Ensure log directory exists for file mode
    if (this.mode === 'file') {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      console.log('[DECISION-LOGGER] Using file storage:', this.logFile);
    }

    if (this.mode === 'memory') {
      console.log('[DECISION-LOGGER] Using in-memory storage');
    }
  }

  /**
   * Log a decision
   */
  async log(decision) {
    const entry = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...decision,
      logged_at: new Date().toISOString(),
    };

    // Always store in memory for quick access
    this.decisions.push(entry);

    // Persist based on mode
    switch (this.mode) {
      case 'supabase':
        await this.logToSupabase(entry);
        break;
      case 'file':
        this.logToFile(entry);
        break;
      // 'memory' - already stored above
    }

    console.log(`[DECISION-LOGGER] Logged: ${entry.id} by ${entry.role}`);
    return entry.id;
  }

  async logToSupabase(entry) {
    try {
      const { error } = await this.supabase
        .from('agent_decisions')
        .insert([{
          id: entry.id,
          task_id: entry.taskId,
          role: entry.role,
          role_name: entry.roleName,
          decision: entry.decision,
          action: entry.action,
          escalated: entry.escalated,
          escalate_reason: entry.escalateReason,
          handoff: entry.handoff,
          model: entry.model,
          tokens: entry.tokens,
          latency_ms: entry.latencyMs,
          timestamp: entry.timestamp,
          logged_at: entry.logged_at,
        }]);

      if (error) {
        console.error('[DECISION-LOGGER] Supabase error:', error.message);
        // Fallback to file
        this.logToFile(entry);
      }
    } catch (error) {
      console.error('[DECISION-LOGGER] Supabase error:', error.message);
      this.logToFile(entry);
    }
  }

  logToFile(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, line);
    } catch (error) {
      console.error('[DECISION-LOGGER] File write error:', error.message);
    }
  }

  /**
   * Get recent decisions
   */
  async getRecent(limit = 50, filters = {}) {
    if (this.mode === 'supabase' && this.supabase) {
      try {
        let query = this.supabase
          .from('agent_decisions')
          .select('*')
          .order('logged_at', { ascending: false })
          .limit(limit);

        if (filters.role) {
          query = query.eq('role', filters.role);
        }
        if (filters.taskId) {
          query = query.eq('task_id', filters.taskId);
        }
        if (filters.escalated !== undefined) {
          query = query.eq('escalated', filters.escalated);
        }

        const { data, error } = await query;
        if (!error) return data;
      } catch (error) {
        console.error('[DECISION-LOGGER] Supabase query error:', error.message);
      }
    }

    // Fallback to in-memory
    let results = [...this.decisions].reverse();

    if (filters.role) {
      results = results.filter((d) => d.role === filters.role);
    }
    if (filters.taskId) {
      results = results.filter((d) => d.taskId === filters.taskId);
    }
    if (filters.escalated !== undefined) {
      results = results.filter((d) => d.escalated === filters.escalated);
    }

    return results.slice(0, limit);
  }

  /**
   * Get decisions that were escalated to CEO
   */
  async getEscalated(limit = 20) {
    return this.getRecent(limit, { escalated: true });
  }

  /**
   * Get decisions by role
   */
  async getByRole(role, limit = 50) {
    return this.getRecent(limit, { role });
  }

  /**
   * Get decision by ID
   */
  async getById(id) {
    if (this.mode === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase
        .from('agent_decisions')
        .select('*')
        .eq('id', id)
        .single();

      if (!error) return data;
    }

    return this.decisions.find((d) => d.id === id);
  }

  /**
   * Get statistics
   */
  async getStats(since = null) {
    const decisions = since
      ? this.decisions.filter((d) => new Date(d.logged_at) >= new Date(since))
      : this.decisions;

    const stats = {
      total: decisions.length,
      escalated: decisions.filter((d) => d.escalated).length,
      byRole: {},
      byModel: {},
      totalTokens: 0,
      avgLatencyMs: 0,
    };

    let totalLatency = 0;

    for (const d of decisions) {
      // By role
      if (!stats.byRole[d.role]) {
        stats.byRole[d.role] = { total: 0, escalated: 0 };
      }
      stats.byRole[d.role].total++;
      if (d.escalated) stats.byRole[d.role].escalated++;

      // By model
      if (d.model) {
        stats.byModel[d.model] = (stats.byModel[d.model] || 0) + 1;
      }

      // Tokens & latency
      stats.totalTokens += d.tokens || 0;
      totalLatency += d.latencyMs || 0;
    }

    stats.avgLatencyMs = decisions.length > 0 ? Math.round(totalLatency / decisions.length) : 0;

    return stats;
  }

  /**
   * Export decisions to file
   */
  async export(filepath, format = 'json') {
    const decisions = await this.getRecent(10000);

    if (format === 'json') {
      fs.writeFileSync(filepath, JSON.stringify(decisions, null, 2));
    } else if (format === 'csv') {
      const headers = ['id', 'task_id', 'role', 'decision', 'escalated', 'model', 'tokens', 'timestamp'];
      const lines = [headers.join(',')];

      for (const d of decisions) {
        lines.push(headers.map((h) => JSON.stringify(d[h] || '')).join(','));
      }

      fs.writeFileSync(filepath, lines.join('\n'));
    }

    console.log(`[DECISION-LOGGER] Exported ${decisions.length} decisions to ${filepath}`);
  }

  /**
   * Clear in-memory decisions (for testing)
   */
  clear() {
    this.decisions = [];
  }
}

export default DecisionLogger;
