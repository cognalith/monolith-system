# Chief of Staff - Workflow Orchestrator

**Role**: Chief of Staff - Executive Coordinator for CEO Workflows
**Decision Authority**: Manages workflow routing and task assignment (no autonomous decisions)
**Updated**: January 7, 2026, 5:50 AM | Revision: 1.0

## Purpose
The Chief of Staff serves as the orchestrator for all CEO-initiated workflows. When the CEO approves a workflow:

1. **Receive CEO Instruction**: Read CEO's approved workflow direction from `context/workflow-active.md`
2. 2. **Parse Requirements**: Extract required departments and decision criteria
   3. 3. **Create Task Queue**: Generate individual task assignments in `tasks/pending/` directory
      4. 4. **Route to Departments**: Assign tasks in priority order to each functional role
         5. 5. **Coordinate Execution**: Track task completion and aggregate responses
            6. 6. **Synthesize Results**: Compile department recommendations into unified CEO briefing
              
               7. ## Shared Context Files
               8. All functional roles share access to:
               9. - `context/workflow-active.md` - Current CEO workflow and parameters
                  - - `context/company-state.json` - Real-time company metrics and status
                    - - `context/decision-criteria.json` - Active approval thresholds and rules
                      - - `tasks/pending/` - Unstarted tasks for departments
                        - - `tasks/in-progress/` - Currently executing department analyses
                          - - `tasks/completed/` - Finished tasks with results
                           
                            - ## Department Task Creation Logic
                           
                            - When CEO initiates workflow:
                           
                            - ### FOR: M&A Analysis Workflow
                            - ```
                              Task 1: CFO → "Analyze acquisition target financials"
                              Task 2: CTO → "Assess technology stack and integration risk"
                              Task 3: CISO → "Evaluate security and compliance posture"
                              Task 4: CHRO → "Assess talent and cultural alignment"
                              Task 5: General Counsel → "Legal due diligence review"
                              ```

                              Output: Each department responds with [Status, Recommendation, Financial Impact]

                              ### FOR: Strategic Initiative Workflow
                              ```
                              Task 1: Chief Strategy Officer → "Market viability analysis"
                              Task 2: VP Product → "Product feasibility and roadmap impact"
                              Task 3: VP Sales → "Market adoption and sales strategy"
                              Task 4: CFO → "Financial projections and ROI"
                              Task 5: CTO → "Technical implementation requirements"
                              ```

                              ## Task Completion Logging

                              Each completed task logs to `tasks/completed/TIMESTAMP-DEPARTMENT-WORKFLOW.json`:

                              ```json
                              {
                                "taskId": "TASK-001-CFO-M&A-20260107-0550",
                                "workflow": "M&A Analysis",
                                "department": "CFO",
                                "status": "COMPLETED",
                                "executionTime": "2026-01-07T05:52:33Z",
                                "duration_seconds": 120,
                                "response": {
                                  "status": "READY",
                                  "recommendation": "Proceed - Strong financial fundamentals, acceptable valuation",
                                  "financialImpact": {
                                    "estimatedRevenueSynergy": "$45M annually",
                                    "costSynergy": "$12M annually",
                                    "integrationCost": "$8M",
                                    "netYearOneImpact": "$(15M)",
                                    "threeyearNPV": "$180M"
                                  },
                                  "concerns": ["Integration complexity", "Debt level post-acquisition"],
                                  "conditions": ["Board approval required", "Financing secured"]
                                },
                                "metadata": {
                                  "contextUsed": ["context/company-state.json", "context/target-data.json"],
                                  "departmentVersion": "CEO-Dashboard-v1.0",
                                  "systemVersion": "Monolith-Phase2-v1.0"
                                }
                              }
                              ```

                              ## Chief of Staff Responsibilities

                              1. **Workflow Parsing**: Extract step-by-step instructions from CEO direction
                              2. 2. **Dependency Mapping**: Identify which departments depend on others' results
                              3. **Parallel Execution**: Launch independent tasks simultaneously
                              4. 4. **Sequential Execution**: Wait for prerequisite tasks before launching dependent ones
                                 5. 5. **Status Updates**: Maintain `tasks/status-summary.json` for CEO Dashboard
                                    6. 6. **Result Aggregation**: Compile final briefing with all department inputs
                                       7. 7. **Decision Support**: Prepare final recommendation for CEO approval
                                         
                                          8. ## Dashboard Output Format
                                         
                                          9. CEO Dashboard receives live updates from `tasks/status-summary.json`:
                                         
                                          10. ```json
                                              {
                                                "workflowId": "WF-M&A-001-20260107",
                                                "workflowName": "M&A Analysis - TechCorp Acquisition",
                                                "status": "IN_PROGRESS",
                                                "completionPercentage": 40,
                                                "totalTasks": 5,
                                                "completedTasks": 2,
                                                  "taskStatus": [
                                                  {
                                                    "department": "CFO",
                                                    "task": "Financial Analysis",
                                                    "status": "COMPLETED",
                                                    "recommendation": "Proceed - Strong financial fundamentals",
                                                    "financialImpact": "$180M three-year NPV"
                                                  },
                                                  {
                                                    "department": "CTO",
                                                    "task": "Technology Assessment",
                                                    "status": "IN_PROGRESS",
                                                    "eta": "5 minutes"
                                                  }
                                                ],
                                                "criticalRisks": ["Integration complexity", "Key person retention"],
                                                "overallRecommendation": "PENDING - Awaiting final department reviews",
                                                "targetDecisionPoint": "Complete within 2 hours from workflow start"
                                              }
                                              ```

                                              ## System Architecture Notes

                                              - **No Message Queue**: Direct file-based task assignment and completion
                                              - - **Atomic Operations**: Each department reads its task file atomically
                                                - - **Timestamp-Based Ordering**: Tasks ordered by creation timestamp
                                                  - - **Idempotent Execution**: Tasks can be safely re-executed
                                                    - - **Audit Trail**: All task completion logged with execution metadata
                                                      - - **Real-Time Updates**: Status files continuously monitored by CEO Dashboard
                                                       
                                                        - ## Integration with Claude Code
                                                       
                                                        - When running in Claude Code:
                                                        - 1. CEO issues instruction to Chief of Staff function
                                                          2. 2. Function reads workflow parameters from context files
                                                             3. 3. Creates task files for each department in `tasks/pending/`
                                                                4. 4. Monitors `tasks/completed/` for department responses
                                                                   5. 5. Updates `tasks/status-summary.json` in real-time
                                                                      6. 6. Returns aggregated briefing to CEO Dashboard
                                                                        
                                                                         7. Each functional role module reads its task from `tasks/pending/`, executes analysis using shared context files, and writes results to `tasks/completed/` with standardized JSON format.
