# Phase 8: Agent 2 - Backend Developer

## Overview
- **Phase:** 8 - Dashboard UX Enhancement ("The Interface")
- **Agent:** 2
- **Role:** Backend Developer
- **Status:** Not Started
- **Last Updated:** 2026-01-11

## Task Summary
| Status | Count |
|--------|-------|
| Completed | 0 |
| In Progress | 0 |
| Not Started | 6 |
| Blocked | 0 |
| **Total** | **6** |

**Progress: 0%**

---

## Tasks

### 8.3 - API Endpoints for Dashboard

- [ ] **8.3.1** - Create role task counts endpoint
  - File: `src/api/role-task-counts.js`
  - Endpoint: `GET /api/role-task-counts`
  - Notes: Returns pending task count per role for notification badges

- [ ] **8.3.2** - Create active workflows endpoint
  - File: `src/api/workflows-active.js`
  - Endpoint: `GET /api/workflows/active`
  - Notes: Returns list of active workflows with status, owner, progress

- [ ] **8.3.3** - Create completed tasks endpoint
  - File: `src/api/tasks-completed.js`
  - Endpoint: `GET /api/tasks/completed-today`
  - Notes: Returns today's completed tasks with timestamps and role

- [ ] **8.3.4** - Create decision log endpoint
  - File: `src/api/decisions.js`
  - Endpoint: `GET /api/decisions`
  - Notes: Returns decision history with pagination, filtering by role

- [ ] **8.3.5** - Add role filter to existing endpoints
  - Files: `src/api/pending-tasks.js`, `src/api/recent-activity.js`
  - Notes: Add `?role=ceo` query parameter support to filter by role

- [ ] **8.3.6** - Create role hierarchy endpoint
  - File: `src/api/roles.js`
  - Endpoint: `GET /api/roles/hierarchy`
  - Notes: Returns role hierarchy with abbreviations, full names, importance rank

---

## API Response Schemas

### GET /api/role-task-counts
```json
{
  "counts": {
    "ceo": 3,
    "cfo": 5,
    "cto": 2,
    "ciso": 8,
    ...
  },
  "total": 45,
  "updated_at": "2026-01-11T12:00:00Z"
}
```

### GET /api/workflows/active
```json
{
  "workflows": [
    {
      "id": "wf-123",
      "name": "Q1 Budget Review",
      "status": "in_progress",
      "owner_role": "cfo",
      "progress": 65,
      "started_at": "2026-01-10T09:00:00Z"
    }
  ]
}
```

### GET /api/roles/hierarchy
```json
{
  "roles": [
    { "id": "ceo", "abbr": "CEO", "name": "Chief Executive Officer", "tier": 1, "rank": 1 },
    { "id": "cfo", "abbr": "CFO", "name": "Chief Financial Officer", "tier": 1, "rank": 2 },
    ...
  ]
}
```

---

## Notes

- All endpoints should support CORS for dashboard access
- Include proper error handling and status codes
- Add rate limiting for production

---

## Resources

- [Existing API Structure](../../src/api/)
- [Dashboard Stats Endpoint](../../src/api/dashboard-stats.js)
