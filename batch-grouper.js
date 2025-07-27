/**
 * Batch Tab Grouper
 * Handles efficient creation and management of tab groups based on categorization results
 */

/**
 * Gets all existing tab groups in the current window
 * @returns {Promise<Array>} Array of existing tab group objects
 */
async function getExistingGroups() {
  return new Promise((resolve) => {
    chrome.tabGroups.query({}, (groups) => {
      resolve(groups || []);
    });
  });
}

/**
 * Generates color assignments for categories
 * @param {Array} categories - Array of category names
 * @param {Map} existingColors - Map of existing category -> color assignments
 * @returns {Map} Map of category -> color assignments
 */
function assignColorsToCategories(categories, existingColors = new Map()) {
  const availableColors = [
    'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'
  ];
  
  const colorMap = new Map(existingColors);
  let colorIndex = 0;
  
  for (const category of categories) {
    if (!colorMap.has(category)) {
      colorMap.set(category, availableColors[colorIndex % availableColors.length]);
      colorIndex++;
    }
  }
  
  return colorMap;
}

/**
 * Creates a new tab group for a category
 * @param {string} category - Category name
 * @param {Array} tabIds - Array of tab IDs to group
 * @param {string} color - Color for the group
 * @returns {Promise<number>} Group ID of created group
 */
async function createNewGroup(category, tabIds, color = 'grey') {
  return new Promise((resolve, reject) => {
    if (!tabIds || tabIds.length === 0) {
      reject(new Error('No tab IDs provided for group creation'));
      return;
    }
    
    chrome.tabs.group({ tabIds }, (groupId) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      chrome.tabGroups.update(groupId, { 
        title: category,
        color: color
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Created new group "${category}" with ${tabIds.length} tabs`);
          resolve(groupId);
        }
      });
    });
  });
}

/**
 * Adds tabs to an existing group  
 * @param {number} groupId - Existing group ID
 * @param {Array} tabIds - Array of tab IDs to add
 * @returns {Promise<void>}
 */
async function addTabsToExistingGroup(groupId, tabIds) {
  return new Promise((resolve, reject) => {
    if (!tabIds || tabIds.length === 0) {
      resolve();
      return;
    }
    
    chrome.tabs.group({ tabIds, groupId }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        console.log(`Added ${tabIds.length} tabs to existing group ${groupId}`);
        resolve();
      }
    });
  });
}

/**
 * Removes empty groups (groups with no tabs)
 * @returns {Promise<void>}
 */
async function removeEmptyGroups() {
  try {
    const groups = await getExistingGroups();
    
    for (const group of groups) {
      // Get tabs in this group
      const tabsInGroup = await new Promise((resolve) => {
        chrome.tabs.query({ groupId: group.id }, resolve);
      });
      
      if (tabsInGroup.length === 0) {
        console.log(`Removing empty group: ${group.title}`);
        chrome.tabGroups.remove(group.id, () => {
          if (chrome.runtime.lastError) {
            console.warn(`Failed to remove empty group ${group.id}:`, chrome.runtime.lastError);
          }
        });
      }
    }
  } catch (error) {
    console.warn('Failed to remove empty groups:', error);
  }
}

/**
 * Organizes categorized tabs into groups efficiently
 * @param {Array} categorizedTabs - Array of categorized tab objects
 * @param {Object} options - Options for grouping
 * @returns {Promise<Object>} Results of the grouping operation
 */
async function batchCreateGroups(categorizedTabs, options = {}) {
  const {
    updateExisting = true,
    removeEmpty = true,
    colorAssignment = true
  } = options;
  
  try {
    console.log(`Starting batch group creation for ${categorizedTabs.length} tabs`);
    
    if (!categorizedTabs || categorizedTabs.length === 0) {
      console.log('No categorized tabs provided');
      return { created: 0, updated: 0, errors: [] };
    }
    
    // Get existing groups  
    const existingGroups = await getExistingGroups();
    const existingGroupMap = new Map();
    const existingColorMap = new Map();
    
    existingGroups.forEach(group => {
      existingGroupMap.set(group.title, group.id);
      existingColorMap.set(group.title, group.color);
    });
    
    // Group tabs by category
    const tabsByCategory = new Map();
    const allCategories = new Set();
    
    categorizedTabs.forEach(tab => {
      if (!tab || !tab.category || !tab.id) {
        console.warn('Invalid categorized tab:', tab);
        return;
      }
      
      if (!tabsByCategory.has(tab.category)) {
        tabsByCategory.set(tab.category, []);
      }
      tabsByCategory.get(tab.category).push(tab.id);
      allCategories.add(tab.category);
    });
    
    console.log(`Organizing tabs into ${allCategories.size} categories`);
    
    // Assign colors to categories
    const colorMap = colorAssignment 
      ? assignColorsToCategories(Array.from(allCategories), existingColorMap)
      : existingColorMap;
    
    const results = {
      created: 0,
      updated: 0,
      errors: [],
      groups: []
    };
    
    // Process each category
    for (const [category, tabIds] of tabsByCategory) {
      try {
        const existingGroupId = existingGroupMap.get(category);
        const color = colorMap.get(category) || 'grey';
        
        if (existingGroupId && updateExisting) {
          // Add to existing group
          await addTabsToExistingGroup(existingGroupId, tabIds);
          results.updated++;
          results.groups.push({
            category,
            groupId: existingGroupId,
            tabCount: tabIds.length,
            action: 'updated'
          });
        } else {
          // Create new group
          const newGroupId = await createNewGroup(category, tabIds, color);
          results.created++;
          results.groups.push({
            category,
            groupId: newGroupId,
            tabCount: tabIds.length,
            action: 'created'
          });
        }
        
        // Small delay to avoid overwhelming Chrome API
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (error) {
        console.error(`Failed to process category "${category}":`, error);
        results.errors.push({
          category,
          error: error.message,
          tabIds
        });
      }
    }
    
    // Remove empty groups if requested
    if (removeEmpty) {
      await removeEmptyGroups();
    }
    
    console.log(`Batch grouping completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);
    return results;
    
  } catch (error) {
    console.error('Batch group creation failed:', error);
    throw error;
  }
}

/**
 * Updates an existing group's properties
 * @param {number} groupId - Group ID to update
 * @param {Object} updates - Properties to update (title, color, collapsed)
 * @returns {Promise<void>}
 */
async function updateGroup(groupId, updates) {
  return new Promise((resolve, reject) => {
    chrome.tabGroups.update(groupId, updates, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Gets statistics about current tab groups
 * @returns {Promise<Object>} Group statistics
 */
async function getGroupStatistics() {
  try {
    const groups = await getExistingGroups();
    const stats = {
      totalGroups: groups.length,
      groupsByColor: new Map(),
      tabCounts: [],
      categories: []
    };
    
    for (const group of groups) {
      // Count by color
      const colorCount = stats.groupsByColor.get(group.color) || 0;
      stats.groupsByColor.set(group.color, colorCount + 1);
      
      // Get tab count for this group
      const tabsInGroup = await new Promise((resolve) => {
        chrome.tabs.query({ groupId: group.id }, resolve);
      });
      
      stats.tabCounts.push(tabsInGroup.length);
      stats.categories.push(group.title);
    }
    
    return stats;
  } catch (error) {
    console.error('Failed to get group statistics:', error);
    return { totalGroups: 0, groupsByColor: new Map(), tabCounts: [], categories: [] };
  }
}

// Export functions for testing and module usage
const __test_exports = {
  getExistingGroups,
  assignColorsToCategories,
  createNewGroup,
  addTabsToExistingGroup,
  removeEmptyGroups,
  batchCreateGroups,
  updateGroup,
  getGroupStatistics
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getExistingGroups,
    assignColorsToCategories,
    createNewGroup,
    addTabsToExistingGroup,
    batchCreateGroups,
    updateGroup,
    getGroupStatistics,
    __test_exports
  };
}