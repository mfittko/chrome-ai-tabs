document.addEventListener('DOMContentLoaded', () => {
  const toggleCategorization = document.getElementById('toggleCategorization');
  const regroupBtn = document.getElementById('regroupBtn');
  const statusMessage = document.getElementById('statusMessage');

  // 1. Load any saved settings (e.g., autoCategorize) from storage
  chrome.storage.sync.get(['autoCategorize'], (result) => {
    toggleCategorization.checked = !!result.autoCategorize;
    statusMessage.textContent = `Auto-categorization is ${toggleCategorization.checked ? 'ON' : 'OFF'}`;
  });

  // 2. Toggle automatic categorization on checkbox change
  toggleCategorization.addEventListener('change', () => {
    const isChecked = toggleCategorization.checked;
    chrome.storage.sync.set({ autoCategorize: isChecked }, () => {
      console.log('Auto-categorization set to', isChecked);
      statusMessage.textContent = `Auto-categorization is ${isChecked ? 'ON' : 'OFF'}`;
      // Optionally show user feedback
    });
  });

  // 3. Send a "regroup" message to background.js on button click
  regroupBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'RE_CATEGORIZE_ALL' }, response => {
      console.log('Regroup request sent. Response:', response);
      statusMessage.textContent = 'Tabs regrouped!';
    });
  });
});
