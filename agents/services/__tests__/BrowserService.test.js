/**
 * Unit tests for BrowserService
 * Tests browser automation with mocked Playwright
 */

import { jest } from '@jest/globals';

// Mock Playwright
const mockPage = {
  goto: jest.fn(),
  title: jest.fn(),
  url: jest.fn(),
  click: jest.fn(),
  fill: jest.fn(),
  screenshot: jest.fn(),
  textContent: jest.fn(),
  content: jest.fn(),
  evaluate: jest.fn(),
  waitForSelector: jest.fn(),
  waitForNavigation: jest.fn(),
  selectOption: jest.fn(),
  check: jest.fn(),
  uncheck: jest.fn(),
  hover: jest.fn(),
  keyboard: { press: jest.fn() },
  getAttribute: jest.fn(),
  isVisible: jest.fn(),
  $$: jest.fn(),
  $: jest.fn(),
  locator: jest.fn(),
  goBack: jest.fn(),
  goForward: jest.fn(),
  reload: jest.fn(),
  viewportSize: jest.fn(),
  bringToFront: jest.fn(),
  close: jest.fn()
};

const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  setDefaultTimeout: jest.fn(),
  addCookies: jest.fn(),
  cookies: jest.fn(),
  clearCookies: jest.fn(),
  close: jest.fn()
};

const mockBrowser = {
  newContext: jest.fn().mockResolvedValue(mockContext),
  close: jest.fn()
};

jest.unstable_mockModule('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser)
  }
}));

const { BrowserService } = await import('../BrowserService.js');

describe('BrowserService', () => {
  let service;

  beforeEach(() => {
    service = new BrowserService({
      headless: true,
      defaultTimeout: 10000
    });
    jest.clearAllMocks();

    // Reset mock returns
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.title.mockResolvedValue('Test Page');
    mockPage.url.mockReturnValue('https://example.com');
    mockPage.textContent.mockResolvedValue('Page content');
    mockPage.content.mockResolvedValue('<html><body>Content</body></html>');
    mockPage.viewportSize.mockReturnValue({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    if (service.initialized) {
      await service.close();
    }
  });

  describe('constructor', () => {
    it('should initialize with custom config', () => {
      expect(service.config.headless).toBe(true);
      expect(service.config.defaultTimeout).toBe(10000);
    });

    it('should use default config when not provided', () => {
      const defaultService = new BrowserService();
      expect(defaultService.config.headless).toBe(true);
      expect(defaultService.config.viewport).toEqual({ width: 1280, height: 720 });
    });

    it('should initialize with null state', () => {
      expect(service.browser).toBeNull();
      expect(service.context).toBeNull();
      expect(service.pages).toEqual([]);
      expect(service.currentPageIndex).toBe(0);
      expect(service.initialized).toBe(false);
    });
  });

  describe('page getter', () => {
    it('should return null when no pages', () => {
      expect(service.page).toBeNull();
    });

    it('should return current page after initialization', async () => {
      await service.initialize();
      expect(service.page).toBe(mockPage);
    });
  });

  describe('initialize', () => {
    it('should launch browser successfully', async () => {
      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized successfully');
      expect(service.initialized).toBe(true);
    });

    it('should create initial page', async () => {
      await service.initialize();

      expect(mockContext.newPage).toHaveBeenCalled();
      expect(service.pages.length).toBe(1);
    });

    it('should set default timeout', async () => {
      await service.initialize();

      expect(mockContext.setDefaultTimeout).toHaveBeenCalledWith(10000);
    });

    it('should return existing message if already initialized', async () => {
      await service.initialize();
      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already initialized');
    });
  });

  describe('navigate', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should navigate to URL successfully', async () => {
      const result = await service.navigate('https://example.com');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'domcontentloaded'
      });
    });

    it('should return page title', async () => {
      const result = await service.navigate('https://example.com');

      expect(result.title).toBe('Test Page');
    });

    it('should return status code', async () => {
      const result = await service.navigate('https://example.com');

      expect(result.status).toBe(200);
    });

    it('should handle navigation errors', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      const result = await service.navigate('https://invalid.url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation failed');
    });

    it('should auto-initialize if not initialized', async () => {
      service.initialized = false;
      service.browser = null;

      const result = await service.navigate('https://example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('click', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should click element successfully', async () => {
      const result = await service.click('#button');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#button');
      expect(mockPage.click).toHaveBeenCalledWith('#button');
    });

    it('should handle click errors', async () => {
      mockPage.click.mockRejectedValue(new Error('Element not found'));

      const result = await service.click('#nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Click failed');
    });
  });

  describe('type', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should type text successfully', async () => {
      const result = await service.type('#input', 'Hello World');

      expect(result.success).toBe(true);
      expect(result.textLength).toBe(11);
      expect(mockPage.fill).toHaveBeenCalledWith('#input', 'Hello World');
    });

    it('should handle type errors', async () => {
      mockPage.fill.mockRejectedValue(new Error('Input not found'));

      const result = await service.type('#nonexistent', 'text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Type failed');
    });
  });

  describe('fillForm', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fill multiple fields successfully', async () => {
      const fields = {
        '#name': 'John Doe',
        '#email': 'john@example.com'
      };

      const result = await service.fillForm(fields);

      expect(result.success).toBe(true);
      expect(result.successfulFields).toBe(2);
      expect(mockPage.fill).toHaveBeenCalledTimes(2);
    });

    it('should report partial failures', async () => {
      mockPage.fill
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Field not found'));

      const result = await service.fillForm({
        '#name': 'John',
        '#invalid': 'value'
      });

      expect(result.success).toBe(false);
      expect(result.successfulFields).toBe(1);
      expect(result.failedFields).toBe(1);
    });

    it('should include details for each field', async () => {
      const result = await service.fillForm({ '#input': 'value' });

      expect(result.details).toBeDefined();
      expect(result.details[0].selector).toBe('#input');
    });
  });

  describe('screenshot', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should take screenshot successfully', async () => {
      const result = await service.screenshot('/tmp/test.png');

      expect(result.success).toBe(true);
      expect(result.path).toBe('/tmp/test.png');
      expect(mockPage.screenshot).toHaveBeenCalled();
    });

    it('should support full page screenshot', async () => {
      const result = await service.screenshot('/tmp/test.png', { fullPage: true });

      expect(result.fullPage).toBe(true);
    });

    it('should support element screenshot', async () => {
      const mockElement = { screenshot: jest.fn() };
      mockPage.$.mockResolvedValue(mockElement);

      const result = await service.screenshot('/tmp/test.png', { selector: '#element' });

      expect(result.success).toBe(true);
      expect(mockElement.screenshot).toHaveBeenCalled();
    });

    it('should handle element not found', async () => {
      mockPage.$.mockResolvedValue(null);

      const result = await service.screenshot('/tmp/test.png', { selector: '#nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });
  });

  describe('getPageContent', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get page content successfully', async () => {
      const result = await service.getPageContent();

      expect(result.success).toBe(true);
      expect(result.content).toBe('Page content');
      expect(result.title).toBe('Test Page');
      expect(result.url).toBe('https://example.com');
    });

    it('should include content length', async () => {
      const result = await service.getPageContent();

      expect(result.contentLength).toBe(12);
    });
  });

  describe('getPageHTML', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get page HTML successfully', async () => {
      const result = await service.getPageHTML();

      expect(result.success).toBe(true);
      expect(result.html).toContain('<html>');
    });
  });

  describe('evaluate', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should evaluate JavaScript successfully', async () => {
      mockPage.evaluate.mockResolvedValue({ data: 'result' });

      const result = await service.evaluate('() => document.title');

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'result' });
    });

    it('should handle evaluation errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Script error'));

      const result = await service.evaluate('invalid script');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Evaluate failed');
    });
  });

  describe('waitFor', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should wait for element successfully', async () => {
      const result = await service.waitFor('#element');

      expect(result.success).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', {
        timeout: 10000,
        state: 'visible'
      });
    });

    it('should use custom timeout', async () => {
      const result = await service.waitFor('#element', 5000);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', {
        timeout: 5000,
        state: 'visible'
      });
    });

    it('should handle timeout errors', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

      const result = await service.waitFor('#slow-element');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Wait failed');
    });
  });

  describe('tab management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getTabs', () => {
      it('should list all tabs', async () => {
        const result = await service.getTabs();

        expect(result.success).toBe(true);
        expect(result.tabs.length).toBe(1);
        expect(result.activeTabIndex).toBe(0);
      });
    });

    describe('newTab', () => {
      it('should create new tab', async () => {
        const result = await service.newTab();

        expect(result.success).toBe(true);
        expect(service.pages.length).toBe(2);
        expect(result.tabIndex).toBe(1);
      });

      it('should navigate to URL if provided', async () => {
        const result = await service.newTab('https://example.com');

        expect(result.navigation).toBeDefined();
      });
    });

    describe('switchTab', () => {
      it('should switch to existing tab', async () => {
        await service.newTab();
        const result = await service.switchTab(0);

        expect(result.success).toBe(true);
        expect(service.currentPageIndex).toBe(0);
      });

      it('should reject invalid tab index', async () => {
        const result = await service.switchTab(99);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid tab index');
      });
    });

    describe('closeTab', () => {
      it('should close specified tab', async () => {
        await service.newTab();
        const result = await service.closeTab(1);

        expect(result.success).toBe(true);
        expect(service.pages.length).toBe(1);
      });

      it('should not close the last tab', async () => {
        const result = await service.closeTab(0);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot close the last tab');
      });

      it('should close current tab by default', async () => {
        await service.newTab();
        service.currentPageIndex = 1;

        const result = await service.closeTab();

        expect(result.success).toBe(true);
        expect(result.closedTabIndex).toBe(1);
      });
    });
  });

  describe('form interactions', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('select', () => {
      it('should select option successfully', async () => {
        const result = await service.select('#dropdown', 'option1');

        expect(result.success).toBe(true);
        expect(mockPage.selectOption).toHaveBeenCalledWith('#dropdown', 'option1');
      });
    });

    describe('check', () => {
      it('should check checkbox', async () => {
        const result = await service.check('#checkbox', true);

        expect(result.success).toBe(true);
        expect(mockPage.check).toHaveBeenCalledWith('#checkbox');
      });

      it('should uncheck checkbox', async () => {
        const result = await service.check('#checkbox', false);

        expect(result.success).toBe(true);
        expect(mockPage.uncheck).toHaveBeenCalledWith('#checkbox');
      });
    });

    describe('hover', () => {
      it('should hover over element', async () => {
        const result = await service.hover('#element');

        expect(result.success).toBe(true);
        expect(mockPage.hover).toHaveBeenCalledWith('#element');
      });
    });

    describe('press', () => {
      it('should press key', async () => {
        const result = await service.press('Enter');

        expect(result.success).toBe(true);
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
      });
    });
  });

  describe('element queries', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getAttribute', () => {
      it('should get attribute value', async () => {
        mockPage.getAttribute.mockResolvedValue('button-class');

        const result = await service.getAttribute('#button', 'class');

        expect(result.success).toBe(true);
        expect(result.value).toBe('button-class');
      });
    });

    describe('getText', () => {
      it('should get element text', async () => {
        mockPage.textContent.mockResolvedValue('Button Text');

        const result = await service.getText('#button');

        expect(result.success).toBe(true);
        expect(result.text).toBe('Button Text');
      });
    });

    describe('isVisible', () => {
      it('should check visibility', async () => {
        mockPage.isVisible.mockResolvedValue(true);

        const result = await service.isVisible('#element');

        expect(result.success).toBe(true);
        expect(result.visible).toBe(true);
      });
    });

    describe('queryAll', () => {
      it('should find all matching elements', async () => {
        mockPage.$$.mockResolvedValue([
          { textContent: jest.fn().mockResolvedValue('Item 1'), evaluate: jest.fn().mockResolvedValue('li') },
          { textContent: jest.fn().mockResolvedValue('Item 2'), evaluate: jest.fn().mockResolvedValue('li') }
        ]);

        const result = await service.queryAll('li');

        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
      });
    });
  });

  describe('navigation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('goBack', () => {
      it('should go back in history', async () => {
        const result = await service.goBack();

        expect(result.success).toBe(true);
        expect(mockPage.goBack).toHaveBeenCalled();
      });
    });

    describe('goForward', () => {
      it('should go forward in history', async () => {
        const result = await service.goForward();

        expect(result.success).toBe(true);
        expect(mockPage.goForward).toHaveBeenCalled();
      });
    });

    describe('reload', () => {
      it('should reload page', async () => {
        const result = await service.reload();

        expect(result.success).toBe(true);
        expect(mockPage.reload).toHaveBeenCalled();
      });
    });
  });

  describe('cookies', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('setCookies', () => {
      it('should set cookies', async () => {
        const cookies = [{ name: 'session', value: 'abc123' }];
        const result = await service.setCookies(cookies);

        expect(result.success).toBe(true);
        expect(mockContext.addCookies).toHaveBeenCalledWith(cookies);
      });
    });

    describe('getCookies', () => {
      it('should get cookies', async () => {
        mockContext.cookies.mockResolvedValue([{ name: 'session', value: 'abc123' }]);

        const result = await service.getCookies();

        expect(result.success).toBe(true);
        expect(result.cookies.length).toBe(1);
      });
    });

    describe('clearCookies', () => {
      it('should clear cookies', async () => {
        const result = await service.clearCookies();

        expect(result.success).toBe(true);
        expect(mockContext.clearCookies).toHaveBeenCalled();
      });
    });
  });

  describe('getPageInfo', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return page info', async () => {
      const result = await service.getPageInfo();

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(result.viewport).toEqual({ width: 1280, height: 720 });
    });
  });

  describe('close', () => {
    it('should close browser successfully', async () => {
      await service.initialize();
      const result = await service.close();

      expect(result.success).toBe(true);
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(service.initialized).toBe(false);
    });

    it('should clean up state', async () => {
      await service.initialize();
      await service.close();

      expect(service.browser).toBeNull();
      expect(service.context).toBeNull();
      expect(service.pages).toEqual([]);
    });
  });

  describe('configure', () => {
    it('should update config', async () => {
      const result = await service.configure({ headless: false });

      expect(result.success).toBe(true);
      expect(service.config.headless).toBe(false);
    });

    it('should restart browser if was initialized', async () => {
      await service.initialize();
      const result = await service.configure({ headless: false });

      expect(result.success).toBe(true);
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});
