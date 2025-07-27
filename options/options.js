// options.js

export function saveOptions() {
const apiKey = document.getElementById('apiKeyInput').value;
const model = document.getElementById('modelInput').value;
const categories = document.getElementById('categoriesInput').value.split(',');

chrome.storage.local.set({
    openaiApiKey: apiKey,
    openaiModel: model,
    preConfiguredCategories: categories
}, () => {
    console.log('Options saved!');
});
}

export function restoreOptions() {
return new Promise((resolve) => {
    chrome.storage.local.get(['openaiApiKey', 'openaiModel', 'preConfiguredCategories'], (items) => {
    document.getElementById('apiKeyInput').value = items.openaiApiKey || '';
    document.getElementById('modelInput').value = items.openaiModel || '';
    document.getElementById('categoriesInput').value = items.preConfiguredCategories ? items.preConfiguredCategories.join(',') : '';
    resolve(items);
    });
});
}

export function initialize() {
restoreOptions();
document.getElementById('saveButton').addEventListener('click', saveOptions);
}

// Only run in browser context
if (typeof window !== 'undefined' && window.document) {
document.addEventListener('DOMContentLoaded', initialize);
}

// Export for testing
export default {
saveOptions,
restoreOptions,
initialize
};
