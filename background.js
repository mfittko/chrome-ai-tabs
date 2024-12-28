// Export key functions for testing
function initialize() {
  chrome.tabs.onCreated.addListener(handleNewTab);
};

// Only run initialization code when in browser extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
chrome.runtime.onInstalled.addListener(() => {
    console.log('Tab Grouper Extension installed.');
    initialize();
});
}

async function handleNewTab(tab) {
  const tabUrl = tab.url;
  const tabTitle = tab.title;
  if (!tabUrl || !tabTitle) return;

  const categories = await getCategories();
  const category = await categorizeTab(tabUrl, tabTitle, categories);

  if (category) {
    groupTab(tab.id, category);
  }
}

function getCategories() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['preConfiguredCategories'], (items) => {
      resolve(items.preConfiguredCategories || []);
    });
  });
}

async function categorizeTab(url, title, categories) {
const apiKey = await getApiKey();
const model = await getModel();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: `Categorize the following URL and title into one of these categories: ${categories.join(', ')}`
        },
        {
          role: 'user',
          content: `URL: ${url}\nTitle: ${title}\nCategory:`
        }
      ],
      max_tokens: 10
    })
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function getApiKey() {
return new Promise((resolve) => {
    chrome.storage.sync.get(['openaiApiKey'], (items) => {
    resolve(items.openaiApiKey || '');
    });
});
}

function getModel() {
return new Promise((resolve) => {
    chrome.storage.sync.get(['openaiModel'], (items) => {
    resolve(items.openaiModel || 'gpt-4o-mini');
    });
});
}

function groupTab(tabId, category) {
  chrome.tabs.group({ tabIds: tabId }, (groupId) => {
    chrome.tabGroups.update(groupId, { title: category });
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
initialize();
}

const __test_exports = {
handleNewTab,
getCategories,
groupTab
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initialize,
    categorizeTab,
    getApiKey,
    getModel,
    __test_exports
  };
}
