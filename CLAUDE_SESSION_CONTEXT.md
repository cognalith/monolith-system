# Claude Code Session Context
**Last Updated**: 2026-01-17
**Branch**: main
**Phase**: 6H (All Teams Deployed + QA Fixes)
**Last Commit**: 00971cf - fix(dashboard): resolve API 404/500 errors from QA testing

---

## QA Fixes (Latest)

### Issues Found & Resolved
| Issue | Root Cause | Fix Applied |
|-------|-----------|-------------|
| 404 on `/teams/product` | Missing team ID in TEAM_HIERARCHY | Added product team definition to teamRoutes.js |
| 404 on `/teams/people` | Missing team ID in TEAM_HIERARCHY | Added people team definition to teamRoutes.js |
| 404 on `/recommendation-queue` | Endpoint not implemented | Added endpoint in neuralStackRoutes.js |
| 404 on `/learning-insights` | Endpoint not implemented | Added endpoint in neuralStackRoutes.js |
| 404 on `/research-log` | Endpoint not implemented | Added endpoint in neuralStackRoutes.js |
| 404 on `/teams/heatmap` | Endpoint not implemented | Added endpoint in neuralStackRoutes.js |
| 404 on `/teams/activity-log` | Endpoint not implemented | Added endpoint in neuralStackRoutes.js |
| 500 on `/recent-activity` | Unhandled Supabase error | Added graceful error handling |

### Files Modified
- `dashboard/src/api/teamRoutes.js` - Added product/people teams
- `dashboard/src/api/neuralStackRoutes.js` - Added 5 endpoints, updated KNOWLEDGE_BOTS
- `dashboard/src/server.js` - Graceful error handling for recent-activity

### Production Status
- Vercel frontend: Deployed ✅
- Railway backend: Deployed ✅ (commit 00971cf)
- All fixed endpoints responding correctly

---

## Phase 6G-6H: Finance & People Teams

### Overview
Phases 6G and 6H complete the Team Deployment series by adding the final two teams: Finance Team (6G) and People Team (6H). Executed in parallel for efficiency.

### Finance Team Structure (Phase 6G)
| Role | Reports To | Specialties |
|------|-----------|-------------|
| **CFO** (Team Lead) | CoS | Financial strategy, expense management, revenue analytics |
| **Expense Tracking Lead** | CFO | Expense management, budget tracking, cost analysis, spend optimization |
| **Revenue Analytics Lead** | CFO | Revenue forecasting, financial modeling, KPI tracking, profitability analysis |
| **finance_knowledge_bot** (Advisory) | CFO | Research best practices for subordinates |

### People Team Structure (Phase 6H)
| Role | Reports To | Specialties |
|------|-----------|-------------|
| **CHRO** (Team Lead) | CoS | HR strategy, talent management, compliance |
| **Hiring Lead** | CHRO | Talent acquisition, recruiting, candidate screening, onboarding |
| **Compliance Lead** | CHRO | HR compliance, policy enforcement, labor law, workplace safety |
| **people_knowledge_bot** (Advisory) | CHRO | Research best practices for subordinates |

### New Dashboard Components
| Component | File | Color |
|-----------|------|-------|
| `FinanceTeamPanel` | `FinanceTeamPanel.jsx` | Green (#22c55e) |
| `PeopleTeamPanel` | `PeopleTeamPanel.jsx` | Purple (#a855f7) |

### Test Results
- Finance Team: 103 tests passing
- People Team: 111 tests passing
- Combined Suite: 281 tests passing

---

## Phase 6F: Operations Team Panel

### Operations Team Structure
| Role | Reports To | Specialties |
|------|-----------|-------------|
| **COO** (Team Lead) | CoS | Vendor management, process automation, operational excellence |
| **Vendor Management Lead** | COO | Contract negotiation, SLA management, procurement |
| **Process Automation Lead** | COO | Workflow automation, system integration, no-code tools |
| **ops_knowledge_bot** (Advisory) | COO | Research best practices for subordinates |

### New Dashboard Components
| Component | File | Purpose |
|-----------|------|---------|
| `OperationsTeamPanel` | `OperationsTeamPanel.jsx` | Operations Team monitoring dashboard |
| Orange color scheme | `NeuralStack.css` | --neon-orange: #ff8c00 |

### API Endpoints (Phase 6F)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/neural-stack/teams/operations` | GET | Operations Team health and activity |
| `/api/neural-stack/knowledge-bots/ops-kb/research` | POST | Trigger ops knowledge bot research |

### Key Files
- `dashboard/src/components/NeuralStack/OperationsTeamPanel.jsx` - Main panel component
- `agents/neural-stack/operations-team-configs.js` - Agent configurations
- `agents/neural-stack/operations-team.test.js` - 67 tests (all passing)
- `agents/neural-stack/009_operations_team_seed.sql` - Database seed

---

## Phase 6 Series: Team Deployment

| Phase | Team | Lead | Color | Status |
|-------|------|------|-------|--------|
| 6A | Team Hierarchy | - | - | Complete (schema + overview panels) |
| 6B | Knowledge Bots | - | - | Complete (8 knowledge bots) |
| 6C | Tech Team | CTO | Cyan (#00b4d8) | Complete |
| 6D | Marketing Team | CMO | Magenta (#c832c8) | Complete |
| 6E | Product Team | CPO | Teal (#00c9a7) | Complete |
| 6F | Operations Team | COO | Orange (#ff8c00) | Complete |
| 6G | Finance Team | CFO | Green (#22c55e) | Complete |
| 6H | People Team | CHRO | Purple (#a855f7) | Complete |

---

## Phase 5E: Full Autonomy

### Overview
Phase 5E enables the Chief of Staff (CoS) to operate autonomously for standard Knowledge layer amendments, with exception-only escalation to the CEO. This completes the Neural Stack evolution from manual approval to autonomous operation.

### Deployment Status
| Component | Status | URL |
|-----------|--------|-----|
| Frontend (Vercel) | Deployed | https://monolith-system.vercel.app |
| Backend (Railway) | Deployed | monolith-system-production.up.railway.app |
| Database (Supabase) | Active | ixeruhjgahfhqmgftouj.supabase.co |

### New Dashboard Widgets
| Widget | Purpose |
|--------|---------|
| **Autonomy Status Panel** | Shows autonomous vs escalated amendment counts, autonomy rate |
| **CoS Health Indicator** | Success rate gauge with hardcoded 50% threshold over 20 amendments |
| **Exception Queue** | Pending CEO escalations with approve/reject actions |
| **Baking Activity** | Tracks when proven amendments merge into standard_knowledge |

### Escalation Triggers (CEO Required)
1. **Skills Layer Modifications** - Changes to agent capabilities
2. **Persona Layer Modifications** - Changes to agent personality/behavior
3. **3+ Consecutive Failures** - Same agent failing repeatedly
4. **Cross-Agent Decline Patterns** - Multiple agents declining simultaneously

### Hardcoded Safety Constraints
```javascript
const HARDCODED = Object.freeze({
  ALERT_THRESHOLD: 0.50,        // 50% success rate triggers alert
  WINDOW_SIZE: 20,              // Rolling window of amendments
  MIN_AMENDMENTS_FOR_ALERT: 10, // Minimum sample before alerting
  SELF_MODIFY_BLOCKED: true     // CoS cannot modify these values
});
```

### Database Tables (Phase 5E)
```sql
-- Exception escalations requiring CEO action
exception_escalations (id, amendment_id, reason, status, resolved_by, created_at)

-- Proven amendments merged into standard_knowledge
baked_amendments (id, original_amendment_id, agent_role, baked_changes, version_hashes)

-- CoS self-monitoring metrics
cos_monitoring (id, amendment_id, success, recorded_at)

-- Reversion audit trail
revert_log (id, amendment_id, reason, metrics, reverted_at)

-- Consecutive failure tracking
consecutive_failures (id, agent_role, failure_count, escalated)

-- CEO health alerts
ceo_alerts (id, alert_type, reason, metrics, acknowledged)
```

### Amendment Baking Process
1. Agent reaches 10+ active amendments (threshold)
2. Oldest proven amendment selected (5+ successful evaluations, 60%+ success rate)
3. Amendment merged into `standard_knowledge` layer
4. New `knowledge_version_hash` computed
5. Amendment marked `is_baked = true` and archived

---

## Neural Stack Evolution (Phases 5A-5E)

| Phase | Name | Description |
|-------|------|-------------|
| 5A | Data Foundation | Supabase tables for agent memory, task history, amendments |
| 5B | Authorization Escalation | Financial Escalation Framework (MonA + Frank MFA) |
| 5C | Amendment System | Knowledge amendments with CoS evaluation |
| 5D | Neural Stack Dashboard | Health monitoring, variance tracking, amendment activity |
| 5E | Full Autonomy | Exception-only escalation, auto-approval, amendment baking |

---

## Project Structure

```
/home/tinanaman/monolith-system/
├── agents/                          # AI Agent System
│   ├── core/
│   │   ├── TaskOrchestrator.js     # Task routing and execution
│   │   ├── RoleAgent.js            # Base agent class
│   │   ├── EscalationEngine.js     # Phase 5E exception escalation
│   │   ├── DecisionLogger.js       # Decision audit logging
│   │   └── LLMRouter.js            # Model selection logic
│   ├── intelligence/
│   │   └── SmartRouter.js          # Intelligent task routing
│   ├── neural-stack/
│   │   ├── AmendmentEngine.js      # Amendment CRUD operations
│   │   ├── AmendmentSafety.js      # Safety checks, auto-revert
│   │   ├── ApprovalWorkflow.js     # Autonomous/strict modes
│   │   ├── KnowledgeComputer.js    # Knowledge layer composition
│   │   ├── ExceptionEscalation.js  # Phase 5E escalation logic
│   │   ├── AmendmentBaking.js      # Phase 5E baking mechanism
│   │   └── CoSSelfMonitor.js       # Phase 5E self-monitoring
│   ├── roles/
│   │   ├── ceo/agent.js            # CEO agent
│   │   ├── cfo/agent.js            # CFO agent (financial oversight)
│   │   ├── cto/agent.js            # CTO agent
│   │   ├── cos/agent.js            # Chief of Staff (document management)
│   │   ├── ciso/agent.js           # CISO agent (security)
│   │   ├── cmo/agent.js            # CMO agent (marketing)
│   │   ├── devops/agent.js         # DevOps agent
│   │   └── software-engineer/      # Software Engineer agent
│   ├── services/
│   │   ├── BrowserService.js       # Playwright automation
│   │   ├── DatabaseService.js      # Supabase operations
│   │   ├── DocumentService.js      # Google Drive file ops
│   │   ├── DocumentIndexer.js      # Document search index
│   │   ├── GmailService.js         # Email operations
│   │   ├── LoggingService.js       # Centralized logging
│   │   ├── MeteringService.js      # Usage tracking
│   │   ├── TenantService.js        # Multi-tenant support
│   │   └── index.js                # Service exports
│   ├── production/
│   │   ├── ConfigManager.js        # Environment config
│   │   └── validateSecrets.js      # Secret validation
│   └── server.js                   # Agent API server
│
├── dashboard/                       # React Dashboard + Express API
│   ├── src/
│   │   ├── server.js               # Main Express server
│   │   ├── api/
│   │   │   ├── neuralStackRoutes.js # Neural Stack API endpoints
│   │   │   ├── tasksRoutes.js      # Task management API
│   │   │   ├── agentIntegration.js # Agent bridge
│   │   │   └── taskDataWriter.js   # Atomic JSON updates
│   │   ├── components/
│   │   │   ├── NeuralStack/        # Phase 5D-5E dashboard
│   │   │   │   ├── index.jsx       # Main dashboard component
│   │   │   │   ├── AgentHealthGrid.jsx
│   │   │   │   ├── AutonomyStatusPanel.jsx    # Phase 5E
│   │   │   │   ├── CoSHealthIndicator.jsx     # Phase 5E
│   │   │   │   ├── ExceptionQueueWidget.jsx   # Phase 5E
│   │   │   │   ├── BakingActivityWidget.jsx   # Phase 5E
│   │   │   │   ├── EscalationWidget.jsx
│   │   │   │   ├── VarianceTrendChart.jsx
│   │   │   │   ├── AmendmentActivityLog.jsx
│   │   │   │   ├── AgentHeatmap.jsx
│   │   │   │   └── NeuralStack.css
│   │   │   └── ...other components
│   │   ├── hooks/
│   │   │   └── useNeuralStack.js   # Neural Stack data hooks
│   │   └── data/tasks/             # Task JSON files
│   └── package.json
│
├── database/
│   ├── schema.sql                  # Core database schema
│   ├── tenant-schema.sql           # Multi-tenant schema
│   └── migrations/
│       └── 005_phase5e_full_autonomy.sql  # Phase 5E tables
│
├── railway.toml                    # Railway deployment config
├── Dockerfile                      # Container configuration
├── CLAUDE.md                       # Claude Code instructions
└── CLAUDE_SESSION_CONTEXT.md       # This file
```

---

## API Endpoints

### Neural Stack API (`/api/neural-stack/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent-health` | GET | Health metrics for all 15 agents |
| `/variance-history/:agentRole` | GET | Variance trend data |
| `/escalations` | GET | Financial escalations (Phase 5B) |
| `/amendments` | GET | Amendment activity log |
| `/heatmap` | GET | Cross-agent performance matrix |
| `/cos-health` | GET | CoS success rate and alerts (Phase 5E) |
| `/exception-escalations` | GET | Pending CEO exceptions (Phase 5E) |
| `/exception-escalations/:id/resolve` | POST | Resolve exception (Phase 5E) |
| `/baked-amendments` | GET | Baked amendment history (Phase 5E) |
| `/autonomy-stats` | GET | Autonomous vs escalated counts (Phase 5E) |

### Task API (`/api/tasks/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:taskId` | GET | Get single task |
| `/:taskId/status` | PATCH | Update task status |
| `/:taskId/complete` | POST | Complete task + unblock dependents |
| `/:taskId/send-to-agent` | POST | Queue for AI agent |
| `/:taskId/steps` | GET | Get/generate task steps |

---

## Environment Variables

### Dashboard (Vercel/Railway)
```bash
SUPABASE_URL=https://ixeruhjgahfhqmgftouj.supabase.co
SUPABASE_ANON_KEY=<jwt-token>
SUPABASE_SERVICE_ROLE_KEY=<service-key>  # Optional, for admin ops
NODE_ENV=production
```

### Agents
```bash
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>
DOCUMENT_ROOT=/mnt/h/My Drive/MONOLITH_OS
ENABLE_DOCUMENT_MANAGEMENT=true
```

---

## Google Drive Integration

### Document Repository
- **Path**: `H:\My Drive\MONOLITH_OS` (WSL: `/mnt/h/My Drive/MONOLITH_OS`)
- **Managed By**: Chief of Staff Agent

### Folder Structure
```
MONOLITH_OS/
├── 00_INBOX/      # Unprocessed incoming documents
├── 01_EXECUTIVE/  # CEO directives, board docs
├── 02_FINANCE/    # Budgets, reports, invoices
├── 03_TECHNOLOGY/ # Architecture docs, specs
├── 04_LEGAL/      # Contracts, compliance
├── 05_OPERATIONS/ # SOPs, workflows
├── 06_PRODUCT/    # PRDs, roadmaps
├── 07_PEOPLE/     # HR policies, org charts
├── 08_MARKETING/  # Brand assets, campaigns
├── 09_SECURITY/   # Security policies, audits
├── 10_PROJECTS/   # Active project workspaces
├── 99_ARCHIVE/    # Completed/obsolete documents
└── _INDEX.md      # Repository guide
```

### WSL Mount Command
```bash
sudo mkdir -p /mnt/h && sudo mount -t drvfs H: /mnt/h
```

---

## How to Start

### Dashboard Server
```bash
cd /home/tinanaman/monolith-system/dashboard
node src/server.js
# Server runs on http://localhost:3000
```

### View Dashboard
- Local: http://localhost:3000
- Production: https://monolith-system.vercel.app

---

## Recent Commits

```
efd1244 feat(phase-5e): complete Full Autonomy implementation
0f1a4d6 fix: update heatmap query to use existing column names
c877db9 chore: trigger Railway Dockerfile rebuild for Phase 5E
6d350e3 feat(neural-stack): implement Phase 5E Full Autonomy
b3ad7e8 feat(dashboard): implement Cognalith Cyber-Noir UI redesign
bd3ad78 feat(dashboard): add Phase 5D Neural Stack Dashboard
cf0fa91 feat(neural-stack): add Phase 5C Amendment System
6c4b367 feat(neural-stack): add Phase 5B Authorization Escalation Framework
82d87a6 feat(neural-stack): add Phase 5A Data Foundation
```

---

## Next Steps / Potential Work

- [ ] Implement real-time WebSocket updates for dashboard
- [ ] Add amendment evaluation simulation for testing
- [ ] Connect live agent system to Neural Stack
- [ ] Add cross-agent pattern detection analytics
- [ ] Implement amendment rollback UI
- [ ] Add CoS health trend visualization
