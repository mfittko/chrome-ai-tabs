import { JSDOM } from 'jsdom';
import 'jest-chrome';

describe('popup.js', () => {
let dom;
let initialize;

beforeAll(async () => {
    // Mock chrome storage API
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      const mockStorage = {
        autoCategorize: true
      };
      cb(keys.reduce((acc, key) => {
        if (mockStorage[key] !== undefined) {
          acc[key] = mockStorage[key];
        }
        return acc;
      }, {}));
    });

    // Set up DOM with test content
    dom = new JSDOM(`<!DOCTYPE html>
    <html>
        <head>
        <title>AI Tab Manager</title>
        </head>
        <body>
        <div class="container">
            <div id="header">
            <h2>AI Tab Manager</h2>
            </div>
            <div class="controls">
            <div class="toggle-group">
                <input type="checkbox" id="toggleCategorization" />
                <label for="toggleCategorization">Auto-categorize new tabs</label>
            </div>
            <button id="regroupBtn">Regroup All Tabs</button>
            </div>
            <div id="statusMessage"></div>
        </div>
        </body>
    </html>`, {
      url: 'http://localhost',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true
    });

    // Wait for JSDOM to finish loading
    await new Promise(resolve => {
    dom.window.addEventListener('load', resolve);
    });

    // Import popup module after setting up globals
    const popupModule = await import('../popup/popup.js');
    initialize = popupModule.initialize;

    console.log('Document context:', document === global.document ? 'same' : 'different');
    console.log('Window context:', window === global.window ? 'same' : 'different');

    // Set up mock implementations
    chrome.storage.sync.set.mockImplementation((data, cb) => {
    cb && cb();
    });

    chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
    cb && cb('OK');
    });

    // Add delay before initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('DOM elements before initialization:');
    console.log('toggleCategorization:', dom.window.document.getElementById('toggleCategorization'));
    console.log('regroupBtn:', dom.window.document.getElementById('regroupBtn'));
    console.log('statusMessage:', dom.window.document.getElementById('statusMessage'));

    try {
    await initialize(dom.window.document);
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      throw error;
    }
  });

afterEach(() => {
    // Reset chrome API mocks
    chrome.storage.sync.get.mockClear();
    chrome.storage.sync.set.mockClear();
    chrome.runtime.sendMessage.mockClear();

    // Reset DOM content using the correct document context
    const statusMessage = dom.window.document.getElementById('statusMessage');
    if (statusMessage) {
    statusMessage.textContent = '';
    }
});

  afterAll(() => {
    // Clean up window and document globals
    delete global.window;
    delete global.document;
    dom.window.close();
  });

test('loads saved settings', async () => {
    const checkbox = dom.window.document.getElementById('toggleCategorization');
    const statusMessage = dom.window.document.getElementById('statusMessage');
    expect(checkbox.checked).toBe(true);
    expect(statusMessage.textContent).toBe('Auto-categorization is ON');
});

test('toggles auto-categorization', async () => {
    const checkbox = dom.window.document.getElementById('toggleCategorization');
    // Use the change event instead of click since we're listening for change
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new dom.window.Event('change'));
    await Promise.resolve();  // Wait for next tick
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
    { autoCategorize: false },
    expect.any(Function)
    );
});

test('sends a regroup message', async () => {
const btn = dom.window.document.getElementById('regroupBtn');
const statusMessage = dom.window.document.getElementById('statusMessage');
  // Trigger click and wait for async operations
  btn.dispatchEvent(new dom.window.Event('click'));
  await Promise.resolve(); // Wait for next tick
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'RE_CATEGORIZE_ALL' },
      expect.any(Function)
  );
  expect(statusMessage.textContent).toBe('Tabs regrouped!');
  });
});
