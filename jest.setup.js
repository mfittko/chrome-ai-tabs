import 'jest-chrome'

// Initialize chrome API mocks
global.chrome = {
runtime: {
    onInstalled: {
    addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    },
},
storage: {
    sync: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    },
    local: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    },
},
tabs: {
    query: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    onCreated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    },
    onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    },
    onActivated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    },
},
tabGroups: {
    query: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
},
}

// Set default mock implementations
// Set default storage values
const defaultStorageValues = {
autoCategorize: false,
openaiApiKey: '',
openaiModel: 'gpt-3.5-turbo',
preConfiguredCategories: []
}

chrome.storage.sync.get.mockImplementation((keys, callback) => {
const result = typeof keys === 'string' 
    ? { [keys]: defaultStorageValues[keys] }
    : Array.isArray(keys)
    ? keys.reduce((acc, key) => ({ ...acc, [key]: defaultStorageValues[key] }), {})
    : defaultStorageValues
if (callback) callback(result)
return Promise.resolve(result)
})

chrome.storage.sync.set.mockImplementation((items, callback) => {
Object.assign(defaultStorageValues, items)
if (callback) callback()
return Promise.resolve()
})

chrome.runtime.sendMessage.mockImplementation((message, callback) => {
if (callback) callback()
return Promise.resolve()
})

chrome.tabs.query.mockImplementation(() => Promise.resolve([]))
chrome.tabs.get.mockImplementation(() => Promise.resolve({}))
chrome.tabs.group.mockImplementation(() => Promise.resolve(1))
chrome.tabs.create.mockImplementation(() => Promise.resolve({}))

chrome.tabGroups.query.mockImplementation(() => Promise.resolve([]))
chrome.tabGroups.update.mockImplementation(() => Promise.resolve({}))
chrome.tabGroups.create.mockImplementation(() => Promise.resolve({}))

// Reset all mocks between tests
beforeEach(() => {
jest.clearAllMocks()
})

