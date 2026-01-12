# Claude Code Prompt: Add MONOLITH OS Agent System Guide to NotebookLM

Use this prompt with Claude Code to generate comprehensive content for adding to your Monolith OS NotebookLM notebook.

---

## Prompt

```
I need you to create a comprehensive guide about the MONOLITH OS Autonomous Agent System for my NotebookLM notebook. Please read the ARCHITECTURE.md file in the agents/ directory first to understand the system.

Create content in the following sections that I can add to NotebookLM:

## Section 1: Executive Summary (for NotebookLM source)

Create a 500-word executive summary that covers:
- What MONOLITH OS is and its purpose
- The organizational structure (14+ AI agents)
- Key capabilities (task orchestration, multi-LLM routing, workflows, escalation)
- Business value proposition

## Section 2: Technical Deep Dive (for NotebookLM source)

Create detailed technical documentation covering:

### Agent Architecture
- How RoleAgent base class works
- Task classification and model selection
- Response parsing (ANALYSIS → ACTION → DECISION → HANDOFF → ESCALATE)
- Authority limits and approval thresholds

### Task Orchestration
- TaskOrchestrator queue management
- Priority scoring (CRITICAL=100, HIGH=75, MEDIUM=50, LOW=25)
- Dependency resolution
- Concurrent task limiting

### Multi-LLM Integration
- LLMRouter provider support (Anthropic, OpenAI, Google, Ollama)
- Smart routing logic
- Cost tracking per model
- Fallback mechanisms

### Workflow Engine
- How workflows chain agents together
- The 8 predefined workflows and their purposes
- Context propagation between steps
- Condition evaluation

### Intelligence Hub
- KnowledgeBase for decision storage and learning
- PerformanceTracker metrics
- CostOptimizer budget management
- SmartRouter load balancing

### Production Hardening
- RetryHandler exponential backoff
- RateLimiter token bucket algorithm
- HealthChecker monitoring
- GracefulShutdown cleanup

## Section 3: Agent Reference Guide (for NotebookLM source)

Create a reference guide for all 14 agents:

For each agent include:
- Role name and tier
- Approval limits (if applicable)
- Key responsibilities (bullet points)
- What types of tasks they handle
- When they escalate to CEO
- Example use cases

Agents to cover:
1. Chief of Staff (CoS)
2. Chief Financial Officer (CFO)
3. Chief Technology Officer (CTO)
4. Chief Legal Officer (CLO)
5. Chief Operations Officer (COO)
6. Chief Information Security Officer (CISO)
7. Chief Marketing Officer (CMO)
8. Chief Human Resources Officer (CHRO)
9. Chief Compliance Officer (CCO)
10. Chief Product Officer (CPO)
11. Chief Revenue Officer (CRO)
12. DevOps Specialist
13. Data Engineering Specialist
14. QA Specialist

## Section 4: Workflow Playbook (for NotebookLM source)

Create detailed playbooks for each predefined workflow:

1. **New Feature Development** (CPO → CTO → DevOps → QA → COO)
   - When to use
   - Step-by-step breakdown
   - Expected outputs at each step
   - Escalation scenarios

2. **Vendor Evaluation** (COO → CFO → CISO → CLO)

3. **New Hire Onboarding** (CHRO → CTO → DevOps → CISO)

4. **Product Launch** (CPO → CMO → CRO → CLO → COO)

5. **Security Incident Response** (CISO → CTO → CLO → CMO)

6. **Quarterly Business Review** (CFO → CRO → CMO → CPO → COO → CoS)

7. **Compliance Audit** (CCO → CLO → CISO → CFO → CoS)

8. **Platform Migration** (CTO → DevOps → CISO → Data → QA → COO)

## Section 5: Escalation Matrix (for NotebookLM source)

Create a comprehensive escalation matrix:
- Financial thresholds by role
- Risk keywords that trigger escalation
- Strategic decision criteria
- Role-specific escalation rules
- Priority levels (CRITICAL, HIGH, MEDIUM)

## Section 6: FAQ and Troubleshooting (for NotebookLM source)

Create Q&A content covering:
- How do agents decide which LLM to use?
- What happens when an agent is unavailable?
- How are costs tracked and optimized?
- How does the system learn from past decisions?
- What triggers a CEO escalation?
- How do workflows handle failures?
- How to add a new agent to the system?
- How to create a custom workflow?

## Section 7: API Reference (for NotebookLM source)

Document the main API entry points:
- initializeAgentSystem() configuration options
- TaskOrchestrator methods
- WorkflowEngine methods
- LLMRouter methods
- DecisionLogger query methods

## Output Format

For each section, output the content in a format suitable for copying into NotebookLM as a source document. Use clear headings, bullet points, and tables where appropriate. Each section should be self-contained so it can be added as a separate source if needed.
```

---

## Usage Instructions

1. Open Claude Code in your monolith-system repository
2. Copy and paste the prompt above
3. Claude Code will read the ARCHITECTURE.md and generate comprehensive content
4. Copy each section into NotebookLM as separate sources
5. NotebookLM will then be able to answer questions about the MONOLITH OS agent system

## Tips for NotebookLM

- Add each section as a separate source for better organization
- Use descriptive source names like "MONOLITH OS - Executive Summary", "MONOLITH OS - Agent Reference", etc.
- After adding all sources, ask NotebookLM to generate an "Audio Overview" for a podcast-style summary
- Use NotebookLM's chat to query specific details about agents, workflows, or technical implementation
