# MONOLITH OS - Autonomous Agent System Architecture

## Overview

MONOLITH OS is a sophisticated multi-agent autonomous system designed to automate business operations through AI-powered role-based agents. The system simulates a complete organizational hierarchy with 14+ specialized agents that can collaborate, escalate decisions, and execute complex workflows.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│          Dashboard / External System                     │
│          (Task Input, CEO Decisions)                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   TaskOrchestrator    │
        │ (Queue, Schedule,     │
        │  Assign, Prioritize)  │
        └─────────┬─────────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │   CoS    │ │ C-Suite  │ │Specialists│
  │  (Tier 2)│ │(Tier 1)  │ │ (Tier 3) │
  └─────┬────┘ └────┬─────┘ └────┬─────┘
        │           │            │
        └───────────┼────────────┘
                    ▼
            ┌──────────────────┐
            │   LLMRouter      │
            │ (Model Selection)│
            └────────┬─────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌────────┐  ┌──────────┐  ┌────────┐
   │Anthropic│  │  OpenAI  │  │ Google │
   │(Claude) │  │ (GPT-4o) │  │(Gemini)│
   └────────┘  └──────────┘  └────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────────┐  ┌────────────────────┐
│ DecisionLogger    │  │ Intelligence Hub   │
│ (Audit Trail)     │  │ - KnowledgeBase    │
└───────────────────┘  │ - CostOptimizer    │
                       │ - SmartRouter      │
                       └────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │  Escalation Engine   │
                    │ (CEO Queue Logic)    │
                    └──────────────────────┘
```

## Development Phases

The system was built in 6 phases:

| Phase | Component | Description |
|-------|-----------|-------------|
| 1 | Chief of Staff | Foundation agent - CEO advisor and coordinator |
| 2 | Core C-Suite | CFO, CTO, CLO, COO - Primary leadership |
| 3 | Extended Leadership | CISO, CMO, CHRO, CCO, CPO, CRO |
| 4 | Specialists & Workflows | DevOps, Data Engineering, QA + Workflow Engine |
| 5 | Intelligence | Knowledge Base, Performance Tracking, Cost Optimization |
| 6 | Production Hardening | Retry, Rate Limiting, Health Checks, Graceful Shutdown |

## Core Components

### 1. RoleAgent (`/core/RoleAgent.js`)

Base class for all 14+ role-specific agents. Handles:
- Task classification (document_draft, analysis, strategic_decision, code_review, summarization, general)
- Model selection based on task type
- Response parsing into structured outputs: ANALYSIS → ACTION → DECISION → HANDOFF → ESCALATE
- Authority checking (approval limits per role)
- Event emission (handoff, escalate, error)

**Agent Attributes:**
```javascript
{
  roleId: 'cfo',
  roleName: 'Chief Financial Officer',
  tier: 1,
  responsibilities: ['Budget management', 'Financial analysis', ...],
  authorityLimits: { maxApproval: 25000 },
  reportsTo: 'ceo',
  directReports: ['finance-team'],
  systemPrompt: '...'
}
```

### 2. TaskOrchestrator (`/core/TaskOrchestrator.js`)

Central coordination engine:
- Agent registration and lifecycle management
- Priority-based task queue (CRITICAL=100, HIGH=75, MEDIUM=50, LOW=25)
- Task dependency resolution (blockedBy chains)
- Concurrent task limiting (default: 5)
- Processing loop (5-second tick interval)

### 3. LLMRouter (`/core/LLMRouter.js`)

Multi-provider LLM integration:

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | Claude Opus 4, Sonnet 4, Haiku | Strategic decisions, analysis, documents |
| OpenAI | GPT-4o, GPT-4o-mini | Structured output, JSON tasks |
| Google | Gemini 1.5 Pro | Long-context documents (>100k tokens) |
| Ollama | Llama 3 | Privacy-sensitive, local processing |

**Smart Routing Logic:**
1. Privacy/compliance data → Local Ollama
2. Very long context → Gemini 1.5 Pro
3. Task type → Default model candidates
4. Availability → Fallback to next provider

### 4. DecisionLogger (`/core/DecisionLogger.js`)

Persistent audit trail with 3 backends:
- **Supabase** - Cloud database
- **File** - JSONL format (`./logs/decisions.jsonl`)
- **Memory** - In-process storage

Logs: decision ID, task ID, role, analysis, actions, model used, tokens, latency

### 5. EscalationEngine (`/core/EscalationEngine.js`)

Determines when tasks need CEO decision:

**Triggers:**
- Explicit markers: "CEO approval", "requires CEO", "executive decision"
- Financial thresholds: Single expense >$10k, Contract >$50k
- Risk keywords: Legal liability, compliance violation, security incident
- Strategic keywords: Strategic direction, M&A, new market, product pivot
- Role-specific rules (CFO: major investment, CTO: architecture change, etc.)

## Agent Hierarchy

### Tier 1: C-Suite Leadership

| Agent | Approval Limit | Key Responsibilities |
|-------|---------------|---------------------|
| CFO | $25,000 | Budget, vendor approval, financial analysis |
| CTO | $15,000 | Architecture, tech stack, technical debt |
| CLO | - | Legal drafting, compliance, contracts |
| COO | - | Operations, execution, workflow optimization |

### Tier 2: Extended Leadership

| Agent | Focus Area |
|-------|------------|
| CISO | Security assessment, incident response |
| CMO | Marketing strategy, campaigns, brand |
| CHRO | HR, recruiting, compensation |
| CCO | Compliance audits, regulatory |
| CPO | Product roadmap, features |
| CRO | Revenue strategy, sales |

### Tier 3: Specialists

| Agent | Approval Limit | Focus Area |
|-------|---------------|------------|
| DevOps | $5,000 | CI/CD, infrastructure, deployment |
| Data Engineering | - | Data pipelines, analytics |
| QA | - | Test planning, automation |

### Tier 2 (Leadership Support)

| Agent | Approval Limit | Focus Area |
|-------|---------------|------------|
| Chief of Staff | $5,000 | CEO advisor, cross-functional coordination |

## Workflow System

### WorkflowEngine (`/workflows/WorkflowEngine.js`)

Chains agents together in defined sequences with:
- Sequential step execution
- Condition checking (previousStepSuccess, previousStepFailed, custom)
- Template variable substitution (`{{variable}}`)
- Context propagation between steps
- Escalation handling (stops workflow if triggered)

### Predefined Workflows

| Workflow | Agent Chain |
|----------|-------------|
| New Feature Development | CPO → CTO → DevOps → QA → COO |
| Vendor Evaluation | COO → CFO → CISO → CLO |
| New Hire Onboarding | CHRO → CTO → DevOps → CISO |
| Product Launch | CPO → CMO → CRO → CLO → COO |
| Security Incident | CISO → CTO → CLO → CMO |
| Quarterly Business Review | CFO → CRO → CMO → CPO → COO → CoS |
| Compliance Audit | CCO → CLO → CISO → CFO → CoS |
| Platform Migration | CTO → DevOps → CISO → Data → QA → COO |

## Intelligence Hub (Phase 5)

### KnowledgeBase
- Stores agent decisions with outcomes
- Enables learning from past decisions
- Context retrieval for similar tasks

### PerformanceTracker
- Task completion metrics per agent
- Success rates, escalation rates
- Response time tracking
- LLM usage by model/role

### CostOptimizer
- Smart model selection based on task complexity
- Budget tracking (daily: $100, monthly: $2000 defaults)
- Response caching (LRU, 1-hour TTL)

### SmartRouter
- Dynamic load balancing
- Performance-based routing

## Production Hardening (Phase 6)

| Component | Purpose |
|-----------|---------|
| RetryHandler | Exponential backoff retry logic |
| RateLimiter | Token bucket rate limiting |
| HealthChecker | Periodic system health checks |
| GracefulShutdown | Ordered cleanup with timeout |
| ConfigManager | Environment-based configuration |

## Agent Communication

### 1. Handoff Events
When an agent can't complete a task, it emits a `handoff` event:
```javascript
{
  fromRole: 'cfo',
  toRole: 'cto',
  task: { ... },
  context: { ... },
  deliverables: { ... }
}
```

### 2. Escalation Events
Critical decisions escalate to CEO queue:
```javascript
{
  task: { ... },
  reason: 'Exceeds approval limit',
  recommendation: 'APPROVE with conditions',
  priority: 'CRITICAL'
}
```

### 3. Task Dependencies
Tasks can specify blockers:
```javascript
{
  id: 'task-2',
  blockedBy: ['task-1']
}
```

## Technology Stack

```
Language: JavaScript (ES Modules)
Runtime: Node.js

Dependencies:
├── @anthropic-ai/sdk: ^0.71.2
├── openai: ^6.16.0
├── @google/generative-ai: ^0.24.1
├── @supabase/supabase-js: ^2.90.1
├── @sendgrid/mail: ^8.1.6
├── resend: ^6.7.0
└── dotenv: ^17.2.3
```

## Usage

### Initialize the System

```javascript
import { initializeAgentSystem } from './agents/index.js';

const system = await initializeAgentSystem({
  llm: {},
  logging: { mode: 'memory' },
  orchestrator: {},
  escalation: {},
  email: { provider: 'sendgrid' },
  knowledge: {},
  performance: {},
  cost: { dailyBudget: 100, monthlyBudget: 2000 },
  enableProduction: true
});
```

### CLI Commands

```bash
# System Commands
node agents/demo.js demo           # Demo run
node agents/demo.js start          # Start processing tasks
node agents/demo.js status         # Show status
node agents/demo.js digest         # Generate daily digest

# Agent Testing
node agents/demo.js test-cos       # Test Chief of Staff
node agents/demo.js test-cfo       # Test CFO
node agents/demo.js test-all       # Test all agents

# Workflows
node agents/demo.js workflows      # List workflows
node agents/demo.js run-workflow new-feature

# Intelligence
node agents/demo.js intelligence   # Dashboard
node agents/demo.js health         # Health report
node agents/demo.js costs          # Cost summary
```

## Example: Finance Approval Flow

```
1. Task arrives: "Review $8,500 laptop expense"
   └── assigned_role: "cfo", priority: "MEDIUM"

2. TaskOrchestrator queues with priority score: 50

3. CFOAgent processes:
   └── Classifies as "analysis"
   └── Selects claude-sonnet-4
   └── Calls LLMRouter

4. LLMRouter routes to Anthropic API

5. CFOAgent parses response:
   └── Extracts ANALYSIS, ACTION, DECISION
   └── Checks authority: $8,500 < $25,000 ✓
   └── Decision: APPROVE

6. DecisionLogger records audit trail

7. PerformanceTracker updates metrics

8. Task complete (no escalation needed)
```

## Example: Security Incident Workflow

```
1. Incident triggers "security-incident" workflow

2. Step 1: CISO Assessment
   └── Containment actions, severity classification

3. Step 2: CTO Remediation
   └── Technical fix implementation plan

4. Step 3: CLO Legal Assessment
   └── Regulatory impact analysis
   └── ESCALATION TRIGGERED → CEO queue

5. Step 4: CMO Communication
   └── Customer notification plan

6. Workflow Status: "escalated"
   └── CEO receives critical alert
```

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SENDGRID_API_KEY=SG...
RESEND_API_KEY=re_...
OLLAMA_ENDPOINT=http://localhost:11434
```

## File Structure

```
agents/
├── index.js                 # Main entry point
├── demo.js                  # CLI demo
├── package.json             # Dependencies
├── core/
│   ├── RoleAgent.js         # Base agent class
│   ├── TaskOrchestrator.js  # Task coordination
│   ├── LLMRouter.js         # Multi-LLM routing
│   ├── DecisionLogger.js    # Audit trail
│   └── EscalationEngine.js  # CEO escalation
├── workflows/
│   ├── WorkflowEngine.js    # Workflow orchestration
│   └── definitions.js       # Predefined workflows
├── intelligence/
│   ├── index.js             # Intelligence hub
│   ├── KnowledgeBase.js     # Decision storage
│   ├── PerformanceTracker.js
│   ├── CostOptimizer.js
│   └── SmartRouter.js
├── production/
│   ├── index.js             # Production wrapper
│   ├── RetryHandler.js
│   ├── RateLimiter.js
│   ├── HealthChecker.js
│   ├── GracefulShutdown.js
│   └── ConfigManager.js
├── notifications/
│   └── email/
│       └── EmailNotifier.js
└── roles/
    ├── cos/agent.js         # Chief of Staff
    ├── cfo/agent.js         # CFO
    ├── cto/agent.js         # CTO
    ├── clo/agent.js         # CLO
    ├── coo/agent.js         # COO
    ├── ciso/agent.js        # CISO
    ├── cmo/agent.js         # CMO
    ├── chro/agent.js        # CHRO
    ├── cco/agent.js         # CCO
    ├── cpo/agent.js         # CPO
    ├── cro/agent.js         # CRO
    ├── devops/agent.js      # DevOps
    ├── data/agent.js        # Data Engineering
    └── qa/agent.js          # QA
```
