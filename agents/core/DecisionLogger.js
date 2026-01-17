/**
 * MONOLITH OS - Decision Logger
 * Audit trail for all agent decisions
 * Uses DatabaseService as primary storage with file fallback
 */

import fs from 'fs';
import path from 'path';
import databaseService from '../services/DatabaseService.js';

class DecisionLogger {
  constructor(config = {}) {
    this.decisions = []; // In-memory cache for quick access
    this.logFile = config.logFile || './logs/decisions.jsonl';
    this.maxInMemory = config.maxInMemory || 1000; // Limit in-memory cache size
    this.dbService = config.dbService || databaseService;

    this.initialize();
  }

  initialize() {
    // Ensure log directory exists for file fallback
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    if (this.dbService.isAvailable()) {
      console.log('[DECISION-LOGGER] Using DatabaseService as primary storage');
    } else {
      console.log('[DECISION-LOGGER] DatabaseService unavailable, using file storage');
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

    // Always store in memory for quick access (with limit)
    this.decisions.push(entry);
    if (this.decisions.length > this.maxInMemory) {
      this.decisions = this.decisions.slice(-this.maxInMemory);
    }

    // Try database first
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.logDecision({
        task_id: entry.taskId,
        role_id: entry.role,
        role_name: entry.roleName,
        decision: entry.decision,
        action: entry.action,
        reasoning: entry.reasoning,
        escalated: entry.escalated || false,
        escalate_reason: entry.escalateReason,
        handoff: entry.handoff,
        model_used: entry.model,
        tokens: entry.tokens || 0,
        latency_ms: entry.latencyMs || 0,
        cost: entry.cost || 0,
        confidence: entry.confidence,
        metadata: entry.metadata || {},
        timestamp: entry.timestamp || entry.logged_at,
      });

      if (error) {
        console.warn('[DECISION-LOGGER] Database error, falling back to file:', error.message);
        this.logToFile(entry);
      } else if (data) {
        entry.dbId = data.id; // Store database ID
      }
    } else {
      // Fall back to file
      this.logToFile(entry);
    }

    console.log(`[DECISION-LOGGER] Logged: ${entry.id} by ${entry.role}`);
    return entry.id;
  }

  /**
   * Log to file (fallback)
   */
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
    // Try database first
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.getRecentDecisions(limit, {
        role: filters.role,
        task_id: filters.taskId,
        escalated: filters.escalated,
      });

      if (!error && data) {
        return data;
      }
      console.warn('[DECISION-LOGGER] Database query error, using in-memory cache');
    }

    // Fall back to in-memory
    let results = [...this.decisions].reverse();

    if (filters.role) {
      results = results.filter((d) => d.role === filters.role || d.role_id === filters.role);
    }
    if (filters.taskId) {
      results = results.filter((d) => d.taskId === filters.taskId || d.task_id === filters.taskId);
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
    // Try database first
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.getDecisionsByRole(role, limit);
      if (!error && data) {
        return data;
      }
    }

    // Fall back to in-memory
    return this.getRecent(limit, { role });
  }

  /**
   * Get decision by ID
   */
  async getById(id) {
    // Try database first
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.supabase
        .from('decisions')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return data;
      }
    }

    // Fall back to in-memory
    return this.decisions.find((d) => d.id === id || d.dbId === id);
  }

  /**
   * Get decisions by task
   */
  async getByTask(taskId) {
    // Try database first
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.getDecisionsByTask(taskId);
      if (!error && data) {
        return data;
      }
    }

    // Fall back to in-memory
    return this.decisions.filter((d) => d.taskId === taskId || d.task_id === taskId);
  }

  /**
   * Get statistics
   */
  async getStats(since = null) {
    // Try to get stats from database
    if (this.dbService.isAvailable()) {
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { data: decisions, error } = await this.dbService.supabase
        .from('decisions')
        .select('role_id, model_used, escalated, tokens, latency_ms, cost')
        .gte('timestamp', sinceDate.toISOString());

      if (!error && decisions) {
        return this.calculateStats(decisions.map(d => ({
          role: d.role_id,
          model: d.model_used,
          escalated: d.escalated,
          tokens: d.tokens,
          latencyMs: d.latency_ms,
          cost: d.cost,
        })));
      }
    }

    // Fall back to in-memory
    const decisions = since
      ? this.decisions.filter((d) => new Date(d.logged_at) >= new Date(since))
      : this.decisions;

    return this.calculateStats(decisions);
  }

  /**
   * Calculate stats from decision array
   */
  calculateStats(decisions) {
    const stats = {
      total: decisions.length,
      escalated: decisions.filter((d) => d.escalated).length,
      byRole: {},
      byModel: {},
      totalTokens: 0,
      totalCost: 0,
      avgLatencyMs: 0,
    };

    let totalLatency = 0;

    for (const d of decisions) {
      const role = d.role || d.role_id;
      const model = d.model || d.model_used;

      // By role
      if (role) {
        if (!stats.byRole[role]) {
          stats.byRole[role] = { total: 0, escalated: 0 };
        }
        stats.byRole[role].total++;
        if (d.escalated) stats.byRole[role].escalated++;
      }

      // By model
      if (model) {
        stats.byModel[model] = (stats.byModel[model] || 0) + 1;
      }

      // Tokens, latency, cost
      stats.totalTokens += d.tokens || 0;
      stats.totalCost += d.cost || 0;
      totalLatency += d.latencyMs || d.latency_ms || 0;
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
        lines.push(headers.map((h) => {
          const value = d[h] || d[h.replace('_', '')] || '';
          return JSON.stringify(value);
        }).join(','));
      }

      fs.writeFileSync(filepath, lines.join('\n'));
    }

    console.log(`[DECISION-LOGGER] Exported ${decisions.length} decisions to ${filepath}`);
  }

  /**
   * Sync file-based decisions to database (utility method)
   */
  async syncToDatabase() {
    if (!this.dbService.isAvailable()) {
      console.warn('[DECISION-LOGGER] Database not available for sync');
      return { synced: 0, errors: 0 };
    }

    if (!fs.existsSync(this.logFile)) {
      return { synced: 0, errors: 0 };
    }

    const content = fs.readFileSync(this.logFile, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);

    let synced = 0;
    let errors = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const { error } = await this.dbService.logDecision({
          task_id: entry.taskId,
          role_id: entry.role,
          role_name: entry.roleName,
          decision: entry.decision,
          action: entry.action,
          escalated: entry.escalated || false,
          escalate_reason: entry.escalateReason,
          model_used: entry.model,
          tokens: entry.tokens || 0,
          latency_ms: entry.latencyMs || 0,
          timestamp: entry.timestamp || entry.logged_at,
        });

        if (error) {
          errors++;
        } else {
          synced++;
        }
      } catch (e) {
        errors++;
      }
    }

    console.log(`[DECISION-LOGGER] Synced ${synced} decisions, ${errors} errors`);
    return { synced, errors };
  }

  /**
   * Clear in-memory decisions (for testing)
   */
  clear() {
    this.decisions = [];
  }

  /**
   * Check if database is being used
   */
  isUsingDatabase() {
    return this.dbService.isAvailable();
  }
}

export default DecisionLogger;
