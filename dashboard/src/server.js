import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: './dashboard/.env' });
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import { sendSlackNotification, sendEmailNotification, notifyDecision } from './notifications.js';

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GET /api/dashboard/stats - Returns row counts from Supabase
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Get counts from each table
    const { count: workflowCount, error: workflowError } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true });
    
    const { count: taskCount, error: taskError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true });
    
    const { count: decisionCount, error: decisionError } = await supabase
      .from('decision_logs')
      .select('*', { count: 'exact', head: true });
    
    if (workflowError || taskError || decisionError) {
      throw new Error('Error fetching stats');
    }
    
    res.json({
      workflows: workflowCount || 0,
      tasks: taskCount || 0,
      decisions: decisionCount || 0,
    });
  } catch (error) {
    console.error('Error in /api/dashboard/stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/recent-activity - Returns the last 10 rows from decision_logs
app.get('/api/recent-activity', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('decision_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({
      activities: data || [],
    });
  } catch (error) {
    console.error('Error in /api/recent-activity:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/decision - Allows the dashboard to write back to the system
app.post('/api/decision', async (req, res) => {
  try {
    const { task_id, role, decision, financial_impact, rationale } = req.body;
    
    // Validate required fields
    if (!decision) {
      return res.status(400).json({ error: 'Decision field is required' });
    }
    
    // Insert into decision_logs
    const { data, error } = await supabase
      .from('decision_logs')
      .insert([{
        task_id: task_id || null,
        role: role || null,
        decision: decision,
        financial_impact: financial_impact || null,
        rationale: rationale || null,
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

// GET /api/pending-tasks - Returns pending tasks with full details
app.get('/api/pending-tasks', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, content, assigned_role, priority, status, created_at, workflows!inner(name)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const priorityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    const sortedTasks = data.sort((a, b) => {
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return diff !== 0 ? diff : new Date(a.created_at) - new Date(b.created_at);
    });

    const now = new Date();
    const tasks = sortedTasks.map(t => ({
      Id: t.id,
      Content: t.content,
      assigned_role: t.assigned_role,
      Priority: t.priority,
      Status: t.status,
      created_at: t.created_at,
      workflow_name: t.workflows?.name || 'Unknown',
      age_in_hours: Math.round((now - new Date(t.created_at)) / 3600000)
    }));

    const summary = {
      CRITICAL: tasks.filter(t => t.Priority === 'CRITICAL').length,
      HIGH: tasks.filter(t => t.Priority === 'HIGH').length,
      MEDIUM: tasks.filter(t => t.Priority === 'MEDIUM').length,
      LOW: tasks.filter(t => t.Priority === 'LOW').length
    };

    res.json({ Tasks: tasks, Summary: summary });
  } catch (error) {
    console.error('Error in /api/pending-tasks:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/decision-history - Returns decision history with task details
app.get('/api/decision-history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('decision_logs')
      .select('id, task_id, role, decision, financial_impact, rationale, timestamp, tasks(content, priority)')
      .order('timestamp', { ascending: false });

    if (error) throw new Error(error.message);

    const decisions = data.map(d => ({
      id: d.id,
      task_id: d.task_id,
      task_content: d.tasks?.content || 'Unknown',
      task_priority: d.tasks?.priority || 'Unknown',
      role: d.role,
      decision: d.decision,
      financial_impact: d.financial_impact,
      rationale: d.rationale,
      timestamp: d.timestamp
    }));

    res.json({ decisions, total: decisions.length });
  } catch (error) {
    console.error('Error in /api/decision-history:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ============================================
// NOTIFICATION ENDPOINTS (Phase 6.2)
// ============================================

// POST /api/notifications/test - Test notification service
app.post('/api/notifications/test', async (req, res) => {
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

// Start server
app.listen(port, () => {
  console.log(`Backend API server running on http://localhost:${port}`);
});
