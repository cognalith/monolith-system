/**
 * MONOLITH OS - Email Notifier
 * Sends daily digests and critical alerts to CEO
 * Supports SendGrid and Resend as email providers
 */

class EmailNotifier {
  constructor(config = {}) {
    this.provider = config.provider || 'console'; // 'sendgrid', 'resend', 'console'
    this.fromEmail = config.fromEmail || 'monolith@cognalith.com';
    this.fromName = config.fromName || 'MONOLITH OS';
    this.ceoEmail = config.ceoEmail || process.env.CEO_EMAIL;

    this.sendgridApiKey = config.sendgridApiKey || process.env.SENDGRID_API_KEY;
    this.resendApiKey = config.resendApiKey || process.env.RESEND_API_KEY;

    // Determine provider based on available keys
    if (this.sendgridApiKey) {
      this.provider = 'sendgrid';
    } else if (this.resendApiKey) {
      this.provider = 'resend';
    }

    console.log(`[EMAIL] Email Notifier initialized with provider: ${this.provider}`);
  }

  /**
   * Send daily digest email
   */
  async sendDailyDigest(summary, ceoQueue, agentActivity) {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `MONOLITH Daily Briefing - ${date}`;

    const html = this.buildDailyDigestHTML(summary, ceoQueue, agentActivity, date);
    const text = this.buildDailyDigestText(summary, ceoQueue, agentActivity, date);

    return this.send({
      to: this.ceoEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Send critical alert email
   */
  async sendCriticalAlert(escalation) {
    const subject = `[CRITICAL] MONOLITH: Immediate Decision Required`;

    const html = this.buildCriticalAlertHTML(escalation);
    const text = this.buildCriticalAlertText(escalation);

    return this.send({
      to: this.ceoEmail,
      subject,
      html,
      text,
      priority: 'high',
    });
  }

  /**
   * Build daily digest HTML
   */
  buildDailyDigestHTML(summary, ceoQueue, agentActivity, date) {
    const pendingDecisions = ceoQueue.filter((item) => item.status === 'pending');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; }
    .header { border-bottom: 2px solid #00ff88; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { color: #00ff88; margin: 0; font-size: 24px; }
    .header p { color: #888; margin: 5px 0 0 0; }
    .section { margin-bottom: 25px; }
    .section-title { color: #00ff88; font-size: 14px; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; letter-spacing: 2px; }
    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #222; }
    .stat-label { color: #888; }
    .stat-value { color: #fff; font-weight: bold; }
    .stat-value.green { color: #00ff88; }
    .stat-value.amber { color: #ffaa00; }
    .stat-value.red { color: #ff4444; }
    .decision-item { background: #1a1a1a; border: 1px solid #333; border-left: 4px solid #ffaa00; padding: 15px; margin-bottom: 10px; }
    .decision-item.critical { border-left-color: #ff4444; }
    .decision-title { color: #fff; font-weight: bold; margin-bottom: 8px; }
    .decision-meta { color: #888; font-size: 12px; }
    .decision-actions { margin-top: 10px; }
    .decision-actions a { color: #00ff88; text-decoration: none; margin-right: 15px; }
    .activity-item { padding: 8px 0; border-bottom: 1px solid #222; }
    .activity-role { color: #00ff88; font-weight: bold; }
    .activity-text { color: #ccc; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #333; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MONOLITH DAILY BRIEFING</h1>
      <p>${date}</p>
    </div>

    <div class="section">
      <div class="section-title">EXECUTIVE SUMMARY</div>
      <div class="stat-row">
        <span class="stat-label">Tasks Completed Yesterday</span>
        <span class="stat-value green">${summary.tasksCompleted}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Auto-Resolved (No CEO Input)</span>
        <span class="stat-value green">${summary.tasksAutoResolved}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Awaiting Your Decision</span>
        <span class="stat-value ${pendingDecisions.length > 3 ? 'amber' : 'green'}">${pendingDecisions.length}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Critical Items</span>
        <span class="stat-value ${pendingDecisions.filter((d) => d.priority === 'CRITICAL').length > 0 ? 'red' : 'green'}">${pendingDecisions.filter((d) => d.priority === 'CRITICAL').length}</span>
      </div>
    </div>

    ${pendingDecisions.length > 0 ? `
    <div class="section">
      <div class="section-title">AWAITING YOUR DECISION</div>
      ${pendingDecisions.map((item) => `
        <div class="decision-item ${item.priority === 'CRITICAL' ? 'critical' : ''}">
          <div class="decision-title">[${item.priority || 'MEDIUM'}] ${item.task?.content || item.reason}</div>
          <div class="decision-meta">
            Escalated by: ${item.role?.toUpperCase() || 'Unknown'} |
            ${new Date(item.createdAt).toLocaleString()}
          </div>
          ${item.recommendation ? `<div style="margin-top: 8px; color: #00ff88;">Recommendation: ${item.recommendation}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">AGENT ACTIVITY SUMMARY</div>
      ${Object.entries(summary.byRole || {}).map(([role, data]) => `
        <div class="activity-item">
          <span class="activity-role">${role.toUpperCase()}</span>:
          <span class="activity-text">Completed ${data.completed} tasks${data.escalated > 0 ? `, escalated ${data.escalated}` : ''}</span>
        </div>
      `).join('') || '<div class="activity-item"><span class="activity-text">No agent activity recorded</span></div>'}
    </div>

    <div class="footer">
      <p>This is an automated briefing from MONOLITH OS.</p>
      <p>Reply to this email or access the dashboard to take action.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Build daily digest plain text
   */
  buildDailyDigestText(summary, ceoQueue, agentActivity, date) {
    const pendingDecisions = ceoQueue.filter((item) => item.status === 'pending');

    let text = `MONOLITH DAILY BRIEFING
${date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tasks Completed Yesterday: ${summary.tasksCompleted}
Auto-Resolved (No CEO Input): ${summary.tasksAutoResolved}
Awaiting Your Decision: ${pendingDecisions.length}
Critical Items: ${pendingDecisions.filter((d) => d.priority === 'CRITICAL').length}

`;

    if (pendingDecisions.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWAITING YOUR DECISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
      pendingDecisions.forEach((item, i) => {
        text += `${i + 1}. [${item.priority || 'MEDIUM'}] ${item.task?.content || item.reason}
   Escalated by: ${item.role?.toUpperCase() || 'Unknown'}
   ${item.recommendation ? `Recommendation: ${item.recommendation}` : ''}

`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGENT ACTIVITY SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    Object.entries(summary.byRole || {}).forEach(([role, data]) => {
      text += `${role.toUpperCase()}: Completed ${data.completed} tasks${data.escalated > 0 ? `, escalated ${data.escalated}` : ''}\n`;
    });

    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated briefing from MONOLITH OS.
Reply to this email or access the dashboard to take action.
`;

    return text;
  }

  /**
   * Build critical alert HTML
   */
  buildCriticalAlertHTML(escalation) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    .alert-header { background: #ff4444; color: #fff; padding: 15px; text-align: center; }
    .alert-header h1 { margin: 0; font-size: 18px; }
    .content { background: #1a1a1a; border: 1px solid #ff4444; padding: 20px; }
    .label { color: #888; font-size: 12px; margin-top: 15px; }
    .value { color: #fff; margin-top: 5px; }
    .recommendation { background: #222; border-left: 3px solid #00ff88; padding: 10px; margin-top: 15px; }
    .actions { margin-top: 20px; padding-top: 15px; border-top: 1px solid #333; }
    .action-btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; }
    .approve { background: #00ff88; color: #000; }
    .reject { background: #ff4444; color: #fff; }
    .info { background: #333; color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert-header">
      <h1>⚠️ CRITICAL ESCALATION</h1>
    </div>
    <div class="content">
      <div class="label">ISSUE</div>
      <div class="value">${escalation.task?.content || escalation.reason}</div>

      <div class="label">ESCALATED BY</div>
      <div class="value">${escalation.role?.toUpperCase() || 'Unknown'}</div>

      <div class="label">TIME</div>
      <div class="value">${new Date(escalation.createdAt || Date.now()).toLocaleString()}</div>

      <div class="label">REASON FOR ESCALATION</div>
      <div class="value">${escalation.reason}</div>

      ${escalation.recommendation ? `
      <div class="recommendation">
        <div class="label">RECOMMENDATION</div>
        <div class="value">${escalation.recommendation}</div>
      </div>
      ` : ''}

      <div class="actions">
        <div class="label">REPLY WITH ONE OF:</div>
        <div class="value" style="margin-top: 10px;">
          APPROVE - Accept recommendation<br>
          REJECT - Decline recommendation<br>
          INFO - Request more information
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Build critical alert plain text
   */
  buildCriticalAlertText(escalation) {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  CRITICAL ESCALATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: ${escalation.task?.content || escalation.reason}
Escalated by: ${escalation.role?.toUpperCase() || 'Unknown'}
Time: ${new Date(escalation.createdAt || Date.now()).toLocaleString()}

Reason: ${escalation.reason}

${escalation.recommendation ? `Recommendation: ${escalation.recommendation}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply with: APPROVE, REJECT, or INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  /**
   * Send email using configured provider
   */
  async send({ to, subject, html, text, priority }) {
    switch (this.provider) {
      case 'sendgrid':
        return this.sendWithSendGrid({ to, subject, html, text, priority });
      case 'resend':
        return this.sendWithResend({ to, subject, html, text, priority });
      default:
        return this.sendToConsole({ to, subject, text });
    }
  }

  async sendWithSendGrid({ to, subject, html, text }) {
    try {
      const { default: sgMail } = await import('@sendgrid/mail');
      sgMail.setApiKey(this.sendgridApiKey);

      await sgMail.send({
        to,
        from: { email: this.fromEmail, name: this.fromName },
        subject,
        html,
        text,
      });

      console.log(`[EMAIL] Sent via SendGrid to ${to}: ${subject}`);
      return { success: true, provider: 'sendgrid' };
    } catch (error) {
      console.error('[EMAIL] SendGrid error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendWithResend({ to, subject, html, text }) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(this.resendApiKey);

      await resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject,
        html,
        text,
      });

      console.log(`[EMAIL] Sent via Resend to ${to}: ${subject}`);
      return { success: true, provider: 'resend' };
    } catch (error) {
      console.error('[EMAIL] Resend error:', error.message);
      return { success: false, error: error.message };
    }
  }

  sendToConsole({ to, subject, text }) {
    console.log('\n' + '='.repeat(60));
    console.log('[EMAIL] Console Mode - Would send:');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('-'.repeat(60));
    console.log(text);
    console.log('='.repeat(60) + '\n');

    return { success: true, provider: 'console' };
  }
}

export default EmailNotifier;
