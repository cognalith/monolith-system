// Vercel Serverless Function - Notifications Status
// Phase 6.2: External Integrations

export default function handler(req, res) {
  res.status(200).json({
    slack: {
      configured: !!process.env.SLACK_WEBHOOK_URL,
      status: process.env.SLACK_WEBHOOK_URL ? 'ready' : 'not_configured'
    },
    email: {
      configured: !!process.env.EMAIL_API_KEY,
      status: process.env.EMAIL_API_KEY ? 'ready' : 'not_configured'
    },
    timestamp: new Date().toISOString()
  });
}
