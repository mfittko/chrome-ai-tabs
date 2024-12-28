// options.js

function saveOptions() {
  const apiKey = document.getElementById('apiKeyInput').value;
  const model = document.getElementById('modelInput').value;
  const categories = document.getElementById('categoriesInput').value.split(',');

  chrome.storage.sync.set({
    openaiApiKey: apiKey,
    openaiModel: model,
    preConfiguredCategories: categories
  }, () => {
    console.log('Options saved!');
  });
}

function restoreOptions() {
  chrome.storage.sync.get(['openaiApiKey', 'openaiModel', 'preConfiguredCategories'], (items) => {
    document.getElementById('apiKeyInput').value = items.openaiApiKey || '';
    document.getElementById('modelInput').value = items.openaiModel || '';
    document.getElementById('categoriesInput').value = items.preConfiguredCategories ? items.preConfiguredCategories.join(',') : '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();
  document.getElementById('saveButton').addEventListener('click', saveOptions);
});
