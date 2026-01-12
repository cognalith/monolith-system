/**
 * MONOLITH OS - Health Checker
 * System health monitoring and checks
 *
 * Features:
 * - Liveness and readiness probes
 * - Component health checks
 * - Dependency checks
 * - Health history
 */

class HealthChecker {
  constructor(config = {}) {
    this.checks = new Map();
    this.history = [];
    this.maxHistory = config.maxHistory || 100;
    this.checkInterval = config.checkInterval || 30000;
    this.intervalId = null;

    this.status = {
      healthy: true,
      lastCheck: null,
      components: {},
    };

    // Register default checks
    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  registerDefaultChecks() {
    // Memory check
    this.registerCheck('memory', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const percentUsed = Math.round((usage.heapUsed / usage.heapTotal) * 100);

      return {
        healthy: percentUsed < 90,
        details: {
          heapUsedMB,
          heapTotalMB,
          percentUsed,
        },
        message: percentUsed >= 90 ? `High memory usage: ${percentUsed}%` : 'Memory OK',
      };
    });

    // Event loop check
    this.registerCheck('eventLoop', async () => {
      const start = Date.now();
      await new Promise(resolve => setImmediate(resolve));
      const lag = Date.now() - start;

      return {
        healthy: lag < 100,
        details: { lagMs: lag },
        message: lag >= 100 ? `Event loop lag: ${lag}ms` : 'Event loop OK',
      };
    });

    // Uptime check
    this.registerCheck('uptime', async () => {
      const uptimeSeconds = process.uptime();
      const uptimeHours = Math.round(uptimeSeconds / 3600 * 100) / 100;

      return {
        healthy: true,
        details: {
          uptimeSeconds,
          uptimeHours,
        },
        message: `Uptime: ${uptimeHours}h`,
      };
    });
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      critical: options.critical !== false,
      timeout: options.timeout || 5000,
    });
  }

  /**
   * Run all health checks
   */
  async runChecks() {
    const results = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        // Run check with timeout
        const result = await Promise.race([
          check.fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Check timeout')), check.timeout)
          ),
        ]);

        results[name] = {
          ...result,
          status: result.healthy ? 'healthy' : 'unhealthy',
        };

        if (!result.healthy && check.critical) {
          allHealthy = false;
        }
      } catch (error) {
        results[name] = {
          healthy: false,
          status: 'error',
          message: error.message,
        };

        if (check.critical) {
          allHealthy = false;
        }
      }
    }

    // Update status
    this.status = {
      healthy: allHealthy,
      lastCheck: new Date().toISOString(),
      components: results,
    };

    // Store in history
    this.history.push({
      timestamp: this.status.lastCheck,
      healthy: allHealthy,
      results: { ...results },
    });

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    return this.status;
  }

  /**
   * Get current health status
   */
  getStatus() {
    return this.status;
  }

  /**
   * Get liveness probe result
   */
  async getLiveness() {
    // Liveness just checks if the process is running
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get readiness probe result
   */
  async getReadiness() {
    // Readiness checks if the system is ready to serve
    const status = await this.runChecks();

    return {
      ready: status.healthy,
      timestamp: status.lastCheck,
      checks: Object.entries(status.components).map(([name, result]) => ({
        name,
        status: result.status,
        message: result.message,
      })),
    };
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks() {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      try {
        await this.runChecks();
      } catch (error) {
        console.error('[HEALTH] Periodic check error:', error.message);
      }
    }, this.checkInterval);

    // Run initial check
    this.runChecks();
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get health history
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Get uptime percentage from history
   */
  getUptimePercentage() {
    if (this.history.length === 0) return 100;

    const healthyCount = this.history.filter(h => h.healthy).length;
    return Math.round((healthyCount / this.history.length) * 100);
  }

  /**
   * Create HTTP health check handlers
   */
  createHandlers() {
    return {
      liveness: async (req, res) => {
        const result = await this.getLiveness();
        res.status(200).json(result);
      },

      readiness: async (req, res) => {
        const result = await this.getReadiness();
        res.status(result.ready ? 200 : 503).json(result);
      },

      health: async (req, res) => {
        const status = await this.runChecks();
        res.status(status.healthy ? 200 : 503).json(status);
      },
    };
  }
}

export default HealthChecker;
