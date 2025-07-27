// Functions for testing
export async function loadSettings(toggleCategorization, statusMessage) {
try {
    const result = await new Promise((resolve, reject) => {
    chrome.storage.local.get(['autoCategorize'], (result) => {
        if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        } else {
        resolve(result);
        }
    });
    });

    toggleCategorization.checked = !!result.autoCategorize;
    statusMessage.textContent = `Auto-categorization is ${toggleCategorization.checked ? 'ON' : 'OFF'}`;
    return result;
} catch (error) {
    console.error('Failed to load settings:', error);
    statusMessage.textContent = 'Failed to load settings';
    throw error;
}
}

export async function saveSettings(isChecked, statusMessage) {
try {
    await new Promise((resolve, reject) => {
    chrome.storage.local.set({ autoCategorize: isChecked }, () => {
        if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        } else {
        resolve();
        }
    });
    });

    console.log('Auto-categorization set to', isChecked);
    statusMessage.textContent = `Auto-categorization is ${isChecked ? 'ON' : 'OFF'}`;
} catch (error) {
    console.error('Failed to save settings:', error);
    statusMessage.textContent = 'Failed to save settings';
    throw error;
}
}

export async function regroupTabs(statusMessage) {
try {
    console.log('Sending regroupTabs message...');
    const response = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'regroupTabs' }, (response) => {
        if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        } else {
        resolve(response);
        }
    });
    });

    console.log('Regroup request sent. Response:', response);
    statusMessage.textContent = 'Tabs regrouped!';
    return response;
} catch (error) {
    console.error('Failed to regroup tabs:', error);
    statusMessage.textContent = 'Failed to regroup tabs';
    throw error;
}
}

export function initialize() {
    const toggleCategorization = document.getElementById('toggleCategorization');
    const regroupBtn = document.getElementById('regroupBtn');
    const statusMessage = document.getElementById('statusMessage');
    const defaultDescriptionInput = document.getElementById('defaultDescription');
    const saveButton = document.getElementById('save');
    
    console.log('Using provided document:', document ? 'global' : 'custom');

console.log('Element details:', {
    toggleCategorization: toggleCategorization ? {
        tagName: toggleCategorization.tagName,
        id: toggleCategorization.id,
        type: toggleCategorization.type
    } : null,
    regroupBtn: regroupBtn ? {
        tagName: regroupBtn.tagName,
        id: regroupBtn.id
    } : null,
    statusMessage: statusMessage ? {
        tagName: statusMessage.tagName,
        id: statusMessage.id
    } : null,
    defaultDescriptionInput: defaultDescriptionInput ? {
        tagName: defaultDescriptionInput.tagName,
        id: defaultDescriptionInput.id
    } : null,
    saveButton: saveButton ? {
        tagName: saveButton.tagName,
        id: saveButton.id
    } : null
});

const missingElements = [];
if (!toggleCategorization) missingElements.push('toggleCategorization');
if (!regroupBtn) missingElements.push('regroupBtn');
if (!statusMessage) missingElements.push('statusMessage');
if (!defaultDescriptionInput) missingElements.push('defaultDescriptionInput');
if (!saveButton) missingElements.push('saveButton');

if (missingElements.length > 0) {
    throw new Error(`Required DOM elements not found: ${missingElements.join(', ')}`);
}

// Load initial settings
loadSettings(toggleCategorization, statusMessage).catch(console.error);

// Set up event listeners
toggleCategorization.addEventListener('change', () => {
    saveSettings(toggleCategorization.checked, statusMessage).catch(console.error);
});

regroupBtn.addEventListener('click', () => {
    regroupTabs(statusMessage).catch(console.error);
});

saveButton.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        const domain = new URL(tab.url).hostname;
        const defaultDescription = defaultDescriptionInput.value;

        chrome.storage.local.set({ [domain]: defaultDescription }, function () {
            console.log('Default description saved for', domain);
        });
    });
});

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    const domain = new URL(tab.url).hostname;

    chrome.storage.local.get(domain, function (data) {
        if (data[domain]) {
            defaultDescriptionInput.value = data[domain];
        }
    });
});

console.log('Popup Initialization complete.');

return {
    toggleCategorization,
    regroupBtn,
    statusMessage,
    defaultDescriptionInput,
    saveButton
};
}

// Only run initialization in browser context
if (typeof window !== 'undefined' && typeof jest === 'undefined') {
  document.addEventListener('DOMContentLoaded', initialize);
}
