/**
 * Website Review Script
 * Uses Monolith agents (CEO, CMO, CTO) to review the Cognalith website
 * for alignment with company vision and marketing effectiveness
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic();

// Read the website content
const websiteDir = '/home/tinanaman/monolith-system/cognalith-website';

function readWebsiteContent() {
  const files = {
    'Hero Section': fs.readFileSync(path.join(websiteDir, 'components/sections/Hero.tsx'), 'utf-8'),
    'About Section': fs.readFileSync(path.join(websiteDir, 'components/sections/About.tsx'), 'utf-8'),
    'Monolith System Section': fs.readFileSync(path.join(websiteDir, 'components/sections/MonolithSystem.tsx'), 'utf-8'),
    'Portfolio Section': fs.readFileSync(path.join(websiteDir, 'components/sections/Portfolio.tsx'), 'utf-8'),
    'How It Works': fs.readFileSync(path.join(websiteDir, 'components/sections/HowItWorks.tsx'), 'utf-8'),
    'Contact Section': fs.readFileSync(path.join(websiteDir, 'components/sections/Contact.tsx'), 'utf-8'),
    'Data/Content': fs.readFileSync(path.join(websiteDir, 'lib/data.ts'), 'utf-8'),
  };
  return files;
}

// CEO Review - Strategic Alignment
async function ceoReview(websiteContent) {
  console.log('\n' + '='.repeat(60));
  console.log('🏢 CEO AGENT REVIEW - Strategic Alignment');
  console.log('='.repeat(60) + '\n');

  const systemPrompt = `You are the Chief Executive Officer of Cognalith, a software development company powered by the Monolith System.

The Monolith System is an AI-powered organizational framework with:
- 15 specialized AI agent roles (CEO, CFO, CTO, COO, CLO, CISO, CMO, CHRO, CCO, CPO, CRO, Chief of Staff, DevOps, Data Engineering, QA)
- Multi-LLM intelligence (Claude, GPT-4, Gemini, Ollama)
- 16+ enterprise workflows
- Enterprise-grade compliance and audit trails
- MCP tool integrations (Gmail, Playwright, Google Drive)

Our Vision: To productize AI-powered software development and demonstrate the power of autonomous AI operations.

Your role is to evaluate whether the website aligns with our strategic vision.`;

  const userPrompt = `Review the Cognalith website content below and provide a strategic assessment.

## Website Content:
${Object.entries(websiteContent).map(([section, content]) => `
### ${section}
\`\`\`tsx
${content.substring(0, 2000)}...
\`\`\`
`).join('\n')}

## Provide CEO Strategic Review:

1. **VISION ALIGNMENT** (Score 1-10)
   - Does the website accurately represent our mission?
   - Is the Monolith System properly showcased?
   - Are we differentiating ourselves in the market?

2. **MESSAGING EFFECTIVENESS**
   - Is the value proposition clear?
   - Will visitors understand what we offer?
   - Is the "powered by AI" narrative compelling?

3. **PORTFOLIO PRESENTATION**
   - Do the projects showcase our capabilities?
   - Is there enough variety to demonstrate range?

4. **STRATEGIC CONCERNS**
   - Any messaging that could be misinterpreted?
   - Missing elements that should be included?
   - Competitive positioning issues?

5. **CEO RECOMMENDATION**
   - Overall assessment
   - Priority changes needed
   - Approval status: APPROVED / APPROVED WITH CHANGES / NEEDS REVISION

Be thorough but concise. Focus on strategic fit, not design details.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  });

  console.log(response.content[0].text);
  return response.content[0].text;
}

// CMO Review - Marketing Effectiveness
async function cmoReview(websiteContent) {
  console.log('\n' + '='.repeat(60));
  console.log('📢 CMO AGENT REVIEW - Marketing Effectiveness');
  console.log('='.repeat(60) + '\n');

  const systemPrompt = `You are the Chief Marketing Officer of Cognalith.

Your expertise includes:
- Marketing strategy and brand positioning
- Content marketing and messaging
- User acquisition and conversion optimization
- Competitive analysis
- Digital marketing best practices

You are responsible for ensuring the website effectively communicates our value proposition and converts visitors into leads.`;

  const userPrompt = `Review the Cognalith website from a marketing perspective.

## Website Content:
${Object.entries(websiteContent).map(([section, content]) => `
### ${section}
\`\`\`tsx
${content.substring(0, 2000)}...
\`\`\`
`).join('\n')}

## Provide CMO Marketing Review:

1. **BRAND POSITIONING** (Score 1-10)
   - Is the brand identity clear and differentiated?
   - Does the visual language match our positioning?
   - Is the tone appropriate for our target audience?

2. **CONVERSION OPTIMIZATION**
   - Are CTAs clear and compelling?
   - Is the user journey logical?
   - Are there enough conversion opportunities?

3. **CONTENT QUALITY**
   - Is copy engaging and scannable?
   - Are benefits clearly communicated?
   - Is technical content accessible?

4. **COMPETITIVE DIFFERENTIATION**
   - How do we stand out from other dev agencies?
   - Is the AI-powered angle compelling?
   - What's our unique selling proposition?

5. **RECOMMENDATIONS**
   - Top 3 improvements for conversion
   - Missing content or sections
   - SEO considerations

6. **CMO VERDICT**
   - Marketing effectiveness score (1-10)
   - Ready for launch? YES / WITH CHANGES / NO

Focus on marketing effectiveness, not technical implementation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  });

  console.log(response.content[0].text);
  return response.content[0].text;
}

// CTO Review - Technical Accuracy
async function ctoReview(websiteContent) {
  console.log('\n' + '='.repeat(60));
  console.log('💻 CTO AGENT REVIEW - Technical Accuracy');
  console.log('='.repeat(60) + '\n');

  const systemPrompt = `You are the Chief Technology Officer of Cognalith.

You have deep knowledge of the Monolith System architecture:
- 15 AI agent roles with specific authority limits
- Multi-LLM routing (Claude, GPT-4, Gemini, Ollama)
- TaskOrchestrator for workflow management
- Decision logging and audit trails
- MCP integrations (Gmail, Playwright, Google Drive)
- React dashboard with real-time task management

Your role is to ensure technical claims on the website are accurate and not overselling our capabilities.`;

  const userPrompt = `Review the technical claims on the Cognalith website.

## Website Content (Data/Features):
\`\`\`typescript
${websiteContent['Data/Content']}
\`\`\`

## Monolith System Section:
\`\`\`tsx
${websiteContent['Monolith System Section']}
\`\`\`

## Provide CTO Technical Review:

1. **ACCURACY CHECK**
   - Are agent role counts correct? (15 agents)
   - Are workflow counts accurate? (16+ workflows)
   - Are LLM provider claims correct?
   - Are MCP tool integrations accurately described?

2. **TECHNICAL CLAIMS AUDIT**
   - Any exaggerated capabilities?
   - Missing important features?
   - Misleading technical descriptions?

3. **COMPETITIVE TECHNICAL POSITIONING**
   - Are we accurately representing our tech stack?
   - Is the multi-LLM claim substantiated?
   - Enterprise-grade claims justified?

4. **CTO RECOMMENDATIONS**
   - Technical corrections needed
   - Features to highlight more
   - Technical credibility concerns

5. **CTO VERDICT**
   - Technical accuracy score (1-10)
   - Approved for technical claims? YES / NEEDS CORRECTIONS

Be precise about technical accuracy.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  });

  console.log(response.content[0].text);
  return response.content[0].text;
}

// Main execution
async function main() {
  console.log('\n' + '🔷'.repeat(30));
  console.log('  MONOLITH SYSTEM - WEBSITE REVIEW');
  console.log('  Cognalith Landing Page Assessment');
  console.log('🔷'.repeat(30) + '\n');

  try {
    const websiteContent = readWebsiteContent();
    console.log('✅ Website content loaded\n');

    // Run all three reviews
    await ceoReview(websiteContent);
    await cmoReview(websiteContent);
    await ctoReview(websiteContent);

    console.log('\n' + '='.repeat(60));
    console.log('✅ REVIEW COMPLETE');
    console.log('='.repeat(60));
    console.log('\nAll C-suite agents have reviewed the website.');
    console.log('Please review the recommendations above.\n');

  } catch (error) {
    console.error('❌ Error during review:', error.message);
    process.exit(1);
  }
}

main();
