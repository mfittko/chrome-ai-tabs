import 'jest-chrome';

describe('options.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label>
        OpenAI API Key:
        <input type="text" id="apiKeyInput" />
      </label>
      <br />
      <label>
        OpenAI Model:
        <input type="text" id="modelInput" />
      </label>
      <br />
      <label>
        Pre-configured Categories (comma-separated):
        <input type="text" id="categoriesInput" />
      </label>
      <br />
      <button id="saveButton">Save</button>
    `;
    require('../options/options.js');
  });

  it('should save options to chrome storage', () => {
    document.getElementById('apiKeyInput').value = 'test-api-key';
    document.getElementById('modelInput').value = 'test-model';
    document.getElementById('categoriesInput').value = 'category1,category2';

    document.getElementById('saveButton').click();

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      openaiApiKey: 'test-api-key',
      openaiModel: 'test-model',
      preConfiguredCategories: ['category1', 'category2']
    }, expect.any(Function));
  });

  it('should restore options from chrome storage', () => {
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        openaiApiKey: 'restored-api-key',
        openaiModel: 'restored-model',
        preConfiguredCategories: ['restored-category1', 'restored-category2']
      });
    });

    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(document.getElementById('apiKeyInput').value).toBe('restored-api-key');
    expect(document.getElementById('modelInput').value).toBe('restored-model');
    expect(document.getElementById('categoriesInput').value).toBe('restored-category1,restored-category2');
  });
});