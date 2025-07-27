import 'jest-chrome';

// Setup all Chrome API mocks before importing the tested module
chrome.windows = {
  ...chrome.windows,
  getCurrent: jest.fn()
};

chrome.tabs = {
  ...chrome.tabs,
  query: jest.fn(),
  group: jest.fn(),
  update: jest.fn()
};

chrome.tabGroups = {
  ...chrome.tabGroups,
  update: jest.fn(),
  TAB_GROUP_ID_NONE: -1
};

// Mock implementation for chrome.windows.getCurrent
chrome.windows.getCurrent.mockImplementation((options, callback) => {
  const mockWindow = {
    id: 1,
    focused: true,
    tabs: [
      { id: 1, url: 'https://example.com', title: 'Example', groupId: -1 },
      { id: 2, url: 'https://test.com', title: 'Test', groupId: -1 }
    ]
  };
  callback(mockWindow);
});

// Import tested module after setting up all mocks
import { categorizeTab, getApiKey, getModel, __test_exports } from '../background.js';

const { handleTabUpdated, groupTab } = __test_exports;

describe('background.js', () => {
  beforeEach(() => {
    // Reset all mocks
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.windows.getCurrent.mockReset();
    chrome.tabs.query.mockReset();
    chrome.tabs.group.mockReset();
    chrome.tabs.update.mockReset();
    chrome.tabGroups.update.mockReset();
    chrome.windows.getCurrent.mockImplementation((options, callback) => {
      const mockWindow = {
        id: 1,
        focused: true,
        tabs: [
          { id: 1, url: 'https://example.com', title: 'Example', groupId: -1 },
          { id: 2, url: 'https://test.com', title: 'Test', groupId: -1 }
        ]
      };
      callback(mockWindow);
    });
    global.fetch?.mockReset();
  });

  it('should not throw on load', () => {
    expect(() => {
      require('../background.js');
    }).not.toThrow();
  });

  it('should categorize tab correctly', async () => {
    const mockApiKey = 'test-api-key';
    const mockModel = 'gpt-4o-mini';
    const mockCategories = ['News', 'Sports', 'Entertainment'];
    const mockUrl = 'https://example.com';
    const mockTitle = 'Example Title';
    const mockResponse = {
      choices: [{ message: { content: 'News' } }]
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResponse)
      })
    );

    // Mock storage.sync.get implementations
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (keys[0] === 'openaiApiKey') {
        callback({ openaiApiKey: mockApiKey });
      } else if (keys[0] === 'openaiModel') {
        callback({ openaiModel: mockModel });
      }
    });

    const category = await categorizeTab(mockUrl, mockTitle, mockCategories);
    expect(category).toBe('News');
  });

  it('should get API key from storage', async () => {
    const mockApiKey = 'test-api-key';
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ openaiApiKey: mockApiKey });
    });

    const apiKey = await getApiKey();
    expect(apiKey).toBe(mockApiKey);
  });

  it('should get model from storage', async () => {
    const mockModel = 'gpt-4o-mini';
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ openaiModel: mockModel });
    });

    const model = await getModel();
    expect(model).toBe(mockModel);
  });

  it('should categorize updated tab correctly', async () => {
    const mockApiKey = 'test-api-key';
    const mockModel = 'gpt-4o-mini';
    const mockCategories = ['News', 'Sports', 'Entertainment'];
    const mockUrl = 'https://example.com';
    const mockTitle = 'Example Title';
    const mockResponse = {
      choices: [{ message: { content: 'News' } }]
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResponse)
      })
    );

    // Mock storage.sync.get implementations
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (keys[0] === 'openaiApiKey') {
        callback({ openaiApiKey: mockApiKey });
      } else if (keys[0] === 'openaiModel') {
        callback({ openaiModel: mockModel });
      }
    });

    const mockTab = { id: 1, url: mockUrl, title: mockTitle };
    const mockChangeInfo = { url: mockUrl };

    await handleTabUpdated(mockTab.id, mockChangeInfo, mockTab);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('should group ungrouped tabs correctly', async () => {
    const mockTab = { id: 1, url: 'https://example.com', title: 'Example Title', groupId: chrome.tabGroups.TAB_GROUP_ID_NONE };
    const mockGroupId = 100;

    chrome.windows.getCurrent.mockImplementation((options, callback) => {
      callback({
        tabs: [mockTab]
      });
    });

    chrome.tabs.group.mockImplementation((options, callback) => {
      callback(mockGroupId);
    });

    await handleTabUpdated(mockTab);

    expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: mockTab.id }, expect.any(Function));
    expect(chrome.tabGroups.update).toHaveBeenCalledWith(mockGroupId, { title: expect.any(String) });
  });
});
