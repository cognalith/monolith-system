/**
 * MONOLITH OS - Chief Legal Officer / General Counsel Agent
 * Legal matters, contracts, compliance, and risk management
 *
 * Responsibilities:
 * - Contract drafting and review
 * - Legal compliance oversight
 * - Risk assessment and mitigation
 * - Intellectual property protection
 * - Regulatory guidance
 */

import RoleAgent from '../../core/RoleAgent.js';

const CLO_CONFIG = {
  roleId: 'clo',
  roleName: 'General Counsel',
  roleAbbr: 'CLO',
  tier: 2,

  responsibilities: [
    'Draft and review contracts and agreements',
    'Ensure legal and regulatory compliance',
    'Protect intellectual property rights',
    'Manage legal risks and liabilities',
    'Advise on corporate governance',
    'Handle legal disputes and negotiations',
    'Maintain corporate legal documentation',
  ],

  authorityLimits: {
    canDraftContracts: true,
    canReviewContracts: true,
    canApproveContracts: false, // All contracts need CEO signature
    canFileRegulatory: false, // Needs CEO approval
    requiresCEOFor: ['contract signature', 'legal settlement', 'regulatory filing'],
  },

  reportsTo: 'ceo',
  directReports: [],

  roleDescription: `You are the General Counsel (CLO), the chief legal advisor.

Your core competencies:
1. Contract Law - Draft, review, and negotiate contracts
2. Compliance - Ensure regulatory compliance
3. Risk Management - Identify and mitigate legal risks
4. IP Protection - Trademarks, patents, copyrights
5. Corporate Governance - Board matters, corporate structure

Decision Framework:
- Draft all contracts but escalate for CEO signature
- Flag any legal risks immediately
- Always consider jurisdiction-specific requirements
- Document legal advice and rationale
- Coordinate with CCO on compliance matters
- Escalate any litigation or regulatory issues

IMPORTANT: Never provide final legal advice that could create liability.
Always recommend external counsel for complex matters.`,
};

class CLOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CLO_CONFIG, ...config });

    // CLO-specific state
    this.contracts = [];
    this.legalRisks = [];
    this.complianceChecklist = [];
  }

  /**
   * Draft a legal document
   */
  async draftDocument(request) {
    const draftPrompt = `Draft the following legal document.

## Document Request:
${JSON.stringify(request, null, 2)}

## Important Guidelines:
1. Use clear, unambiguous language
2. Include all standard protective clauses
3. Consider jurisdiction (default: Alberta, Canada)
4. Flag areas that need specific customization
5. Include placeholders for party-specific details
6. Add comments for sections requiring CEO review

## Document Types and Key Provisions:
- Terms of Service: Liability limits, dispute resolution, user obligations
- Privacy Policy: Data collection, use, sharing, PIPEDA/GDPR compliance
- NDA: Confidentiality scope, duration, exceptions
- Service Agreement: Scope, payment, termination, SLA
- Employment: At-will, IP assignment, non-compete (if enforceable)

Provide a complete draft with [PLACEHOLDER] markers for customization.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: draftPrompt,
      temperature: 0.4, // Lower temp for legal precision
    });

    return {
      draft: response.content,
      request,
      draftedAt: new Date().toISOString(),
      status: 'draft',
      requiresCEOReview: true,
    };
  }

  /**
   * Review a contract
   */
  async reviewContract(contract) {
    const reviewPrompt = `Review this contract and identify issues.

## Contract to Review:
${JSON.stringify(contract, null, 2)}

## Review Checklist:
1. **Parties** - Correctly identified? Authority to sign?
2. **Scope** - Clear and complete?
3. **Payment Terms** - Clear, reasonable, enforceable?
4. **Liability** - Are we adequately protected?
5. **Termination** - Exit provisions clear?
6. **IP Rights** - Ownership clear? License terms?
7. **Confidentiality** - Adequate protection?
8. **Dispute Resolution** - Jurisdiction, arbitration?
9. **Compliance** - Any regulatory issues?
10. **Red Flags** - Unusual or concerning clauses?

## Output Format:
1. SUMMARY: Overall assessment
2. RISKS: List of identified risks (High/Medium/Low)
3. CHANGES REQUIRED: Must-have modifications
4. SUGGESTIONS: Nice-to-have improvements
5. RECOMMENDATION: APPROVE, NEGOTIATE, or REJECT`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.4,
    });

    return {
      review: response.content,
      contract,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Assess legal risk
   */
  async assessRisk(situation) {
    const riskPrompt = `Assess the legal risk of this situation.

## Situation:
${JSON.stringify(situation, null, 2)}

## Risk Assessment Framework:
1. **Risk Category**: Contract, Regulatory, IP, Employment, Liability, etc.
2. **Likelihood**: Probability of issue materializing (1-5)
3. **Impact**: Severity if issue occurs (1-5)
4. **Risk Score**: Likelihood × Impact
5. **Mitigations**: Actions to reduce risk
6. **Residual Risk**: Risk level after mitigations

## Output:
1. Risk summary
2. Detailed risk analysis
3. Recommended mitigations
4. Whether external counsel is needed
5. Escalation recommendation`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: riskPrompt,
      temperature: 0.4,
    });

    const risk = {
      assessment: response.content,
      situation,
      assessedAt: new Date().toISOString(),
    };

    this.legalRisks.push(risk);
    return risk;
  }

  /**
   * Check compliance requirements
   */
  async checkCompliance(area) {
    const compliancePrompt = `Check compliance requirements for this area.

## Area to Review:
${JSON.stringify(area, null, 2)}

## Jurisdictions to Consider:
- Alberta, Canada (primary)
- Canada (federal)
- International (if applicable: GDPR, etc.)

## Common Compliance Areas:
- Privacy: PIPEDA, PIPA (Alberta), GDPR
- Employment: ESA, human rights, safety
- Corporate: Business registration, reporting
- Industry-specific: Depends on sector
- Tax: GST, corporate tax, payroll

## Output:
1. Applicable regulations
2. Current compliance status (if known)
3. Required actions
4. Deadlines
5. Ongoing obligations`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: compliancePrompt,
      temperature: 0.4,
    });

    return {
      compliance: response.content,
      area,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Draft Terms of Service
   */
  async draftTermsOfService(product) {
    const tosPrompt = `Draft Terms of Service for this product.

## Product Details:
${JSON.stringify(product, null, 2)}

## Required Sections:
1. Acceptance of Terms
2. Description of Service
3. User Accounts and Registration
4. User Responsibilities
5. Prohibited Uses
6. Intellectual Property
7. User Content
8. Privacy (reference Privacy Policy)
9. Disclaimers and Limitations
10. Indemnification
11. Termination
12. Dispute Resolution
13. Governing Law (Alberta, Canada)
14. Changes to Terms
15. Contact Information

Make it readable but legally sound. Use plain language where possible.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: tosPrompt,
      temperature: 0.4,
    });

    return {
      tos: response.content,
      product,
      draftedAt: new Date().toISOString(),
      requiresCEOApproval: true,
    };
  }

  /**
   * Draft Privacy Policy
   */
  async draftPrivacyPolicy(product) {
    const privacyPrompt = `Draft a Privacy Policy for this product.

## Product Details:
${JSON.stringify(product, null, 2)}

## Required Sections (PIPEDA + GDPR compliant):
1. Introduction and Scope
2. Information We Collect
   - Directly provided
   - Automatically collected
   - Third-party sources
3. How We Use Information
4. Legal Basis for Processing (GDPR)
5. Information Sharing
6. Data Retention
7. Your Rights (access, correction, deletion)
8. Cookies and Tracking
9. Security Measures
10. Children's Privacy
11. International Transfers
12. Changes to Policy
13. Contact Information
14. Complaints Process

Ensure compliance with both Canadian (PIPEDA/PIPA) and EU (GDPR) requirements.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: privacyPrompt,
      temperature: 0.4,
    });

    return {
      privacyPolicy: response.content,
      product,
      draftedAt: new Date().toISOString(),
      requiresCEOApproval: true,
    };
  }

  /**
   * Override canHandle for CLO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const cloKeywords = [
      'legal', 'contract', 'agreement', 'terms', 'policy',
      'compliance', 'regulation', 'privacy', 'liability',
      'intellectual property', 'trademark', 'patent', 'copyright',
      'dispute', 'lawsuit', 'nda', 'confidential'
    ];

    if (cloKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CLOAgent;
export { CLO_CONFIG };
