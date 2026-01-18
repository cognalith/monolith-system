// Load environment variables (dotenv for local dev, Railway provides them in production)
import dotenv from 'dotenv';
dotenv.config(); // Uses .env in current directory if it exists
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import { sendSlackNotification, sendEmailNotification, notifyDecision } from './notifications.js';

// Phase 3: Security Middleware Imports
import { securityHeaders, enforceHttps } from './middleware/securityHeaders.js';
import { corsOptions, corsMiddleware } from './middleware/corsConfig.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { inputValidation, inputSanitization } from './middleware/inputValidation.js';
import { requireAuth, optionalAuth } from './middleware/authMiddleware.js';
import authRoutes from './api/authRoutes.js';

// Phase 8: Dashboard UX Enhancement API Routes
import rolesRoutes from './api/rolesRoutes.js';
import roleTaskCountsRoutes from './api/roleTaskCountsRoutes.js';
import workflowsActiveRoutes from './api/workflowsActiveRoutes.js';
import tasksCompletedRoutes from './api/tasksCompletedRoutes.js';
import decisionsRoutes from './api/decisionsRoutes.js';
// Task Completion Feature Routes
import tasksRoutes from './api/tasksRoutes.js';
// Task data loader for NotebookLM-extracted JSON files
import { getPendingTasks, getPrioritySummary, getCompletedTasks, getActiveWorkflows, getTaskCountsByRole } from './api/taskDataLoader.js';

// Phase 5D: Neural Stack Dashboard Routes
import neuralStackRoutes from './api/neuralStackRoutes.js';

// Phase 6A: Team Hierarchy Routes
import teamRoutes from './api/teamRoutes.js';

// Phase 6B: Knowledge Bot Routes
import knowledgeBotRoutes from './api/knowledgeBotRoutes.js';

// Phase 7: Task Orchestration Engine Routes
import orchestrationRoutes from './api/orchestrationRoutes.js';

// Phase 9: Context Graph Routes
import contextGraphRoutes from './api/contextGraphRoutes.js';

// Phase 11: Event Log & Memory Routes
import eventLogRoutes from './api/eventLogRoutes.js';

const app = express();
const port = process.env.PORT || 3000;

// ============================================
// PHASE 3: SECURITY MIDDLEWARE STACK
// ============================================

// Apply security headers to all requests
app.use(securityHeaders);

// HTTPS enforcement (enabled in production)
if (process.env.NODE_ENV === 'production') {
  app.use(enforceHttps);
}

// CORS configuration - use custom middleware for more control
app.use(corsMiddleware);

// Rate limiting - applied globally
app.use(rateLimiter);

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }));

// Input validation and sanitization for all requests with bodies
app.use(inputValidation);
app.use(inputSanitization);

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Health check endpoint - always public
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes - public for login/register
app.use('/api/auth', authRoutes);

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================
// Note: In development, authentication can be bypassed by setting
// DISABLE_AUTH=true in environment variables

const authMiddleware = process.env.DISABLE_AUTH === 'true'
  ? (req, res, next) => {
      // Development bypass - attach mock user
      req.user = { id: 'dev-user', email: 'dev@monolith.local', role: 'admin' };
      next();
    }
  : requireAuth;

// ============================================
// PHASE 8: Dashboard UX Enhancement Routes
// ============================================
// These routes are protected by authentication
app.use('/api/roles', authMiddleware, rolesRoutes);
app.use('/api/role-task-counts', authMiddleware, roleTaskCountsRoutes);
app.use('/api/workflows/active', authMiddleware, workflowsActiveRoutes);
app.use('/api/workflows', authMiddleware, workflowsActiveRoutes);  // Alias for /api/workflows
app.use('/api/tasks', authMiddleware, tasksCompletedRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);  // Task completion & agent execution
app.use('/api/decisions', authMiddleware, decisionsRoutes);

// Phase 5D: Neural Stack Dashboard Routes
app.use('/api/neural-stack', authMiddleware, neuralStackRoutes);

// Phase 6A: Team Hierarchy Routes (mounted under neural-stack for consistency)
app.use('/api/neural-stack/teams', authMiddleware, teamRoutes);

// Phase 6B: Knowledge Bot Routes (mounted under neural-stack for consistency)
app.use('/api/neural-stack/knowledge-bots', authMiddleware, knowledgeBotRoutes);

// Phase 7: Task Orchestration Engine Routes
app.use('/api/orchestration', authMiddleware, orchestrationRoutes);

// Phase 9: Context Graph Routes
app.use('/api/context', authMiddleware, contextGraphRoutes);

// Phase 11: Event Log & Memory Routes
app.use('/api/event-log', authMiddleware, eventLogRoutes);

// Initialize Supabase client (optional - works without it using JSON data)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('[SERVER] Supabase client initialized');
} else {
  console.log('[SERVER] Running without Supabase - using JSON data only');
}

// GET /api/dashboard/stats - Returns dashboard statistics (protected)
// Phase 9: Updated to use real NotebookLM-extracted JSON data as primary source
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    // Get real stats from NotebookLM-extracted JSON files
    const pendingTasks = getPendingTasks();
    const completedTasks = getCompletedTasks();
    const activeWorkflows = getActiveWorkflows();

    // Calculate stats from real data
    const stats = {
      activeWorkflows: activeWorkflows.length,
      pendingTasks: pendingTasks.length,
      completedToday: completedTasks.length,
      totalDecisions: 0 // Will be updated from Supabase if available
    };

    // Try to get decision count from Supabase if available
    if (supabase && supabaseUrl && supabaseAnonKey) {
      try {
        const { count: decisionCount, error: decisionError } = await supabase
          .from('monolith_decisions')
          .select('*', { count: 'exact', head: true });

        if (!decisionError && decisionCount !== null) {
          stats.totalDecisions = decisionCount;
        }
      } catch (dbError) {
        console.warn('[DASHBOARD-STATS] Supabase error for decisions:', dbError.message);
      }
    }

    console.log(`[DASHBOARD-STATS] Real data: ${stats.pendingTasks} pending, ${stats.activeWorkflows} workflows, ${stats.completedToday} completed`);

    res.json(stats);
  } catch (error) {
    console.error('Error in /api/dashboard/stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recent-activity - Returns the last 10 rows from decision_logs (protected)
// Phase 8.3.5: Added ?role= query parameter support
app.get('/api/recent-activity', authMiddleware, async (req, res) => {
  try {
    const { role } = req.query;

    // Return empty activities if Supabase is not configured
    if (!supabase) {
      return res.json({
        activities: [],
        message: 'Supabase not configured - no activity data available'
      });
    }

    let query = supabase
      .from('monolith_decisions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    // Filter by role if specified
    if (role) {
      query = query.eq('role_id', role.toLowerCase());
    }

    const { data, error } = await query;

    if (error) {
      // Gracefully handle database errors (table doesn't exist, RLS issues, etc.)
      console.warn('[RECENT-ACTIVITY] Supabase query error:', error.message);
      return res.json({
        activities: [],
        message: `Database query failed: ${error.message}`
      });
    }

    res.json({
      activities: data || [],
    });
  } catch (error) {
    console.error('Error in /api/recent-activity:', error.message);
    // Return empty array instead of 500 to keep dashboard functional
    res.json({
      activities: [],
      message: `Error fetching activities: ${error.message}`
    });
  }
});

// POST /api/decision - Allows the dashboard to write back to the system (protected)
app.post('/api/decision', authMiddleware, async (req, res) => {
  try {
    const { task_id, role, decision, action, reasoning } = req.body;

    // Validate required fields
    if (!decision) {
      return res.status(400).json({ error: 'Decision field is required' });
    }

    // Insert into monolith_decisions
    const { data, error } = await supabase
      .from('monolith_decisions')
      .insert([{
        task_id: task_id || null,
        role_id: role || null,
        role_name: role ? role.toUpperCase() : null,
        decision: decision,
        action: action || null,
        reasoning: reasoning || null,
        timestamp: new Date().toISOString(),
      }])
      .select();

    if (error) {
      throw new Error(error.message);
    }

    res.status(201).json({
      message: 'Decision recorded successfully',
      data: data[0],
    });
  } catch (error) {
    console.error('Error in /api/decision:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pending-tasks - Returns pending tasks with full details (protected)
// Phase 8.3.5: Added ?role= query parameter support
// Phase 9: Updated to use NotebookLM-extracted JSON files as primary source
app.get('/api/pending-tasks', authMiddleware, async (req, res) => {
  try {
    const { role } = req.query;
    let useJsonData = true;
    let tasks = [];
    let summary = {};

    // Try Supabase first if connected
    if (supabase && supabaseUrl && supabaseAnonKey) {
      try {
        let query = supabase
          .from('tasks')
          .select('id, content, assigned_role, priority, status, created_at, workflows!inner(name)')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: true });

        if (role) {
          query = query.eq('assigned_role', role.toLowerCase());
        }

        const { data, error } = await query;

        if (!error && data && data.length > 0) {
          useJsonData = false;
          const priorityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
          const sortedTasks = data.sort((a, b) => {
            const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
            return diff !== 0 ? diff : new Date(a.created_at) - new Date(b.created_at);
          });

          const now = new Date();
          tasks = sortedTasks.map(t => ({
            id: t.id,
            content: t.content,
            assigned_role: t.assigned_role,
            priority: t.priority,
            status: t.status,
            created_at: t.created_at,
            workflows: { name: t.workflows?.name || 'Unknown' },
            age_in_hours: Math.round((now - new Date(t.created_at)) / 3600000)
          }));
        }
      } catch (dbError) {
        console.warn('[PENDING-TASKS] Supabase error, falling back to JSON:', dbError.message);
      }
    }

    // Fallback to JSON files (primary source for now)
    if (useJsonData) {
      const jsonTasks = getPendingTasks(role);
      const now = new Date();

      tasks = jsonTasks.map(t => ({
        id: t.id,
        content: t.content,
        assigned_role: t.assigned_role,
        priority: t.priority,
        status: t.status,
        created_at: t.created_at,
        workflows: { name: t.workflow || 'Unknown' },
        age_in_hours: Math.round((now - new Date(t.created_at || now)) / 3600000)
      }));
    }

    // Calculate priority summary
    summary = {
      CRITICAL: tasks.filter(t => t.priority === 'CRITICAL').length,
      HIGH: tasks.filter(t => t.priority === 'HIGH').length,
      MEDIUM: tasks.filter(t => t.priority === 'MEDIUM').length,
      LOW: tasks.filter(t => t.priority === 'LOW').length
    };

    res.json({
      tasks,
      by_priority: summary,
      total: tasks.length,
      source: useJsonData ? 'notebooklm_json' : 'supabase'
    });
  } catch (error) {
    console.error('Error in /api/pending-tasks:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/decision-history - Returns decision history with task details (protected)
app.get('/api/decision-history', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('monolith_decisions')
      .select('id, task_id, role_id, role_name, decision, action, reasoning, timestamp')
      .order('timestamp', { ascending: false });

    if (error) throw new Error(error.message);

    const decisions = data.map(d => ({
      id: d.id,
      task_id: d.task_id,
      role: d.role_id,
      role_name: d.role_name || d.role_id,
      decision: d.decision,
      action: d.action,
      reasoning: d.reasoning,
      timestamp: d.timestamp
    }));

    res.json({ decisions, total: decisions.length });
  } catch (error) {
    console.error('Error in /api/decision-history:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NOTIFICATION ENDPOINTS (Phase 6.2) - Protected
// ============================================

// POST /api/notifications/test - Test notification service
app.post('/api/notifications/test', authMiddleware, async (req, res) => {
  try {
      const { channel, message, priority, role } = req.body;
          
              let result;
                  if (channel === 'slack' || !channel) {
                        result = await sendSlackNotification({
                                title: 'Test Notification',
                                        message: message || 'This is a test notification from MONOLITH OS',
                                                priority: priority || 'LOW',
                                                        role: role || 'system'
                                                              });
                                                                  }
                                                                      
                                                                          if (channel === 'email') {
                                                                                result = await sendEmailNotification({
                                                                                        subject: 'Test Email',
                                                                                                body: `<p>${message || 'This is a test email from MONOLITH OS'}</p>`,
                                                                                                        priority: priority || 'CRITICAL',
                                                                                                                role: role || 'system'
                                                                                                                      });
                                                                                                                          }
                                                                                                                              
                                                                                                                                  res.json({ success: true, result });
                                                                                                                                    } catch (error) {
                                                                                                                                        console.error('Error testing notification:', error.message);
                                                                                                                                            res.status(500).json({ error: error.message });
                                                                                                                                              }
                                                                                                                                              });

                                                                                                                                              // GET /api/notifications/status - Check notification service status
                                                                                                                                              app.get('/api/notifications/status', (req, res) => {
                                                                                                                                                res.json({
                                                                                                                                                    slack: {
                                                                                                                                                          configured: !!process.env.SLACK_WEBHOOK_URL,
                                                                                                                                                                status: process.env.SLACK_WEBHOOK_URL ? 'ready' : 'not_configured'
                                                                                                                                                                    },
                                                                                                                                                                        email: {
                                                                                                                                                                              configured: !!process.env.EMAIL_API_KEY,
                                                                                                                                                                                    status: process.env.EMAIL_API_KEY ? 'ready' : 'not_configured'
                                                                                                                                                                                        },
                                                                                                                                                                                            timestamp: new Date().toISOString()
                                                                                                                                                                                              });
                                                                                                                                                                                              });

// Start server with error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Backend API server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Auth: ${process.env.DISABLE_AUTH === 'true' ? 'DISABLED' : 'ENABLED'}`);
});

server.on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
