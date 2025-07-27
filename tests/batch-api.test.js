import 'jest-chrome';
import { __test_exports } from '../batch-api.js';

const { 
  buildSystemPrompt, 
  buildUserPrompt, 
  sendBatchCategorizationRequest,
  getApiKeyFromStorage,
  getModelFromStorage
} = __test_exports;

describe('batch-api.js', () => {
  beforeEach(() => {
    // Reset all mocks
    chrome.storage.sync.get.mockReset();
    global.fetch?.mockReset();
  });

  describe('buildSystemPrompt', () => {
    it('should build system prompt with existing categories', () => {
      const existingCategories = ['Work', 'Entertainment', 'News'];
      const maxNewCategories = 3;
      
      const prompt = buildSystemPrompt(existingCategories, maxNewCategories);
      
      expect(prompt).toContain('Existing categories: Work, Entertainment, News');
      expect(prompt).toContain('max 3 new categories');
      expect(prompt).toContain('JSON object');
    });

    it('should handle empty categories array', () => {
      const prompt = buildSystemPrompt([], 5);
      
      expect(prompt).toContain('No existing categories defined');
      expect(prompt).toContain('max 5 new categories');
    });
  });

  describe('buildUserPrompt', () => {
    it('should build user prompt with tab data', () => {
      const tabs = [
        { id: 1, title: 'GitHub', domain: 'github.com', url: 'https://github.com' },
        { id: 2, title: 'News Article', domain: 'news.com', url: 'https://news.com/article' }
      ];
      
      const prompt = buildUserPrompt(tabs);
      
      expect(prompt).toContain('Please categorize these 2 tabs');
      expect(prompt).toContain('ID: 1, Title: "GitHub", Domain: github.com');
      expect(prompt).toContain('ID: 2, Title: "News Article", Domain: news.com');
    });
  });

  describe('sendBatchCategorizationRequest', () => {
    it('should send successful request to OpenAI', async () => {
      const tabs = [
        { id: 1, title: 'GitHub', domain: 'github.com', url: 'https://github.com' }
      ];
      const existingCategories = ['Development'];
      const apiKey = 'test-api-key';
      const model = 'gpt-4o-mini';

      const mockResponse = {
        categorizedTabs: [
          { id: 1, category: 'Development', confidence: 0.95, reasoning: 'GitHub is a development platform' }
        ],
        newCategories: [],
        summary: 'Categorized 1 tab'
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: JSON.stringify(mockResponse) } }]
          })
        })
      );

      const result = await sendBatchCategorizationRequest(tabs, existingCategories, apiKey, model);
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }
        })
      );
    });

    it('should throw error when API key is missing', async () => {
      const tabs = [{ id: 1, title: 'Test', domain: 'test.com', url: 'https://test.com' }];
      
      await expect(sendBatchCategorizationRequest(tabs, [], null, 'gpt-4o-mini'))
        .rejects.toThrow('OpenAI API key is required');
    });

    it('should throw error when no tabs provided', async () => {
      await expect(sendBatchCategorizationRequest([], [], 'api-key', 'gpt-4o-mini'))
        .rejects.toThrow('No tabs provided for categorization');
    });

    it('should handle API error response', async () => {
      const tabs = [{ id: 1, title: 'Test', domain: 'test.com', url: 'https://test.com' }];
      
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized')
        })
      );

      await expect(sendBatchCategorizationRequest(tabs, [], 'api-key', 'gpt-4o-mini'))
        .rejects.toThrow('OpenAI API error (401): Unauthorized');
    });

    it('should handle malformed JSON response', async () => {
      const tabs = [{ id: 1, title: 'Test', domain: 'test.com', url: 'https://test.com' }];
      
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'invalid json response' } }]
          })
        })
      );

      await expect(sendBatchCategorizationRequest(tabs, [], 'api-key', 'gpt-4o-mini'))
        .rejects.toThrow('Response is not valid JSON');
    });

    it('should extract JSON from wrapped response', async () => {
      const tabs = [{ id: 1, title: 'Test', domain: 'test.com', url: 'https://test.com' }];
      
      const mockResponse = {
        categorizedTabs: [{ id: 1, category: 'Test', confidence: 0.8, reasoning: 'Test site' }],
        newCategories: ['Test'],
        summary: 'Test categorization'
      };

      const wrappedResponse = `Here's the categorization: ${JSON.stringify(mockResponse)}`;

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: wrappedResponse } }]
          })
        })
      );

      const result = await sendBatchCategorizationRequest(tabs, [], 'api-key', 'gpt-4o-mini');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('storage helper functions', () => {
    it('should get API key from storage', async () => {
      const mockApiKey = 'stored-api-key';
      
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ openaiApiKey: mockApiKey });
      });

      const apiKey = await getApiKeyFromStorage();
      expect(apiKey).toBe(mockApiKey);
    });

    it('should get model from storage', async () => {
      const mockModel = 'gpt-4';
      
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ openaiModel: mockModel });
      });

      const model = await getModelFromStorage();
      expect(model).toBe(mockModel);
    });

    it('should return default model when none stored', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const model = await getModelFromStorage();
      expect(model).toBe('gpt-4o-mini');
    });
  });
});