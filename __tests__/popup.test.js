import { JSDOM } from 'jsdom';

describe('popup.js', () => {
  let dom;
  let document;

  beforeAll(() => {
    // Mock chrome APIs
    global.chrome = {
      storage: {
        sync: {
          get: jest.fn((keys, cb) => cb({ autoCategorize: true })),
          set: jest.fn((data, cb) => cb && cb())
        }
      },
      runtime: {
        sendMessage: jest.fn((msg, cb) => cb && cb('OK'))
      }
    };

    // Create DOM
    dom = new JSDOM(`
      <html>
        <body>
          <input type="checkbox" id="toggleCategorization"/>
          <button id="regroupBtn"></button>
          <div id="statusMessage"></div>
          <script></script>
        </body>
      </html>
    `);
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;

    // Load popup.js
    require('../popup/popup.js');
  });

  test('loads saved settings', () => {
    const checkbox = document.getElementById('toggleCategorization');
    const statusMessage = document.getElementById('statusMessage');
    expect(checkbox.checked).toBe(true);
    expect(statusMessage.textContent).toBe('Auto-categorization is ON');
  });

  test('toggles auto-categorization', () => {
    const checkbox = document.getElementById('toggleCategorization');
    checkbox.checked = false;
    checkbox.dispatchEvent(new dom.window.Event('change'));
    expect(global.chrome.storage.sync.set).toHaveBeenCalledWith(
      { autoCategorize: false },
      expect.any(Function)
    );
  });

  test('sends a regroup message', () => {
    const btn = document.getElementById('regroupBtn');
    const statusMessage = document.getElementById('statusMessage');
    btn.click();
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'RE_CATEGORIZE_ALL' },
      expect.any(Function)
    );
    expect(statusMessage.textContent).toBe('Tabs regrouped!');
  });
});
