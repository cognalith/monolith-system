/**
 * MONOLITH OS - Phase 7: Incident Response API
 * Tasks 7.4.1.1, 7.4.1.2, 7.4.2.1, 7.4.3.1
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog, AuditCategory, AuditSeverity, logSecurityEvent } from '../security/auditLogger.js';
import { sendSlackNotification, sendEmailNotification } from '../notifications.js';

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory incident store (use database in production)
const incidentStore = new Map();
const anomalyThresholds = {
  failedLogins: 5,          // Per minute per IP
  requestRate: 100,         // Per minute per IP
  errorRate: 0.1,           // 10% error rate threshold
  dataExfiltrationSize: 10000000  // 10MB
};

// Anomaly tracking
const anomalyTracking = new Map();

/**
 * Task 7.4.1.1 - Anomaly Detection Triggers
 */
export function detectAnomalies(req, res, next) {
  const clientIP = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  // Get or create tracking data for this IP
  let tracking = anomalyTracking.get(clientIP);
  if (!tracking || now - tracking.windowStart > windowMs) {
    tracking = {
      windowStart: now,
      requests: 0,
      errors: 0,
      failedLogins: 0,
      dataTransferred: 0
    };
    anomalyTracking.set(clientIP, tracking);
  }
  
  tracking.requests++;
  
  // Track response for anomaly detection
  const originalSend = res.send;
  res.send = function(body) {
    // Track errors
    if (res.statusCode >= 400) {
      tracking.errors++;
    }
    
    // Track failed logins
    if (req.path.includes('/login') && res.statusCode === 401) {
      tracking.failedLogins++;
    }
    
    // Track data size
    if (body) {
      tracking.dataTransferred += body.length || 0;
    }
    
    // Check for anomalies
    checkAnomalies(clientIP, tracking, req);
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Check for anomalies and trigger alerts
 */
async function checkAnomalies(clientIP, tracking, req) {
  const anomalies = [];
  
  // Check request rate
  if (tracking.requests > anomalyThresholds.requestRate) {
    anomalies.push({
      type: 'HIGH_REQUEST_RATE',
      severity: 'HIGH',
      value: tracking.requests,
      threshold: anomalyThresholds.requestRate
    });
  }
  
  // Check failed logins
  if (tracking.failedLogins > anomalyThresholds.failedLogins) {
    anomalies.push({
      type: 'BRUTE_FORCE_ATTEMPT',
      severity: 'CRITICAL',
      value: tracking.failedLogins,
      threshold: anomalyThresholds.failedLogins
    });
  }
  
  // Check error rate
  const errorRate = tracking.requests > 0 ? tracking.errors / tracking.requests : 0;
  if (errorRate > anomalyThresholds.errorRate && tracking.requests > 10) {
    anomalies.push({
      type: 'HIGH_ERROR_RATE',
      severity: 'MEDIUM',
      value: errorRate,
      threshold: anomalyThresholds.errorRate
    });
  }
  
  // Check data exfiltration
  if (tracking.dataTransferred > anomalyThresholds.dataExfiltrationSize) {
    anomalies.push({
      type: 'POTENTIAL_DATA_EXFILTRATION',
      severity: 'CRITICAL',
      value: tracking.dataTransferred,
      threshold: anomalyThresholds.dataExfiltrationSize
    });
  }
  
  // Log and alert on anomalies
  for (const anomaly of anomalies) {
    await createIncident({
      type: anomaly.type,
      severity: anomaly.severity,
      source: 'ANOMALY_DETECTION',
      description: \`Anomaly detected: \${anomaly.type}\`,
      details: {
        ...anomaly,
        ipAddress: clientIP,
        path: req.path,
        method: req.method
      }
    }, req);
  }
}

/**
 * Create a new security incident
 */
async function createIncident(incidentData, req = null) {
  const incidentId = \`inc_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  
  const incident = {
    id: incidentId,
    ...incidentData,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignedTo: null,
    escalationLevel: 0,
    timeline: [{
      timestamp: new Date().toISOString(),
      action: 'INCIDENT_CREATED',
      actor: 'SYSTEM'
    }]
  };
  
  incidentStore.set(incidentId, incident);
  
  // Log the incident
  await logSecurityEvent(\`INCIDENT_CREATED: \${incidentData.type}\`, incident, req);
  
  // Send notifications for high/critical severity
  if (['HIGH', 'CRITICAL'].includes(incidentData.severity)) {
    await triggerEscalation(incident);
  }
  
  return incident;
}

/**
 * Task 7.4.2.1 - Incident Escalation Webhook
 */
async function triggerEscalation(incident) {
  try {
    // Send Slack notification
    await sendSlackNotification({
      title: \`🚨 Security Incident: \${incident.type}\`,
      message: \`Severity: \${incident.severity}\n\${incident.description}\`,
      priority: incident.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      role: 'security-team'
    });
    
    // Send email to security team
    await sendEmailNotification({
      subject: \`[SECURITY ALERT] \${incident.type} - \${incident.severity}\`,
      body: \`
        <h2>Security Incident Detected</h2>
        <p><strong>ID:</strong> \${incident.id}</p>
        <p><strong>Type:</strong> \${incident.type}</p>
        <p><strong>Severity:</strong> \${incident.severity}</p>
        <p><strong>Description:</strong> \${incident.description}</p>
        <p><strong>Time:</strong> \${incident.createdAt}</p>
        <p><strong>Details:</strong></p>
        <pre>\${JSON.stringify(incident.details, null, 2)}</pre>
      \`,
      priority: 'CRITICAL',
      role: 'ciso'
    });
    
    // Update incident timeline
    incident.timeline.push({
      timestamp: new Date().toISOString(),
      action: 'ESCALATION_TRIGGERED',
      actor: 'SYSTEM',
      details: { channels: ['slack', 'email'] }
    });
    
    incident.escalationLevel++;
    incident.updatedAt = new Date().toISOString();
    incidentStore.set(incident.id, incident);
    
  } catch (error) {
    console.error('[INCIDENT] Escalation failed:', error);
  }
}

/**
 * POST /api/incident/create
 * Manually create a security incident
 */
router.post('/create', async (req, res) => {
  try {
    const { type, severity, description, details } = req.body;
    
    if (!type || !severity || !description) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'type, severity, and description are required'
      });
    }
    
    const incident = await createIncident({
      type,
      severity,
      source: 'MANUAL',
      description,
      details: details || {}
    }, req);
    
    res.status(201).json({
      success: true,
      message: 'Incident created',
      incident
    });
  } catch (error) {
    console.error('[INCIDENT] Create error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create incident'
    });
  }
});

/**
 * GET /api/incident/list
 * Task 7.4.1.2 - Real-time Threat Monitoring API (list incidents)
 */
router.get('/list', async (req, res) => {
  try {
    const { status, severity, limit = 50 } = req.query;
    
    let incidents = Array.from(incidentStore.values());
    
    // Filter by status
    if (status) {
      incidents = incidents.filter(i => i.status === status);
    }
    
    // Filter by severity
    if (severity) {
      incidents = incidents.filter(i => i.severity === severity);
    }
    
    // Sort by creation time (newest first)
    incidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limit results
    incidents = incidents.slice(0, parseInt(limit, 10));
    
    res.json({
      success: true,
      count: incidents.length,
      incidents
    });
  } catch (error) {
    console.error('[INCIDENT] List error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list incidents'
    });
  }
});

/**
 * GET /api/incident/:id
 * Get incident details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const incident = incidentStore.get(id);
    
    if (!incident) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Incident not found'
      });
    }
    
    res.json({
      success: true,
      incident
    });
  } catch (error) {
    console.error('[INCIDENT] Get error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get incident'
    });
  }
});

/**
 * PUT /api/incident/:id/status
 * Update incident status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedTo } = req.body;
    
    const incident = incidentStore.get(id);
    if (!incident) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Incident not found'
      });
    }
    
    const validStatuses = ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: \`Status must be one of: \${validStatuses.join(', ')}\`
      });
    }
    
    // Update incident
    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    if (assignedTo) incident.assignedTo = assignedTo;
    
    // Add to timeline
    incident.timeline.push({
      timestamp: new Date().toISOString(),
      action: \`STATUS_CHANGED_TO_\${status}\`,
      actor: req.user?.id || 'unknown',
      notes
    });
    
    incidentStore.set(id, incident);
    
    // Log status change
    await logSecurityEvent(\`INCIDENT_STATUS_CHANGED: \${id}\`, {
      incidentId: id,
      newStatus: status,
      notes
    }, req);
    
    res.json({
      success: true,
      message: 'Incident status updated',
      incident
    });
  } catch (error) {
    console.error('[INCIDENT] Update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update incident'
    });
  }
});

/**
 * POST /api/incident/breach-notification
 * Task 7.4.3.1 - Breach Notification API
 */
router.post('/breach-notification', async (req, res) => {
  try {
    const {
      incidentId,
      breachType,
      affectedSystems,
      affectedUsers,
      dataCategories,
      notifyAuthorities = false,
      notifyUsers = false
    } = req.body;
    
    if (!breachType || !affectedSystems) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'breachType and affectedSystems are required'
      });
    }
    
    const notificationId = \`breach_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    
    const breachNotification = {
      notificationId,
      incidentId,
      breachType,
      affectedSystems,
      affectedUsers: affectedUsers || [],
      dataCategories: dataCategories || [],
      createdAt: new Date().toISOString(),
      notificationStatus: {
        authorities: notifyAuthorities ? 'PENDING' : 'NOT_REQUIRED',
        users: notifyUsers ? 'PENDING' : 'NOT_REQUIRED'
      },
      timeline: [{
        timestamp: new Date().toISOString(),
        action: 'BREACH_NOTIFICATION_CREATED'
      }]
    };
    
    // Log the breach notification
    await createAuditLog({
      action: 'BREACH_NOTIFICATION_CREATED',
      category: AuditCategory.SECURITY_EVENT,
      severity: AuditSeverity.CRITICAL,
      details: breachNotification,
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    // GDPR requires notification within 72 hours
    const gdprDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    
    // Send immediate escalation
    await sendSlackNotification({
      title: '🚨 DATA BREACH DETECTED',
      message: \`Breach Type: \${breachType}\nAffected Systems: \${affectedSystems.join(', ')}\nGDPR Notification Deadline: \${gdprDeadline}\`,
      priority: 'CRITICAL',
      role: 'executive-team'
    });
    
    res.status(201).json({
      success: true,
      message: 'Breach notification created',
      notification: breachNotification,
      gdprDeadline,
      nextSteps: [
        'Document the breach scope and impact',
        'Notify data protection officer',
        'Prepare regulatory notification (if required)',
        'Prepare user notifications (if required)',
        'Implement containment measures'
      ]
    });
  } catch (error) {
    console.error('[INCIDENT] Breach notification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create breach notification'
    });
  }
});

/**
 * GET /api/incident/metrics
 * Get incident metrics for monitoring dashboard
 */
router.get('/metrics/summary', async (req, res) => {
  try {
    const incidents = Array.from(incidentStore.values());
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const metrics = {
      total: incidents.length,
      byStatus: {},
      bySeverity: {},
      last24Hours: incidents.filter(i => new Date(i.createdAt) > last24h).length,
      last7Days: incidents.filter(i => new Date(i.createdAt) > last7d).length,
      openCritical: incidents.filter(i => i.status === 'OPEN' && i.severity === 'CRITICAL').length,
      averageResolutionTime: null // Calculate if we have resolved incidents
    };
    
    // Count by status
    incidents.forEach(i => {
      metrics.byStatus[i.status] = (metrics.byStatus[i.status] || 0) + 1;
      metrics.bySeverity[i.severity] = (metrics.bySeverity[i.severity] || 0) + 1;
    });
    
    res.json({
      success: true,
      metrics,
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error('[INCIDENT] Metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get metrics'
    });
  }
});

export { detectAnomalies };
export default router;
