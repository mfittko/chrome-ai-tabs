import 'jest-chrome';
import { __test_exports } from '../batch-grouper.js';

const { 
  getExistingGroups, 
  assignColorsToCategories, 
  createNewGroup,
  addTabsToExistingGroup,
  batchCreateGroups
} = __test_exports;

describe('batch-grouper.js', () => {
  beforeEach(() => {
    // Reset all mocks
    chrome.tabGroups.query.mockReset();
    chrome.tabGroups.update.mockReset();
    chrome.tabGroups.remove.mockReset();
    chrome.tabs.group.mockReset();
    chrome.tabs.query.mockReset();
    delete chrome.runtime.lastError;
  });

  describe('getExistingGroups', () => {
    it('should get all existing groups', async () => {
      const mockGroups = [
        { id: 1, title: 'Work', color: 'blue' },
        { id: 2, title: 'Social', color: 'red' }
      ];
      
      chrome.tabGroups.query.mockImplementation((query, callback) => {
        callback(mockGroups);
      });

      const groups = await getExistingGroups();
      expect(groups).toEqual(mockGroups);
    });

    it('should handle empty groups array', async () => {
      chrome.tabGroups.query.mockImplementation((query, callback) => {
        callback(null);
      });

      const groups = await getExistingGroups();
      expect(groups).toEqual([]);
    });
  });

  describe('assignColorsToCategories', () => {
    it('should assign colors to new categories', () => {
      const categories = ['Work', 'Social', 'News'];
      const colorMap = assignColorsToCategories(categories);
      
      expect(colorMap.get('Work')).toBe('grey');
      expect(colorMap.get('Social')).toBe('blue');
      expect(colorMap.get('News')).toBe('red');
    });

    it('should preserve existing color assignments', () => {
      const categories = ['Work', 'Social'];
      const existingColors = new Map([['Work', 'green']]);
      
      const colorMap = assignColorsToCategories(categories, existingColors);
      
      expect(colorMap.get('Work')).toBe('green');
      expect(colorMap.get('Social')).toBe('grey');
    });

    it('should cycle through available colors', () => {
      const categories = Array.from({ length: 10 }, (_, i) => `Category${i}`);
      const colorMap = assignColorsToCategories(categories);
      
      // Should cycle back to 'grey' after using all 8 colors
      expect(colorMap.get('Category0')).toBe('grey');
      expect(colorMap.get('Category8')).toBe('grey');
      expect(colorMap.get('Category1')).toBe('blue');
    });
  });

  describe('createNewGroup', () => {
    it('should create new group successfully', async () => {
      const category = 'Work';
      const tabIds = [1, 2, 3];
      const color = 'blue';
      const mockGroupId = 123;

      chrome.tabs.group.mockImplementation((options, callback) => {
        expect(options.tabIds).toEqual(tabIds);
        callback(mockGroupId);
      });

      chrome.tabGroups.update.mockImplementation((groupId, updates, callback) => {
        expect(groupId).toBe(mockGroupId);
        expect(updates.title).toBe(category);
        expect(updates.color).toBe(color);
        callback();
      });

      const groupId = await createNewGroup(category, tabIds, color);
      expect(groupId).toBe(mockGroupId);
    });

    it('should throw error when no tab IDs provided', async () => {
      await expect(createNewGroup('Work', [], 'blue'))
        .rejects.toThrow('No tab IDs provided for group creation');
    });

    it('should handle Chrome API errors', async () => {
      chrome.tabs.group.mockImplementation((options, callback) => {
        chrome.runtime.lastError = { message: 'Tab grouping failed' };
        callback(null);
      });

      await expect(createNewGroup('Work', [1, 2], 'blue'))
        .rejects.toEqual({ message: 'Tab grouping failed' });
    });
  });

  describe('addTabsToExistingGroup', () => {
    it('should add tabs to existing group', async () => {
      const groupId = 123;
      const tabIds = [4, 5, 6];

      chrome.tabs.group.mockImplementation((options, callback) => {
        expect(options.tabIds).toEqual(tabIds);
        expect(options.groupId).toBe(groupId);
        callback();
      });

      await addTabsToExistingGroup(groupId, tabIds);
      expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds, groupId }, expect.any(Function));
    });

    it('should resolve immediately when no tab IDs provided', async () => {
      await expect(addTabsToExistingGroup(123, [])).resolves.toBeUndefined();
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
  });

  describe('batchCreateGroups', () => {
    it('should create groups for categorized tabs', async () => {
      const categorizedTabs = [
        { id: 1, category: 'Work' },
        { id: 2, category: 'Work' },
        { id: 3, category: 'Social' }
      ];

      // Mock existing groups (empty)
      chrome.tabGroups.query.mockImplementation((query, callback) => {
        callback([]);
      });

      // Mock group creation
      let groupIdCounter = 100;
      chrome.tabs.group.mockImplementation((options, callback) => {
        callback(++groupIdCounter);
      });

      chrome.tabGroups.update.mockImplementation((groupId, updates, callback) => {
        callback();
      });

      const results = await batchCreateGroups(categorizedTabs);
      
      expect(results.created).toBe(2); // Work and Social groups
      expect(results.updated).toBe(0);
      expect(results.errors).toHaveLength(0);
      expect(results.groups).toHaveLength(2);
      
      // Verify Work group has 2 tabs
      const workGroup = results.groups.find(g => g.category === 'Work');
      expect(workGroup.tabCount).toBe(2);
    });

    it('should update existing groups when available', async () => {
      const categorizedTabs = [
        { id: 1, category: 'Work' },
        { id: 2, category: 'Social' }
      ];

      // Mock existing groups
      chrome.tabGroups.query.mockImplementation((query, callback) => {
        callback([
          { id: 50, title: 'Work', color: 'blue' }
        ]);
      });

      // Mock adding to existing group
      chrome.tabs.group.mockImplementation((options, callback) => {
        if (options.groupId) {
          // Adding to existing group
          callback();
        } else {
          // Creating new group
          callback(101);
        }
      });

      chrome.tabGroups.update.mockImplementation((groupId, updates, callback) => {
        callback();
      });

      const results = await batchCreateGroups(categorizedTabs, { removeEmpty: false });
      
      expect(results.created).toBe(1); // Only Social group created
      expect(results.updated).toBe(1); // Work group updated
      expect(results.errors).toHaveLength(0);
    });

    it('should handle empty categorized tabs array', async () => {
      const results = await batchCreateGroups([]);
      
      expect(results.created).toBe(0);
      expect(results.updated).toBe(0);
      expect(results.errors).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      const categorizedTabs = [
        { id: 1, category: 'Work' },
        { id: 2, category: 'Problematic' }
      ];

      chrome.tabGroups.query.mockImplementation((query, callback) => {
        callback([]);
      });

      chrome.tabs.group.mockImplementation((options, callback) => {
        if (options.tabIds.includes(2)) {
          chrome.runtime.lastError = { message: 'Failed to group tab 2' };
          callback(null);
        } else {
          callback(100);
        }
      });

      chrome.tabGroups.update.mockImplementation((groupId, updates, callback) => {
        callback();
      });

      const results = await batchCreateGroups(categorizedTabs);
      
      expect(results.created).toBe(1); // Only Work group created
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].category).toBe('Problematic');
    });

    it('should skip invalid categorized tabs', async () => {
      const categorizedTabs = [
        { id: 1, category: 'Work' },
        { category: 'NoId' }, // Missing id
        { id: 3 }, // Missing category
        null // Invalid tab
      ];

      chrome.tabGroups.query.mockImplementation((query, callback) => {
        callback([]);
      });

      chrome.tabs.group.mockImplementation((options, callback) => {
        callback(100);
      });

      chrome.tabGroups.update.mockImplementation((groupId, updates, callback) => {
        callback();
      });

      const results = await batchCreateGroups(categorizedTabs);
      
      expect(results.created).toBe(1); // Only valid Work tab processed
      expect(results.groups).toHaveLength(1);
      expect(results.groups[0].tabCount).toBe(1);
    });
  });
});