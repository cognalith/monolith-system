# Software Engineer Agent - Session Template

## Overview

This document captures the work pattern from the inaugural Software Engineer session (2026-01-15) which built the Cognalith website from scratch. Use this as a template for future SWE agent sessions.

---

## Session: Cognalith Website Implementation

**Date:** 2026-01-15
**Duration:** Extended session
**Outcome:** Production-ready landing page

### Task Summary

| Phase | Tasks Completed |
|-------|-----------------|
| **Initial Build** | Created Next.js 14 project, 7 sections, custom theme |
| **Design Update** | Implemented PDF-inspired changes (Mantra, Quiet Power, Hub-Spoke) |
| **Audit Response** | Fixed 11 critical/high-priority items from comprehensive audit |

---

## Workflow Pattern

### 1. Requirements Gathering

```
Input: User request + clarifying questions
Output: Clear understanding of deliverables

Questions to ask:
- What type of project? (landing page, app, component)
- Tech stack preferences?
- Design assets available?
- Key features/sections needed?
- CTAs and conversion goals?
```

### 2. Planning & Architecture

```
Input: Requirements
Output: File structure, component breakdown, data models

Artifacts:
- Directory structure plan
- Component hierarchy
- Data/content structure
- Tailwind theme configuration
```

### 3. Implementation

```
Input: Plan
Output: Working code

Order of operations:
1. Project setup (Next.js, dependencies)
2. Theme/styling configuration
3. Layout and navigation
4. Section components (top to bottom)
5. Data population
6. Animations and interactivity
```

### 4. Review Integration

```
Input: External review/audit
Output: Prioritized fixes

Process:
1. Parse audit into actionable items
2. Categorize by severity
3. Create todo list
4. Implement fixes systematically
5. Verify each fix
```

---

## Technical Decisions Made

### Framework Choice
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for animations

### Project Structure
```
/app
  layout.tsx      # Root layout, metadata, schema
  page.tsx        # Main page composition
  globals.css     # Global styles, Tailwind imports
/components
  /ui             # Reusable components (Button, Card, Container)
  /sections       # Page sections (Hero, About, Portfolio, etc.)
  Navbar.tsx      # Navigation component
/lib
  data.ts         # Content data, configurations
/public
  favicon.svg     # Site icon
  og-image.svg    # Social sharing image
  sitemap.xml     # SEO sitemap
  robots.txt      # Crawler instructions
```

### Design System
```css
Colors:
- dark: #0a0a0f (background)
- dark-secondary: #0d0d12
- dark-card: #141419
- accent-cyan: #00d4ff
- accent-purple: #a855f7
- accent-green: #22c55e

Typography:
- Inter (body)
- System fonts (fallback)
```

---

## Audit Response Framework

### Priority Classification

| Priority | Criteria | Response Time |
|----------|----------|---------------|
| **Critical** | Security, legal compliance, broken functionality | Immediate |
| **High** | SEO fundamentals, accessibility barriers, UX blockers | Same session |
| **Medium** | Enhancements, optimizations, nice-to-haves | Scheduled |
| **Low** | Minor improvements, polish | Backlog |

### Common Audit Items

| Category | Example Issues | Typical Fixes |
|----------|----------------|---------------|
| **SEO** | Missing sitemap, robots.txt, meta tags | Create files, update metadata |
| **Accessibility** | Missing aria-labels, skip links | Add attributes, semantic HTML |
| **UX** | Mobile menu issues, dead links | CSS fixes, proper hrefs |
| **Legal** | Missing privacy policy links | Add footer links |
| **Performance** | Large images, no lazy loading | Optimize assets |

---

## Escalation Guidelines

### Escalate to CTO
- Architecture changes (new patterns, major refactoring)
- Technology adoption (new frameworks, libraries)
- Database schema changes
- Security-critical decisions

### Escalate to DevOps
- Production deployments
- Infrastructure changes
- CI/CD pipeline modifications
- Domain/DNS changes

### Escalate to QA
- Feature completion sign-off
- Release readiness
- Test coverage requirements

### Escalate to CMO
- Brand/messaging decisions
- Marketing copy changes
- Conversion optimization strategy

---

## Quality Checklist

### Before Marking Complete

- [ ] All functionality works as specified
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] Accessibility basics (keyboard nav, aria-labels, contrast)
- [ ] SEO fundamentals (meta tags, sitemap, semantic HTML)
- [ ] No console errors
- [ ] Code is clean and documented
- [ ] Git commit with descriptive message

### After External Review

- [ ] All critical items addressed
- [ ] All high-priority items addressed
- [ ] Medium items documented for follow-up
- [ ] Re-verification performed
- [ ] Summary provided to user

---

## Session Artifacts

### This Session Produced

1. **Cognalith Website** (`/cognalith-website/`)
   - Full Next.js landing page
   - 7 sections with animations
   - Custom dark theme
   - SEO and accessibility optimized

2. **Software Engineer Agent** (`/agents/roles/software-engineer/`)
   - Agent definition file
   - Session template (this document)

3. **Audit Response Example**
   - 11 items fixed from comprehensive audit
   - sitemap.xml, robots.txt, og-image.svg created
   - Meta tags, aria-labels, skip links added

---

## Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run linter

# Verification
curl localhost:3001/sitemap.xml    # Check sitemap
curl localhost:3001/robots.txt     # Check robots

# Git
git add .
git commit -m "feat: implement feature X"
git push
```

---

## Notes for Future Sessions

1. **Always read before writing** - Understand existing code before modifying
2. **Use todo lists** - Track progress visually for complex tasks
3. **Verify fixes** - Take screenshots/snapshots after implementing changes
4. **Document decisions** - Explain why, not just what
5. **Escalate appropriately** - Don't exceed authority limits

---

*Template created: 2026-01-15*
*Based on: Cognalith Website Implementation Session*
