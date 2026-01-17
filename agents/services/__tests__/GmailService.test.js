/**
 * Unit tests for GmailService
 * Tests Gmail API operations with mocked Google APIs
 */

import { jest } from '@jest/globals';

// Mock googleapis
const mockGmail = {
  users: {
    getProfile: jest.fn(),
    messages: {
      list: jest.fn(),
      get: jest.fn(),
      send: jest.fn(),
      modify: jest.fn(),
      trash: jest.fn(),
      attachments: {
        get: jest.fn()
      }
    },
    labels: {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    threads: {
      get: jest.fn()
    },
    drafts: {
      create: jest.fn()
    },
    watch: jest.fn(),
    stop: jest.fn()
  }
};

const mockAuth = {
  generateAuthUrl: jest.fn().mockReturnValue('https://auth.url'),
  setCredentials: jest.fn(),
  getToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  isTokenExpiring: jest.fn()
};

jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => mockAuth)
    },
    gmail: jest.fn().mockReturnValue(mockGmail)
  }
}));

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined)
  },
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined)
}));

const fs = (await import('fs/promises')).default;
const { GmailService, SCOPES } = await import('../GmailService.js');

describe('GmailService', () => {
  let service;

  beforeEach(() => {
    service = new GmailService({
      credentialsPath: '/test/credentials.json',
      tokenPath: '/test/token.json',
      credentialsDir: '/test'
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with custom paths', () => {
      expect(service.credentialsPath).toBe('/test/credentials.json');
      expect(service.tokenPath).toBe('/test/token.json');
      expect(service.credentialsDir).toBe('/test');
    });

    it('should initialize with default state', () => {
      expect(service.auth).toBeNull();
      expect(service.gmail).toBeNull();
      expect(service.initialized).toBe(false);
      expect(service.userEmail).toBeNull();
    });

    it('should use default paths when not provided', () => {
      const defaultService = new GmailService();
      expect(defaultService.credentialsPath).toContain('credentials.json');
      expect(defaultService.tokenPath).toContain('token.json');
    });
  });

  describe('SCOPES export', () => {
    it('should export Gmail API scopes', () => {
      expect(SCOPES).toBeDefined();
      expect(Array.isArray(SCOPES)).toBe(true);
    });

    it('should include readonly scope', () => {
      expect(SCOPES).toContain('https://www.googleapis.com/auth/gmail.readonly');
    });

    it('should include send scope', () => {
      expect(SCOPES).toContain('https://www.googleapis.com/auth/gmail.send');
    });

    it('should include modify scope', () => {
      expect(SCOPES).toContain('https://www.googleapis.com/auth/gmail.modify');
    });

    it('should include labels scope', () => {
      expect(SCOPES).toContain('https://www.googleapis.com/auth/gmail.labels');
    });
  });

  describe('ensureInitialized', () => {
    it('should throw error when not initialized', () => {
      expect(() => service.ensureInitialized()).toThrow('Gmail service not initialized');
    });

    it('should not throw when initialized', () => {
      service.initialized = true;
      service.gmail = mockGmail;
      expect(() => service.ensureInitialized()).not.toThrow();
    });
  });

  describe('getAuthUrl', () => {
    it('should return null when auth not set up', () => {
      expect(service.getAuthUrl()).toBeNull();
    });

    it('should return auth URL when auth is configured', () => {
      service.auth = mockAuth;
      const url = service.getAuthUrl();
      expect(mockAuth.generateAuthUrl).toHaveBeenCalled();
      expect(url).toBe('https://auth.url');
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      service.userEmail = 'test@example.com';
      mockGmail.users.messages.send.mockResolvedValue({
        data: {
          id: 'msg-123',
          threadId: 'thread-123',
          labelIds: ['SENT']
        }
      });
    });

    it('should throw when not initialized', async () => {
      service.initialized = false;
      await expect(service.sendEmail('to@example.com', 'Subject', 'Body'))
        .rejects.toThrow('Gmail service not initialized');
    });

    it('should send email successfully', async () => {
      const result = await service.sendEmail('to@example.com', 'Subject', 'Body');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockGmail.users.messages.send).toHaveBeenCalled();
    });

    it('should return thread ID on success', async () => {
      const result = await service.sendEmail('to@example.com', 'Subject', 'Body');

      expect(result.threadId).toBe('thread-123');
    });

    it('should handle array of recipients', async () => {
      const result = await service.sendEmail(
        ['to1@example.com', 'to2@example.com'],
        'Subject',
        'Body'
      );

      expect(result.success).toBe(true);
    });

    it('should handle CC recipients', async () => {
      const result = await service.sendEmail(
        'to@example.com',
        'Subject',
        'Body',
        { cc: 'cc@example.com' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle BCC recipients', async () => {
      const result = await service.sendEmail(
        'to@example.com',
        'Subject',
        'Body',
        { bcc: 'bcc@example.com' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle plain text emails', async () => {
      const result = await service.sendEmail(
        'to@example.com',
        'Subject',
        'Body',
        { isHtml: false }
      );

      expect(result.success).toBe(true);
    });

    it('should return error on API failure', async () => {
      mockGmail.users.messages.send.mockRejectedValue(new Error('API Error'));

      const result = await service.sendEmail('to@example.com', 'Subject', 'Body');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send email');
    });
  });

  describe('searchEmails', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.list.mockResolvedValue({
        data: {
          messages: [
            { id: 'msg-1', threadId: 'thread-1' },
            { id: 'msg-2', threadId: 'thread-2' }
          ]
        }
      });
      mockGmail.users.messages.get.mockResolvedValue({
        data: {
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Subject', value: 'Test Subject' },
              { name: 'Date', value: 'Mon, 1 Jan 2025 00:00:00 GMT' }
            ]
          },
          snippet: 'Email preview...',
          labelIds: ['INBOX']
        }
      });
    });

    it('should search emails successfully', async () => {
      const result = await service.searchEmails('from:test@example.com');

      expect(result.success).toBe(true);
      expect(result.messages).toBeDefined();
      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: 'from:test@example.com',
        maxResults: 10
      });
    });

    it('should respect maxResults parameter', async () => {
      await service.searchEmails('is:unread', 5);

      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: 'is:unread',
        maxResults: 5
      });
    });

    it('should return message details', async () => {
      const result = await service.searchEmails('test');

      expect(result.messages[0].from).toBe('sender@example.com');
      expect(result.messages[0].subject).toBe('Test Subject');
    });

    it('should return count of results', async () => {
      const result = await service.searchEmails('test');

      expect(result.count).toBe(2);
    });

    it('should handle empty results', async () => {
      mockGmail.users.messages.list.mockResolvedValue({ data: {} });

      const result = await service.searchEmails('nonexistent');

      expect(result.success).toBe(true);
      expect(result.messages).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should return error on API failure', async () => {
      mockGmail.users.messages.list.mockRejectedValue(new Error('Search failed'));

      const result = await service.searchEmails('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
    });
  });

  describe('readEmail', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.get.mockResolvedValue({
        data: {
          id: 'msg-123',
          threadId: 'thread-123',
          snippet: 'Preview text',
          labelIds: ['INBOX'],
          internalDate: '1704067200000',
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Subject', value: 'Test Subject' },
              { name: 'Date', value: 'Mon, 1 Jan 2025 00:00:00 GMT' }
            ],
            body: {
              data: Buffer.from('Email body content').toString('base64')
            },
            mimeType: 'text/plain'
          }
        }
      });
    });

    it('should read email successfully', async () => {
      const result = await service.readEmail('msg-123');

      expect(result.success).toBe(true);
      expect(result.id).toBe('msg-123');
      expect(mockGmail.users.messages.get).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-123',
        format: 'full'
      });
    });

    it('should return email metadata', async () => {
      const result = await service.readEmail('msg-123');

      expect(result.from).toBe('sender@example.com');
      expect(result.to).toBe('recipient@example.com');
      expect(result.subject).toBe('Test Subject');
      expect(result.threadId).toBe('thread-123');
    });

    it('should return error on API failure', async () => {
      mockGmail.users.messages.get.mockRejectedValue(new Error('Not found'));

      const result = await service.readEmail('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read email');
    });
  });

  describe('modifyEmail', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.modify.mockResolvedValue({
        data: {
          id: 'msg-123',
          threadId: 'thread-123',
          labelIds: ['INBOX', 'STARRED']
        }
      });
    });

    it('should add labels successfully', async () => {
      const result = await service.modifyEmail('msg-123', ['STARRED'], []);

      expect(result.success).toBe(true);
      expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-123',
        requestBody: {
          addLabelIds: ['STARRED'],
          removeLabelIds: []
        }
      });
    });

    it('should remove labels successfully', async () => {
      const result = await service.modifyEmail('msg-123', [], ['UNREAD']);

      expect(result.success).toBe(true);
    });

    it('should return updated label IDs', async () => {
      const result = await service.modifyEmail('msg-123', ['STARRED'], []);

      expect(result.labelIds).toEqual(['INBOX', 'STARRED']);
    });
  });

  describe('markAsRead', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.modify.mockResolvedValue({
        data: { id: 'msg-123', labelIds: ['INBOX'] }
      });
    });

    it('should remove UNREAD label', async () => {
      await service.markAsRead('msg-123');

      expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-123',
        requestBody: {
          addLabelIds: [],
          removeLabelIds: ['UNREAD']
        }
      });
    });
  });

  describe('markAsUnread', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.modify.mockResolvedValue({
        data: { id: 'msg-123', labelIds: ['INBOX', 'UNREAD'] }
      });
    });

    it('should add UNREAD label', async () => {
      await service.markAsUnread('msg-123');

      expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-123',
        requestBody: {
          addLabelIds: ['UNREAD'],
          removeLabelIds: []
        }
      });
    });
  });

  describe('archiveEmail', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.modify.mockResolvedValue({
        data: { id: 'msg-123', labelIds: [] }
      });
    });

    it('should remove INBOX label', async () => {
      await service.archiveEmail('msg-123');

      expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-123',
        requestBody: {
          addLabelIds: [],
          removeLabelIds: ['INBOX']
        }
      });
    });
  });

  describe('starEmail', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.modify.mockResolvedValue({
        data: { id: 'msg-123', labelIds: ['STARRED'] }
      });
    });

    it('should add STARRED label', async () => {
      await service.starEmail('msg-123');

      expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-123',
        requestBody: {
          addLabelIds: ['STARRED'],
          removeLabelIds: []
        }
      });
    });
  });

  describe('trashEmail', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.messages.trash.mockResolvedValue({ data: {} });
    });

    it('should trash email successfully', async () => {
      const result = await service.trashEmail('msg-123');

      expect(result.success).toBe(true);
      expect(result.action).toBe('trashed');
      expect(mockGmail.users.messages.trash).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-123'
      });
    });

    it('should return error on failure', async () => {
      mockGmail.users.messages.trash.mockRejectedValue(new Error('Failed'));

      const result = await service.trashEmail('msg-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to trash email');
    });
  });

  describe('listLabels', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.labels.list.mockResolvedValue({
        data: {
          labels: [
            { id: 'INBOX', name: 'INBOX', type: 'system' },
            { id: 'Label_1', name: 'Custom', type: 'user' }
          ]
        }
      });
    });

    it('should list labels successfully', async () => {
      const result = await service.listLabels();

      expect(result.success).toBe(true);
      expect(result.labels).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should include label details', async () => {
      const result = await service.listLabels();

      expect(result.labels[0].id).toBe('INBOX');
      expect(result.labels[0].name).toBe('INBOX');
      expect(result.labels[0].type).toBe('system');
    });
  });

  describe('createLabel', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.labels.create.mockResolvedValue({
        data: {
          id: 'Label_new',
          name: 'New Label',
          type: 'user'
        }
      });
    });

    it('should create label successfully', async () => {
      const result = await service.createLabel('New Label');

      expect(result.success).toBe(true);
      expect(result.label.name).toBe('New Label');
    });

    it('should pass label options', async () => {
      await service.createLabel('Colored Label', {
        backgroundColor: '#ff0000',
        textColor: '#ffffff'
      });

      expect(mockGmail.users.labels.create).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.getProfile.mockResolvedValue({
        data: {
          emailAddress: 'user@example.com',
          messagesTotal: 1000,
          threadsTotal: 500,
          historyId: '12345'
        }
      });
    });

    it('should get profile successfully', async () => {
      const result = await service.getProfile();

      expect(result.success).toBe(true);
      expect(result.emailAddress).toBe('user@example.com');
      expect(result.messagesTotal).toBe(1000);
    });
  });

  describe('getUnreadCount', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.labels.get.mockResolvedValue({
        data: {
          messagesUnread: 10,
          messagesTotal: 100
        }
      });
    });

    it('should return unread count', async () => {
      const result = await service.getUnreadCount();

      expect(result.success).toBe(true);
      expect(result.unreadCount).toBe(10);
      expect(result.totalCount).toBe(100);
    });
  });

  describe('getThread', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      mockGmail.users.threads.get.mockResolvedValue({
        data: {
          id: 'thread-123',
          historyId: '12345',
          messages: [
            {
              id: 'msg-1',
              snippet: 'First message',
              labelIds: ['INBOX'],
              payload: {
                headers: [
                  { name: 'From', value: 'sender@example.com' },
                  { name: 'Subject', value: 'Thread Subject' }
                ]
              }
            }
          ]
        }
      });
    });

    it('should get thread successfully', async () => {
      const result = await service.getThread('thread-123');

      expect(result.success).toBe(true);
      expect(result.threadId).toBe('thread-123');
      expect(result.messageCount).toBe(1);
    });

    it('should include message details', async () => {
      const result = await service.getThread('thread-123');

      expect(result.messages[0].from).toBe('sender@example.com');
      expect(result.messages[0].subject).toBe('Thread Subject');
    });
  });

  describe('createDraft', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      service.userEmail = 'user@example.com';
      mockGmail.users.drafts.create.mockResolvedValue({
        data: {
          id: 'draft-123',
          message: { id: 'msg-123' }
        }
      });
    });

    it('should create draft successfully', async () => {
      const result = await service.createDraft('to@example.com', 'Subject', 'Body');

      expect(result.success).toBe(true);
      expect(result.draftId).toBe('draft-123');
    });
  });

  describe('sendBulkEmail', () => {
    beforeEach(() => {
      service.initialized = true;
      service.gmail = mockGmail;
      service.userEmail = 'user@example.com';
      mockGmail.users.messages.send.mockResolvedValue({
        data: { id: 'msg-123', threadId: 'thread-123', labelIds: ['SENT'] }
      });
    });

    it('should send to multiple recipients', async () => {
      const recipients = ['r1@example.com', 'r2@example.com', 'r3@example.com'];
      const result = await service.sendBulkEmail(recipients, 'Subject', 'Body');

      expect(result.sent).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should track failed sends', async () => {
      mockGmail.users.messages.send
        .mockResolvedValueOnce({ data: { id: 'msg-1' } })
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await service.sendBulkEmail(
        ['r1@example.com', 'r2@example.com'],
        'Subject',
        'Body'
      );

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(false);
    });
  });
});
