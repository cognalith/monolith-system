/**
 * MONOLITH OS - Browser Service
 * Provides web automation capabilities using Playwright
 *
 * Features:
 * - Browser lifecycle management (singleton pattern)
 * - Navigation and page interaction
 * - Form automation
 * - Screenshot capture
 * - Tab management
 * - JavaScript evaluation
 */

import { chromium } from 'playwright';

const DEFAULT_CONFIG = {
  headless: true,
  defaultTimeout: 30000,
  viewport: { width: 1280, height: 720 },
  userAgent: 'MONOLITH-Agent/1.0',
};

class BrowserService {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.browser = null;
    this.context = null;
    this.pages = [];
    this.currentPageIndex = 0;
    this.initialized = false;
  }

  /**
   * Get the current active page
   */
  get page() {
    return this.pages[this.currentPageIndex] || null;
  }

  /**
   * Initialize and launch the browser
   */
  async initialize() {
    if (this.initialized && this.browser) {
      return { success: true, message: 'Browser already initialized' };
    }

    try {
      this.browser = await chromium.launch({
        headless: this.config.headless,
      });

      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent,
      });

      // Set default timeout for all operations
      this.context.setDefaultTimeout(this.config.defaultTimeout);

      // Create initial page
      const page = await this.context.newPage();
      this.pages.push(page);
      this.currentPageIndex = 0;

      this.initialized = true;

      return {
        success: true,
        message: 'Browser initialized successfully',
        headless: this.config.headless,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error.message}`,
      };
    }
  }

  /**
   * Ensure browser is running before operations
   */
  async ensureInitialized() {
    if (!this.initialized || !this.browser) {
      const result = await this.initialize();
      if (!result.success) {
        throw new Error(result.error);
      }
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url) {
    try {
      await this.ensureInitialized();

      const response = await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
      });

      return {
        success: true,
        url: this.page.url(),
        status: response?.status() || null,
        title: await this.page.title(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Navigation failed: ${error.message}`,
        url,
      };
    }
  }

  /**
   * Click on an element
   */
  async click(selector) {
    try {
      await this.ensureInitialized();

      await this.page.click(selector);

      return {
        success: true,
        selector,
        message: `Clicked element: ${selector}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Click failed: ${error.message}`,
        selector,
      };
    }
  }

  /**
   * Type text into an element
   */
  async type(selector, text) {
    try {
      await this.ensureInitialized();

      await this.page.fill(selector, text);

      return {
        success: true,
        selector,
        textLength: text.length,
        message: `Typed ${text.length} characters into: ${selector}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Type failed: ${error.message}`,
        selector,
      };
    }
  }

  /**
   * Fill multiple form fields at once
   */
  async fillForm(fields) {
    try {
      await this.ensureInitialized();

      const results = [];

      for (const [selector, value] of Object.entries(fields)) {
        try {
          await this.page.fill(selector, value);
          results.push({
            selector,
            success: true,
          });
        } catch (error) {
          results.push({
            selector,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      return {
        success: successCount === results.length,
        totalFields: results.length,
        successfulFields: successCount,
        failedFields: results.length - successCount,
        details: results,
      };
    } catch (error) {
      return {
        success: false,
        error: `Form fill failed: ${error.message}`,
      };
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(filePath, options = {}) {
    try {
      await this.ensureInitialized();

      const screenshotOptions = {
        path: filePath,
        fullPage: options.fullPage || false,
        type: options.type || 'png',
      };

      if (options.selector) {
        const element = await this.page.$(options.selector);
        if (element) {
          await element.screenshot(screenshotOptions);
        } else {
          throw new Error(`Element not found: ${options.selector}`);
        }
      } else {
        await this.page.screenshot(screenshotOptions);
      }

      return {
        success: true,
        path: filePath,
        fullPage: screenshotOptions.fullPage,
        type: screenshotOptions.type,
      };
    } catch (error) {
      return {
        success: false,
        error: `Screenshot failed: ${error.message}`,
        path: filePath,
      };
    }
  }

  /**
   * Get page text content
   */
  async getPageContent() {
    try {
      await this.ensureInitialized();

      const content = await this.page.textContent('body');
      const title = await this.page.title();
      const url = this.page.url();

      return {
        success: true,
        url,
        title,
        content: content || '',
        contentLength: (content || '').length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get page content: ${error.message}`,
      };
    }
  }

  /**
   * Get HTML content of the page
   */
  async getPageHTML() {
    try {
      await this.ensureInitialized();

      const html = await this.page.content();
      const title = await this.page.title();
      const url = this.page.url();

      return {
        success: true,
        url,
        title,
        html,
        htmlLength: html.length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get page HTML: ${error.message}`,
      };
    }
  }

  /**
   * Evaluate JavaScript on the page
   */
  async evaluate(script) {
    try {
      await this.ensureInitialized();

      const result = await this.page.evaluate(script);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Evaluate failed: ${error.message}`,
        script: script.substring(0, 100) + (script.length > 100 ? '...' : ''),
      };
    }
  }

  /**
   * Wait for an element to appear
   */
  async waitFor(selector, timeout = null) {
    try {
      await this.ensureInitialized();

      const waitTimeout = timeout || this.config.defaultTimeout;

      await this.page.waitForSelector(selector, {
        timeout: waitTimeout,
        state: 'visible',
      });

      return {
        success: true,
        selector,
        message: `Element found: ${selector}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Wait failed: ${error.message}`,
        selector,
        timeout: timeout || this.config.defaultTimeout,
      };
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options = {}) {
    try {
      await this.ensureInitialized();

      await this.page.waitForNavigation({
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || this.config.defaultTimeout,
      });

      return {
        success: true,
        url: this.page.url(),
        title: await this.page.title(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Wait for navigation failed: ${error.message}`,
      };
    }
  }

  /**
   * Get all open tabs
   */
  async getTabs() {
    try {
      await this.ensureInitialized();

      const tabInfo = [];

      for (let i = 0; i < this.pages.length; i++) {
        const page = this.pages[i];
        try {
          tabInfo.push({
            index: i,
            url: page.url(),
            title: await page.title(),
            isActive: i === this.currentPageIndex,
          });
        } catch {
          tabInfo.push({
            index: i,
            url: 'about:blank',
            title: '',
            isActive: i === this.currentPageIndex,
            error: 'Page may be closed',
          });
        }
      }

      return {
        success: true,
        tabs: tabInfo,
        totalTabs: this.pages.length,
        activeTabIndex: this.currentPageIndex,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get tabs: ${error.message}`,
      };
    }
  }

  /**
   * Open a new tab
   */
  async newTab(url = null) {
    try {
      await this.ensureInitialized();

      const page = await this.context.newPage();
      this.pages.push(page);
      this.currentPageIndex = this.pages.length - 1;

      let navResult = null;
      if (url) {
        navResult = await this.navigate(url);
      }

      return {
        success: true,
        tabIndex: this.currentPageIndex,
        totalTabs: this.pages.length,
        url: url || 'about:blank',
        navigation: navResult,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create new tab: ${error.message}`,
      };
    }
  }

  /**
   * Switch to a specific tab
   */
  async switchTab(index) {
    try {
      await this.ensureInitialized();

      if (index < 0 || index >= this.pages.length) {
        return {
          success: false,
          error: `Invalid tab index: ${index}. Available tabs: 0-${this.pages.length - 1}`,
        };
      }

      this.currentPageIndex = index;
      await this.pages[index].bringToFront();

      return {
        success: true,
        tabIndex: index,
        url: this.page.url(),
        title: await this.page.title(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to switch tab: ${error.message}`,
        tabIndex: index,
      };
    }
  }

  /**
   * Close a specific tab
   */
  async closeTab(index = null) {
    try {
      await this.ensureInitialized();

      const targetIndex = index !== null ? index : this.currentPageIndex;

      if (targetIndex < 0 || targetIndex >= this.pages.length) {
        return {
          success: false,
          error: `Invalid tab index: ${targetIndex}`,
        };
      }

      if (this.pages.length === 1) {
        return {
          success: false,
          error: 'Cannot close the last tab. Use close() to close the browser.',
        };
      }

      const closedPage = this.pages[targetIndex];
      await closedPage.close();
      this.pages.splice(targetIndex, 1);

      // Adjust current page index
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = this.pages.length - 1;
      }

      return {
        success: true,
        closedTabIndex: targetIndex,
        remainingTabs: this.pages.length,
        currentTabIndex: this.currentPageIndex,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to close tab: ${error.message}`,
      };
    }
  }

  /**
   * Select option from dropdown
   */
  async select(selector, value) {
    try {
      await this.ensureInitialized();

      await this.page.selectOption(selector, value);

      return {
        success: true,
        selector,
        value,
        message: `Selected "${value}" in: ${selector}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Select failed: ${error.message}`,
        selector,
        value,
      };
    }
  }

  /**
   * Check or uncheck a checkbox
   */
  async check(selector, checked = true) {
    try {
      await this.ensureInitialized();

      if (checked) {
        await this.page.check(selector);
      } else {
        await this.page.uncheck(selector);
      }

      return {
        success: true,
        selector,
        checked,
        message: `${checked ? 'Checked' : 'Unchecked'}: ${selector}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Check operation failed: ${error.message}`,
        selector,
      };
    }
  }

  /**
   * Hover over an element
   */
  async hover(selector) {
    try {
      await this.ensureInitialized();

      await this.page.hover(selector);

      return {
        success: true,
        selector,
        message: `Hovered over: ${selector}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Hover failed: ${error.message}`,
        selector,
      };
    }
  }

  /**
   * Press keyboard keys
   */
  async press(key) {
    try {
      await this.ensureInitialized();

      await this.page.keyboard.press(key);

      return {
        success: true,
        key,
        message: `Pressed key: ${key}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Key press failed: ${error.message}`,
        key,
      };
    }
  }

  /**
   * Get element attribute
   */
  async getAttribute(selector, attribute) {
    try {
      await this.ensureInitialized();

      const value = await this.page.getAttribute(selector, attribute);

      return {
        success: true,
        selector,
        attribute,
        value,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get attribute: ${error.message}`,
        selector,
        attribute,
      };
    }
  }

  /**
   * Get element inner text
   */
  async getText(selector) {
    try {
      await this.ensureInitialized();

      const text = await this.page.textContent(selector);

      return {
        success: true,
        selector,
        text: text || '',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get text: ${error.message}`,
        selector,
      };
    }
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector) {
    try {
      await this.ensureInitialized();

      const visible = await this.page.isVisible(selector);

      return {
        success: true,
        selector,
        visible,
      };
    } catch (error) {
      return {
        success: false,
        error: `Visibility check failed: ${error.message}`,
        selector,
      };
    }
  }

  /**
   * Get all elements matching a selector
   */
  async queryAll(selector) {
    try {
      await this.ensureInitialized();

      const elements = await this.page.$$(selector);
      const results = [];

      for (const element of elements) {
        try {
          const text = await element.textContent();
          const tagName = await element.evaluate(el => el.tagName.toLowerCase());
          results.push({
            text: text || '',
            tagName,
          });
        } catch {
          results.push({ text: '', tagName: 'unknown' });
        }
      }

      return {
        success: true,
        selector,
        count: elements.length,
        elements: results,
      };
    } catch (error) {
      return {
        success: false,
        error: `Query failed: ${error.message}`,
        selector,
      };
    }
  }

  /**
   * Scroll page
   */
  async scroll(options = {}) {
    try {
      await this.ensureInitialized();

      if (options.selector) {
        await this.page.locator(options.selector).scrollIntoViewIfNeeded();
      } else {
        const x = options.x || 0;
        const y = options.y || 0;
        await this.page.evaluate(([scrollX, scrollY]) => {
          window.scrollBy(scrollX, scrollY);
        }, [x, y]);
      }

      return {
        success: true,
        options,
        message: options.selector
          ? `Scrolled to: ${options.selector}`
          : `Scrolled by (${options.x || 0}, ${options.y || 0})`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Scroll failed: ${error.message}`,
      };
    }
  }

  /**
   * Go back in browser history
   */
  async goBack() {
    try {
      await this.ensureInitialized();

      await this.page.goBack();

      return {
        success: true,
        url: this.page.url(),
        title: await this.page.title(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Go back failed: ${error.message}`,
      };
    }
  }

  /**
   * Go forward in browser history
   */
  async goForward() {
    try {
      await this.ensureInitialized();

      await this.page.goForward();

      return {
        success: true,
        url: this.page.url(),
        title: await this.page.title(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Go forward failed: ${error.message}`,
      };
    }
  }

  /**
   * Reload the current page
   */
  async reload() {
    try {
      await this.ensureInitialized();

      await this.page.reload();

      return {
        success: true,
        url: this.page.url(),
        title: await this.page.title(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Reload failed: ${error.message}`,
      };
    }
  }

  /**
   * Set cookies
   */
  async setCookies(cookies) {
    try {
      await this.ensureInitialized();

      await this.context.addCookies(cookies);

      return {
        success: true,
        cookiesAdded: cookies.length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set cookies: ${error.message}`,
      };
    }
  }

  /**
   * Get cookies
   */
  async getCookies(urls = null) {
    try {
      await this.ensureInitialized();

      const cookies = await this.context.cookies(urls);

      return {
        success: true,
        cookies,
        count: cookies.length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get cookies: ${error.message}`,
      };
    }
  }

  /**
   * Clear cookies
   */
  async clearCookies() {
    try {
      await this.ensureInitialized();

      await this.context.clearCookies();

      return {
        success: true,
        message: 'Cookies cleared',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to clear cookies: ${error.message}`,
      };
    }
  }

  /**
   * Get current page info
   */
  async getPageInfo() {
    try {
      await this.ensureInitialized();

      return {
        success: true,
        url: this.page.url(),
        title: await this.page.title(),
        viewport: this.page.viewportSize(),
        tabIndex: this.currentPageIndex,
        totalTabs: this.pages.length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get page info: ${error.message}`,
      };
    }
  }

  /**
   * Close the browser and cleanup
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
      }

      this.browser = null;
      this.context = null;
      this.pages = [];
      this.currentPageIndex = 0;
      this.initialized = false;

      return {
        success: true,
        message: 'Browser closed successfully',
      };
    } catch (error) {
      // Force cleanup even on error
      this.browser = null;
      this.context = null;
      this.pages = [];
      this.currentPageIndex = 0;
      this.initialized = false;

      return {
        success: false,
        error: `Browser close error: ${error.message}`,
        message: 'Browser resources cleaned up despite error',
      };
    }
  }

  /**
   * Reconfigure browser settings (requires restart)
   */
  async configure(options = {}) {
    const wasInitialized = this.initialized;

    if (wasInitialized) {
      await this.close();
    }

    this.config = { ...this.config, ...options };

    if (wasInitialized) {
      return this.initialize();
    }

    return {
      success: true,
      config: this.config,
      message: 'Configuration updated. Browser will use new settings on next initialize.',
    };
  }
}

// Singleton instance with default configuration
const browserService = new BrowserService();

export default browserService;
export { BrowserService };
