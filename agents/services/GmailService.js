/**
 * MONOLITH OS - Gmail Service
 * Manages Gmail operations via Google APIs
 *
 * Features:
 * - OAuth2 authentication with Google
 * - Send emails with attachments
 * - Search and read emails
 * - Label management
 * - Attachment downloads
 */

import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';

const CREDENTIALS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.gmail-credentials');
const TOKEN_PATH = path.join(CREDENTIALS_DIR, 'token.json');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials.json');

// Gmail API scopes required for full functionality
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
];

class GmailService {
  constructor(options = {}) {
    this.credentialsPath = options.credentialsPath || CREDENTIALS_PATH;
    this.tokenPath = options.tokenPath || TOKEN_PATH;
    this.credentialsDir = options.credentialsDir || CREDENTIALS_DIR;
    this.auth = null;
    this.gmail = null;
    this.initialized = false;
    this.userEmail = null;
  }

  /**
   * Initialize the Gmail service and authenticate
   */
  async initialize() {
    try {
      // Ensure credentials directory exists
      await fs.mkdir(this.credentialsDir, { recursive: true });

      // Check for credentials file
      try {
        await fs.access(this.credentialsPath);
      } catch {
        return {
          success: false,
          error: `Credentials file not found at ${this.credentialsPath}. Please download OAuth2 credentials from Google Cloud Console.`,
          instructions: [
            '1. Go to https://console.cloud.google.com/apis/credentials',
            '2. Create OAuth 2.0 Client ID (Desktop application)',
            '3. Download the credentials JSON file',
            `4. Save it as ${this.credentialsPath}`,
          ],
        };
      }

      // Load credentials
      const credentialsContent = await fs.readFile(this.credentialsPath, 'utf-8');
      const credentials = JSON.parse(credentialsContent);
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

      // Create OAuth2 client
      this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      // Try to load existing token
      try {
        const tokenContent = await fs.readFile(this.tokenPath, 'utf-8');
        const token = JSON.parse(tokenContent);
        this.auth.setCredentials(token);

        // Check if token needs refresh
        if (this.auth.isTokenExpiring && this.auth.isTokenExpiring()) {
          const { credentials: newCredentials } = await this.auth.refreshAccessToken();
          await this.saveToken(newCredentials);
        }
      } catch {
        // No valid token, need to authorize
        return {
          success: false,
          error: 'Not authenticated. Authorization required.',
          authUrl: this.getAuthUrl(),
          instructions: [
            '1. Visit the authorization URL below',
            '2. Grant permissions to the application',
            '3. Copy the authorization code',
            '4. Call gmailService.authorize(code) with the code',
          ],
        };
      }

      // Initialize Gmail API client
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      this.initialized = true;

      // Get user email
      try {
        const profile = await this.gmail.users.getProfile({ userId: 'me' });
        this.userEmail = profile.data.emailAddress;
      } catch {
        // Continue without user email
      }

      return { success: true, message: 'Gmail service initialized successfully', email: this.userEmail };
    } catch (error) {
      return {
        success: false,
        error: `Initialization failed: ${error.message}`,
      };
    }
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthUrl() {
    if (!this.auth) {
      return null;
    }
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  /**
   * Complete OAuth2 authorization with code
   */
  async authorize(code) {
    try {
      if (!this.auth) {
        // Try to set up auth client first
        try {
          await fs.access(this.credentialsPath);
          const credentialsContent = await fs.readFile(this.credentialsPath, 'utf-8');
          const credentials = JSON.parse(credentialsContent);
          const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
          this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        } catch (error) {
          return {
            success: false,
            error: `Cannot load credentials: ${error.message}`,
          };
        }
      }

      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      await this.saveToken(tokens);

      // Initialize Gmail API client
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      this.initialized = true;

      // Get user email
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      this.userEmail = profile.data.emailAddress;

      return { success: true, message: 'Authorization successful', email: this.userEmail };
    } catch (error) {
      return {
        success: false,
        error: `Authorization failed: ${error.message}`,
      };
    }
  }

  /**
   * Save token to file
   */
  async saveToken(token) {
    await fs.mkdir(this.credentialsDir, { recursive: true });
    await fs.writeFile(this.tokenPath, JSON.stringify(token, null, 2), 'utf-8');
  }

  /**
   * Ensure service is initialized
   */
  ensureInitialized() {
    if (!this.initialized || !this.gmail) {
      throw new Error('Gmail service not initialized. Call initialize() first.');
    }
  }

  /**
   * Send an email
   * @param {string} to - Recipient email address (can be array)
   * @param {string} subject - Email subject
   * @param {string} body - Email body (can be HTML)
   * @param {Object} options - Optional: { cc, bcc, attachments, isHtml, from, replyTo }
   */
  async sendEmail(to, subject, body, options = {}) {
    try {
      this.ensureInitialized();

      const { cc, bcc, attachments, isHtml = true, from, replyTo } = options;

      // Build email headers
      const boundary = `boundary_${Date.now()}`;
      const headers = [];

      // Get user's email for 'From' field if not specified
      let fromAddress = from || this.userEmail;
      if (!fromAddress) {
        const profile = await this.gmail.users.getProfile({ userId: 'me' });
        fromAddress = profile.data.emailAddress;
        this.userEmail = fromAddress;
      }

      headers.push(`From: ${fromAddress}`);
      headers.push(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
      headers.push(`Subject: ${subject}`);

      if (cc) headers.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
      if (bcc) headers.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
      if (replyTo) headers.push(`Reply-To: ${replyTo}`);

      headers.push('MIME-Version: 1.0');

      let emailContent;

      if (attachments && attachments.length > 0) {
        // Multipart email with attachments
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

        let parts = headers.join('\r\n') + '\r\n\r\n';

        // Add body part
        parts += `--${boundary}\r\n`;
        parts += `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"\r\n\r\n`;
        parts += body + '\r\n\r\n';

        // Add attachments
        for (const attachment of attachments) {
          const { filename, content, mimeType, path: filePath } = attachment;

          let attachmentContent;
          let attachmentMimeType = mimeType || 'application/octet-stream';
          let attachmentFilename = filename;

          if (filePath) {
            // Read from file
            const fileContent = await fs.readFile(filePath);
            attachmentContent = fileContent.toString('base64');
            attachmentFilename = attachmentFilename || path.basename(filePath);
          } else if (content) {
            // Use provided content
            attachmentContent = Buffer.isBuffer(content)
              ? content.toString('base64')
              : Buffer.from(content).toString('base64');
          }

          parts += `--${boundary}\r\n`;
          parts += `Content-Type: ${attachmentMimeType}\r\n`;
          parts += `Content-Disposition: attachment; filename="${attachmentFilename}"\r\n`;
          parts += 'Content-Transfer-Encoding: base64\r\n\r\n';
          parts += attachmentContent + '\r\n\r\n';
        }

        parts += `--${boundary}--`;
        emailContent = parts;
      } else {
        // Simple email without attachments
        headers.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
        emailContent = headers.join('\r\n') + '\r\n\r\n' + body;
      }

      // Encode to base64url
      const encodedEmail = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send email: ${error.message}`,
      };
    }
  }

  /**
   * Search emails using Gmail query syntax
   * @param {string} query - Gmail search query (e.g., "from:user@example.com", "is:unread", "subject:hello")
   * @param {number} maxResults - Maximum number of results (default: 10)
   */
  async searchEmails(query, maxResults = 10) {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = response.data.messages || [];
      const results = [];

      // Fetch details for each message
      for (const msg of messages) {
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });

        const headers = detail.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

        results.push({
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          snippet: detail.data.snippet,
          labelIds: detail.data.labelIds,
        });
      }

      return {
        success: true,
        count: results.length,
        messages: results,
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      return {
        success: false,
        error: `Search failed: ${error.message}`,
      };
    }
  }

  /**
   * Read full email content
   * @param {string} messageId - Gmail message ID
   */
  async readEmail(messageId) {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload.headers;
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

      // Extract body content
      let body = '';
      let htmlBody = '';
      const attachments = [];

      const extractParts = (payload) => {
        if (payload.body && payload.body.data) {
          const content = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          if (payload.mimeType === 'text/plain') {
            body = content;
          } else if (payload.mimeType === 'text/html') {
            htmlBody = content;
          }
        }

        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.filename && part.body.attachmentId) {
              attachments.push({
                id: part.body.attachmentId,
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body.size,
              });
            } else {
              extractParts(part);
            }
          }
        }
      };

      extractParts(message.payload);

      return {
        success: true,
        id: message.id,
        threadId: message.threadId,
        from: getHeader('From'),
        to: getHeader('To'),
        cc: getHeader('Cc'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        body: body || htmlBody,
        htmlBody,
        plainBody: body,
        snippet: message.snippet,
        labelIds: message.labelIds,
        attachments,
        internalDate: new Date(parseInt(message.internalDate)),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read email: ${error.message}`,
        messageId,
      };
    }
  }

  /**
   * List all labels
   */
  async listLabels() {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.labels.list({
        userId: 'me',
      });

      const labels = response.data.labels.map(label => ({
        id: label.id,
        name: label.name,
        type: label.type,
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
      }));

      return {
        success: true,
        count: labels.length,
        labels,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list labels: ${error.message}`,
      };
    }
  }

  /**
   * Create a new label
   * @param {string} name - Label name
   * @param {Object} options - Optional: { backgroundColor, textColor, showInMessageList, showInLabelList }
   */
  async createLabel(name, options = {}) {
    try {
      this.ensureInitialized();

      const labelData = {
        name,
        labelListVisibility: options.showInLabelList !== false ? 'labelShow' : 'labelHide',
        messageListVisibility: options.showInMessageList !== false ? 'show' : 'hide',
      };

      if (options.backgroundColor || options.textColor) {
        labelData.color = {
          backgroundColor: options.backgroundColor || '#ffffff',
          textColor: options.textColor || '#000000',
        };
      }

      const response = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: labelData,
      });

      return {
        success: true,
        label: {
          id: response.data.id,
          name: response.data.name,
          type: response.data.type,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create label: ${error.message}`,
        name,
      };
    }
  }

  /**
   * Modify email labels
   * @param {string} messageId - Gmail message ID
   * @param {string[]} addLabels - Label IDs to add
   * @param {string[]} removeLabels - Label IDs to remove
   */
  async modifyEmail(messageId, addLabels = [], removeLabels = []) {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        },
      });

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to modify email: ${error.message}`,
        messageId,
      };
    }
  }

  /**
   * Download an email attachment
   * @param {string} messageId - Gmail message ID
   * @param {string} attachmentId - Attachment ID
   * @param {string} savePath - Path to save the attachment
   */
  async downloadAttachment(messageId, attachmentId, savePath) {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      });

      const data = response.data.data;
      const buffer = Buffer.from(data, 'base64');

      // Ensure directory exists
      await fs.mkdir(path.dirname(savePath), { recursive: true });

      // Write file
      await fs.writeFile(savePath, buffer);

      return {
        success: true,
        savePath,
        size: buffer.length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to download attachment: ${error.message}`,
        messageId,
        attachmentId,
      };
    }
  }

  /**
   * Mark email as read
   * @param {string} messageId - Gmail message ID
   */
  async markAsRead(messageId) {
    return this.modifyEmail(messageId, [], ['UNREAD']);
  }

  /**
   * Mark email as unread
   * @param {string} messageId - Gmail message ID
   */
  async markAsUnread(messageId) {
    return this.modifyEmail(messageId, ['UNREAD'], []);
  }

  /**
   * Archive an email (remove from INBOX)
   * @param {string} messageId - Gmail message ID
   */
  async archiveEmail(messageId) {
    return this.modifyEmail(messageId, [], ['INBOX']);
  }

  /**
   * Star an email
   * @param {string} messageId - Gmail message ID
   */
  async starEmail(messageId) {
    return this.modifyEmail(messageId, ['STARRED'], []);
  }

  /**
   * Unstar an email
   * @param {string} messageId - Gmail message ID
   */
  async unstarEmail(messageId) {
    return this.modifyEmail(messageId, [], ['STARRED']);
  }

  /**
   * Trash an email
   * @param {string} messageId - Gmail message ID
   */
  async trashEmail(messageId) {
    try {
      this.ensureInitialized();

      await this.gmail.users.messages.trash({
        userId: 'me',
        id: messageId,
      });

      return {
        success: true,
        messageId,
        action: 'trashed',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to trash email: ${error.message}`,
        messageId,
      };
    }
  }

  /**
   * Get user's Gmail profile
   */
  async getProfile() {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.getProfile({
        userId: 'me',
      });

      return {
        success: true,
        emailAddress: response.data.emailAddress,
        messagesTotal: response.data.messagesTotal,
        threadsTotal: response.data.threadsTotal,
        historyId: response.data.historyId,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get profile: ${error.message}`,
      };
    }
  }

  /**
   * Reply to an email
   * @param {string} messageId - Original message ID to reply to
   * @param {string} body - Reply body
   * @param {Object} options - Optional: { cc, bcc, attachments, isHtml }
   */
  async replyToEmail(messageId, body, options = {}) {
    try {
      this.ensureInitialized();

      // Get original message for headers
      const original = await this.readEmail(messageId);
      if (!original.success) {
        return original;
      }

      // Build reply subject
      const subject = original.subject.startsWith('Re:')
        ? original.subject
        : `Re: ${original.subject}`;

      // Extract reply-to address
      const to = original.from;

      // Send as reply (include threadId and References header)
      const { cc, bcc, attachments, isHtml = true } = options;

      const headers = [];

      const fromAddress = this.userEmail || (await this.gmail.users.getProfile({ userId: 'me' })).data.emailAddress;
      headers.push(`From: ${fromAddress}`);
      headers.push(`To: ${to}`);
      headers.push(`Subject: ${subject}`);
      headers.push(`In-Reply-To: ${messageId}`);
      headers.push(`References: ${messageId}`);

      if (cc) headers.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
      if (bcc) headers.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);

      headers.push('MIME-Version: 1.0');
      headers.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);

      const emailContent = headers.join('\r\n') + '\r\n\r\n' + body;

      const encodedEmail = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
          threadId: original.threadId,
        },
      });

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
        inReplyTo: messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to reply to email: ${error.message}`,
        messageId,
      };
    }
  }

  /**
   * Get unread email count
   */
  async getUnreadCount() {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.labels.get({
        userId: 'me',
        id: 'INBOX',
      });

      return {
        success: true,
        unreadCount: response.data.messagesUnread,
        totalCount: response.data.messagesTotal,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get unread count: ${error.message}`,
      };
    }
  }

  /**
   * Get thread (conversation) by ID
   * @param {string} threadId - Gmail thread ID
   */
  async getThread(threadId) {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const thread = response.data;
      const messages = [];

      for (const msg of thread.messages) {
        const headers = msg.payload.headers;
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

        messages.push({
          id: msg.id,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          snippet: msg.snippet,
          labelIds: msg.labelIds,
        });
      }

      return {
        success: true,
        threadId: thread.id,
        historyId: thread.historyId,
        messageCount: messages.length,
        messages,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get thread: ${error.message}`,
        threadId,
      };
    }
  }

  /**
   * Send bulk emails (same content to multiple recipients individually)
   * @param {string[]} recipients - List of email addresses
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Object} options - Additional options
   */
  async sendBulkEmail(recipients, subject, body, options = {}) {
    const results = [];

    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, body, options);
      results.push({ recipient, ...result });
    }

    return {
      success: results.every(r => r.success),
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * Watch for new emails (set up push notifications)
   * @param {string} topicName - Google Cloud Pub/Sub topic name
   * @param {string[]} labelIds - Labels to watch (default: ['INBOX'])
   */
  async watchInbox(topicName, labelIds = ['INBOX']) {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds,
        },
      });

      return {
        success: true,
        historyId: response.data.historyId,
        expiration: response.data.expiration,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set up watch: ${error.message}`,
      };
    }
  }

  /**
   * Stop watching for new emails
   */
  async stopWatch() {
    try {
      this.ensureInitialized();

      await this.gmail.users.stop({
        userId: 'me',
      });

      return {
        success: true,
        message: 'Watch stopped',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stop watch: ${error.message}`,
      };
    }
  }

  /**
   * Create a draft email
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Object} options - Optional: { cc, bcc, isHtml }
   */
  async createDraft(to, subject, body, options = {}) {
    try {
      this.ensureInitialized();

      const { cc, bcc, isHtml = true } = options;
      const headers = [];

      const fromAddress = this.userEmail || (await this.gmail.users.getProfile({ userId: 'me' })).data.emailAddress;
      headers.push(`From: ${fromAddress}`);
      headers.push(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
      headers.push(`Subject: ${subject}`);

      if (cc) headers.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
      if (bcc) headers.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);

      headers.push('MIME-Version: 1.0');
      headers.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);

      const emailContent = headers.join('\r\n') + '\r\n\r\n' + body;

      const encodedEmail = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedEmail,
          },
        },
      });

      return {
        success: true,
        draftId: response.data.id,
        messageId: response.data.message.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create draft: ${error.message}`,
      };
    }
  }

  /**
   * Delete a label
   * @param {string} labelId - Label ID to delete
   */
  async deleteLabel(labelId) {
    try {
      this.ensureInitialized();

      await this.gmail.users.labels.delete({
        userId: 'me',
        id: labelId,
      });

      return {
        success: true,
        labelId,
        action: 'deleted',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete label: ${error.message}`,
        labelId,
      };
    }
  }

  /**
   * Get label by ID
   * @param {string} labelId - Label ID
   */
  async getLabel(labelId) {
    try {
      this.ensureInitialized();

      const response = await this.gmail.users.labels.get({
        userId: 'me',
        id: labelId,
      });

      return {
        success: true,
        label: {
          id: response.data.id,
          name: response.data.name,
          type: response.data.type,
          messagesTotal: response.data.messagesTotal,
          messagesUnread: response.data.messagesUnread,
          threadsTotal: response.data.threadsTotal,
          threadsUnread: response.data.threadsUnread,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get label: ${error.message}`,
        labelId,
      };
    }
  }
}

// Singleton instance
const gmailService = new GmailService();

export default gmailService;
export { GmailService, SCOPES };
