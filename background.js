// Export key functions for testing
function initialize() {
  chrome.tabs.onCreated.addListener(handleNewTab);
  chrome.runtime.onMessage.addListener(handleMessage);
};

// Message handler for popup requests
async function handleMessage(request, sender, sendResponse) {
  if (request.action === 'RE_CATEGORIZE_ALL') {
    try {
      await regroupAllTabs();
      sendResponse('OK');
    } catch (error) {
      console.error('Failed to regroup tabs:', error);
      sendResponse('ERROR');
    }
    return true; // Keep message channel open for async response
  }
}

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
    await groupTabByCategory(tab.id, category);
  }
}

function getCategories() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['preConfiguredCategories'], (items) => {
      const categories = items.preConfiguredCategories || [];
      // If no categories are configured, provide default ones
      if (categories.length === 0) {
        const defaultCategories = [
          'Work', 'Social Media', 'News', 'Entertainment', 
          'Shopping', 'Research', 'Documentation', 'Developer Tools'
        ];
        resolve(defaultCategories);
      } else {
        resolve(categories);
      }
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

async function regroupAllTabs() {
  try {
    // Get all tabs in the current window
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ currentWindow: true }, resolve);
    });

    console.log(`Starting regrouping of ${tabs.length} tabs`);
    
    // Filter out chrome:// and chrome-extension:// pages
    const validTabs = tabs.filter(tab => {
      return tab.url && 
             !tab.url.startsWith('chrome://') && 
             !tab.url.startsWith('chrome-extension://') &&
             tab.title;
    });

    console.log(`Processing ${validTabs.length} valid tabs`);

    // Get categories
    const categories = await getCategories();
    console.log(`Using categories: ${categories.join(', ')}`);

    // Process each tab (for now, we'll do individual processing)
    for (const tab of validTabs) {
      try {
        const category = await categorizeTab(tab.url, tab.title, categories);
        if (category) {
          await groupTabByCategory(tab.id, category);
        }
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to process tab ${tab.id}:`, error);
        // Continue with other tabs even if one fails
      }
    }
    
    console.log('Regrouping completed');
  } catch (error) {
    console.error('Failed to regroup tabs:', error);
    throw error;
  }
}

async function groupTabByCategory(tabId, category) {
  return new Promise((resolve, reject) => {
    // First, try to find an existing group with this category
    chrome.tabGroups.query({}, (groups) => {
      const existingGroup = groups.find(group => group.title === category);
      
      if (existingGroup) {
        // Add tab to existing group
        chrome.tabs.group({ tabIds: tabId, groupId: existingGroup.id }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        // Create new group
        chrome.tabs.group({ tabIds: tabId }, (groupId) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            chrome.tabGroups.update(groupId, { title: category }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          }
        });
      }
    });
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
initialize();
}

const __test_exports = {
handleNewTab,
getCategories,
groupTabByCategory,
regroupAllTabs,
handleMessage
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initialize,
    categorizeTab,
    getApiKey,
    getModel,
    regroupAllTabs,
    handleMessage,
    __test_exports
  };
}
