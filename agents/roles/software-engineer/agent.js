/**
 * MONOLITH OS - Software Engineer Agent
 * Frontend/Backend development, implementation, and code quality
 *
 * Responsibilities:
 * - Implement features and functionality
 * - Fix bugs and address technical debt
 * - Respond to code audits and reviews
 * - Ensure code quality and best practices
 * - Build responsive, accessible interfaces
 * - Integrate APIs and services
 *
 * Created: 2026-01-15
 * Based on: Cognalith Website Implementation Session
 */

import RoleAgent from '../../core/RoleAgent.js';

const SOFTWARE_ENGINEER_CONFIG = {
  roleId: 'software-engineer',
  roleName: 'Software Engineer',
  roleAbbr: 'SWE',
  tier: 3,

  responsibilities: [
    'Implement frontend and backend features',
    'Fix bugs and resolve technical issues',
    'Respond to code audits and implement fixes',
    'Ensure code quality, accessibility, and SEO',
    'Write clean, maintainable, well-documented code',
    'Build responsive, cross-browser compatible UIs',
    'Integrate APIs, databases, and third-party services',
    'Follow established coding standards and patterns',
  ],

  authorityLimits: {
    maxApprovalAmount: 0, // No spending authority
    canDeployToProduction: false, // Requires DevOps
    canModifyArchitecture: false, // Requires CTO
    canAddDependencies: true, // Within reason
    canRefactor: true, // Within scope
    requiresCTOFor: [
      'architecture changes',
      'new technology adoption',
      'major refactoring',
      'database schema changes',
    ],
    requiresDevOpsFor: [
      'production deployments',
      'infrastructure changes',
      'CI/CD modifications',
    ],
    requiresQAFor: [
      'feature completion sign-off',
      'release readiness',
    ],
  },

  reportsTo: 'cto',
  collaboratesWith: ['devops', 'qa', 'cmo'],

  roleDescription: `You are a Software Engineer, responsible for implementing features and maintaining code quality.

Your core competencies:
1. Frontend Development - React, Next.js, Vue, responsive design, accessibility
2. Backend Development - Node.js, Python, APIs, databases
3. Code Quality - Clean code, testing, documentation
4. Audit Response - SEO, accessibility, performance optimization
5. Integration - APIs, third-party services, databases

Decision Framework:
- Implement features as specified by product/design
- Make code-level decisions within established patterns
- Escalate architecture decisions to CTO
- Escalate deployment needs to DevOps
- Coordinate with QA on testing requirements
- Document significant code changes

Work Principles:
- Write code that is readable and maintainable
- Follow DRY, SOLID, and other best practices
- Prioritize accessibility and SEO
- Test your code before marking complete
- Keep dependencies minimal and up to date
- Security is always a consideration`,

  // Technology proficiencies
  techStack: {
    frontend: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion'],
    backend: ['Node.js', 'Express', 'Python', 'PostgreSQL', 'MongoDB'],
    tools: ['Git', 'npm', 'Webpack', 'ESLint', 'Prettier'],
    testing: ['Jest', 'React Testing Library', 'Cypress', 'Playwright'],
  },
};

class SoftwareEngineerAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...SOFTWARE_ENGINEER_CONFIG, ...config });

    // SWE-specific state
    this.implementations = [];
    this.auditResponses = [];
    this.codeReviews = [];
  }

  /**
   * Implement a feature based on requirements
   */
  async implementFeature(feature) {
    const implPrompt = `Implement this feature following best practices.

## Feature Requirements:
${JSON.stringify(feature, null, 2)}

## Implementation Guidelines:
1. **Planning**
   - Break down into subtasks
   - Identify files to create/modify
   - Consider dependencies

2. **Code Quality**
   - Follow existing patterns in codebase
   - Write clean, readable code
   - Add appropriate comments
   - Handle edge cases and errors

3. **Accessibility**
   - Semantic HTML
   - ARIA labels where needed
   - Keyboard navigation
   - Color contrast compliance

4. **SEO** (if applicable)
   - Meta tags
   - Semantic structure
   - Performance considerations

5. **Testing**
   - What tests are needed?
   - How to verify the feature works?

## Output:
1. Implementation plan with file changes
2. Key code snippets
3. Testing checklist
4. Any escalations needed (CTO/DevOps)`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: implPrompt,
      temperature: 0.4,
    });

    const implementation = {
      id: `IMPL-${Date.now()}`,
      feature,
      plan: response.content,
      status: 'planned',
      createdAt: new Date().toISOString(),
    };

    this.implementations.push(implementation);
    return implementation;
  }

  /**
   * Respond to an audit report with fixes
   */
  async respondToAudit(audit) {
    const auditPrompt = `Analyze this audit report and create a remediation plan.

## Audit Report:
${JSON.stringify(audit, null, 2)}

## Response Process:
1. **Triage Issues**
   - Critical (fix immediately)
   - High (fix this session)
   - Medium (fix this week)
   - Low (backlog)

2. **For Each Issue**
   - Root cause
   - Fix approach
   - Files to modify
   - Estimated effort
   - Dependencies on other fixes

3. **Prioritization**
   - Security issues first
   - User-facing issues second
   - Technical debt third

4. **Validation**
   - How to verify each fix
   - Regression considerations

## Output:
1. Prioritized fix list with effort estimates
2. Implementation order (respecting dependencies)
3. Any items requiring escalation
4. Success criteria for audit re-check`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: auditPrompt,
      temperature: 0.4,
    });

    const auditResponse = {
      id: `AUDIT-${Date.now()}`,
      audit,
      remediation: response.content,
      status: 'planned',
      createdAt: new Date().toISOString(),
    };

    this.auditResponses.push(auditResponse);
    return auditResponse;
  }

  /**
   * Fix a bug or issue
   */
  async fixBug(bug) {
    const bugPrompt = `Diagnose and fix this bug.

## Bug Report:
${JSON.stringify(bug, null, 2)}

## Debugging Process:
1. **Reproduce**
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment/browser info

2. **Diagnose**
   - Likely root cause
   - Related code areas
   - Potential side effects

3. **Fix**
   - Code changes needed
   - Why this fix works
   - Edge cases to handle

4. **Verify**
   - Test the fix
   - Regression testing
   - Browser/device testing

5. **Prevent**
   - What caused this bug?
   - How to prevent similar bugs?
   - Tests to add?

## Output:
1. Root cause analysis
2. Fix implementation
3. Verification steps
4. Prevention recommendations`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: bugPrompt,
      temperature: 0.3,
    });

    return {
      bug,
      diagnosis: response.content,
      fixedAt: new Date().toISOString(),
    };
  }

  /**
   * Review code for quality and best practices
   */
  async reviewCode(code) {
    const reviewPrompt = `Review this code for quality, security, and best practices.

## Code to Review:
${JSON.stringify(code, null, 2)}

## Review Checklist:

### Code Quality
- [ ] Readable and well-organized
- [ ] Follows project conventions
- [ ] DRY (no unnecessary duplication)
- [ ] Functions are focused and small
- [ ] Variables are well-named

### Security
- [ ] No hardcoded secrets
- [ ] Input validation
- [ ] XSS prevention
- [ ] SQL injection prevention
- [ ] CSRF protection

### Performance
- [ ] No obvious bottlenecks
- [ ] Efficient algorithms
- [ ] Proper caching
- [ ] Lazy loading where appropriate

### Accessibility
- [ ] Semantic HTML
- [ ] ARIA labels
- [ ] Keyboard navigation
- [ ] Focus management

### SEO (if applicable)
- [ ] Meta tags
- [ ] Semantic structure
- [ ] Core Web Vitals considerations

## Output:
1. Summary: APPROVED / NEEDS_CHANGES / REJECTED
2. Critical issues (must fix)
3. Suggestions (nice to have)
4. Positive observations`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.4,
    });

    const review = {
      id: `REVIEW-${Date.now()}`,
      code,
      review: response.content,
      reviewedAt: new Date().toISOString(),
    };

    this.codeReviews.push(review);
    return review;
  }

  /**
   * Optimize code for performance, accessibility, or SEO
   */
  async optimizeCode(optimization) {
    const optimizePrompt = `Optimize this code for the specified criteria.

## Optimization Request:
${JSON.stringify(optimization, null, 2)}

## Optimization Areas:

### Performance
- Bundle size reduction
- Render optimization
- Network request optimization
- Caching strategies
- Lazy loading

### Accessibility
- Screen reader compatibility
- Keyboard navigation
- Focus management
- Color contrast
- ARIA implementation

### SEO
- Meta tags optimization
- Structured data
- Core Web Vitals
- Semantic HTML
- Mobile responsiveness

## Output:
1. Current issues identified
2. Specific optimizations with code changes
3. Expected improvement
4. Testing/verification approach`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: optimizePrompt,
      temperature: 0.4,
    });

    return {
      optimization,
      recommendations: response.content,
      optimizedAt: new Date().toISOString(),
    };
  }

  /**
   * Create component or module documentation
   */
  async documentCode(code) {
    const docPrompt = `Create documentation for this code.

## Code to Document:
${JSON.stringify(code, null, 2)}

## Documentation Requirements:

1. **Overview**
   - What does this code do?
   - When should it be used?

2. **API Reference**
   - Props/parameters
   - Return values
   - Events/callbacks

3. **Usage Examples**
   - Basic usage
   - Common patterns
   - Edge cases

4. **Dependencies**
   - Required imports
   - Peer dependencies
   - Environment requirements

5. **Notes**
   - Known limitations
   - Performance considerations
   - Future improvements

## Output:
Complete documentation in markdown format.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: docPrompt,
      temperature: 0.5,
    });

    return {
      code,
      documentation: response.content,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for SWE-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const sweKeywords = [
      'implement', 'build', 'create', 'fix', 'bug', 'feature',
      'frontend', 'backend', 'component', 'api', 'ui', 'ux',
      'responsive', 'accessibility', 'seo', 'audit', 'code',
      'react', 'next', 'typescript', 'css', 'html', 'javascript',
      'form', 'validation', 'animation', 'style', 'layout',
      'refactor', 'optimize', 'test', 'website', 'page', 'screen'
    ];

    if (sweKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default SoftwareEngineerAgent;
export { SOFTWARE_ENGINEER_CONFIG };
