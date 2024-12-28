import 'jest-chrome';
import { categorizeTab, getApiKey, getModel } from '../background.js';

describe('background.js', () => {
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

    chrome.storage.sync.get
      .withArgs(['openaiApiKey'])
      .yields({ openaiApiKey: mockApiKey });
    chrome.storage.sync.get
      .withArgs(['openaiModel'])
      .yields({ openaiModel: mockModel });

    const category = await categorizeTab(mockUrl, mockTitle, mockCategories);
    expect(category).toBe('News');
  });

  it('should get API key from storage', async () => {
    const mockApiKey = 'test-api-key';
    chrome.storage.sync.get.withArgs(['openaiApiKey']).yields({ openaiApiKey: mockApiKey });

    const apiKey = await getApiKey();
    expect(apiKey).toBe(mockApiKey);
  });

  it('should get model from storage', async () => {
    const mockModel = 'gpt-4o-mini';
    chrome.storage.sync.get.withArgs(['openaiModel']).yields({ openaiModel: mockModel });

    const model = await getModel();
    expect(model).toBe(mockModel);
  });
});
