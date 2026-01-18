# Claude Code Session Context
**Last Updated**: 2026-01-18
**Branch**: main
**Phase**: 11 (Event Log & Memory Complete)
**Last Commit**: f805467 - feat(phase-11): implement Event Log & Memory system

---

## Phase 11: Event Log & Memory (Latest)

### Overview
Phase 11 implements a unified event logging system that connects agent execution to the Phase 10 memory tables, plus creates an Event Log debug page for troubleshooting. Includes an Audit Agent for grading completed tasks and a Memory Compression Service for managing agent context windows.

### New Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `agents/roles/audit/AuditAgent.js` | 478 | Grades completed tasks on accuracy, completeness, quality, efficiency; detects drift; captures learnings |
| `agents/services/MemoryCompressionService.js` | 497 | LLM-based conversation compression; manages agent context windows |
| `dashboard/src/api/eventLogRoutes.js` | 991 | Unified event log API with 6 endpoints |
| `dashboard/src/components/NeuralStack/EventLogPanel.jsx` | 670 | Dashboard component for unified event timeline |

### Modified Files

| File | Changes |
|------|---------|
| `agents/core/TaskOrchestrator.js` | Added audit agent integration, state change logging |
| `agents/orchestration/AgentExecutor.js` | Added conversation saving to memory tables |
| `dashboard/src/components/NeuralStack/index.jsx` | Added EventLogPanel section, updated to v11.0 |
| `dashboard/src/components/NeuralStack/NeuralStack.css` | Added 300+ lines of event log styling |
| `dashboard/src/server.js` | Registered eventLogRoutes |

### Event Log API Endpoints (`/api/event-log/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Unified event stream (tasks, conversations, audits, state changes) |
| `/agent/:role` | GET | Agent-specific events |
| `/task/:taskId` | GET | Task-specific timeline |
| `/memory/:agent` | GET | Agent memory state (conversations, knowledge, compressions) |
| `/compression-status` | GET | Memory compression statistics |
| `/compress/:agent` | POST | Trigger memory compression for an agent |

### Audit Agent Features
- **Grading Criteria** (0-100 scale):
  - Accuracy - Did output address the request?
  - Completeness - Were all aspects covered?
  - Quality - Is output well-structured?
  - Efficiency - Appropriate scope?
- **Drift Detection**: None, Minor, Moderate, Severe
- **Learning Capture**: High-quality outputs (80+ accuracy) sent to MONA for knowledge retention
- **Time Variance Tracking**: Compares estimated vs actual hours

### Memory Compression Service Features
- **Compression Guidelines**: Preserves key decisions, facts, action items
- **Default Settings**: 24-hour threshold, minimum 3 conversations
- **Target Ratio**: 80% reduction (0.2 compression ratio)
- **Daily Compression**: `runDailyCompression()` for all agents
- **Stats Tracking**: Compression ratio, tokens saved, by-agent breakdown

---

## Phase 10: Memory Tables Schema

### Overview
Phase 10 created the database schema for agent memory, conversations, audits, and context graphs. These tables are populated by Phase 11 implementation.

### Database Tables

| Table | Purpose |
|-------|---------|
| `monolith_agent_conversations` | Stores agent conversation history with messages, token counts |
| `monolith_agent_knowledge` | Agent knowledge entries with confidence scores |
| `monolith_memory_compressions` | Compression records with before/after token counts |
| `monolith_task_audits` | Task audit grades (accuracy, completeness, quality, efficiency) |
| `monolith_task_state_log` | Task state change history |
| `monolith_task_artifacts` | Task output artifacts and deliverables |
| `monolith_context_nodes` | Context graph nodes (topics, concepts, agents) |
| `monolith_context_edges` | Context graph relationships |

### Migration File
- `database/migrations/010_context_graph.sql` - Context graph tables
- Memory tables created via Supabase MCP

---

## Phase 9: Context Graph System

### Overview
Phase 9 implements a context graph system for visualizing relationships between agents, tasks, concepts, and knowledge.

### Key Files
- `dashboard/src/api/contextGraphRoutes.js` - Context graph API endpoints
- Database tables: `monolith_context_nodes`, `monolith_context_edges`

### Context Graph API Endpoints (`/api/context/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nodes` | GET | List context graph nodes |
| `/edges` | GET | List context graph edges |
| `/graph` | GET | Full graph with nodes and edges |
| `/agent/:role` | GET | Agent-centric subgraph |

---

## Phase 8: Agent Execution System

### Overview
Phase 8 integrates the AgentExecutor into the orchestration system, enabling real LLM-powered agent execution with token tracking and conversation history.

### Key Changes
- `agents/orchestration/AgentExecutor.js` - Executes tasks via LLM with token tracking
- `/api/orchestration/execute/:agent` - Execute task endpoint
- Token usage tracking per agent and task
- Conversation history saving

### Execution Flow
```
POST /api/orchestration/execute/:agent
  → AgentExecutor.executeTask()
    → LLMRouter.complete()
    → Save conversation to monolith_agent_conversations
    → Return result with token usage
```

---

## Phase 7.1: Task Migration

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
| `/execute/:agent` | POST | Execute task via AgentExecutor (Phase 8) |

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

## Project Structure

```
/home/tinanaman/monolith-system/
├── agents/                          # AI Agent System
│   ├── core/
│   │   ├── TaskOrchestrator.js     # Task routing, execution, audit integration
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
│   │   └── *-team-configs.js       # Team configuration files
│   ├── orchestration/              # Phase 7-8 components
│   │   ├── TaskRouter.js           # Task routing to agents
│   │   ├── ExecutionEngine.js      # Agent execution loop
│   │   ├── AgentExecutor.js        # LLM-powered task execution
│   │   ├── ResolutionSystem.js     # Dependency/decision resolution
│   │   ├── DependencyParser.js     # Parses task dependencies from notes
│   │   ├── migrateJsonTasks.js     # JSON to Supabase migration script
│   │   ├── migrateDependencies.js  # Cross-agent dependency migration
│   │   └── index.js                # Module exports
│   ├── roles/                      # Agent role definitions
│   │   ├── audit/
│   │   │   └── AuditAgent.js       # Phase 11: Task auditing
│   │   └── [other roles]/
│   ├── services/
│   │   └── MemoryCompressionService.js  # Phase 11: Memory compression
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
│   │   │   ├── contextGraphRoutes.js   # Phase 9 Context Graph API
│   │   │   ├── eventLogRoutes.js       # Phase 11 Event Log API
│   │   │   ├── teamRoutes.js           # Team hierarchy API
│   │   │   ├── knowledgeBotRoutes.js   # Knowledge bot API
│   │   │   └── tasksRoutes.js          # Task management API
│   │   ├── components/
│   │   │   ├── NeuralStack/        # Phase 5D-11 dashboard
│   │   │   │   ├── index.jsx       # Main dashboard (v11.0)
│   │   │   │   ├── EventLogPanel.jsx   # Phase 11 event log
│   │   │   │   └── [other widgets]
│   │   │   └── Orchestration/      # Phase 7 dashboard
│   │   └── data/tasks/             # Task JSON files
│   └── package.json
│
├── database/
│   └── migrations/
│       ├── 005_phase5e_full_autonomy.sql
│       ├── 006_phase6a_team_hierarchy.sql
│       ├── 007_phase6b_knowledge_bot_tables.sql
│       ├── 008_phase7_task_orchestration.sql
│       └── 010_context_graph.sql
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

### Event Log API (`/api/event-log/`) - Phase 11
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Unified event stream |
| `/agent/:role` | GET | Agent-specific events |
| `/task/:taskId` | GET | Task timeline |
| `/memory/:agent` | GET | Agent memory state |
| `/compression-status` | GET | Compression statistics |
| `/compress/:agent` | POST | Trigger compression |

### Context Graph API (`/api/context/`) - Phase 9
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nodes` | GET | List context nodes |
| `/edges` | GET | List context edges |
| `/graph` | GET | Full graph |
| `/agent/:role` | GET | Agent subgraph |

### Orchestration API (`/api/orchestration/`) - Phase 7-8
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
| `/execute/:agent` | POST | Execute task via LLM |

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
f805467 feat(phase-11): implement Event Log & Memory system
cc823aa feat(phase-9): add context graph system and fix task-queue endpoint
a08cffa feat(phase-8): integrate AgentExecutor into execute endpoint
94637b9 feat(phase-8): add token tracking and agent execution system
a56efe4 docs: update session context for Phase 7.1 task migration
3953522 feat(orchestration): add dependency migration script
9c67ae3 feat(orchestration): add task migration system for JSON to Supabase
7796ba5 fix(orchestration): use integer priorities and generate task_id
afd993c feat(phase-7): implement Task Orchestration Engine
```

---

## Next Steps / Potential Work

- [x] ~~Implement batch task creation API~~ (Phase 7.1 - bulk import endpoints)
- [x] ~~Integrate AgentExecutor into execution endpoint~~ (Phase 8)
- [x] ~~Add context graph system~~ (Phase 9)
- [x] ~~Create memory tables schema~~ (Phase 10)
- [x] ~~Implement Event Log & Memory system~~ (Phase 11)
- [ ] Build Orchestration Dashboard UI in React frontend
- [ ] Implement real-time WebSocket updates for task status
- [ ] Connect live agent system to Task Orchestration Engine
- [ ] Add task dependency visualization (graph view)
- [ ] Add task templates for common workflows
- [ ] CEO decision notification system (Slack/email)
- [ ] Implement Knowledge Bot auto-research triggers
- [ ] Add memory compression scheduling (cron job)
