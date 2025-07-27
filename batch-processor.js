/**
 * Batch Tab Processor
 * Handles efficient collection and metadata extraction for multiple tabs
 */

/**
 * Collects all tabs from a specific window (or current window if not specified)
 * @param {number} windowId - Optional window ID, defaults to current window
 * @returns {Promise<Array>} Array of tab objects
 */
async function collectAllTabs(windowId = null) {
  return new Promise((resolve) => {
    const query = windowId ? { windowId } : { currentWindow: true };
    chrome.tabs.query(query, (tabs) => {
      resolve(tabs || []);
    });
  });
}

/**
 * Determines if a tab should be included in batch processing
 * @param {Object} tab - Chrome tab object
 * @returns {boolean} True if tab should be processed
 */
function shouldIncludeTab(tab) {
  if (!tab.url || !tab.title) {
    return false;
  }
  
  // Skip internal Chrome pages and extensions
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return false;
  }
  
  // Skip empty or loading pages
  if (tab.title === 'Loading...' || tab.title === '') {
    return false;
  }
  
  return true;
}

/**
 * Extracts metadata for a single tab
 * @param {Object} tab - Chrome tab object
 * @returns {Object} Tab metadata object
 */
function extractTabMetadata(tab) {
  try {
    const url = new URL(tab.url);
    
    return {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      domain: url.hostname,
      protocol: url.protocol,
      pathname: url.pathname,
      search: url.search,
      favicon: tab.favIconUrl || '',
      pinned: tab.pinned || false,
      discarded: tab.discarded || false,
      status: tab.status || 'complete'
    };
  } catch (error) {
    console.warn(`Failed to extract metadata for tab ${tab.id}:`, error);
    // Return basic metadata if URL parsing fails
    return {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      domain: 'unknown',
      protocol: 'unknown',
      pathname: '',
      search: '',
      favicon: tab.favIconUrl || '',
      pinned: tab.pinned || false,
      discarded: tab.discarded || false,
      status: tab.status || 'complete'
    };
  }
}

/**
 * Attempts to extract meta description from a tab's page
 * Note: This requires content script injection which needs permissions
 * For now, we'll return empty description but leave infrastructure for future enhancement
 * @param {Object} tab - Chrome tab object
 * @returns {Promise<string>} Meta description or empty string
 */
async function extractMetaDescription(tab) {
  try {
    // TODO: Implement content script injection to extract meta tags
    // This would require additional permissions in manifest.json
    // For now, return empty string to avoid errors
    return '';
  } catch (error) {
    console.warn(`Failed to extract meta description for tab ${tab.id}:`, error);
    return '';
  }
}

/**
 * Batch processes multiple tabs to extract metadata
 * @param {Array} tabs - Array of Chrome tab objects
 * @returns {Promise<Array>} Array of processed tab metadata objects
 */
async function batchExtractMetaTags(tabs) {
  const validTabs = tabs.filter(shouldIncludeTab);
  
  console.log(`Processing metadata for ${validTabs.length} tabs`);
  
  const processedTabs = [];
  
  // Process tabs in parallel for better performance
  const metadataPromises = validTabs.map(async (tab) => {
    const metadata = extractTabMetadata(tab);
    const description = await extractMetaDescription(tab);
    
    return {
      ...metadata,
      description
    };
  });
  
  try {
    const results = await Promise.all(metadataPromises);
    processedTabs.push(...results);
  } catch (error) {
    console.error('Error processing metadata in batch:', error);
    // Fallback to individual processing if batch fails
    for (const tab of validTabs) {
      try {
        const metadata = extractTabMetadata(tab);
        const description = await extractMetaDescription(tab);
        processedTabs.push({ ...metadata, description });
      } catch (tabError) {
        console.warn(`Failed to process tab ${tab.id}, skipping:`, tabError);
      }
    }
  }
  
  console.log(`Successfully processed ${processedTabs.length} tabs`);
  return processedTabs;
}

/**
 * Main function to collect and process all tabs in a window
 * @param {number} windowId - Optional window ID
 * @returns {Promise<Array>} Array of processed tab metadata
 */
async function collectAndProcessTabs(windowId = null) {
  try {
    console.log('Starting tab collection and processing...');
    
    const tabs = await collectAllTabs(windowId);
    console.log(`Found ${tabs.length} total tabs`);
    
    const processedTabs = await batchExtractMetaTags(tabs);
    console.log(`Processed ${processedTabs.length} valid tabs`);
    
    return processedTabs;
  } catch (error) {
    console.error('Failed to collect and process tabs:', error);
    throw error;
  }
}

// Export functions for testing and module usage
const __test_exports = {
  collectAllTabs,
  shouldIncludeTab,
  extractTabMetadata,
  extractMetaDescription,
  batchExtractMetaTags,
  collectAndProcessTabs
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    collectAllTabs,
    shouldIncludeTab,
    extractTabMetadata,  
    batchExtractMetaTags,
    collectAndProcessTabs,
    __test_exports
  };
}