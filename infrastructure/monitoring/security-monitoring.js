/**
 * MONOLITH OS - Security Monitoring Infrastructure
 * Task: 7.5.4 - Set up security monitoring infrastructure
 * Task: 7.5.5 - Configure log aggregation pipeline
 * Task: 7.2.2.3 - Define and configure RTO monitoring
 * Task: 7.2.2.4 - Define and configure RPO monitoring
 */

const https = require('https');

// Monitoring Configuration
const MONITORING_CONFIG = {
  // RTO/RPO Thresholds
  rto: {
    target: 4, // hours
    warning: 3,
    critical: 3.5
  },
  rpo: {
    target: 1, // hours
    warning: 0.75,
    critical: 0.9
  },
  
  // Health check intervals
  healthCheckInterval: 60000, // 1 minute
  metricsInterval: 30000, // 30 seconds
  
  // Endpoints to monitor
  endpoints: {
    frontend: 'https://monolith-system.vercel.app',
    supabase: 'https://nhjnywarhnmlszudcqdl.supabase.co',
    api: 'https://monolith-system.vercel.app/api'
  },
  
  // Alert channels
  alertChannels: ['slack', 'pagerduty', 'email']
};

// Security Metrics Collection
class SecurityMonitor {
  constructor(config = MONITORING_CONFIG) {
    this.config = config;
    this.metrics = {
      uptime: { frontend: 0, backend: 0, database: 0 },
      responseTime: { frontend: [], backend: [], database: [] },
      errors: { count: 0, recent: [] },
      securityEvents: [],
      lastBackup: null,
      rpoStatus: 'unknown',
      rtoStatus: 'unknown'
    };
    this.alertHandlers = new Map();
  }

  // Register alert handler
  registerAlertHandler(channel, handler) {
    this.alertHandlers.set(channel, handler);
  }

  // Send alert to specific channel
  async sendAlert(channel, alert) {
    const handler = this.alertHandlers.get(channel);
    if (handler) {
      try {
        await handler(alert);
      } catch (error) {
        console.error(`Alert handler error (${channel}):`, error);
      }
    }
  }

  // Broadcast alert to all channels
  async broadcastAlert(alert) {
    for (const channel of this.config.alertChannels) {
      await this.sendAlert(channel, alert);
    }
  }

  // Health check for endpoint
  async checkEndpoint(name, url) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 10000 }, (res) => {
        const responseTime = Date.now() - startTime;
        const isHealthy = res.statusCode >= 200 && res.statusCode < 400;
        
        resolve({
          name,
          url,
          status: isHealthy ? 'healthy' : 'degraded',
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date().toISOString()
        });
      });

      req.on('error', (error) => {
        resolve({
          name,
          url,
          status: 'down',
          error: error.message,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          name,
          url,
          status: 'timeout',
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  // Run health checks
  async runHealthChecks() {
    const results = await Promise.all([
      this.checkEndpoint('frontend', this.config.endpoints.frontend),
      this.checkEndpoint('supabase', this.config.endpoints.supabase),
      this.checkEndpoint('api', this.config.endpoints.api)
    ]);

    // Update metrics
    for (const result of results) {
      if (result.status === 'healthy') {
        this.metrics.uptime[result.name]++;
      }
      this.metrics.responseTime[result.name] = 
        this.metrics.responseTime[result.name] || [];
      this.metrics.responseTime[result.name].push(result.responseTime);
      
      // Keep only last 100 measurements
      if (this.metrics.responseTime[result.name].length > 100) {
        this.metrics.responseTime[result.name].shift();
      }

      // Alert on degradation
      if (result.status !== 'healthy') {
        await this.broadcastAlert({
          type: 'HEALTH_CHECK_FAILURE',
          severity: result.status === 'down' ? 'critical' : 'warning',
          service: result.name,
          message: `${result.name} is ${result.status}: ${result.error || result.statusCode}`,
          timestamp: result.timestamp
        });
      }
    }

    return results;
  }

  // Monitor RPO
  async checkRPO() {
    const lastBackup = this.metrics.lastBackup;
    if (!lastBackup) {
      this.metrics.rpoStatus = 'unknown';
      return { status: 'unknown', message: 'No backup information available' };
    }

    const backupAge = (Date.now() - new Date(lastBackup).getTime()) / 3600000;
    const { target, warning, critical } = this.config.rpo;

    let status = 'ok';
    if (backupAge >= target) {
      status = 'critical';
    } else if (backupAge >= critical * target) {
      status = 'critical';
    } else if (backupAge >= warning * target) {
      status = 'warning';
    }

    this.metrics.rpoStatus = status;

    if (status !== 'ok') {
      await this.broadcastAlert({
        type: 'RPO_ALERT',
        severity: status,
        message: `RPO Alert: Last backup was ${backupAge.toFixed(2)} hours ago (target: ${target}h)`,
        currentRPO: backupAge,
        targetRPO: target
      });
    }

    return {
      status,
      lastBackup,
      ageHours: backupAge,
      targetHours: target
    };
  }

  // Record backup completion
  recordBackup(timestamp = new Date().toISOString()) {
    this.metrics.lastBackup = timestamp;
    return this.checkRPO();
  }

  // Monitor RTO (simulated recovery test)
  async estimateRTO() {
    // This would be calculated based on:
    // 1. Backup download time
    // 2. Database restore time
    // 3. Service startup time
    // 4. Verification time
    
    const estimates = {
      backupDownload: 0.5, // hours
      databaseRestore: 1.0,
      serviceStartup: 0.25,
      verification: 0.25,
      buffer: 0.5
    };

    const totalRTO = Object.values(estimates).reduce((a, b) => a + b, 0);
    const { target, warning, critical } = this.config.rto;

    let status = 'ok';
    if (totalRTO >= target) {
      status = 'critical';
    } else if (totalRTO >= critical) {
      status = 'warning';
    }

    this.metrics.rtoStatus = status;

    if (status !== 'ok') {
      await this.broadcastAlert({
        type: 'RTO_ALERT',
        severity: status,
        message: `RTO Alert: Estimated recovery time is ${totalRTO} hours (target: ${target}h)`,
        estimatedRTO: totalRTO,
        targetRTO: target
      });
    }

    return {
      status,
      estimatedHours: totalRTO,
      targetHours: target,
      breakdown: estimates
    };
  }

  // Get dashboard metrics
  getDashboardMetrics() {
    const avgResponseTime = {};
    for (const [service, times] of Object.entries(this.metrics.responseTime)) {
      if (times.length > 0) {
        avgResponseTime[service] = Math.round(
          times.reduce((a, b) => a + b, 0) / times.length
        );
      }
    }

    return {
      timestamp: new Date().toISOString(),
      health: {
        frontend: this.metrics.responseTime.frontend?.length > 0 ? 'healthy' : 'unknown',
        backend: this.metrics.responseTime.backend?.length > 0 ? 'healthy' : 'unknown',
        database: this.metrics.responseTime.database?.length > 0 ? 'healthy' : 'unknown'
      },
      avgResponseTime,
      rpo: {
        status: this.metrics.rpoStatus,
        lastBackup: this.metrics.lastBackup
      },
      rto: {
        status: this.metrics.rtoStatus
      },
      recentErrors: this.metrics.errors.recent.slice(-10),
      securityEvents: this.metrics.securityEvents.slice(-10)
    };
  }

  // Record security event
  recordSecurityEvent(event) {
    this.metrics.securityEvents.push({
      ...event,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 events
    if (this.metrics.securityEvents.length > 1000) {
      this.metrics.securityEvents.shift();
    }
  }

  // Start monitoring
  start() {
    console.log('Starting security monitoring...');
    
    // Health checks
    setInterval(() => this.runHealthChecks(), this.config.healthCheckInterval);
    
    // RPO monitoring
    setInterval(() => this.checkRPO(), 300000); // Every 5 minutes
    
    // RTO estimation
    setInterval(() => this.estimateRTO(), 3600000); // Every hour
    
    // Initial checks
    this.runHealthChecks();
    this.estimateRTO();
    
    console.log('Security monitoring started');
  }
}

// Log Aggregation Pipeline
class LogAggregator {
  constructor() {
    this.logs = [];
    this.maxLogs = 10000;
  }

  // Add log entry
  log(level, message, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata
    };

    this.logs.push(entry);

    // Rotate logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Forward to external service if configured
    this.forwardLog(entry);

    return entry;
  }

  // Forward log to external aggregation service
  async forwardLog(entry) {
    // Forward to Datadog if configured
    if (process.env.DATADOG_API_KEY) {
      try {
        await fetch('https://http-intake.logs.datadoghq.com/v1/input', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': process.env.DATADOG_API_KEY
          },
          body: JSON.stringify({
            ddsource: 'monolith-os',
            service: 'monolith-security',
            hostname: 'vercel',
            ...entry
          })
        });
      } catch (error) {
        console.error('Failed to forward log to Datadog:', error);
      }
    }

    // Forward to ELK if configured
    if (process.env.ELASTICSEARCH_URL) {
      try {
        await fetch(`${process.env.ELASTICSEARCH_URL}/monolith-logs/_doc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch (error) {
        console.error('Failed to forward log to Elasticsearch:', error);
      }
    }
  }

  // Query logs
  query(filter = {}) {
    return this.logs.filter(log => {
      for (const [key, value] of Object.entries(filter)) {
        if (log[key] !== value) return false;
      }
      return true;
    });
  }

  // Get recent logs
  getRecent(count = 100) {
    return this.logs.slice(-count);
  }

  // Get logs by level
  getByLevel(level) {
    return this.query({ level });
  }

  // Export logs
  export(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }
    // Add other formats as needed (CSV, etc.)
    return this.logs;
  }
}

// Create instances
const securityMonitor = new SecurityMonitor();
const logAggregator = new LogAggregator();

// Configure alert handlers
securityMonitor.registerAlertHandler('slack', async (alert) => {
  if (!process.env.SLACK_WEBHOOK_URL) return;
  
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🔒 ${alert.type}: ${alert.message}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: Object.entries(alert)
          .filter(([k]) => !['type', 'message'].includes(k))
          .map(([title, value]) => ({ title, value: String(value), short: true }))
      }]
    })
  });
});

securityMonitor.registerAlertHandler('pagerduty', async (alert) => {
  if (!process.env.PAGERDUTY_ROUTING_KEY) return;
  if (!['critical', 'high'].includes(alert.severity)) return;

  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: process.env.PAGERDUTY_ROUTING_KEY,
      event_action: 'trigger',
      payload: {
        summary: `${alert.type}: ${alert.message}`,
        severity: alert.severity,
        source: 'Monolith OS Security Monitor'
      }
    })
  });
});

module.exports = {
  SecurityMonitor,
  LogAggregator,
  securityMonitor,
  logAggregator,
  MONITORING_CONFIG
};
