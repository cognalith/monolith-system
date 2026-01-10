/**
 * MONOLITH OS - Phase 7: Forensic Investigation API
 * Task 7.3.2.5 - Create forensic investigation API
 */

import express from 'express';
import { searchAuditLogs, getAuditLogById, AuditCategory, AuditSeverity } from '../security/auditLogger.js';

const router = express.Router();

/**
 * POST /api/forensics/investigation
 * Create a new forensic investigation
 */
router.post('/investigation', async (req, res) => {
  try {
    const {
      incidentId,
      investigationType,
      scope,
      targetUserId,
      targetIp,
      timeRange,
      description
    } = req.body;
    
    if (!investigationType || !scope) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'investigationType and scope are required'
      });
    }
    
    const investigationId = \`inv_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    
    const investigation = {
      investigationId,
      incidentId: incidentId || null,
      investigationType,
      scope,
      targetUserId,
      targetIp,
      timeRange: timeRange || {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      description,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      createdBy: req.user?.id || 'system',
      findings: [],
      evidence: [],
      timeline: [{
        timestamp: new Date().toISOString(),
        action: 'INVESTIGATION_OPENED',
        actor: req.user?.id || 'system'
      }]
    };
    
    res.status(201).json({
      success: true,
      message: 'Forensic investigation created',
      investigation
    });
  } catch (error) {
    console.error('[FORENSICS] Create investigation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create investigation'
    });
  }
});

/**
 * GET /api/forensics/audit-trail
 * Get audit trail for forensic analysis
 */
router.get('/audit-trail', async (req, res) => {
  try {
    const {
      userId,
      ipAddress,
      startDate,
      endDate,
      category,
      severity,
      action,
      limit = 500
    } = req.query;
    
    const results = await searchAuditLogs({
      userId,
      ipAddress,
      startDate,
      endDate,
      category,
      severity,
      action,
      limit: parseInt(limit, 10)
    });
    
    // Enrich with forensic metadata
    const enrichedLogs = results.logs.map(log => ({
      ...log,
      forensicMetadata: {
        riskScore: calculateRiskScore(log),
        anomalyIndicators: detectAnomalyIndicators(log),
        relatedEvents: [] // Would be populated by correlation engine
      }
    }));
    
    res.json({
      success: true,
      investigationContext: {
        totalEvents: results.total,
        timeRange: {
          start: startDate || 'unbounded',
          end: endDate || 'now'
        },
        filters: { userId, ipAddress, category, severity }
      },
      events: enrichedLogs,
      pagination: {
        limit: results.limit,
        offset: results.offset,
        total: results.total
      }
    });
  } catch (error) {
    console.error('[FORENSICS] Audit trail error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve audit trail'
    });
  }
});

/**
 * GET /api/forensics/user-activity/:userId
 * Get comprehensive user activity for investigation
 */
router.get('/user-activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // Get audit logs for user
    const auditResults = await searchAuditLogs({
      userId,
      startDate,
      limit: 1000
    });
    
    // Analyze activity patterns
    const activityAnalysis = analyzeUserActivity(auditResults.logs);
    
    res.json({
      success: true,
      userId,
      analysisTimeframe: { days: parseInt(days, 10), startDate },
      summary: {
        totalEvents: auditResults.total,
        uniqueIPs: activityAnalysis.uniqueIPs,
        uniqueActions: activityAnalysis.uniqueActions,
        riskScore: activityAnalysis.riskScore
      },
      activityByCategory: activityAnalysis.byCategory,
      activityByDay: activityAnalysis.byDay,
      suspiciousPatterns: activityAnalysis.suspiciousPatterns,
      recentEvents: auditResults.logs.slice(0, 50)
    });
  } catch (error) {
    console.error('[FORENSICS] User activity error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve user activity'
    });
  }
});

/**
 * GET /api/forensics/ip-analysis/:ipAddress
 * Analyze activity from a specific IP address
 */
router.get('/ip-analysis/:ipAddress', async (req, res) => {
  try {
    const { ipAddress } = req.params;
    const { days = 7 } = req.query;
    
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // Get audit logs for IP
    const auditResults = await searchAuditLogs({
      ipAddress,
      startDate,
      limit: 500
    });
    
    // Analyze IP activity
    const ipAnalysis = analyzeIpActivity(auditResults.logs);
    
    res.json({
      success: true,
      ipAddress,
      analysisTimeframe: { days: parseInt(days, 10), startDate },
      summary: {
        totalEvents: auditResults.total,
        uniqueUsers: ipAnalysis.uniqueUsers,
        geoLocation: ipAnalysis.geoLocation, // Would need GeoIP lookup
        reputation: ipAnalysis.reputation
      },
      activityPattern: ipAnalysis.pattern,
      associatedUsers: ipAnalysis.users,
      suspiciousIndicators: ipAnalysis.suspiciousIndicators,
      recentEvents: auditResults.logs.slice(0, 50)
    });
  } catch (error) {
    console.error('[FORENSICS] IP analysis error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to analyze IP activity'
    });
  }
});

/**
 * POST /api/forensics/timeline
 * Build a forensic timeline from multiple sources
 */
router.post('/timeline', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      userIds = [],
      ipAddresses = [],
      eventTypes = []
    } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'startDate and endDate are required'
      });
    }
    
    // Collect events from audit logs
    const auditResults = await searchAuditLogs({
      startDate,
      endDate,
      limit: 1000
    });
    
    // Filter by specified criteria
    let events = auditResults.logs;
    
    if (userIds.length > 0) {
      events = events.filter(e => userIds.includes(e.user_id));
    }
    if (ipAddresses.length > 0) {
      events = events.filter(e => ipAddresses.includes(e.ip_address));
    }
    if (eventTypes.length > 0) {
      events = events.filter(e => eventTypes.some(type => e.action.includes(type)));
    }
    
    // Build timeline with correlation
    const timeline = events.map(event => ({
      timestamp: event.timestamp,
      eventType: event.action,
      category: event.category,
      severity: event.severity,
      actor: {
        userId: event.user_id,
        ipAddress: event.ip_address
      },
      details: event.details,
      correlationId: event.request_id
    })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({
      success: true,
      timelineId: \`tl_\${Date.now()}\`,
      timeRange: { startDate, endDate },
      filters: { userIds, ipAddresses, eventTypes },
      eventCount: timeline.length,
      timeline
    });
  } catch (error) {
    console.error('[FORENSICS] Timeline error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to build forensic timeline'
    });
  }
});

/**
 * Helper: Calculate risk score for an event
 */
function calculateRiskScore(log) {
  let score = 0;
  
  // Base score by severity
  const severityScores = {
    'DEBUG': 0, 'INFO': 1, 'WARNING': 3, 'ERROR': 5, 'CRITICAL': 10
  };
  score += severityScores[log.severity] || 1;
  
  // Add score for sensitive categories
  if (log.category === 'SECURITY_EVENT') score += 5;
  if (log.category === 'AUTHENTICATION') score += 2;
  if (log.category === 'DATA_MODIFICATION') score += 3;
  
  // Check for suspicious patterns in action
  if (log.action?.includes('DELETE')) score += 3;
  if (log.action?.includes('FAILED')) score += 2;
  if (log.action?.includes('EXPORT')) score += 2;
  
  return Math.min(score, 10); // Cap at 10
}

/**
 * Helper: Detect anomaly indicators
 */
function detectAnomalyIndicators(log) {
  const indicators = [];
  
  // Check for unusual timing (e.g., off-hours access)
  const hour = new Date(log.timestamp).getHours();
  if (hour < 6 || hour > 22) {
    indicators.push('OFF_HOURS_ACCESS');
  }
  
  // Check for high-risk actions
  if (log.severity === 'CRITICAL' || log.severity === 'ERROR') {
    indicators.push('HIGH_SEVERITY_EVENT');
  }
  
  // Check for data access patterns
  if (log.action?.includes('EXPORT') || log.action?.includes('BULK')) {
    indicators.push('BULK_DATA_ACCESS');
  }
  
  return indicators;
}

/**
 * Helper: Analyze user activity patterns
 */
function analyzeUserActivity(logs) {
  const uniqueIPs = new Set(logs.map(l => l.ip_address).filter(Boolean));
  const uniqueActions = new Set(logs.map(l => l.action));
  
  const byCategory = {};
  const byDay = {};
  const suspiciousPatterns = [];
  
  logs.forEach(log => {
    // Count by category
    byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    
    // Count by day
    const day = log.timestamp?.split('T')[0];
    if (day) {
      byDay[day] = (byDay[day] || 0) + 1;
    }
    
    // Check for suspicious patterns
    if (calculateRiskScore(log) >= 7) {
      suspiciousPatterns.push({
        timestamp: log.timestamp,
        action: log.action,
        riskScore: calculateRiskScore(log)
      });
    }
  });
  
  // Calculate overall risk score
  const riskScore = Math.min(
    Math.round(suspiciousPatterns.length * 2 + (uniqueIPs.size > 5 ? 3 : 0)),
    10
  );
  
  return {
    uniqueIPs: Array.from(uniqueIPs),
    uniqueActions: Array.from(uniqueActions),
    byCategory,
    byDay,
    suspiciousPatterns: suspiciousPatterns.slice(0, 20),
    riskScore
  };
}

/**
 * Helper: Analyze IP activity
 */
function analyzeIpActivity(logs) {
  const uniqueUsers = new Set(logs.map(l => l.user_id).filter(Boolean));
  const suspiciousIndicators = [];
  
  // Check for multiple users from same IP
  if (uniqueUsers.size > 3) {
    suspiciousIndicators.push({
      type: 'MULTIPLE_USERS',
      description: \`\${uniqueUsers.size} different users from this IP\`
    });
  }
  
  // Check for rapid requests
  if (logs.length > 100) {
    suspiciousIndicators.push({
      type: 'HIGH_REQUEST_VOLUME',
      description: \`\${logs.length} requests in analyzed period\`
    });
  }
  
  // Analyze pattern
  const hours = logs.map(l => new Date(l.timestamp).getHours());
  const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
  
  return {
    uniqueUsers: Array.from(uniqueUsers),
    geoLocation: null, // Would need GeoIP service
    reputation: suspiciousIndicators.length > 0 ? 'SUSPICIOUS' : 'NORMAL',
    pattern: {
      peakHour: Math.round(avgHour),
      requestCount: logs.length,
      avgRequestsPerDay: Math.round(logs.length / 7)
    },
    users: Array.from(uniqueUsers).slice(0, 10),
    suspiciousIndicators
  };
}

export default router;
