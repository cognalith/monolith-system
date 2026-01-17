/**
 * MONOLITH OS - Services
 * Centralized service exports
 */

import documentService, { DocumentService, FOLDER_MAPPING } from './DocumentService.js';
import documentIndexer, { DocumentIndexer } from './DocumentIndexer.js';
import browserService, { BrowserService } from './BrowserService.js';
import gmailService, { GmailService, SCOPES as GMAIL_SCOPES } from './GmailService.js';
import redisService, { RedisService } from './RedisService.js';
import loggingService, { LoggingService } from './LoggingService.js';
import databaseService, { DatabaseService } from './DatabaseService.js';

// Phase 7: Multi-tenancy and Metering Services
import tenantService, {
  TenantService,
  PLANS as TENANT_PLANS,
  TENANT_STATUS
} from './TenantService.js';
import meteringService, {
  MeteringService,
  MetricType,
  LLM_PRICING,
  SERVICE_PRICING
} from './MeteringService.js';

// Media Generation Services (Phase 8)
import notebookLMService, { NotebookLMService } from './NotebookLMService.js';
import mediaGenerationService, { MediaGenerationService, MEDIA_TYPES } from './MediaGenerationService.js';

export {
  // Document Services
  documentService,
  DocumentService,
  FOLDER_MAPPING,
  documentIndexer,
  DocumentIndexer,
  // Browser Service
  browserService,
  BrowserService,
  // Gmail Service
  gmailService,
  GmailService,
  GMAIL_SCOPES,
  // Production Infrastructure Services
  redisService,
  RedisService,
  loggingService,
  LoggingService,
  // Database Service
  databaseService,
  DatabaseService,
  // Tenant Service (Phase 7)
  tenantService,
  TenantService,
  TENANT_PLANS,
  TENANT_STATUS,
  // Metering Service (Phase 7)
  meteringService,
  MeteringService,
  MetricType,
  LLM_PRICING,
  SERVICE_PRICING,
  // Media Generation Services (Phase 8)
  notebookLMService,
  NotebookLMService,
  mediaGenerationService,
  MediaGenerationService,
  MEDIA_TYPES,
};

export default {
  documentService,
  documentIndexer,
  browserService,
  gmailService,
  redisService,
  loggingService,
  databaseService,
  tenantService,
  meteringService,
  notebookLMService,
  mediaGenerationService,
};
