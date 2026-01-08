#!/bin/bash

# Create orchestration.md for Chief of Staff
cat > agents/chief-of-staff/orchestration.md << 'EOF'
# Monolith Agent Orchestration Master File

## System Status
- Status: BOOTSTRAP PHASE 0
- Activated Agents: 1 (Chief of Staff)
- Current Phase: 0 - System Initialization
- Last Updated: 2026-01-07 14:45 UTC

## Active Agents Dashboard
| Agent | Phase | Status | Progress | Next Handoff |
|-------|-------|--------|----------|--------------|
| Chief of Staff | 0 | ACTIVE | 25% | CTO, VP Ops |
| CTO | 0 | PENDING | 0% | - |
| VP Operations | 0 | PENDING | 0% | All teams |
| CFO | 0 | PENDING | 0% | - |
| Frontend | 1 | PENDING | 0% | - |
| Backend | 1 | PENDING | 0% | - |

## Blocked Dependencies
None

## Critical Path to Phase 1
1. CTO reviews architecture (15 min)
2. VP Ops sets process (15 min)
3. Activate Phase 1 teams (5 min)
4. Frontend builds mocks + Dashboard (2 hours)
5. Backend implements APIs (2 hours)
6. First integration (30 min)

## Key Decisions Log
- 2026-01-07 14:45 UTC: Bootstrap Phase 0 infrastructure created
EOF

# Create memory.json for each agent
AGENTS=("chief-of-staff" "cto" "vp-operations" "cfo" "frontend" "backend" "database" "authentication" "devops" "qa" "email" "analytics" "security" "documentation" "integration" "data")

for agent in "${AGENTS[@]}"; do
  cat > agents/$agent/memory.json << EOF
{
  "agent_id": "$agent",
  "role": "$agent",
  "session_id": "session-bootstrap-001",
  "started_at": "2026-01-07T14:45:00Z",
  "active_tasks": [],
  "completed_tasks": [],
  "blocked_tasks": [],
  "dependencies": [],
  "next_handoff_to": "",
  "questions_for_chief": [],
  "artifacts_created": [],
  "last_updated": "2026-01-07T14:45:00Z"
}
EOF
done

# Create .gitkeep files so empty directories are tracked
touch agents/chief-of-staff/.gitkeep
touch tasks/pending/.gitkeep
touch tasks/in-progress/.gitkeep
touch tasks/completed/.gitkeep

echo "✅ Agent infrastructure created successfully!"
echo "📁 Directory structure:"
echo "  /agents/ - 16 agent roles"
echo "  /tasks/ - Task queue system"
echo "  /agents/process/ - Shared process documentation"
echo ""
echo "🚀 Next step: Create context.md files for each agent role"
