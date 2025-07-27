import { timestamp, shouldSkipTab } from './utils.js';
import { getApiKey, getModel, getCategories, getMetaTags } from './api.js';
import { categorizeTab, categorizeAndGroupUngroupedTabs, groupTab } from './categorization.js';

function initialize() {
  chrome.storage.local.remove(['categoryCache', 'leftoverTabsCache', 'embeddingsCache'], () => {
    if (chrome.runtime.lastError) {
      console.error(timestamp(), 'Failed to clear caches:', chrome.runtime.lastError);
    } else {
      console.log(timestamp(), 'Caches cleared.');
    }
  });

  chrome.tabs.onUpdated.hasListener(handleTabUpdated) || chrome.tabs.onUpdated.addListener(handleTabUpdated);

  if (typeof chrome !== 'undefined' && chrome.windows && chrome.tabGroups) {
    groupTabsInCurrentWindow();
  }
}

function groupTabsInCurrentWindow() {
  chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
    if (currentWindow.type !== 'normal' || currentWindow.state === 'fullscreen' || currentWindow.state === 'minimized') {
      console.log(timestamp(), 'Skipping grouping for non-normal or standalone window.');
      return;
    }

    const existingGroups = new Map();
    const ungroupedTabs = [];

    // Collect existing groups and ungrouped tabs
    currentWindow.tabs.forEach(tab => {
      if (tab.pinned) return; // Skip pinned tabs
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        if (!existingGroups.has(tab.groupId)) {
          existingGroups.set(tab.groupId, []);
        }
        existingGroups.get(tab.groupId).push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

    categorizeAndGroupUngroupedTabs(ungroupedTabs);
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(() => {
    console.log(timestamp(), 'Tab Grouper Extension installed.');
    initialize();
  });
}

async function handleTabUpdated(tabId, changeInfo, tab) {
  console.debug(timestamp(), 'Tab updated:', tabId, changeInfo, tab);
  if (!changeInfo.status || changeInfo.status !== 'complete') return;
  const skip = await shouldSkipTab(tab);
  if (skip) return;

  const autoCategorize = await new Promise((resolve) => {
    chrome.storage.local.get(['autoCategorize'], (result) => {
      resolve(result.autoCategorize);
    });
  });

  if (!autoCategorize) {
    console.log(timestamp(), 'Auto-categorization is turned off.');
    return;
  }

  console.log(timestamp(), `Handling updated tab: URL=${tab.url}, Title=${tab.title}`);
  await groupTabByCategory(tabId, tab.url, tab.title);
}

async function groupTabByCategory(tabId, url, title) {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  console.log(timestamp(), 'Fetching categories...');
  const categories = await getCategories();
  if (categories.length === 0) {
    console.log(timestamp(), 'No categories available.');
    return;
  }
  console.log(timestamp(), 'Categories fetched: ' + categories.join(', '));

  const metaTags = await getMetaTags(tabId, url);
  console.log(timestamp(), 'Categorizing tab...');
  const category = await categorizeTab(url, title, metaTags, categories);
  console.log(timestamp(), 'Tab categorized as: ' + category);

  if (!category) {
    console.log(timestamp(), 'Tab could not be categorized. Regrouping ungrouped tabs...');
    await groupUngroupedTabs();
    return;
  }

  // Load the last assigned category from local cache, skip if unchanged
  const lastCategory = await new Promise((resolve) => {
    chrome.storage.local.get(['tabCategoryAssignments'], (res) => {
      const assignments = res.tabCategoryAssignments || {};
      resolve(assignments[tabId]);
    });
  });

  if (lastCategory === category) {
    console.log(timestamp(), `Tab ${tabId} already assigned category '${category}'. Skipping re-grouping.`);
    return;
  }

  // Proceed with grouping and save new assignment
  console.log(timestamp(), 'Grouping tab...');
  const grouped = await groupTab(tabId, category);
  console.log(timestamp(), grouped ? 'Tab grouped.' : 'Tab grouping failed.');

  if (grouped) {
    chrome.storage.local.get(['tabCategoryAssignments'], (res) => {
      const assignments = res.tabCategoryAssignments || {};
      assignments[tabId] = category;
      chrome.storage.local.set({ tabCategoryAssignments: assignments });
    });
  }
}

async function getUngroupedTabs() {
  return new Promise((resolve) => {
    chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
      if (currentWindow.type !== 'normal' || currentWindow.state === 'fullscreen' || currentWindow.state === 'minimized') {
        console.log(timestamp(), 'Skipping fetching ungrouped tabs for non-normal or standalone window.');
        resolve([]);
        return;
      }
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const ungroupedTabs = tabs.filter(tab => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE && !tab.pinned);
        resolve(ungroupedTabs);
      });
    });
  });
}

async function groupUngroupedTabs() {
  const ungroupedTabs = await getUngroupedTabs();
  const newCategory = await categorizeAndGroupUngroupedTabs(ungroupedTabs);
  if (newCategory) {
    console.log(timestamp(), 'New category created and tabs grouped.');
  } else {
    console.log(timestamp(), 'No suitable category found for the ungrouped tabs.');
  }
}

function regroupAllTabs() {
  console.log(timestamp(), 'Regrouping all tabs...');
  chrome.storage.local.set({ leftoverTabsCache: [] }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to reset leftoverTabsCache:', chrome.runtime.lastError);
      return;
    }
    chrome.tabs.query({ active: true }, (tabs) => {
      tabs.forEach(tab => {
        if (shouldSkipTab(tab)) return;

        groupTabByCategory(tab.id, tab.url, tab.title);
      });
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.type === 'regroupTabs') {
    console.log('Triggering regroupAllTabs...');
    regroupAllTabs();
    sendResponse({ status: 'success' });
  } else {
    console.log('Unknown message type:', message.type);
  }
});

if (typeof chrome !== 'undefined' && chrome.runtime) {
  initialize();
}

const __test_exports = {
  handleTabUpdated,
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
