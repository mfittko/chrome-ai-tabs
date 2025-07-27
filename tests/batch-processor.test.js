import 'jest-chrome';
import { __test_exports } from '../batch-processor.js';

const { 
  collectAllTabs, 
  shouldIncludeTab, 
  extractTabMetadata, 
  batchExtractMetaTags,
  collectAndProcessTabs 
} = __test_exports;

describe('batch-processor.js', () => {
  beforeEach(() => {
    // Reset all mocks
    chrome.tabs.query.mockReset();
  });

  describe('collectAllTabs', () => {
    it('should collect all tabs from current window', async () => {
      const mockTabs = [
        { id: 1, title: 'Tab 1', url: 'https://example1.com' },
        { id: 2, title: 'Tab 2', url: 'https://example2.com' }
      ];
      
      chrome.tabs.query.mockImplementation((query, callback) => {
        expect(query).toEqual({ currentWindow: true });
        callback(mockTabs);
      });

      const tabs = await collectAllTabs();
      expect(tabs).toEqual(mockTabs);
    });

    it('should collect tabs from specific window', async () => {
      const mockTabs = [{ id: 1, title: 'Tab 1', url: 'https://example.com' }];
      const windowId = 123;
      
      chrome.tabs.query.mockImplementation((query, callback) => {
        expect(query).toEqual({ windowId: 123 });
        callback(mockTabs);
      });

      const tabs = await collectAllTabs(windowId);
      expect(tabs).toEqual(mockTabs);
    });
  });

  describe('shouldIncludeTab', () => {
    it('should include valid tabs', () => {
      const validTab = {
        url: 'https://example.com',
        title: 'Example Site'
      };
      
      expect(shouldIncludeTab(validTab)).toBe(true);
    });

    it('should exclude chrome:// URLs', () => {
      const chromeTab = {
        url: 'chrome://settings/',
        title: 'Settings'
      };
      
      expect(shouldIncludeTab(chromeTab)).toBe(false);
    });

    it('should exclude chrome-extension:// URLs', () => {
      const extensionTab = {
        url: 'chrome-extension://abc123/popup.html',
        title: 'Extension'
      };
      
      expect(shouldIncludeTab(extensionTab)).toBe(false);
    });

    it('should exclude tabs without URL or title', () => {
      expect(shouldIncludeTab({ url: '', title: 'Title' })).toBe(false);
      expect(shouldIncludeTab({ url: 'https://example.com', title: '' })).toBe(false);
      expect(shouldIncludeTab({ title: 'Loading...' })).toBe(false);
    });
  });

  describe('extractTabMetadata', () => {
    it('should extract metadata from valid tab', () => {
      const tab = {
        id: 123,
        title: 'Example Site',
        url: 'https://example.com/path?param=value',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        discarded: false,
        status: 'complete'
      };

      const metadata = extractTabMetadata(tab);
      
      expect(metadata).toEqual({
        id: 123,
        title: 'Example Site',
        url: 'https://example.com/path?param=value',
        domain: 'example.com',
        protocol: 'https:',
        pathname: '/path',
        search: '?param=value',
        favicon: 'https://example.com/favicon.ico',
        pinned: false,
        discarded: false,
        status: 'complete'
      });
    });

    it('should handle tabs with invalid URLs gracefully', () => {
      const tab = {
        id: 123,
        title: 'Invalid URL Tab',
        url: 'not-a-valid-url',
        status: 'complete'
      };

      const metadata = extractTabMetadata(tab);
      
      expect(metadata.id).toBe(123);
      expect(metadata.title).toBe('Invalid URL Tab');
      expect(metadata.domain).toBe('unknown');
      expect(metadata.protocol).toBe('unknown');
    });
  });

  describe('batchExtractMetaTags', () => {
    it('should process valid tabs and filter invalid ones', async () => {
      const tabs = [
        { id: 1, title: 'Valid Tab', url: 'https://example.com' },
        { id: 2, title: 'Chrome Tab', url: 'chrome://settings/' },
        { id: 3, title: 'Another Valid Tab', url: 'https://github.com' }
      ];

      const processedTabs = await batchExtractMetaTags(tabs);
      
      expect(processedTabs).toHaveLength(2);
      expect(processedTabs[0].id).toBe(1);
      expect(processedTabs[0].domain).toBe('example.com');
      expect(processedTabs[1].id).toBe(3);
      expect(processedTabs[1].domain).toBe('github.com');
    });

    it('should handle empty tab array', async () => {
      const processedTabs = await batchExtractMetaTags([]);
      expect(processedTabs).toEqual([]);
    });
  });

  describe('collectAndProcessTabs', () => {
    it('should collect and process tabs successfully', async () => {
      const mockTabs = [
        { id: 1, title: 'Example', url: 'https://example.com' },
        { id: 2, title: 'GitHub', url: 'https://github.com' }
      ];
      
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      const processedTabs = await collectAndProcessTabs();
      
      expect(processedTabs).toHaveLength(2);
      expect(processedTabs[0].domain).toBe('example.com');
      expect(processedTabs[1].domain).toBe('github.com');
    });
  });
});