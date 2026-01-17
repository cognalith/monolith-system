/**
 * COS SELF-MONITOR - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * CoS (Chief of Staff) self-monitoring system.
 * Tracks amendment success rate and alerts CEO when performance degrades.
 *
 * HARDCODED CONSTRAINTS (CoS cannot modify these):
 * - Alert threshold: 50% success rate
 * - Window size: 20 amendments
 * - Minimum amendments for alert: 10
 * - CoS cannot modify its own evaluation logic
 */

import { createClient } from '@supabase/supabase-js';

// HARDCODED - CoS cannot modify these values
const HARDCODED = Object.freeze({
  ALERT_THRESHOLD: 0.50,        // 50% success rate triggers alert
  WINDOW_SIZE: 20,              // Rolling window of last 20 amendments
  MIN_AMENDMENTS_FOR_ALERT: 10, // Need at least 10 amendments to calculate
  SELF_MODIFY_BLOCKED: true,    // CoS cannot modify these constraints

  // Alert types
  ALERT_TYPES: Object.freeze({
    LOW_SUCCESS_RATE: 'cos_low_success_rate',
    RAPID_DECLINE: 'cos_rapid_decline',
    SUSTAINED_LOW: 'cos_sustained_low',
  }),
});

/**
 * CoS Self-Monitor
 * Tracks CoS amendment performance and alerts CEO
 */
class CoSSelfMonitor {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;

    // These values are HARDCODED and cannot be overridden
    this.alertThreshold = HARDCODED.ALERT_THRESHOLD;
    this.windowSize = HARDCODED.WINDOW_SIZE;
    this.minAmendments = HARDCODED.MIN_AMENDMENTS_FOR_ALERT;

    this.initialize(config);
  }

  initialize(config) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });
      this.isConnected = true;
    }
  }

  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // Prevent any attempt to modify hardcoded values
  setAlertThreshold() {
    throw new Error('BLOCKED: CoS cannot modify alert threshold');
  }

  setWindowSize() {
    throw new Error('BLOCKED: CoS cannot modify window size');
  }

  modifyEvaluationLogic() {
    throw new Error('BLOCKED: CoS cannot modify its own evaluation logic');
  }

  // ============================================================================
  // OUTCOME RECORDING
  // ============================================================================

  /**
   * Record amendment outcome for monitoring
   */
  async recordAmendmentOutcome(amendmentId, agentRole, success, details = {}) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('cos_monitoring')
      .insert([{
        amendment_id: amendmentId,
        agent_role: agentRole,
        success,
        evaluation_details: details,
      }])
      .select()
      .single();

    if (!error) {
      // Check if alert threshold breached
      await this.checkAlertThreshold();
    }

    return { data, error };
  }

  // ============================================================================
  // SUCCESS RATE COMPUTATION
  // ============================================================================

  /**
   * Compute success rate over rolling window
   * HARDCODED: Uses last 20 amendments
   */
  async computeSuccessRate() {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data: records } = await this.supabase
      .from('cos_monitoring')
      .select('success, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(this.windowSize);

    if (!records || records.length === 0) {
      return {
        data: {
          successRate: null,
          total: 0,
          successes: 0,
          failures: 0,
          insufficient: true,
        },
        error: null,
      };
    }

    const successes = records.filter(r => r.success).length;
    const total = records.length;
    const successRate = successes / total;

    return {
      data: {
        successRate,
        total,
        successes,
        failures: total - successes,
        insufficient: total < this.minAmendments,
        windowSize: this.windowSize,
      },
      error: null,
    };
  }

  /**
   * Get detailed metrics for dashboard
   */
  async getMonitoringMetrics() {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get success rate
    const { data: rateData } = await this.computeSuccessRate();

    // Get trend (compare last 10 to previous 10)
    const { data: records } = await this.supabase
      .from('cos_monitoring')
      .select('success, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(this.windowSize);

    let trend = 'stable';
    if (records && records.length >= this.windowSize) {
      const recent10 = records.slice(0, 10);
      const previous10 = records.slice(10, 20);

      const recentRate = recent10.filter(r => r.success).length / 10;
      const previousRate = previous10.filter(r => r.success).length / 10;

      if (recentRate > previousRate + 0.1) {
        trend = 'improving';
      } else if (recentRate < previousRate - 0.1) {
        trend = 'declining';
      }
    }

    // Get active alerts
    const { data: alerts } = await this.supabase
      .from('ceo_alerts')
      .select('*')
      .in('alert_type', Object.values(HARDCODED.ALERT_TYPES))
      .eq('status', 'active');

    // Get by-agent breakdown
    const { data: byAgent } = await this.supabase
      .from('cos_monitoring')
      .select('agent_role, success')
      .order('recorded_at', { ascending: false })
      .limit(100);

    const agentStats = {};
    if (byAgent) {
      for (const r of byAgent) {
        if (!agentStats[r.agent_role]) {
          agentStats[r.agent_role] = { total: 0, successes: 0 };
        }
        agentStats[r.agent_role].total++;
        if (r.success) agentStats[r.agent_role].successes++;
      }
    }

    return {
      data: {
        ...rateData,
        trend,
        thresholds: {
          alertThreshold: this.alertThreshold,
          windowSize: this.windowSize,
          minAmendments: this.minAmendments,
        },
        hasActiveAlert: alerts && alerts.length > 0,
        activeAlerts: alerts || [],
        byAgent: agentStats,
      },
      error: null,
    };
  }

  // ============================================================================
  // ALERT MANAGEMENT
  // ============================================================================

  /**
   * Check if alert threshold is breached
   * HARDCODED: Alerts if success rate < 50% over 20 amendments
   */
  async checkAlertThreshold() {
    const { data: metrics } = await this.computeSuccessRate();

    if (!metrics || metrics.insufficient) {
      return { alertTriggered: false, reason: 'insufficient_data' };
    }

    if (metrics.successRate < this.alertThreshold) {
      // Check if alert already exists
      const { data: existing } = await this.supabase
        .from('ceo_alerts')
        .select('id')
        .eq('alert_type', HARDCODED.ALERT_TYPES.LOW_SUCCESS_RATE)
        .eq('status', 'active')
        .single();

      if (!existing) {
        // Create new alert
        await this.createCEOAlert(
          HARDCODED.ALERT_TYPES.LOW_SUCCESS_RATE,
          `CoS success rate dropped below ${this.alertThreshold * 100}%`,
          {
            currentRate: metrics.successRate,
            threshold: this.alertThreshold,
            window: metrics.total,
            successes: metrics.successes,
            failures: metrics.failures,
          }
        );

        return { alertTriggered: true, metrics };
      }
    }

    return { alertTriggered: false, metrics };
  }

  /**
   * Create CEO alert
   */
  async createCEOAlert(alertType, message, metrics, severity = 'HIGH') {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('ceo_alerts')
      .insert([{
        alert_type: alertType,
        severity,
        message,
        metrics,
        status: 'active',
      }])
      .select()
      .single();

    if (!error) {
      console.log(`[COS-ALERT] CEO Alert created: ${alertType} - ${message}`);
    }

    return { data, error };
  }

  /**
   * Get active CEO alerts
   */
  async getActiveAlerts() {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('ceo_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  }

  /**
   * Acknowledge alert (CEO action)
   */
  async acknowledgeAlert(alertId, acknowledgedBy = 'frank') {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('ceo_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: acknowledgedBy,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('status', 'active')
      .select()
      .single();

    return { data, error };
  }

  /**
   * Resolve alert (CEO action)
   */
  async resolveAlert(alertId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('ceo_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .in('status', ['active', 'acknowledged'])
      .select()
      .single();

    return { data, error };
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Get CoS health status
   */
  async getHealthStatus() {
    const { data: metrics } = await this.getMonitoringMetrics();

    if (!metrics) {
      return {
        status: 'unknown',
        message: 'Unable to compute health metrics',
      };
    }

    if (metrics.insufficient) {
      return {
        status: 'initializing',
        message: `Need ${this.minAmendments - metrics.total} more amendments for monitoring`,
        metrics,
      };
    }

    if (metrics.successRate < this.alertThreshold) {
      return {
        status: 'critical',
        message: `Success rate ${(metrics.successRate * 100).toFixed(1)}% is below ${this.alertThreshold * 100}% threshold`,
        metrics,
      };
    }

    if (metrics.successRate < this.alertThreshold + 0.1) {
      return {
        status: 'warning',
        message: `Success rate ${(metrics.successRate * 100).toFixed(1)}% is approaching threshold`,
        metrics,
      };
    }

    return {
      status: 'healthy',
      message: `Success rate ${(metrics.successRate * 100).toFixed(1)}% is within acceptable range`,
      metrics,
    };
  }

  /**
   * Get hardcoded constraints (for transparency)
   */
  getConstraints() {
    return {
      alertThreshold: this.alertThreshold,
      windowSize: this.windowSize,
      minAmendments: this.minAmendments,
      selfModifyBlocked: HARDCODED.SELF_MODIFY_BLOCKED,
      note: 'These values are HARDCODED and cannot be modified by CoS',
    };
  }
}

// Export
export { CoSSelfMonitor, HARDCODED };
export default CoSSelfMonitor;
