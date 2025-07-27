// Functions for testing
export async function loadSettings(toggleCategorization, statusMessage) {
try {
    const result = await new Promise((resolve, reject) => {
    chrome.storage.sync.get(['autoCategorize'], (result) => {
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
    chrome.storage.sync.set({ autoCategorize: isChecked }, () => {
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
    statusMessage.textContent = 'Starting tab regrouping...';
    
    const response = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'RE_CATEGORIZE_ALL' }, (response) => {
        if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        } else {
        resolve(response);
        }
    });
    });
    
    console.log('Regroup request sent. Response:', response);
    
    if (response === 'OK') {
        statusMessage.textContent = 'Tabs regrouped successfully!';
    } else {
        statusMessage.textContent = 'Regrouping completed with some issues';
    }
    
    return response;
} catch (error) {
    console.error('Failed to regroup tabs:', error);
    statusMessage.textContent = 'Failed to regroup tabs - check console for details';
    throw error;
}
}

export function initialize(doc = document) {
    const toggleCategorization = doc.getElementById('toggleCategorization');
    const regroupBtn = doc.getElementById('regroupBtn');
    const statusMessage = doc.getElementById('statusMessage');
    
    console.log('Using provided document:', doc === document ? 'global' : 'custom');

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
    } : null
});

const missingElements = [];
if (!toggleCategorization) missingElements.push('toggleCategorization');
if (!regroupBtn) missingElements.push('regroupBtn');
if (!statusMessage) missingElements.push('statusMessage');

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

return {
    toggleCategorization,
    regroupBtn,
    statusMessage
};
}

// Only run initialization in browser context
// if (typeof window !== 'undefined' && typeof jest === 'undefined') {
//   document.addEventListener('DOMContentLoaded', initialize);
// }
