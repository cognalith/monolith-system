/**
 * MONOLITH OS - NotebookLM Service
 * Provides podcast/audio generation via Google NotebookLM automation
 *
 * Features:
 * - Persistent session management (cookies/localStorage)
 * - Notebook creation and management
 * - Source upload (URLs, text, documents)
 * - Audio Overview (Deep Dive) generation
 * - Audio download/sharing
 *
 * Used by: Aria (personal), Mona (CMO)
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_CONFIG = {
  headless: false,  // First run needs interactive for auth
  defaultTimeout: 60000,  // NotebookLM can be slow
  viewport: { width: 1400, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  sessionPath: './data/.notebooklm-session',
  baseUrl: 'https://notebooklm.google.com',
};

// Selectors for NotebookLM UI (may need updates if Google changes UI)
const SELECTORS = {
  // Auth
  signInButton: 'button:has-text("Sign in")',
  googleAccountPicker: '[data-identifier]',

  // Notebooks
  newNotebookButton: 'button:has-text("New notebook"), button:has-text("Create")',
  notebookTitleInput: 'input[aria-label*="title"], input[placeholder*="Untitled"]',
  notebookCard: '[data-notebook-id], .notebook-card',

  // Sources
  addSourceButton: 'button:has-text("Add source"), button[aria-label*="Add"]',
  sourceUrlInput: 'input[type="url"], input[placeholder*="URL"]',
  sourceTextArea: 'textarea[placeholder*="text"], textarea[aria-label*="text"]',
  uploadFileInput: 'input[type="file"]',
  sourceDoneButton: 'button:has-text("Insert"), button:has-text("Add"), button:has-text("Done")',

  // Audio Overview
  audioOverviewButton: 'button:has-text("Audio Overview"), button:has-text("Generate audio")',
  generateButton: 'button:has-text("Generate"), button:has-text("Create")',
  audioPlayer: 'audio, [data-audio-player]',
  downloadAudioButton: 'button:has-text("Download"), button[aria-label*="download"]',
  shareAudioButton: 'button:has-text("Share"), button[aria-label*="share"]',
  audioLoadingIndicator: '[data-loading], .loading-spinner, .generating',

  // General
  closeButton: 'button[aria-label="Close"], button:has-text("Close")',
  confirmButton: 'button:has-text("Confirm"), button:has-text("OK")',
};

class NotebookLMService {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.browser = null;
    this.context = null;
    this.page = null;
    this.initialized = false;
    this.authenticated = false;
  }

  /**
   * Initialize browser with persistent session
   */
  async initialize() {
    if (this.initialized && this.browser) {
      return { success: true, message: 'NotebookLM service already initialized' };
    }

    try {
      // Ensure session directory exists
      await fs.mkdir(this.config.sessionPath, { recursive: true });

      const sessionFile = path.join(this.config.sessionPath, 'state.json');
      let hasSession = false;

      try {
        await fs.access(sessionFile);
        hasSession = true;
      } catch {
        hasSession = false;
      }

      this.browser = await chromium.launch({
        headless: hasSession ? this.config.headless : false, // Interactive for first auth
      });

      // Load existing session or create new context
      if (hasSession) {
        this.context = await this.browser.newContext({
          storageState: sessionFile,
          viewport: this.config.viewport,
          userAgent: this.config.userAgent,
        });
      } else {
        this.context = await this.browser.newContext({
          viewport: this.config.viewport,
          userAgent: this.config.userAgent,
        });
      }

      this.context.setDefaultTimeout(this.config.defaultTimeout);
      this.page = await this.context.newPage();
      this.initialized = true;

      // Navigate to NotebookLM and check auth status
      await this.page.goto(this.config.baseUrl, { waitUntil: 'networkidle' });

      // Check if we're authenticated
      const needsAuth = await this.page.$(SELECTORS.signInButton);

      if (needsAuth) {
        if (hasSession) {
          // Session expired, need re-auth
          return {
            success: true,
            message: 'Session expired. Please authenticate manually.',
            authenticated: false,
            requiresAuth: true,
          };
        } else {
          return {
            success: true,
            message: 'First-time setup. Please sign in to Google in the browser window.',
            authenticated: false,
            requiresAuth: true,
          };
        }
      }

      this.authenticated = true;

      return {
        success: true,
        message: 'NotebookLM service initialized and authenticated',
        authenticated: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize NotebookLM service: ${error.message}`,
      };
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized || !this.browser) {
      const result = await this.initialize();
      if (!result.success) {
        throw new Error(result.error);
      }
      if (result.requiresAuth) {
        throw new Error('Authentication required. Please run authenticateInteractive() first.');
      }
    }
  }

  /**
   * Wait for manual authentication and save session
   */
  async authenticateInteractive(timeoutMs = 300000) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('Waiting for Google sign-in... Please authenticate in the browser window.');

      // Wait for sign-in to complete (user lands on notebooks page)
      await this.page.waitForURL('**/notebook/**', { timeout: timeoutMs });

      // Save session state
      const sessionFile = path.join(this.config.sessionPath, 'state.json');
      await this.context.storageState({ path: sessionFile });

      this.authenticated = true;

      return {
        success: true,
        message: 'Authentication successful. Session saved.',
        authenticated: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Authentication failed or timed out: ${error.message}`,
      };
    }
  }

  /**
   * Save current session state
   */
  async saveSession() {
    try {
      await this.ensureInitialized();

      const sessionFile = path.join(this.config.sessionPath, 'state.json');
      await this.context.storageState({ path: sessionFile });

      return {
        success: true,
        message: 'Session saved',
        path: sessionFile,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save session: ${error.message}`,
      };
    }
  }

  /**
   * Create a new notebook
   */
  async createNotebook(title) {
    try {
      await this.ensureInitialized();

      // Navigate to home if not there
      if (!this.page.url().includes('notebooklm.google.com')) {
        await this.page.goto(this.config.baseUrl, { waitUntil: 'networkidle' });
      }

      // Click new notebook button
      await this.page.click(SELECTORS.newNotebookButton);
      await this.page.waitForTimeout(1000);

      // Set title if provided
      if (title) {
        const titleInput = await this.page.$(SELECTORS.notebookTitleInput);
        if (titleInput) {
          await titleInput.fill(title);
          await this.page.keyboard.press('Enter');
        }
      }

      // Wait for notebook to be created
      await this.page.waitForURL('**/notebook/**', { timeout: 10000 });

      const notebookUrl = this.page.url();
      const notebookId = notebookUrl.split('/notebook/')[1]?.split('?')[0] || null;

      return {
        success: true,
        notebookId,
        notebookUrl,
        title: title || 'Untitled notebook',
        message: `Notebook "${title || 'Untitled'}" created`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create notebook: ${error.message}`,
        title,
      };
    }
  }

  /**
   * Open an existing notebook by ID or URL
   */
  async openNotebook(notebookIdOrUrl) {
    try {
      await this.ensureInitialized();

      const url = notebookIdOrUrl.startsWith('http')
        ? notebookIdOrUrl
        : `${this.config.baseUrl}/notebook/${notebookIdOrUrl}`;

      await this.page.goto(url, { waitUntil: 'networkidle' });

      const currentUrl = this.page.url();
      const notebookId = currentUrl.split('/notebook/')[1]?.split('?')[0] || null;

      return {
        success: true,
        notebookId,
        notebookUrl: currentUrl,
        message: 'Notebook opened',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to open notebook: ${error.message}`,
        notebookIdOrUrl,
      };
    }
  }

  /**
   * Add a URL source to the current notebook
   */
  async addSourceUrl(url) {
    try {
      await this.ensureInitialized();

      // Click add source button
      await this.page.click(SELECTORS.addSourceButton);
      await this.page.waitForTimeout(500);

      // Look for URL input option and click it
      const urlOption = await this.page.$('button:has-text("Website"), button:has-text("URL"), [data-source-type="url"]');
      if (urlOption) {
        await urlOption.click();
        await this.page.waitForTimeout(500);
      }

      // Fill URL
      const urlInput = await this.page.$(SELECTORS.sourceUrlInput);
      if (urlInput) {
        await urlInput.fill(url);
      } else {
        throw new Error('URL input field not found');
      }

      // Submit
      await this.page.click(SELECTORS.sourceDoneButton);
      await this.page.waitForTimeout(2000); // Wait for processing

      return {
        success: true,
        sourceType: 'url',
        url,
        message: `URL source added: ${url}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add URL source: ${error.message}`,
        url,
      };
    }
  }

  /**
   * Add text/paste source to the current notebook
   */
  async addSourceText(text, title = 'Pasted text') {
    try {
      await this.ensureInitialized();

      // Click add source button
      await this.page.click(SELECTORS.addSourceButton);
      await this.page.waitForTimeout(500);

      // Look for text/paste option and click it
      const textOption = await this.page.$('button:has-text("Copied text"), button:has-text("Paste"), [data-source-type="text"]');
      if (textOption) {
        await textOption.click();
        await this.page.waitForTimeout(500);
      }

      // Fill text
      const textArea = await this.page.$(SELECTORS.sourceTextArea);
      if (textArea) {
        await textArea.fill(text);
      } else {
        throw new Error('Text area not found');
      }

      // Submit
      await this.page.click(SELECTORS.sourceDoneButton);
      await this.page.waitForTimeout(2000);

      return {
        success: true,
        sourceType: 'text',
        title,
        textLength: text.length,
        message: `Text source added: ${title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add text source: ${error.message}`,
      };
    }
  }

  /**
   * Generate Audio Overview (Deep Dive podcast)
   * This can take 2-5+ minutes
   */
  async generateAudioOverview(options = {}) {
    try {
      await this.ensureInitialized();

      const timeout = options.timeout || 600000; // 10 minutes default

      // Click Audio Overview button
      const audioButton = await this.page.$(SELECTORS.audioOverviewButton);
      if (!audioButton) {
        throw new Error('Audio Overview button not found. Make sure sources are added.');
      }
      await audioButton.click();
      await this.page.waitForTimeout(1000);

      // Click Generate if there's a confirmation step
      const generateButton = await this.page.$(SELECTORS.generateButton);
      if (generateButton) {
        await generateButton.click();
      }

      console.log('Audio generation started. This may take several minutes...');

      // Wait for audio to be ready (look for audio player or download button)
      const startTime = Date.now();
      let audioReady = false;

      while (!audioReady && (Date.now() - startTime) < timeout) {
        // Check for audio player or download button
        const audioPlayer = await this.page.$(SELECTORS.audioPlayer);
        const downloadButton = await this.page.$(SELECTORS.downloadAudioButton);

        if (audioPlayer || downloadButton) {
          audioReady = true;
          break;
        }

        // Check if still loading
        const loading = await this.page.$(SELECTORS.audioLoadingIndicator);
        if (!loading) {
          // Check for error messages
          const errorMessage = await this.page.$('.error-message, [data-error]');
          if (errorMessage) {
            const errorText = await errorMessage.textContent();
            throw new Error(`Audio generation failed: ${errorText}`);
          }
        }

        await this.page.waitForTimeout(5000); // Check every 5 seconds
      }

      if (!audioReady) {
        throw new Error('Audio generation timed out');
      }

      const generationTime = Math.round((Date.now() - startTime) / 1000);

      return {
        success: true,
        message: 'Audio Overview generated successfully',
        generationTimeSeconds: generationTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate audio: ${error.message}`,
      };
    }
  }

  /**
   * Get audio share link
   */
  async getAudioShareLink() {
    try {
      await this.ensureInitialized();

      // Click share button
      const shareButton = await this.page.$(SELECTORS.shareAudioButton);
      if (!shareButton) {
        throw new Error('Share button not found. Audio may not be generated yet.');
      }
      await shareButton.click();
      await this.page.waitForTimeout(1000);

      // Look for the share link in a dialog or copy it from input
      const linkInput = await this.page.$('input[readonly], input[type="text"][value*="http"]');
      let shareLink = null;

      if (linkInput) {
        shareLink = await linkInput.getAttribute('value');
      } else {
        // Try to get from clipboard after clicking copy
        const copyButton = await this.page.$('button:has-text("Copy link"), button:has-text("Copy")');
        if (copyButton) {
          await copyButton.click();
          // Note: Getting clipboard in Playwright requires permissions
          shareLink = 'Link copied to clipboard (check manually)';
        }
      }

      // Close dialog
      const closeButton = await this.page.$(SELECTORS.closeButton);
      if (closeButton) {
        await closeButton.click();
      }

      return {
        success: true,
        shareLink,
        message: 'Share link retrieved',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get share link: ${error.message}`,
      };
    }
  }

  /**
   * Download audio file (if available)
   */
  async downloadAudio(downloadPath) {
    try {
      await this.ensureInitialized();

      // Set up download handler
      const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

      // Click download button
      const downloadButton = await this.page.$(SELECTORS.downloadAudioButton);
      if (!downloadButton) {
        throw new Error('Download button not found. Audio may not be generated yet.');
      }
      await downloadButton.click();

      // Wait for download
      const download = await downloadPromise;
      const suggestedFilename = download.suggestedFilename();
      const finalPath = downloadPath || path.join('./downloads', suggestedFilename);

      await fs.mkdir(path.dirname(finalPath), { recursive: true });
      await download.saveAs(finalPath);

      return {
        success: true,
        filePath: finalPath,
        filename: suggestedFilename,
        message: `Audio downloaded to: ${finalPath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to download audio: ${error.message}`,
      };
    }
  }

  /**
   * Full workflow: Create notebook, add sources, generate audio
   */
  async createPodcast(title, sources, options = {}) {
    try {
      await this.ensureInitialized();

      const results = {
        notebook: null,
        sources: [],
        audio: null,
      };

      // Step 1: Create notebook
      const notebookResult = await this.createNotebook(title);
      if (!notebookResult.success) {
        throw new Error(`Notebook creation failed: ${notebookResult.error}`);
      }
      results.notebook = notebookResult;

      // Step 2: Add sources
      for (const source of sources) {
        let sourceResult;

        if (typeof source === 'string') {
          // Detect if URL or text
          if (source.startsWith('http')) {
            sourceResult = await this.addSourceUrl(source);
          } else {
            sourceResult = await this.addSourceText(source);
          }
        } else if (source.type === 'url') {
          sourceResult = await this.addSourceUrl(source.content);
        } else if (source.type === 'text') {
          sourceResult = await this.addSourceText(source.content, source.title);
        }

        results.sources.push(sourceResult);

        if (!sourceResult.success) {
          console.warn(`Source addition failed: ${sourceResult.error}`);
        }
      }

      // Check if any sources were added successfully
      const successfulSources = results.sources.filter(s => s.success).length;
      if (successfulSources === 0) {
        throw new Error('No sources were added successfully');
      }

      // Step 3: Generate audio
      const audioResult = await this.generateAudioOverview(options);
      results.audio = audioResult;

      if (!audioResult.success) {
        throw new Error(`Audio generation failed: ${audioResult.error}`);
      }

      // Step 4: Get share link
      const shareResult = await this.getAudioShareLink();

      return {
        success: true,
        message: `Podcast "${title}" created successfully`,
        notebookId: notebookResult.notebookId,
        notebookUrl: notebookResult.notebookUrl,
        sourcesAdded: successfulSources,
        totalSources: sources.length,
        shareLink: shareResult.success ? shareResult.shareLink : null,
        generationTimeSeconds: audioResult.generationTimeSeconds,
        details: results,
      };
    } catch (error) {
      return {
        success: false,
        error: `Podcast creation failed: ${error.message}`,
        title,
      };
    }
  }

  /**
   * List user's notebooks (from home page)
   */
  async listNotebooks() {
    try {
      await this.ensureInitialized();

      // Navigate to home
      await this.page.goto(this.config.baseUrl, { waitUntil: 'networkidle' });

      // Get notebook cards
      const notebooks = await this.page.$$(SELECTORS.notebookCard);
      const notebookList = [];

      for (const notebook of notebooks) {
        try {
          const title = await notebook.$eval('[data-title], .title, h3', el => el.textContent);
          const id = await notebook.getAttribute('data-notebook-id');
          notebookList.push({ id, title: title?.trim() || 'Untitled' });
        } catch {
          // Skip if can't extract info
        }
      }

      return {
        success: true,
        notebooks: notebookList,
        count: notebookList.length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list notebooks: ${error.message}`,
      };
    }
  }

  /**
   * Take a screenshot of current state (for debugging)
   */
  async screenshot(filePath) {
    try {
      await this.ensureInitialized();

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await this.page.screenshot({ path: filePath, fullPage: true });

      return {
        success: true,
        path: filePath,
        message: 'Screenshot saved',
      };
    } catch (error) {
      return {
        success: false,
        error: `Screenshot failed: ${error.message}`,
      };
    }
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    try {
      // Save session before closing
      if (this.authenticated && this.context) {
        await this.saveSession();
      }

      if (this.browser) {
        await this.browser.close();
      }

      this.browser = null;
      this.context = null;
      this.page = null;
      this.initialized = false;
      this.authenticated = false;

      return {
        success: true,
        message: 'NotebookLM service closed',
      };
    } catch (error) {
      // Force cleanup
      this.browser = null;
      this.context = null;
      this.page = null;
      this.initialized = false;
      this.authenticated = false;

      return {
        success: false,
        error: `Close error: ${error.message}`,
        message: 'Resources cleaned up despite error',
      };
    }
  }
}

// Singleton instance
const notebookLMService = new NotebookLMService();

export default notebookLMService;
export { NotebookLMService };
