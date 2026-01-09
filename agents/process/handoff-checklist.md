# Agent-to-Agent Handoff Checklist

## Pre-Handoff (Source Agent)
- [ ] Task > 90% complete
- [ ] Code committed to GitHub
- [ ] Interface specification documented
- [ ] Test results included
- [ ] Known issues listed
- [ ] Next agent tagged in context.md
- [ ] Output artifacts in /agents/[role]/output.md
- [ ] Updated memory.json with next_handoff_to

## Handoff Communication
- [ ] Leave detailed specification in output.md
- [ ] Update source agent context.md with handoff_to
- [ ] Create task in /tasks/in-progress for next agent
- [ ] Notify next agent via task assignment

## Post-Handoff (Receiving Agent)
- [ ] Read source agent's output.md
- [ ] Verify specification matches expectations
- [ ] Check for blockers in source agent context
- [ ] Review test results
- [ ] Plan integration approach
- [ ] Ask clarifying questions (if needed)
- [ ] Mark task as in-progress
- [ ] Update memory.json

## Quality Verification
- [ ] Code follows standards
- [ ] Documentation complete
- [ ] Tests passing
- [ ] No blockers identified
- [ ] Integration plan clear

---
Last Updated: 2026-01-07 15:00 UTC
