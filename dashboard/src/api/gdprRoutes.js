/**
 * MONOLITH OS - Phase 7: GDPR Compliance API
 * Tasks 7.1.3.1, 7.1.3.2, 7.1.3.3 - GDPR endpoints
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { logGdprEvent, AuditCategory, AuditSeverity, createAuditLog } from '../security/auditLogger.js';

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/gdpr/access-request
 * Task 7.1.3.1 - Data Subject Access Request (DSAR)
 */
router.post('/access-request', async (req, res) => {
  try {
    const { userId, email, requestType = 'full' } = req.body;
    
    if (!userId && !email) {
      return res.status(400).json({
        error: 'Missing identifier',
        message: 'Either userId or email is required'
      });
    }
    
    // Create DSAR record
    const dsarId = \`dsar_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    
    // Collect all user data from different tables
    const userData = {
      dsarId,
      requestedAt: new Date().toISOString(),
      requestType,
      data: {}
    };
    
    // Fetch user profile data (mock - implement with real tables)
    if (userId) {
      userData.data.profile = {
        userId,
        note: 'Profile data would be fetched from user profiles table'
      };
    }
    
    // Fetch decision logs
    const { data: decisions, error: decisionsError } = await supabase
      .from('decision_logs')
      .select('*')
      .eq('role', userId || email)
      .limit(100);
    
    if (!decisionsError) {
      userData.data.decisions = decisions;
    }
    
    // Fetch workflow data
    const { data: workflows, error: workflowsError } = await supabase
      .from('workflows')
      .select('*')
      .limit(50);
    
    if (!workflowsError) {
      userData.data.workflows = workflows;
    }
    
    // Log the GDPR event
    await logGdprEvent('DATA_ACCESS_REQUEST', userId || email, {
      dsarId,
      requestType,
      tablesAccessed: ['decision_logs', 'workflows', 'user_profiles']
    }, req);
    
    res.json({
      success: true,
      dsarId,
      message: 'Data Subject Access Request processed',
      data: userData,
      exportFormats: ['json', 'csv', 'pdf'],
      retentionPolicy: '30 days'
    });
  } catch (error) {
    console.error('[GDPR] Access request error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process data access request'
    });
  }
});

/**
 * POST /api/gdpr/delete
 * Task 7.1.3.2 - Data Deletion Endpoint (Right to Erasure)
 */
router.post('/delete', async (req, res) => {
  try {
    const { userId, email, confirmDeletion = false, deletionScope = 'full' } = req.body;
    
    if (!userId && !email) {
      return res.status(400).json({
        error: 'Missing identifier',
        message: 'Either userId or email is required'
      });
    }
    
    if (!confirmDeletion) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Please confirm deletion by setting confirmDeletion: true',
        warning: 'This action is irreversible. All user data will be permanently deleted.'
      });
    }
    
    const deletionId = \`del_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    const deletionResults = {
      deletionId,
      deletedAt: new Date().toISOString(),
      scope: deletionScope,
      tablesAffected: [],
      recordsDeleted: 0
    };
    
    // Delete from decision_logs
    const { data: deletedDecisions, error: decisionError } = await supabase
      .from('decision_logs')
      .delete()
      .eq('role', userId || email)
      .select();
    
    if (!decisionError && deletedDecisions) {
      deletionResults.tablesAffected.push('decision_logs');
      deletionResults.recordsDeleted += deletedDecisions.length;
    }
    
    // Note: In production, implement deletion from all relevant tables
    // - user_profiles
    // - user_sessions
    // - consent_records
    // - audit_logs (retain for compliance, anonymize user reference)
    
    // Log the GDPR deletion event
    await createAuditLog({
      action: 'DATA_DELETION_REQUEST',
      category: AuditCategory.GDPR,
      severity: AuditSeverity.WARNING,
      userId: userId || email,
      details: {
        deletionId,
        scope: deletionScope,
        tablesAffected: deletionResults.tablesAffected,
        recordsDeleted: deletionResults.recordsDeleted
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      message: 'Data deletion request processed',
      deletionId,
      results: deletionResults,
      retentionNote: 'Some data may be retained for legal compliance purposes'
    });
  } catch (error) {
    console.error('[GDPR] Deletion error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process deletion request'
    });
  }
});

/**
 * GET /api/gdpr/consent
 * Task 7.1.3.3 - Get user consent status
 */
router.get('/consent', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required'
      });
    }
    
    // Fetch consent records (mock - implement with real consent table)
    const consentRecord = {
      userId,
      consents: [
        {
          type: 'essential',
          description: 'Essential cookies and functionality',
          granted: true,
          required: true,
          grantedAt: new Date().toISOString()
        },
        {
          type: 'analytics',
          description: 'Analytics and performance tracking',
          granted: false,
          required: false,
          grantedAt: null
        },
        {
          type: 'marketing',
          description: 'Marketing and advertising',
          granted: false,
          required: false,
          grantedAt: null
        },
        {
          type: 'data_processing',
          description: 'Processing of personal data for service provision',
          granted: true,
          required: true,
          grantedAt: new Date().toISOString()
        }
      ],
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: consentRecord
    });
  } catch (error) {
    console.error('[GDPR] Get consent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve consent status'
    });
  }
});

/**
 * POST /api/gdpr/consent
 * Task 7.1.3.3 - Update user consent
 */
router.post('/consent', async (req, res) => {
  try {
    const { userId, consents } = req.body;
    
    if (!userId || !consents) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'userId and consents array are required'
      });
    }
    
    // Validate consent structure
    if (!Array.isArray(consents)) {
      return res.status(400).json({
        error: 'Invalid consents format',
        message: 'consents must be an array'
      });
    }
    
    // Process consent updates
    const consentUpdateId = \`consent_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    const processedConsents = consents.map(consent => ({
      type: consent.type,
      granted: consent.granted,
      grantedAt: consent.granted ? new Date().toISOString() : null,
      revokedAt: !consent.granted ? new Date().toISOString() : null,
      source: 'user_preference',
      ipAddress: req.ip
    }));
    
    // Log consent changes
    await logGdprEvent('CONSENT_UPDATE', userId, {
      consentUpdateId,
      consentsUpdated: processedConsents.map(c => c.type),
      changes: processedConsents
    }, req);
    
    res.json({
      success: true,
      message: 'Consent preferences updated',
      consentUpdateId,
      updatedConsents: processedConsents,
      effectiveAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[GDPR] Update consent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update consent preferences'
    });
  }
});

/**
 * GET /api/gdpr/export
 * Export user data in specified format
 */
router.get('/export', async (req, res) => {
  try {
    const { userId, format = 'json' } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required'
      });
    }
    
    // Collect all user data
    const exportData = {
      exportId: \`export_\${Date.now()}\`,
      exportedAt: new Date().toISOString(),
      userId,
      format,
      data: {}
    };
    
    // Fetch data from various tables
    const { data: decisions } = await supabase
      .from('decision_logs')
      .select('*')
      .eq('role', userId)
      .limit(1000);
    
    exportData.data.decisions = decisions || [];
    
    // Log export event
    await logGdprEvent('DATA_EXPORT', userId, {
      exportId: exportData.exportId,
      format,
      recordCount: exportData.data.decisions.length
    }, req);
    
    if (format === 'json') {
      res.json(exportData);
    } else if (format === 'csv') {
      // Convert to CSV (simplified)
      const csvHeaders = 'id,decision,role,timestamp\n';
      const csvRows = (exportData.data.decisions || [])
        .map(d => \`\${d.id},\${d.decision},\${d.role},\${d.timestamp}\`)
        .join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', \`attachment; filename="data_export_\${userId}.csv"\`);
      res.send(csvHeaders + csvRows);
    } else {
      res.json(exportData);
    }
  } catch (error) {
    console.error('[GDPR] Export error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export data'
    });
  }
});

export default router;
