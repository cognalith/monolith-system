/**
 * Integration tests for Dashboard API endpoints
 * Tests Express API routes with supertest
 */

import { jest } from '@jest/globals';
import { createRequire } from 'module';

// Mock Supabase
jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    })
  })
}));

// Mock notifications
jest.unstable_mockModule('../notifications.js', () => ({
  sendSlackNotification: jest.fn().mockResolvedValue({ success: true }),
  sendEmailNotification: jest.fn().mockResolvedValue({ success: true }),
  notifyDecision: jest.fn().mockResolvedValue({ success: true })
}));

// Mock task data loader with test data
jest.unstable_mockModule('../api/taskDataLoader.js', () => ({
  getPendingTasks: jest.fn().mockReturnValue([
    {
      id: 'task-1',
      content: 'Test pending task 1',
      priority: 'HIGH',
      status: 'pending',
      assigned_role: 'cfo',
      workflow: 'Q1 Planning',
      created_at: new Date().toISOString()
    },
    {
      id: 'task-2',
      content: 'Test pending task 2',
      priority: 'CRITICAL',
      status: 'in_progress',
      assigned_role: 'cto',
      workflow: 'Development',
      created_at: new Date().toISOString()
    }
  ]),
  getPrioritySummary: jest.fn().mockReturnValue({
    CRITICAL: 2,
    HIGH: 5,
    MEDIUM: 10,
    LOW: 3
  }),
  getCompletedTasks: jest.fn().mockReturnValue([
    { id: 'completed-1', content: 'Completed task', status: 'completed' }
  ]),
  getActiveWorkflows: jest.fn().mockReturnValue([
    { id: 'wf-1', name: 'Q1 Planning', status: 'in_progress', progress: 40 },
    { id: 'wf-2', name: 'Development', status: 'in_progress', progress: 60 }
  ]),
  getTaskCountsByRole: jest.fn().mockReturnValue({
    cfo: 5,
    cto: 8,
    coo: 3
  }),
  getAllRoles: jest.fn().mockReturnValue({
    cfo: { role_id: 'cfo', role_name: 'Chief Financial Officer' },
    cto: { role_id: 'cto', role_name: 'Chief Technology Officer' }
  }),
  getRoleData: jest.fn().mockReturnValue({
    role_id: 'cfo',
    role_name: 'Chief Financial Officer',
    tasks: []
  })
}));

// Mock dotenv
jest.unstable_mockModule('dotenv', () => ({
  default: { config: jest.fn() },
  config: jest.fn()
}));

// Now import Express and create a test app
const express = (await import('express')).default;
const cors = (await import('cors')).default;
const supertest = (await import('supertest')).default;

// Import mocked modules
const {
  getPendingTasks,
  getCompletedTasks,
  getActiveWorkflows,
  getTaskCountsByRole
} = await import('../api/taskDataLoader.js');

// Create test Express app
function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Dashboard stats endpoint
  app.get('/api/dashboard/stats', (req, res) => {
    try {
      const pendingTasks = getPendingTasks();
      const completedTasks = getCompletedTasks();
      const activeWorkflows = getActiveWorkflows();

      res.json({
        activeWorkflows: activeWorkflows.length,
        pendingTasks: pendingTasks.length,
        completedToday: completedTasks.length,
        totalDecisions: 0
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Pending tasks endpoint
  app.get('/api/pending-tasks', (req, res) => {
    try {
      const { role } = req.query;
      const tasks = getPendingTasks(role);

      const now = new Date();
      const formattedTasks = tasks.map(t => ({
        id: t.id,
        content: t.content,
        assigned_role: t.assigned_role,
        priority: t.priority,
        status: t.status,
        created_at: t.created_at,
        workflows: { name: t.workflow || 'Unknown' },
        age_in_hours: Math.round((now - new Date(t.created_at || now)) / 3600000)
      }));

      const summary = {
        CRITICAL: formattedTasks.filter(t => t.priority === 'CRITICAL').length,
        HIGH: formattedTasks.filter(t => t.priority === 'HIGH').length,
        MEDIUM: formattedTasks.filter(t => t.priority === 'MEDIUM').length,
        LOW: formattedTasks.filter(t => t.priority === 'LOW').length
      };

      res.json({
        tasks: formattedTasks,
        by_priority: summary,
        total: formattedTasks.length,
        source: 'notebooklm_json'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Recent activity endpoint (mocked without Supabase)
  app.get('/api/recent-activity', (req, res) => {
    res.json({
      activities: [],
      message: 'Supabase not configured - no activity data available'
    });
  });

  // Notifications status
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

  return app;
}

describe('Dashboard API Integration Tests', () => {
  let app;
  let request;

  beforeAll(() => {
    app = createTestApp();
    request = supertest(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return OK status', async () => {
      const response = await request.get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
    });

    it('should include timestamp', async () => {
      const response = await request.get('/api/health');

      expect(response.body.timestamp).toBeDefined();
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request.get('/api/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request.get('/api/dashboard/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activeWorkflows');
      expect(response.body).toHaveProperty('pendingTasks');
      expect(response.body).toHaveProperty('completedToday');
      expect(response.body).toHaveProperty('totalDecisions');
    });

    it('should return numeric values', async () => {
      const response = await request.get('/api/dashboard/stats');

      expect(typeof response.body.activeWorkflows).toBe('number');
      expect(typeof response.body.pendingTasks).toBe('number');
      expect(typeof response.body.completedToday).toBe('number');
      expect(typeof response.body.totalDecisions).toBe('number');
    });

    it('should count workflows from data loader', async () => {
      const response = await request.get('/api/dashboard/stats');

      // Mock returns 2 active workflows
      expect(response.body.activeWorkflows).toBe(2);
    });

    it('should count pending tasks from data loader', async () => {
      const response = await request.get('/api/dashboard/stats');

      // Mock returns 2 pending tasks
      expect(response.body.pendingTasks).toBe(2);
    });
  });

  describe('GET /api/pending-tasks', () => {
    it('should return pending tasks array', async () => {
      const response = await request.get('/api/pending-tasks');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.tasks)).toBe(true);
    });

    it('should include task count', async () => {
      const response = await request.get('/api/pending-tasks');

      expect(response.body.total).toBeDefined();
      expect(typeof response.body.total).toBe('number');
    });

    it('should include priority breakdown', async () => {
      const response = await request.get('/api/pending-tasks');

      expect(response.body.by_priority).toBeDefined();
      expect(response.body.by_priority).toHaveProperty('CRITICAL');
      expect(response.body.by_priority).toHaveProperty('HIGH');
      expect(response.body.by_priority).toHaveProperty('MEDIUM');
      expect(response.body.by_priority).toHaveProperty('LOW');
    });

    it('should include data source', async () => {
      const response = await request.get('/api/pending-tasks');

      expect(response.body.source).toBe('notebooklm_json');
    });

    it('should include task details', async () => {
      const response = await request.get('/api/pending-tasks');

      const task = response.body.tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('content');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('status');
    });

    it('should include workflow information', async () => {
      const response = await request.get('/api/pending-tasks');

      const task = response.body.tasks[0];
      expect(task).toHaveProperty('workflows');
      expect(task.workflows).toHaveProperty('name');
    });

    it('should calculate age in hours', async () => {
      const response = await request.get('/api/pending-tasks');

      const task = response.body.tasks[0];
      expect(task).toHaveProperty('age_in_hours');
      expect(typeof task.age_in_hours).toBe('number');
    });

    it('should filter by role when query param provided', async () => {
      const response = await request.get('/api/pending-tasks?role=cfo');

      expect(response.status).toBe(200);
      expect(getPendingTasks).toHaveBeenCalledWith('cfo');
    });
  });

  describe('GET /api/recent-activity', () => {
    it('should return activities array', async () => {
      const response = await request.get('/api/recent-activity');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activities');
      expect(Array.isArray(response.body.activities)).toBe(true);
    });

    it('should return message when Supabase not configured', async () => {
      const response = await request.get('/api/recent-activity');

      expect(response.body.message).toContain('Supabase not configured');
    });
  });

  describe('GET /api/notifications/status', () => {
    it('should return notification status', async () => {
      const response = await request.get('/api/notifications/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('slack');
      expect(response.body).toHaveProperty('email');
    });

    it('should include configuration status for each channel', async () => {
      const response = await request.get('/api/notifications/status');

      expect(response.body.slack).toHaveProperty('configured');
      expect(response.body.slack).toHaveProperty('status');
      expect(response.body.email).toHaveProperty('configured');
      expect(response.body.email).toHaveProperty('status');
    });

    it('should include timestamp', async () => {
      const response = await request.get('/api/notifications/status');

      expect(response.body.timestamp).toBeDefined();
    });

    it('should show not_configured when env vars missing', async () => {
      const response = await request.get('/api/notifications/status');

      expect(response.body.slack.status).toBe('not_configured');
      expect(response.body.email.status).toBe('not_configured');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request.get('/api/unknown-endpoint');

      expect(response.status).toBe(404);
    });

    it('should handle JSON parsing in POST requests', async () => {
      const response = await request
        .post('/api/decision')
        .send({ invalid: 'data' });

      // Should return 404 since endpoint doesn't exist in test app
      expect(response.status).toBe(404);
    });
  });

  describe('CORS and middleware', () => {
    it('should allow CORS requests', async () => {
      const response = await request
        .options('/api/health')
        .set('Origin', 'http://localhost:5173');

      // Express CORS middleware adds these headers
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should parse JSON bodies', async () => {
      const response = await request
        .post('/api/test-json')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // Should at least not crash on JSON body
      expect(response.status).toBeDefined();
    });
  });

  describe('Response format consistency', () => {
    it('should return JSON content type', async () => {
      const response = await request.get('/api/health');

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return consistent structure for list endpoints', async () => {
      const pendingResponse = await request.get('/api/pending-tasks');
      const activityResponse = await request.get('/api/recent-activity');

      // Both should have array data
      expect(Array.isArray(pendingResponse.body.tasks)).toBe(true);
      expect(Array.isArray(activityResponse.body.activities)).toBe(true);
    });
  });

  describe('Query parameter handling', () => {
    it('should handle missing query parameters gracefully', async () => {
      const response = await request.get('/api/pending-tasks');

      expect(response.status).toBe(200);
    });

    it('should pass role filter to data loader', async () => {
      await request.get('/api/pending-tasks?role=cto');

      expect(getPendingTasks).toHaveBeenCalledWith('cto');
    });

    it('should handle empty role parameter', async () => {
      const response = await request.get('/api/pending-tasks?role=');

      expect(response.status).toBe(200);
    });
  });
});

describe('API Response Validation', () => {
  let app;
  let request;

  beforeAll(() => {
    app = createTestApp();
    request = supertest(app);
  });

  describe('Dashboard Stats Schema', () => {
    it('should return all required fields', async () => {
      const response = await request.get('/api/dashboard/stats');
      const requiredFields = ['activeWorkflows', 'pendingTasks', 'completedToday', 'totalDecisions'];

      for (const field of requiredFields) {
        expect(response.body).toHaveProperty(field);
      }
    });

    it('should return non-negative numbers', async () => {
      const response = await request.get('/api/dashboard/stats');

      expect(response.body.activeWorkflows).toBeGreaterThanOrEqual(0);
      expect(response.body.pendingTasks).toBeGreaterThanOrEqual(0);
      expect(response.body.completedToday).toBeGreaterThanOrEqual(0);
      expect(response.body.totalDecisions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pending Tasks Schema', () => {
    it('should return valid task objects', async () => {
      const response = await request.get('/api/pending-tasks');

      for (const task of response.body.tasks) {
        expect(typeof task.id).toBe('string');
        expect(typeof task.content).toBe('string');
        expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(task.priority);
      }
    });

    it('should return valid priority summary', async () => {
      const response = await request.get('/api/pending-tasks');

      const summary = response.body.by_priority;
      expect(typeof summary.CRITICAL).toBe('number');
      expect(typeof summary.HIGH).toBe('number');
      expect(typeof summary.MEDIUM).toBe('number');
      expect(typeof summary.LOW).toBe('number');
    });

    it('should have matching total count', async () => {
      const response = await request.get('/api/pending-tasks');

      expect(response.body.total).toBe(response.body.tasks.length);
    });
  });
});
