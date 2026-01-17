# Claude Code Session Context
**Last Updated**: 2026-01-17
**Branch**: main
**Phase**: 7.1 (Task Migration Complete)
**Last Commit**: 3953522 - feat(orchestration): add dependency migration script

---

## Phase 7.1: Task Migration (Latest)

### Overview
Migrated 320 real JSON tasks from NotebookLM extracts to the Supabase orchestration queue with 42 cross-agent dependencies.

### Migration Statistics
| Metric | Count |
|--------|-------|
| Total Tasks Migrated | 320 |
| Dependencies Created | 42 |
| Task Breakdown | 168 queued, 106 active, 45 completed, 3 blocked |

### New Migration Files (`agents/orchestration/`)
| File | Lines | Purpose |
|------|-------|---------|
| `DependencyParser.js` | 932 | Parses task notes to extract dependency references, 50+ phrase-to-role mappings |
| `migrateJsonTasks.js` | 679 | Reads 22 JSON task files, transforms to Supabase format, batch inserts |
| `migrateDependencies.js` | 694 | Creates cross-agent dependencies from metadata and parsed notes |

### New Bulk Import Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/bulk` | POST | Bulk task import (max 100 tasks per request) |
| `/dependencies/bulk` | POST | Bulk dependency import (max 500 per request) |
| `/migration/status` | GET | Migration statistics and validation |

### Task ID Format (Enhanced)
Human-readable: `TASK-YYYYMMDD-ROLE-NNN` (e.g., `TASK-20260105-CHRO-003`)

### QA Fixes Applied During Migration
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| 404 on `/tasks/blocked` | Route ordering - matched as `:id` param | Moved specific routes before parameterized routes |
| 404 on `/tasks/active` | Route ordering - matched as `:id` param | Moved specific routes before parameterized routes |
| Invalid due_date "Daily 8 AM" | Non-date values in JSON | Added date regex validation, moved to metadata |

---

## Phase 7: Task Orchestration Engine

### Overview
Phase 7 implements the autonomous execution layer where tasks flow through agent queues with dependency tracking, blocking states, and CEO decision escalation. This is the "nervous system" that connects all agents.

### Database Schema
Three new tables in Supabase:

| Table | Purpose |
|-------|---------|
| `monolith_task_queue` | Central queue for all tasks with status, priority, blocking, escalation |
| `monolith_task_dependencies` | Task-to-task dependency tracking |
| `monolith_ceo_decisions` | Queue of decisions requiring Frank's input |

### Task States
```
queued → active → completed
              ↘ failed
              ↘ blocked (blocked_agent, blocked_decision, blocked_auth, blocked_payment)
              ↘ cancelled
```

### Priority Mapping
| String | Integer |
|--------|---------|
| `low` | 25 |
| `medium` | 50 |
| `high` | 75 |
| `critical` | 100 |

### Task ID Format
Human-readable: `TASK-YYYYMMDD-XXX` (e.g., `TASK-20260117-878`)

### API Endpoints (`/api/orchestration/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health, task counts, throughput metrics |
| `/tasks` | GET | List tasks with filters (?status, ?agent, ?team) |
| `/tasks` | POST | Create new task |
| `/tasks/bulk` | POST | Bulk task import (max 100) |
| `/tasks/blocked` | GET | All blocked tasks |
| `/tasks/active` | GET | All active tasks |
| `/tasks/queue/:agentRole` | GET | Agent's task queue |
| `/tasks/:id` | GET | Get task details with dependencies |
| `/tasks/:id` | PATCH | Update task |
| `/tasks/:id` | DELETE | Cancel task (soft delete) |
| `/dependencies/bulk` | POST | Bulk dependency import (max 500) |
| `/migration/status` | GET | Migration statistics |
| `/decisions` | GET | Pending CEO decisions |
| `/decisions/:id` | GET | Decision details |
| `/decisions/:id/decide` | POST | Submit Frank's decision |
| `/decisions/:id/defer` | POST | Defer a decision |
| `/decisions/:id/delegate` | POST | Delegate to another agent |
| `/agents` | GET | All agents' work status |
| `/throughput` | GET | Throughput metrics by period |

### Key Files Created

**Core Engine** (`agents/orchestration/`):
- `TaskRouter.js` - Routes tasks to agents based on keywords, tags, team
- `ExecutionEngine.js` - Agent execution loop with task state management
- `ResolutionSystem.js` - DependencyResolver, CEODecisionHandler, AutoEscalation
- `index.js` - Module exports for orchestration components

**API Routes**:
- `dashboard/src/api/orchestrationRoutes.js` - 16 REST endpoints

**Dashboard Components** (`dashboard/src/components/Orchestration/`):
- `ActiveWorkPanel.jsx` - Agent work status grid
- `TaskQueuePanel.jsx` - Queued/blocked/active task lists
- `CEODecisionQueue.jsx` - Frank's decision interface
- `SystemHealthPanel.jsx` - Health metrics dashboard
- `Orchestration.css` - Cyber-noir styling
- `index.jsx` - Main orchestration dashboard

**Database Migration**:
- `database/migrations/008_phase7_task_orchestration.sql`

### Deployment Notes
- Railway requires `RAILWAY_DOCKERFILE_PATH=Dockerfile` env var to use Dockerfile instead of static site serving
- All 16 orchestration endpoints tested and working

### Test Results
```bash
# Health check
curl https://monolith-system-production.up.railway.app/api/orchestration/health
# Returns: {"status":"healthy","task_counts":{...},"pending_decisions":0}

# Create task
curl -X POST .../api/orchestration/tasks -d '{"title":"Test","priority":"high"}'
# Returns: {"success":true,"task":{"task_id":"TASK-20260117-878","priority":75,...}}
```

---

## QA Fixes (Phase 6H)

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
Phase 5E enables the Chief of Staff (CoS) to operate autonomously for standard Knowledge layer amendments, with exception-only escalation to the CEO.

### Deployment Status
| Component | Status | URL |
|-----------|--------|-----|
| Frontend (Vercel) | Deployed | https://monolith-system.vercel.app |
| Backend (Railway) | Deployed | monolith-system-production.up.railway.app |
| Database (Supabase) | Active | ixeruhjgahfhqmgftouj.supabase.co |

### Hardcoded Safety Constraints
```javascript
const HARDCODED = Object.freeze({
  ALERT_THRESHOLD: 0.50,        // 50% success rate triggers alert
  WINDOW_SIZE: 20,              // Rolling window of amendments
  MIN_AMENDMENTS_FOR_ALERT: 10, // Minimum sample before alerting
  SELF_MODIFY_BLOCKED: true     // CoS cannot modify these values
});
```

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
│   ├── neural-stack/               # Phase 5 & 6 components
│   │   ├── AmendmentEngine.js      # Amendment CRUD operations
│   │   ├── AmendmentSafety.js      # Safety checks, auto-revert
│   │   ├── ApprovalWorkflow.js     # Autonomous/strict modes
│   │   ├── KnowledgeComputer.js    # Knowledge layer composition
│   │   ├── ExceptionEscalation.js  # Phase 5E escalation logic
│   │   ├── AmendmentBaking.js      # Phase 5E baking mechanism
│   │   ├── CoSSelfMonitor.js       # Phase 5E self-monitoring
│   │   ├── 001-011_*.sql           # Neural stack & team seed migrations
│   │   └── *-team-configs.js       # Team configuration files (tech, marketing, product, ops)
│   ├── orchestration/              # Phase 7 components
│   │   ├── TaskRouter.js           # Task routing to agents
│   │   ├── ExecutionEngine.js      # Agent execution loop
│   │   ├── ResolutionSystem.js     # Dependency/decision resolution
│   │   ├── DependencyParser.js     # Parses task dependencies from notes
│   │   ├── migrateJsonTasks.js     # JSON to Supabase migration script
│   │   ├── migrateDependencies.js  # Cross-agent dependency migration
│   │   └── index.js                # Module exports
│   ├── roles/                      # Agent role definitions
│   ├── services/                   # Shared services
│   └── server.js                   # Agent API server
│
├── cognalith-website/               # Company website (separate project)
│
├── dashboard/                       # React Dashboard + Express API
│   ├── src/
│   │   ├── server.js               # Main Express server
│   │   ├── api/
│   │   │   ├── neuralStackRoutes.js    # Neural Stack API
│   │   │   ├── orchestrationRoutes.js  # Phase 7 Task Orchestration API
│   │   │   ├── teamRoutes.js           # Team hierarchy API
│   │   │   ├── knowledgeBotRoutes.js   # Knowledge bot API
│   │   │   └── tasksRoutes.js          # Task management API
│   │   ├── components/
│   │   │   ├── NeuralStack/        # Phase 5D-6H dashboard
│   │   │   └── Orchestration/      # Phase 7 dashboard
│   │   └── data/tasks/             # Task JSON files
│   └── package.json
│
├── database/
│   └── migrations/
│       ├── 005_phase5e_full_autonomy.sql
│       ├── 006_phase6a_team_hierarchy.sql
│       ├── 007_phase6b_knowledge_bot_tables.sql
│       └── 008_phase7_task_orchestration.sql
│
├── docs/                           # Documentation
├── infrastructure/                 # Infrastructure configs
├── railway.toml                    # Railway deployment config
├── Dockerfile                      # Container configuration
├── CLAUDE.md                       # Claude Code instructions
└── CLAUDE_SESSION_CONTEXT.md       # This file
```

---

## API Endpoints Summary

### Orchestration API (`/api/orchestration/`) - Phase 7
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health metrics |
| `/tasks` | GET/POST | List/create tasks |
| `/tasks/bulk` | POST | Bulk task import (max 100) |
| `/tasks/blocked` | GET | All blocked tasks |
| `/tasks/active` | GET | All active tasks |
| `/tasks/:id` | GET/PATCH/DELETE | Task CRUD |
| `/dependencies/bulk` | POST | Bulk dependency import |
| `/migration/status` | GET | Migration statistics |
| `/decisions` | GET | CEO decision queue |
| `/decisions/:id/decide` | POST | Submit decision |
| `/agents` | GET | All agents' work status |
| `/throughput` | GET | Throughput metrics |

### Neural Stack API (`/api/neural-stack/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent-health` | GET | Health metrics for all 15 agents |
| `/variance-history/:agentRole` | GET | Variance trend data |
| `/escalations` | GET | Financial escalations |
| `/amendments` | GET | Amendment activity log |
| `/heatmap` | GET | Cross-agent performance matrix |
| `/cos-health` | GET | CoS success rate and alerts |
| `/autonomy-stats` | GET | Autonomous vs escalated counts |

### Team API (`/api/neural-stack/teams/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:teamId` | GET | Team health and activity |
| `/heatmap` | GET | Cross-team performance |
| `/activity-log` | GET | Team lead activity |

---

## Environment Variables

### Dashboard (Railway)
```bash
SUPABASE_URL=https://ixeruhjgahfhqmgftouj.supabase.co
SUPABASE_ANON_KEY=<jwt-token>
SUPABASE_SERVICE_ROLE_KEY=<service-key>
DISABLE_AUTH=true
RAILWAY_DOCKERFILE_PATH=Dockerfile  # Required for Dockerfile builds
```

---

## Recent Commits

```
3953522 feat(orchestration): add dependency migration script
9c67ae3 feat(orchestration): add task migration system for JSON to Supabase
7796ba5 fix(orchestration): use integer priorities and generate task_id
afd993c feat(phase-7): implement Task Orchestration Engine
4bd1b49 feat(database): add Phase 6B Knowledge Bot tables migration
7725ed5 fix(dashboard): update to use monolith_decisions table
11a6fe7 docs: update session context with QA fixes
00971cf fix(dashboard): resolve API 404/500 errors from QA testing
910f13c feat(phase-6g-6h): add Finance and People teams (parallel execution)
43d1837 feat(phase-6): complete Team Deployment series (6A-6F)
```

---

## Next Steps / Potential Work

- [x] ~~Implement batch task creation API~~ (Phase 7.1 - bulk import endpoints)
- [ ] Build Orchestration Dashboard UI in React frontend
- [ ] Implement real-time WebSocket updates for task status
- [ ] Connect live agent system to Task Orchestration Engine
- [ ] Add task dependency visualization (graph view)
- [ ] Add task templates for common workflows
- [ ] CEO decision notification system (Slack/email)
