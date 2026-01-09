# Monolith Agent System - Bootstrap Activation Sequence

## Overview
This document describes the exact sequence to activate the agent system for Phase 0, Phase 1, and beyond.

## Phase 0: System Initialization (1 hour total)

### Step 1: Chief of Staff Activation (5 min)
```bash
claude-agent activate \
  --role chief-of-staff \
  --context /agents/chief-of-staff/context.md \
  --task-queue /tasks/pending/ \
  --orchestration /agents/chief-of-staff/orchestration.md
```

**Chief of Staff Task**:
> "Review context.md. You are Phase 0 Chief Coordinator. Your task: Read the 3 task queue entries in /tasks/pending/. Activate CTO and VP Operations agents by notifying them their context.md files are ready. Monitor their progress. Report readiness for Phase 1 to the CEO."

**Expected Output**:
- Context loaded
- Task queue reviewed
- CTO and VP Operations activation notification created
- Orchestration.md updated with timestamp

### Step 2: CTO Activation (15 min)
Once Chief of Staff signals readiness, activate CTO:

```bash
claude-agent activate \
  --role cto \
  --context /agents/cto/context.md \
  --task /tasks/pending/phase0-cto-review.json
```

**CTO Task**:
> "You are now active as CTO. Your context.md has been loaded. Your task in /tasks/pending/phase0-cto-review.json: Review monolith architecture. Validate tech stack (React, Supabase, Vercel, SendGrid). Create Phase 1 technical roadmap. Move task to /tasks/in-progress/ when starting. Move to /tasks/completed/ when done. Report 'READY FOR PHASE 1' to Chief of Staff."

**Expected Duration**: 15 minutes
**Deliverable**: Phase 1 technical roadmap in /agents/cto/output.md

### Step 3: VP Operations Activation (15 min)
Activate VP Operations:

```bash
claude-agent activate \
  --role vp-operations \
  --context /agents/vp-operations/context.md \
  --task /tasks/pending/phase0-vp-ops-process.json
```

**VP Operations Task**:
> "You are now active as VP Operations. Your context.md has been loaded. Your task in /tasks/pending/phase0-vp-ops-process.json: Create standup template (using /agents/process/daily-standup.md), review escalation rules, create handoff checklist. Setup task tracking. Move task to /tasks/in-progress/ when starting. Report 'READY FOR PHASE 1' to Chief of Staff."

**Expected Duration**: 15 minutes
**Deliverable**: Process documentation reviewed and confirmed

### Step 4: CFO Activation (10 min)
Activate CFO:

```bash
claude-agent activate \
  --role cfo \
  --context /agents/cfo/context.md \
  --task /tasks/pending/phase0-cfo-audit.json
```

**CFO Task**:
> "You are now active as CFO. Your context.md has been loaded. Your task: Verify all free tier limits (Vercel, Supabase, SendGrid, Google OAuth). Update the status table in /agents/cfo/context.md. Create monitoring thresholds. Report 'RESOURCES CONFIRMED' to Chief of Staff."

**Expected Duration**: 10 minutes
**Deliverable**: Free tier audit completed

### Step 5: Chief of Staff Reports to CEO (5 min)
Once all Chiefs report completion:

**Chief of Staff Report to CEO**:
> "Phase 0 Complete. Ready to activate Phase 1.
> - CTO: READY (Phase 1 technical roadmap created)
> - VP Operations: READY (Process framework established)
> - CFO: READY (Resources confirmed)
> - Next: Activate Frontend, Backend, Database, DevOps agents for Phase 1"

## Phase 1: Foundation Build (2 hours total)
Once CEO approves, activate 4 parallel teams:

### Frontend Agent Activation
```bash
claude-agent activate \
  --role frontend \
  --context /agents/frontend/context.md \
  --phase 1
```

### Backend Agent Activation
```bash
claude-agent activate \
  --role backend \
  --context /agents/backend/context.md \
  --phase 1
```

### Database Agent Activation
```bash
claude-agent activate \
  --role database \
  --context /agents/database/context.md \
  --phase 1
```

### DevOps Agent Activation
```bash
claude-agent activate \
  --role devops \
  --context /agents/devops/context.md \
  --phase 1
```

**All Phase 1 agents work in parallel** with handoff specifications from CTO.

## Monitoring During Phases
- Chief of Staff monitors /tasks/in-progress/ every 15 minutes
- VP Operations updates orchestration.md with progress
- Any blockers escalate to Chief immediately
- Progress visible in /agents/chief-of-staff/orchestration.md

## Success Criteria
- Phase 0: All Chiefs confirm "READY FOR PHASE 1"
- Phase 1: All 4 teams activate and report first task progress
- First integration point: Frontend mock API ready, Backend API spec ready

---
Last Updated: 2026-01-07 15:00 UTC
Version: V1.0
Status: READY FOR ACTIVATION
