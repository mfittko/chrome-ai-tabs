import 'jest-chrome';
import { initialize, saveOptions, restoreOptions } from '../options/options.js';

describe('options.js', () => {
beforeEach(async () => {
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
    <button id="saveButton">Save</button>
    `;
    // Initialize options page
    await initialize();
});

afterEach(() => {
    jest.clearAllMocks();
});

it('should save options to chrome storage', async () => {
    // Mock chrome storage set to return a promise
    chrome.storage.local.set.mockImplementation((data, callback) => {
    callback();
    return Promise.resolve();
    });

    // Set input values
    document.getElementById('apiKeyInput').value = 'test-api-key';
    document.getElementById('modelInput').value = 'test-model';

    // Trigger save
    const saveButton = document.getElementById('saveButton');
    await new Promise(resolve => {
    chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
        resolve();
    });
    saveButton.click();
    });

    // Verify storage was updated
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
    openaiApiKey: 'test-api-key',
    openaiModel: 'test-model',
    }, expect.any(Function));
});

  it('should restore options from chrome storage', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        openaiApiKey: 'restored-api-key',
        openaiModel: 'restored-model',
      });
    });

    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(document.getElementById('apiKeyInput').value).toBe('restored-api-key');
    expect(document.getElementById('modelInput').value).toBe('restored-model');
  });
});