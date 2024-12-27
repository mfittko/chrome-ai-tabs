// options.js

function saveApiKey() {
  const apiKey = document.getElementById('apiKeyInput').value;
  chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
    console.log('API key saved!');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveButton').addEventListener('click', saveApiKey);
});
