/**
 * CEO Department Module
 * Chief Executive Officer - Strategic Leadership & Direction
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const CEO_SYSTEM_PROMPT = `You are the Chief Executive Officer (CEO) of a Fortune 500 company. Your role is to provide strategic direction and executive-level decision guidance.

Key responsibilities:
- Strategic vision and company direction
- Market opportunities and competitive positioning
- Major M&A and partnership decisions
- Organizational structure and key appointments
- Shareholder value and investor relations
- Board communications and governance
- Cross-functional strategic initiatives
- Risk management at the enterprise level

Decision Authority:
- Any decision over $50 million requires board approval
- Decisions $5M-$50M require CFO review
- Decisions under $5M are executive approval

You base your guidance on "The Monolith System: Complete Operations & Workflow Guide" V2.0, which contains 64 enterprise workflows covering all major business processes.

When responding:
1. State the strategic considerations
2. Reference relevant workflows from the Master Guide
3. Identify cross-functional impacts
4. Recommend necessary approvals/reviews
5. Suggest metrics to track success`;

/**
 * Query the CEO for strategic guidance
 */
export async function queryCEO(question, options = {}) {
    try {
          const message = await client.messages.create({
                  model: "claude-3-5-sonnet-20241022",
                  max_tokens: 1024,
                  system: CEO_SYSTEM_PROMPT,
                  messages: [
                    {
                                role: "user",
                                content: question,
                    },
                          ],
          });

      const response = message.content[0].text;

      if (options.json) {
              return {
                        department: "CEO",
                        title: "Chief Executive Officer",
                        question: question,
                        response: response,
                        metadata: {
                                    model: "claude-3-5-sonnet-20241022",
                                    usage: {
                                                  input_tokens: message.usage.input_tokens,
                                                  output_tokens: message.usage.output_tokens,
                                    },
                        },
              };
      }

      return response;
    } catch (error) {
          throw new Error(`CEO query failed: ${error.message}`);
    }
}

/**
 * CEO analysis of M&A opportunity
 */
export async function analyzeMAndA(
    targetName,
    valuation,
    strategicFit,
    options = {}
  ) {
    const question = `
        Provide strategic analysis for M&A evaluation:

                Target Company: ${targetName}
                    Valuation: $${valuation.toLocaleString()}
                        Strategic Fit: ${strategicFit}

                                Consider: Market positioning, synergies, risks, integration complexity, and board approval likelihood.
                                  `;

  return queryCEO(question, options);
}

/**
 * Strategic decision support
 */
export async function getStrategicGuidance(topic, context, options = {}) {
    const question = `
        Provide executive-level strategic guidance:

                Topic: ${topic}
                    Context: ${context}

                            Include: Key considerations, recommended actions, required approvals, and success metrics.
                              `;

  return queryCEO(question, options);
}

export default {
    queryCEO,
    analyzeMAndA,
    getStrategicGuidance,
};
