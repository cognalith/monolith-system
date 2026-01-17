/**
 * MONOLITH OS - Tenant Service
 * Phase 7: Multi-tenancy support
 *
 * Provides tenant management operations including:
 * - Tenant CRUD operations
 * - Usage tracking and limits
 * - Plan management
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Tenant plans with their limits
 */
export const PLANS = {
  free: {
    name: 'Free',
    maxUsers: 5,
    maxTasksPerMonth: 100,
    maxAgents: 2,
    maxLlmTokensPerMonth: 50000,
    features: ['basic_tasks', 'basic_workflows']
  },
  starter: {
    name: 'Starter',
    maxUsers: 20,
    maxTasksPerMonth: 1000,
    maxAgents: 5,
    maxLlmTokensPerMonth: 500000,
    features: ['basic_tasks', 'basic_workflows', 'email_notifications', 'api_access']
  },
  professional: {
    name: 'Professional',
    maxUsers: 100,
    maxTasksPerMonth: 10000,
    maxAgents: 20,
    maxLlmTokensPerMonth: 5000000,
    features: ['basic_tasks', 'basic_workflows', 'email_notifications', 'api_access', 'advanced_analytics', 'custom_agents']
  },
  enterprise: {
    name: 'Enterprise',
    maxUsers: -1, // Unlimited
    maxTasksPerMonth: -1,
    maxAgents: -1,
    maxLlmTokensPerMonth: -1,
    features: ['all']
  }
};

/**
 * Tenant status values
 */
export const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TRIAL: 'trial',
  CANCELLED: 'cancelled'
};

/**
 * TenantService class
 * Manages tenant operations and usage tracking
 */
export class TenantService {
  constructor(options = {}) {
    this.supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
    this.supabaseKey = options.supabaseKey || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    // Initialize Supabase client if credentials are available
    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    } else {
      console.warn('[TenantService] Supabase not configured, using in-memory store');
      this.supabase = null;
    }

    // In-memory tenant store for fallback
    this.tenantStore = new Map();
    this.usageStore = new Map();

    // Initialize default tenant
    this._initializeDefaultTenant();
  }

  /**
   * Initialize default tenant for single-tenant mode
   */
  _initializeDefaultTenant() {
    const defaultTenant = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Default Tenant',
      slug: 'default',
      plan: 'enterprise',
      planLimits: PLANS.enterprise,
      settings: {
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        notificationsEnabled: true,
        auditRetentionDays: 90
      },
      status: TENANT_STATUS.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tenantStore.set(defaultTenant.id, defaultTenant);
    this.tenantStore.set(`slug:${defaultTenant.slug}`, defaultTenant);
  }

  /**
   * Generate a unique tenant ID
   */
  _generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a slug from a name
   */
  _generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Create a new tenant
   * @param {object} data - Tenant data
   * @returns {Promise<object>} Created tenant
   */
  async createTenant(data) {
    const { name, slug, plan = 'free', settings = {}, billingEmail } = data;

    if (!name) {
      throw new Error('Tenant name is required');
    }

    const tenantSlug = slug || this._generateSlug(name);

    // Check if slug already exists
    const existing = await this.getTenantBySlug(tenantSlug);
    if (existing) {
      throw new Error(`Tenant with slug '${tenantSlug}' already exists`);
    }

    // Validate plan
    if (!PLANS[plan]) {
      throw new Error(`Invalid plan: ${plan}. Valid plans: ${Object.keys(PLANS).join(', ')}`);
    }

    const tenant = {
      id: this._generateId(),
      name,
      slug: tenantSlug,
      plan,
      planLimits: PLANS[plan],
      settings: {
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        notificationsEnabled: true,
        auditRetentionDays: 90,
        ...settings
      },
      billingEmail: billingEmail || null,
      status: TENANT_STATUS.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Try to persist to Supabase
    if (this.supabase) {
      try {
        const { data: dbTenant, error } = await this.supabase
          .from('tenants')
          .insert([{
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            plan_limits: tenant.planLimits,
            settings: tenant.settings,
            billing_email: tenant.billingEmail,
            status: tenant.status
          }])
          .select()
          .single();

        if (error) throw error;
        tenant.id = dbTenant.id;
      } catch (error) {
        console.error('[TenantService] Failed to persist tenant to database:', error.message);
        // Fall through to in-memory storage
      }
    }

    // Store in memory
    this.tenantStore.set(tenant.id, tenant);
    this.tenantStore.set(`slug:${tenant.slug}`, tenant);

    console.log(`[TenantService] Created tenant: ${tenant.name} (${tenant.id})`);

    return tenant;
  }

  /**
   * Get tenant by ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object|null>} Tenant or null
   */
  async getTenant(tenantId) {
    // Check in-memory first
    const cached = this.tenantStore.get(tenantId);
    if (cached) return cached;

    // Try database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('tenants')
          .select('*')
          .eq('id', tenantId)
          .is('deleted_at', null)
          .single();

        if (error) throw error;
        if (!data) return null;

        const tenant = this._mapDbTenant(data);
        this.tenantStore.set(tenant.id, tenant);
        return tenant;
      } catch (error) {
        console.error('[TenantService] Failed to fetch tenant:', error.message);
      }
    }

    return null;
  }

  /**
   * Get tenant by slug
   * @param {string} slug - Tenant slug
   * @returns {Promise<object|null>} Tenant or null
   */
  async getTenantBySlug(slug) {
    // Check in-memory first
    const cached = this.tenantStore.get(`slug:${slug}`);
    if (cached) return cached;

    // Try database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .is('deleted_at', null)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;

        const tenant = this._mapDbTenant(data);
        this.tenantStore.set(tenant.id, tenant);
        this.tenantStore.set(`slug:${tenant.slug}`, tenant);
        return tenant;
      } catch (error) {
        console.error('[TenantService] Failed to fetch tenant by slug:', error.message);
      }
    }

    return null;
  }

  /**
   * Update tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} updates - Updates to apply
   * @returns {Promise<object>} Updated tenant
   */
  async updateTenant(tenantId, updates) {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const { name, settings, plan, status, billingEmail } = updates;

    if (name) tenant.name = name;
    if (settings) tenant.settings = { ...tenant.settings, ...settings };
    if (plan && PLANS[plan]) {
      tenant.plan = plan;
      tenant.planLimits = PLANS[plan];
    }
    if (status && Object.values(TENANT_STATUS).includes(status)) {
      tenant.status = status;
    }
    if (billingEmail !== undefined) tenant.billingEmail = billingEmail;

    tenant.updatedAt = new Date().toISOString();

    // Update in database
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('tenants')
          .update({
            name: tenant.name,
            settings: tenant.settings,
            plan: tenant.plan,
            plan_limits: tenant.planLimits,
            status: tenant.status,
            billing_email: tenant.billingEmail,
            updated_at: tenant.updatedAt
          })
          .eq('id', tenantId);

        if (error) throw error;
      } catch (error) {
        console.error('[TenantService] Failed to update tenant in database:', error.message);
      }
    }

    // Update in-memory
    this.tenantStore.set(tenant.id, tenant);
    this.tenantStore.set(`slug:${tenant.slug}`, tenant);

    return tenant;
  }

  /**
   * List all tenants
   * @param {object} options - Query options
   * @returns {Promise<object[]>} List of tenants
   */
  async listTenants(options = {}) {
    const { status, plan, limit = 100, offset = 0 } = options;

    // Try database first
    if (this.supabase) {
      try {
        let query = this.supabase
          .from('tenants')
          .select('*', { count: 'exact' })
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (status) query = query.eq('status', status);
        if (plan) query = query.eq('plan', plan);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
          tenants: data.map(this._mapDbTenant),
          total: count,
          limit,
          offset
        };
      } catch (error) {
        console.error('[TenantService] Failed to list tenants:', error.message);
      }
    }

    // Fallback to in-memory
    let tenants = Array.from(this.tenantStore.values())
      .filter(t => typeof t === 'object' && t.id);

    if (status) tenants = tenants.filter(t => t.status === status);
    if (plan) tenants = tenants.filter(t => t.plan === plan);

    return {
      tenants: tenants.slice(offset, offset + limit),
      total: tenants.length,
      limit,
      offset
    };
  }

  /**
   * Record usage for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} usage - Usage data
   * @returns {Promise<object>} Recorded usage
   */
  async recordUsage(tenantId, usage) {
    const {
      metricType,
      quantity,
      unit = 'count',
      unitCost,
      metadata = {}
    } = usage;

    if (!tenantId || !metricType || quantity === undefined) {
      throw new Error('tenantId, metricType, and quantity are required');
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);

    const usageRecord = {
      id: this._generateId(),
      tenantId,
      metricType,
      quantity,
      unit,
      unitCost: unitCost || null,
      totalCost: unitCost ? quantity * unitCost : null,
      currency: 'USD',
      metadata,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      recordedAt: now.toISOString()
    };

    // Persist to database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('usage_records')
          .insert([{
            tenant_id: usageRecord.tenantId,
            metric_type: usageRecord.metricType,
            quantity: usageRecord.quantity,
            unit: usageRecord.unit,
            unit_cost: usageRecord.unitCost,
            total_cost: usageRecord.totalCost,
            currency: usageRecord.currency,
            metadata: usageRecord.metadata,
            period_start: usageRecord.periodStart,
            period_end: usageRecord.periodEnd
          }])
          .select()
          .single();

        if (error) throw error;
        usageRecord.id = data.id;
      } catch (error) {
        console.error('[TenantService] Failed to record usage:', error.message);
      }
    }

    // Store in memory
    const tenantUsage = this.usageStore.get(tenantId) || [];
    tenantUsage.push(usageRecord);
    this.usageStore.set(tenantId, tenantUsage);

    return usageRecord;
  }

  /**
   * Get usage summary for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Usage summary
   */
  async getUsageSummary(tenantId, options = {}) {
    const {
      periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      periodEnd = new Date()
    } = options;

    const summary = {
      tenantId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      metrics: {},
      totalCost: 0
    };

    // Try database first
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('usage_records')
          .select('metric_type, quantity, total_cost')
          .eq('tenant_id', tenantId)
          .gte('period_start', periodStart.toISOString())
          .lte('period_end', periodEnd.toISOString());

        if (error) throw error;

        data.forEach(record => {
          if (!summary.metrics[record.metric_type]) {
            summary.metrics[record.metric_type] = { quantity: 0, cost: 0 };
          }
          summary.metrics[record.metric_type].quantity += parseFloat(record.quantity);
          summary.metrics[record.metric_type].cost += parseFloat(record.total_cost || 0);
          summary.totalCost += parseFloat(record.total_cost || 0);
        });

        return summary;
      } catch (error) {
        console.error('[TenantService] Failed to get usage summary:', error.message);
      }
    }

    // Fallback to in-memory
    const records = this.usageStore.get(tenantId) || [];
    records
      .filter(r => {
        const recordStart = new Date(r.periodStart);
        return recordStart >= periodStart && recordStart <= periodEnd;
      })
      .forEach(record => {
        if (!summary.metrics[record.metricType]) {
          summary.metrics[record.metricType] = { quantity: 0, cost: 0 };
        }
        summary.metrics[record.metricType].quantity += record.quantity;
        summary.metrics[record.metricType].cost += record.totalCost || 0;
        summary.totalCost += record.totalCost || 0;
      });

    return summary;
  }

  /**
   * Check if tenant is within plan limits
   * @param {string} tenantId - Tenant ID
   * @param {string} metricType - Metric type to check
   * @param {number} requestedQuantity - Quantity to add
   * @returns {Promise<object>} Limit check result
   */
  async checkLimits(tenantId, metricType, requestedQuantity = 1) {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return { allowed: false, reason: 'Tenant not found' };
    }

    const limitMap = {
      LLM_TOKENS: 'maxLlmTokensPerMonth',
      TASKS_PROCESSED: 'maxTasksPerMonth'
    };

    const limitKey = limitMap[metricType];
    if (!limitKey) {
      return { allowed: true }; // No limit for this metric
    }

    const limit = tenant.planLimits[limitKey];
    if (limit === -1) {
      return { allowed: true }; // Unlimited
    }

    // Get current usage
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const summary = await this.getUsageSummary(tenantId, { periodStart: monthStart });

    const currentUsage = summary.metrics[metricType]?.quantity || 0;
    const remaining = limit - currentUsage;
    const allowed = (currentUsage + requestedQuantity) <= limit;

    return {
      allowed,
      currentUsage,
      limit,
      remaining,
      requested: requestedQuantity,
      reason: allowed ? null : `Would exceed ${metricType} limit (${limit})`
    };
  }

  /**
   * Map database tenant to service format
   */
  _mapDbTenant(dbTenant) {
    return {
      id: dbTenant.id,
      name: dbTenant.name,
      slug: dbTenant.slug,
      plan: dbTenant.plan,
      planLimits: dbTenant.plan_limits,
      settings: dbTenant.settings,
      billingEmail: dbTenant.billing_email,
      status: dbTenant.status,
      trialEndsAt: dbTenant.trial_ends_at,
      createdAt: dbTenant.created_at,
      updatedAt: dbTenant.updated_at
    };
  }
}

// Export singleton instance
const tenantService = new TenantService();
export default tenantService;
