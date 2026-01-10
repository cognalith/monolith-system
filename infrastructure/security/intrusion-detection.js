/**
 * MONOLITH OS - Intrusion Detection System
 * Task: 7.4.1.5 - Set up intrusion detection systems
 * Task: 7.4.1.6 - Configure security alerting thresholds
 * Task: 7.4.1.7 - Deploy automated response triggers
 */

const ALERT_THRESHOLDS = {
  // Authentication alerts
  failedLoginAttempts: {
    threshold: 5,
    window: '5m',
    severity: 'high',
    action: 'block_ip'
  },
  passwordResetRequests: {
    threshold: 3,
    window: '1h',
    severity: 'medium',
    action: 'notify'
  },
  
  // Rate limiting
  apiRequestsPerMinute: {
    threshold: 100,
    window: '1m',
    severity: 'medium',
    action: 'rate_limit'
  },
  apiRequestsPerHour: {
    threshold: 1000,
    window: '1h',
    severity: 'high',
    action: 'throttle'
  },
  
  // Suspicious patterns
  sqlInjectionAttempts: {
    threshold: 1,
    window: '1m',
    severity: 'critical',
    action: 'block_and_alert'
  },
  xssAttempts: {
    threshold: 1,
    window: '1m',
    severity: 'critical',
    action: 'block_and_alert'
  },
  
  // Data exfiltration
  bulkDataAccess: {
    threshold: 1000,
    window: '5m',
    severity: 'high',
    action: 'alert_and_throttle'
  },
  unusualDataPatterns: {
    threshold: 1,
    window: '1m',
    severity: 'high',
    action: 'alert'
  }
};

// Suspicious patterns to detect
const SUSPICIOUS_PATTERNS = {
  sqlInjection: [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i
  ],
  xss: [
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,
    /((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))[^\n]+((\%3E)|>)/i,
    /((\%3C)|<)[^\n]+((\%3E)|>)/i
  ],
  pathTraversal: [
    /\.\.\//,
    /\.\.%2f/i,
    /%2e%2e\//i,
    /%2e%2e%2f/i
  ],
  commandInjection: [
    /;|\||`|\$\(|\${/,
    /\b(cat|ls|pwd|whoami|wget|curl)\b/i
  ]
};

class IntrusionDetectionSystem {
  constructor(config = {}) {
    this.alertThresholds = { ...ALERT_THRESHOLDS, ...config.thresholds };
    this.eventStore = new Map();
    this.blockedIPs = new Set();
    this.alertHandlers = [];
  }

  // Register alert handler
  onAlert(handler) {
    this.alertHandlers.push(handler);
  }

  // Send alert to all handlers
  async sendAlert(alert) {
    const enrichedAlert = {
      ...alert,
      timestamp: new Date().toISOString(),
      system: 'Monolith OS IDS'
    };

    for (const handler of this.alertHandlers) {
      try {
        await handler(enrichedAlert);
      } catch (error) {
        console.error('Alert handler error:', error);
      }
    }

    return enrichedAlert;
  }

  // Check request for suspicious patterns
  analyzeRequest(req) {
    const threats = [];
    const requestData = {
      url: req.url || '',
      body: JSON.stringify(req.body || {}),
      query: JSON.stringify(req.query || {}),
      headers: JSON.stringify(req.headers || {})
    };

    const fullRequest = Object.values(requestData).join(' ');

    // Check SQL injection
    for (const pattern of SUSPICIOUS_PATTERNS.sqlInjection) {
      if (pattern.test(fullRequest)) {
        threats.push({ type: 'SQL_INJECTION', pattern: pattern.toString() });
      }
    }

    // Check XSS
    for (const pattern of SUSPICIOUS_PATTERNS.xss) {
      if (pattern.test(fullRequest)) {
        threats.push({ type: 'XSS', pattern: pattern.toString() });
      }
    }

    // Check path traversal
    for (const pattern of SUSPICIOUS_PATTERNS.pathTraversal) {
      if (pattern.test(fullRequest)) {
        threats.push({ type: 'PATH_TRAVERSAL', pattern: pattern.toString() });
      }
    }

    // Check command injection
    for (const pattern of SUSPICIOUS_PATTERNS.commandInjection) {
      if (pattern.test(fullRequest)) {
        threats.push({ type: 'COMMAND_INJECTION', pattern: pattern.toString() });
      }
    }

    return threats;
  }

  // Track event for rate limiting
  trackEvent(eventType, identifier) {
    const key = `${eventType}:${identifier}`;
    const now = Date.now();
    
    if (!this.eventStore.has(key)) {
      this.eventStore.set(key, []);
    }

    const events = this.eventStore.get(key);
    events.push(now);

    // Clean old events (keep last hour)
    const hourAgo = now - 3600000;
    this.eventStore.set(key, events.filter(t => t > hourAgo));

    return this.checkThreshold(eventType, identifier);
  }

  // Check if threshold exceeded
  checkThreshold(eventType, identifier) {
    const config = this.alertThresholds[eventType];
    if (!config) return null;

    const key = `${eventType}:${identifier}`;
    const events = this.eventStore.get(key) || [];
    
    const windowMs = this.parseWindow(config.window);
    const windowStart = Date.now() - windowMs;
    const recentEvents = events.filter(t => t > windowStart);

    if (recentEvents.length >= config.threshold) {
      return {
        type: eventType,
        identifier,
        count: recentEvents.length,
        threshold: config.threshold,
        window: config.window,
        severity: config.severity,
        action: config.action
      };
    }

    return null;
  }

  // Parse time window string
  parseWindow(window) {
    const match = window.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 60000; // default 1 minute

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60000;
      case 'h': return value * 3600000;
      case 'd': return value * 86400000;
      default: return 60000;
    }
  }

  // Execute automated response
  async executeResponse(alert) {
    switch (alert.action) {
      case 'block_ip':
        this.blockedIPs.add(alert.identifier);
        await this.sendAlert({
          ...alert,
          message: `IP ${alert.identifier} blocked due to ${alert.type}`
        });
        break;

      case 'block_and_alert':
        this.blockedIPs.add(alert.identifier);
        await this.sendAlert({
          ...alert,
          message: `CRITICAL: ${alert.type} detected from ${alert.identifier}`,
          priority: 'P1'
        });
        break;

      case 'rate_limit':
        await this.sendAlert({
          ...alert,
          message: `Rate limit applied to ${alert.identifier}`
        });
        break;

      case 'throttle':
        await this.sendAlert({
          ...alert,
          message: `Throttling applied to ${alert.identifier}`
        });
        break;

      case 'alert':
      case 'notify':
        await this.sendAlert({
          ...alert,
          message: `Security event: ${alert.type} from ${alert.identifier}`
        });
        break;

      default:
        await this.sendAlert(alert);
    }
  }

  // Check if IP is blocked
  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  // Middleware for Express
  middleware() {
    return async (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;

      // Check if IP is blocked
      if (this.isBlocked(ip)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Analyze request for threats
      const threats = this.analyzeRequest(req);
      
      for (const threat of threats) {
        const alert = {
          type: threat.type,
          identifier: ip,
          severity: 'critical',
          action: 'block_and_alert',
          details: threat
        };
        await this.executeResponse(alert);
        return res.status(403).json({ error: 'Request blocked' });
      }

      // Track API request
      const rateAlert = this.trackEvent('apiRequestsPerMinute', ip);
      if (rateAlert) {
        await this.executeResponse(rateAlert);
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      next();
    };
  }
}

// Alert handlers
const slackAlertHandler = async (alert) => {
  if (!process.env.SLACK_WEBHOOK_URL) return;
  
  const color = alert.severity === 'critical' ? '#ff0000' : 
                alert.severity === 'high' ? '#ff9900' : '#ffcc00';

  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        title: `🚨 Security Alert: ${alert.type}`,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Action', value: alert.action, short: true },
          { title: 'Identifier', value: alert.identifier, short: true },
          { title: 'Timestamp', value: alert.timestamp, short: true }
        ]
      }]
    })
  });
};

const pagerDutyAlertHandler = async (alert) => {
  if (!process.env.PAGERDUTY_ROUTING_KEY) return;
  if (alert.severity !== 'critical' && alert.severity !== 'high') return;

  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: process.env.PAGERDUTY_ROUTING_KEY,
      event_action: 'trigger',
      payload: {
        summary: `${alert.type}: ${alert.message}`,
        severity: alert.severity === 'critical' ? 'critical' : 'error',
        source: 'Monolith OS IDS',
        custom_details: alert
      }
    })
  });
};

// Export
module.exports = {
  IntrusionDetectionSystem,
  ALERT_THRESHOLDS,
  SUSPICIOUS_PATTERNS,
  slackAlertHandler,
  pagerDutyAlertHandler
};

// Example usage
if (require.main === module) {
  const ids = new IntrusionDetectionSystem();
  ids.onAlert(slackAlertHandler);
  ids.onAlert(pagerDutyAlertHandler);
  
  console.log('IDS Configuration:');
  console.log(JSON.stringify(ALERT_THRESHOLDS, null, 2));
}
