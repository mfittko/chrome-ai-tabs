# Task 3: Cross-window Management

## Overview
Implement comprehensive cross-window tab management capabilities that provide a unified interface for all browser windows, introduce workspace concepts for project organization, enable tab migration between windows/workspaces, and support session management.

## Current State Analysis
- **Existing Capability**: Only processes current window tabs
- **Window Scope**: Limited to "normal" windows, skips fullscreen/minimized
- **Cross-window Awareness**: No global view or management across windows
- **Session Management**: No save/restore functionality
- **Workspace Concept**: Absent - users can't organize by project/context

## Proposed Enhancements

### 3.1 Global Tab View & Management

#### Description
Create a unified interface that displays and manages tabs across all browser windows, providing a bird's-eye view of all open tabs and their categorizations.

#### Technical Requirements
- **Multi-window Detection**: Monitor all browser windows simultaneously
- **Real-time Synchronization**: Keep tab states synchronized across windows
- **Global Search**: Find tabs across all windows by title, URL, or category
- **Bulk Operations**: Manage multiple tabs across different windows

#### Implementation Approach
```javascript
// Global window and tab manager
class GlobalTabManager {
  constructor() {
    this.windows = new Map();
    this.allTabs = new Map();
    this.listeners = new Set();
    this.initializeWindowTracking();
  }
  
  async initializeWindowTracking() {
    // Get all existing windows
    const windows = await chrome.windows.getAll({ populate: true });
    
    for (const window of windows) {
      await this.trackWindow(window);
    }
    
    // Set up listeners for new windows
    chrome.windows.onCreated.addListener(this.handleWindowCreated.bind(this));
    chrome.windows.onRemoved.addListener(this.handleWindowRemoved.bind(this));
    chrome.windows.onFocusChanged.addListener(this.handleWindowFocusChanged.bind(this));
  }
  
  async trackWindow(window) {
    this.windows.set(window.id, {
      ...window,
      workspace: await this.getWindowWorkspace(window.id),
      lastActive: Date.now(),
      tabGroups: await this.getWindowTabGroups(window.id)
    });
    
    // Track all tabs in this window
    for (const tab of window.tabs || []) {
      this.allTabs.set(tab.id, {
        ...tab,
        windowId: window.id,
        lastActive: tab.active ? Date.now() : null
      });
    }
  }
  
  async getAllTabsGlobally() {
    const globalTabs = [];
    
    for (const [windowId, window] of this.windows) {
      const tabs = Array.from(this.allTabs.values())
        .filter(tab => tab.windowId === windowId);
      
      globalTabs.push({
        window: window,
        tabs: tabs,
        groups: await this.getWindowTabGroups(windowId)
      });
    }
    
    return globalTabs;
  }
  
  async searchTabsGlobally(query) {
    const allTabs = Array.from(this.allTabs.values());
    const searchResults = [];
    
    for (const tab of allTabs) {
      const relevanceScore = this.calculateRelevance(tab, query);
      if (relevanceScore > 0.3) {
        searchResults.push({
          tab,
          window: this.windows.get(tab.windowId),
          relevanceScore
        });
      }
    }
    
    return searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
  
  calculateRelevance(tab, query) {
    const normalizedQuery = query.toLowerCase();
    let score = 0;
    
    // Title matching
    if (tab.title.toLowerCase().includes(normalizedQuery)) {
      score += 0.5;
    }
    
    // URL matching
    if (tab.url.toLowerCase().includes(normalizedQuery)) {
      score += 0.3;
    }
    
    // Category matching
    const category = this.getTabCategory(tab.id);
    if (category && category.toLowerCase().includes(normalizedQuery)) {
      score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }
}
```

#### User Interface Components
```javascript
// Global tab view interface
const GlobalTabViewUI = {
  renderGlobalView() {
    return `
      <div class="global-tab-manager">
        <div class="global-header">
          <h2>All Browser Tabs</h2>
          <div class="global-controls">
            <input type="text" id="global-search" placeholder="Search all tabs...">
            <button id="create-workspace">New Workspace</button>
            <button id="organize-all">Organize All</button>
          </div>
        </div>
        
        <div class="windows-container">
          ${this.renderWindowList()}
        </div>
        
        <div class="global-stats">
          <span>Total Tabs: ${this.getTotalTabCount()}</span>
          <span>Windows: ${this.getWindowCount()}</span>
          <span>Ungrouped: ${this.getUngroupedCount()}</span>
        </div>
      </div>
    `;
  },
  
  renderWindowList() {
    return this.windows.map(window => `
      <div class="window-panel" data-window-id="${window.id}">
        <div class="window-header">
          <h3>${this.getWindowTitle(window)}</h3>
          <span class="window-info">
            ${window.tabs.length} tabs | ${window.workspace || 'No Workspace'}
          </span>
          <div class="window-actions">
            <button onclick="focusWindow(${window.id})">Focus</button>
            <button onclick="assignWorkspace(${window.id})">Assign Workspace</button>
          </div>
        </div>
        
        <div class="tab-groups">
          ${this.renderWindowTabGroups(window)}
        </div>
        
        <div class="ungrouped-tabs">
          ${this.renderUngroupedTabs(window)}
        </div>
      </div>
    `).join('');
  },
  
  renderTabItem(tab, options = {}) {
    return `
      <div class="tab-item ${tab.active ? 'active' : ''}" 
           data-tab-id="${tab.id}">
        <img src="${tab.favIconUrl}" class="tab-favicon" />
        <span class="tab-title" title="${tab.title}">${tab.title}</span>
        <span class="tab-url">${new URL(tab.url).hostname}</span>
        ${options.showMoveControls ? this.renderMoveControls(tab) : ''}
        <div class="tab-actions">
          <button onclick="focusTab(${tab.id})">Go</button>
          <button onclick="moveTabDialog(${tab.id})">Move</button>
          <button onclick="closeTab(${tab.id})">×</button>
        </div>
      </div>
    `;
  }
};
```

#### Acceptance Criteria
- [ ] Display tabs from all browser windows in unified interface
- [ ] Real-time updates when tabs change across windows
- [ ] Global search finds tabs by title, URL, and category
- [ ] Bulk operations support selecting tabs across windows
- [ ] Performance handles 100+ tabs across 10+ windows efficiently
- [ ] Keyboard shortcuts for common global operations

#### Dependencies
- Enhanced UI framework for complex interfaces
- Real-time event synchronization
- Performance optimization for large data sets
- Chrome windows API extensions

---

### 3.2 Workspace Concepts & Project Organization

#### Description
Introduce workspace functionality that allows users to organize browser windows by project, context, or workflow, with each workspace maintaining its own categorization rules and tab organization.

#### Technical Requirements
- **Workspace Management**: Create, edit, delete, and switch between workspaces
- **Window Assignment**: Assign windows to specific workspaces
- **Workspace-specific Rules**: Different categorization rules per workspace
- **Context Switching**: Quick switching between workspace contexts

#### Implementation Approach
```javascript
// Workspace management system
class WorkspaceManager {
  constructor() {
    this.workspaces = new Map();
    this.windowWorkspaceMap = new Map();
    this.activeWorkspace = null;
  }
  
  async createWorkspace(name, description, options = {}) {
    const workspace = {
      id: generateUUID(),
      name: name.trim(),
      description: description.trim(),
      created: Date.now(),
      lastActive: Date.now(),
      windows: new Set(),
      categories: new Map(),
      rules: new Map(),
      settings: {
        autoGroup: options.autoGroup ?? true,
        inheritGlobalRules: options.inheritGlobalRules ?? true,
        categoryPrefix: options.categoryPrefix || '',
        ...options.settings
      },
      stats: {
        totalTabs: 0,
        averageSessionTime: 0,
        lastUsed: Date.now()
      }
    };
    
    this.workspaces.set(workspace.id, workspace);
    await this.persistWorkspaces();
    return workspace.id;
  }
  
  async assignWindowToWorkspace(windowId, workspaceId) {
    // Remove from previous workspace
    const previousWorkspace = this.getWindowWorkspace(windowId);
    if (previousWorkspace) {
      previousWorkspace.windows.delete(windowId);
    }
    
    // Assign to new workspace
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    
    workspace.windows.add(windowId);
    this.windowWorkspaceMap.set(windowId, workspaceId);
    
    // Apply workspace-specific categorization
    await this.applyWorkspaceRules(windowId, workspace);
    
    // Update workspace stats
    await this.updateWorkspaceStats(workspaceId);
    await this.persistWorkspaces();
  }
  
  async switchToWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    
    this.activeWorkspace = workspaceId;
    workspace.lastActive = Date.now();
    
    // Focus first window in workspace or create new one
    const workspaceWindows = Array.from(workspace.windows);
    if (workspaceWindows.length > 0) {
      await chrome.windows.update(workspaceWindows[0], { focused: true });
    } else {
      // Create new window for workspace
      const newWindow = await chrome.windows.create({
        focused: true,
        type: 'normal'
      });
      await this.assignWindowToWorkspace(newWindow.id, workspaceId);
    }
    
    await this.persistWorkspaces();
  }
  
  async applyWorkspaceRules(windowId, workspace) {
    const tabs = await chrome.tabs.query({ windowId });
    
    for (const tab of tabs) {
      // Apply workspace-specific categorization
      const category = await this.categorizeForWorkspace(tab, workspace);
      if (category) {
        await this.groupTabInWorkspace(tab.id, category, workspace);
      }
    }
  }
  
  async categorizeForWorkspace(tab, workspace) {
    // First try workspace-specific rules
    for (const rule of workspace.rules.values()) {
      if (await this.testWorkspaceRule(rule, tab)) {
        return rule.categoryId;
      }
    }
    
    // Fallback to global rules if enabled
    if (workspace.settings.inheritGlobalRules) {
      return await this.getGlobalCategorization(tab);
    }
    
    return null;
  }
}
```

#### User Interface Components
```javascript
// Workspace management interface
const WorkspaceUI = {
  renderWorkspaceSelector() {
    return `
      <div class="workspace-selector">
        <select id="active-workspace" onchange="switchWorkspace()">
          <option value="">Select Workspace...</option>
          ${this.workspaces.map(ws => `
            <option value="${ws.id}" ${ws.id === this.activeWorkspace ? 'selected' : ''}>
              ${ws.name} (${ws.windows.size} windows)
            </option>
          `).join('')}
        </select>
        <button onclick="showWorkspaceManager()">Manage</button>
      </div>
    `;
  },
  
  renderWorkspaceManager() {
    return `
      <div class="workspace-manager">
        <div class="workspace-header">
          <h2>Workspace Management</h2>
          <button onclick="createWorkspaceDialog()">+ New Workspace</button>
        </div>
        
        <div class="workspace-list">
          ${this.workspaces.map(ws => this.renderWorkspaceCard(ws)).join('')}
        </div>
      </div>
    `;
  },
  
  renderWorkspaceCard(workspace) {
    return `
      <div class="workspace-card" data-workspace-id="${workspace.id}">
        <div class="workspace-info">
          <h3>${workspace.name}</h3>
          <p>${workspace.description}</p>
          <div class="workspace-stats">
            <span>${workspace.windows.size} windows</span>
            <span>${workspace.stats.totalTabs} tabs</span>
            <span>Last used: ${this.formatDate(workspace.lastActive)}</span>
          </div>
        </div>
        
        <div class="workspace-actions">
          <button onclick="switchToWorkspace('${workspace.id}')">Switch</button>
          <button onclick="editWorkspace('${workspace.id}')">Edit</button>
          <button onclick="duplicateWorkspace('${workspace.id}')">Duplicate</button>
          <button onclick="deleteWorkspace('${workspace.id}')">Delete</button>
        </div>
        
        <div class="workspace-windows">
          ${Array.from(workspace.windows).map(windowId => 
            this.renderWorkspaceWindow(windowId)
          ).join('')}
        </div>
      </div>
    `;
  },
  
  renderWorkspaceCreationDialog() {
    return `
      <div class="workspace-dialog">
        <h3>Create New Workspace</h3>
        <form class="workspace-form">
          <input type="text" name="name" placeholder="Workspace Name" required>
          <textarea name="description" placeholder="Description (optional)"></textarea>
          
          <div class="workspace-options">
            <label>
              <input type="checkbox" name="autoGroup" checked>
              Auto-group tabs in this workspace
            </label>
            <label>
              <input type="checkbox" name="inheritGlobalRules" checked>
              Inherit global categorization rules
            </label>
            <input type="text" name="categoryPrefix" 
                   placeholder="Category prefix (e.g., 'Work-')">
          </div>
          
          <div class="initial-setup">
            <h4>Initial Setup</h4>
            <label>
              <input type="radio" name="setupType" value="current" checked>
              Use current window
            </label>
            <label>
              <input type="radio" name="setupType" value="new">
              Create new window
            </label>
            <label>
              <input type="radio" name="setupType" value="empty">
              Create empty workspace
            </label>
          </div>
          
          <div class="form-actions">
            <button type="submit">Create Workspace</button>
            <button type="button" onclick="closeDialog()">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }
};
```

#### Acceptance Criteria
- [ ] Users can create unlimited workspaces with custom names/descriptions
- [ ] Windows can be assigned to workspaces with visual indicators
- [ ] Workspace switching focuses appropriate windows/tabs
- [ ] Workspace-specific categorization rules override global rules
- [ ] Workspace statistics track usage patterns
- [ ] Import/export workspace configurations

#### Dependencies
- Enhanced storage for workspace data
- Window management API extensions
- UI framework for complex workspace interfaces
- Workspace-specific rule engine integration

---

### 3.3 Tab Migration Between Windows/Workspaces

#### Description
Enable seamless movement of tabs between different browser windows and workspaces while maintaining their categorization and grouping.

#### Technical Requirements
- **Drag & Drop Interface**: Visual tab movement between windows
- **Bulk Migration**: Move multiple tabs simultaneously
- **Category Preservation**: Maintain tab groupings during migration
- **Cross-workspace Migration**: Move tabs between different workspace contexts

#### Implementation Approach
```javascript
// Tab migration system
class TabMigrationManager {
  constructor() {
    this.migrationQueue = [];
    this.migrationHistory = [];
  }
  
  async migrateTab(tabId, targetWindowId, options = {}) {
    const sourceTab = await chrome.tabs.get(tabId);
    const targetWindow = await chrome.windows.get(targetWindowId);
    
    const migration = {
      id: generateUUID(),
      sourceTab: { ...sourceTab },
      targetWindowId,
      targetWorkspaceId: options.targetWorkspaceId,
      preserveGroup: options.preserveGroup ?? true,
      targetGroupId: options.targetGroupId,
      timestamp: Date.now()
    };
    
    try {
      // Execute migration
      await this.executeMigration(migration);
      
      // Record success
      this.migrationHistory.push({
        ...migration,
        status: 'completed',
        completedAt: Date.now()
      });
      
      return true;
    } catch (error) {
      // Record failure
      this.migrationHistory.push({
        ...migration,
        status: 'failed',
        error: error.message,
        completedAt: Date.now()
      });
      
      throw error;
    }
  }
  
  async executeMigration(migration) {
    const { sourceTab, targetWindowId, preserveGroup, targetGroupId } = migration;
    
    // Get source tab group info
    let sourceGroupInfo = null;
    if (sourceTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      sourceGroupInfo = await chrome.tabGroups.get(sourceTab.groupId);
    }
    
    // Move tab to target window
    await chrome.tabs.move(sourceTab.id, {
      windowId: targetWindowId,
      index: -1 // Append to end
    });
    
    // Handle grouping in target window
    if (preserveGroup && sourceGroupInfo) {
      await this.recreateGroupInTargetWindow(
        sourceTab.id, 
        sourceGroupInfo, 
        targetWindowId,
        targetGroupId
      );
    }
    
    // Update workspace assignment if needed
    if (migration.targetWorkspaceId) {
      await this.updateTabWorkspaceContext(sourceTab.id, migration.targetWorkspaceId);
    }
  }
  
  async recreateGroupInTargetWindow(tabId, sourceGroupInfo, targetWindowId, targetGroupId = null) {
    if (targetGroupId) {
      // Add to existing group
      await chrome.tabs.group({
        tabIds: [tabId],
        groupId: targetGroupId
      });
    } else {
      // Find or create matching group
      const existingGroups = await chrome.tabGroups.query({ windowId: targetWindowId });
      const matchingGroup = existingGroups.find(g => g.title === sourceGroupInfo.title);
      
      if (matchingGroup) {
        await chrome.tabs.group({
          tabIds: [tabId],
          groupId: matchingGroup.id
        });
      } else {
        // Create new group
        const newGroupId = await chrome.tabs.group({ tabIds: [tabId] });
        await chrome.tabGroups.update(newGroupId, {
          title: sourceGroupInfo.title,
          color: sourceGroupInfo.color
        });
      }
    }
  }
  
  async migrateBulk(tabIds, targetWindowId, options = {}) {
    const migrations = [];
    
    for (const tabId of tabIds) {
      try {
        await this.migrateTab(tabId, targetWindowId, options);
        migrations.push({ tabId, status: 'success' });
      } catch (error) {
        migrations.push({ tabId, status: 'failed', error: error.message });
      }
    }
    
    return migrations;
  }
  
  async createMigrationPlan(tabIds, targetWindowId) {
    const plan = {
      totalTabs: tabIds.length,
      groupings: new Map(),
      conflicts: [],
      recommendations: []
    };
    
    // Analyze groupings
    for (const tabId of tabIds) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        const group = await chrome.tabGroups.get(tab.groupId);
        if (!plan.groupings.has(group.id)) {
          plan.groupings.set(group.id, {
            groupInfo: group,
            tabs: []
          });
        }
        plan.groupings.get(group.id).tabs.push(tab);
      }
    }
    
    // Check for conflicts in target window
    const targetGroups = await chrome.tabGroups.query({ windowId: targetWindowId });
    for (const [groupId, groupData] of plan.groupings) {
      const conflictingGroup = targetGroups.find(g => g.title === groupData.groupInfo.title);
      if (conflictingGroup) {
        plan.conflicts.push({
          sourceGroup: groupData.groupInfo,
          targetGroup: conflictingGroup,
          recommendedAction: 'merge'
        });
      }
    }
    
    return plan;
  }
}
```

#### User Interface Components
```javascript
// Tab migration interface
const TabMigrationUI = {
  renderMigrationDialog(selectedTabs) {
    return `
      <div class="migration-dialog">
        <h3>Move Tabs</h3>
        <div class="migration-source">
          <h4>Selected Tabs (${selectedTabs.length})</h4>
          <div class="tab-list">
            ${selectedTabs.map(tab => this.renderTabPreview(tab)).join('')}
          </div>
        </div>
        
        <div class="migration-target">
          <h4>Destination</h4>
          <div class="target-selection">
            <label>
              <input type="radio" name="targetType" value="window" checked>
              Existing Window
            </label>
            <select id="target-window">
              ${this.renderWindowOptions()}
            </select>
            
            <label>
              <input type="radio" name="targetType" value="new-window">
              New Window
            </label>
            
            <label>
              <input type="radio" name="targetType" value="workspace">
              Workspace
            </label>
            <select id="target-workspace">
              ${this.renderWorkspaceOptions()}
            </select>
          </div>
        </div>
        
        <div class="migration-options">
          <h4>Migration Options</h4>
          <label>
            <input type="checkbox" id="preserve-groups" checked>
            Preserve tab groups
          </label>
          <label>
            <input type="checkbox" id="merge-groups">
            Merge with existing groups
          </label>
          <label>
            <input type="checkbox" id="maintain-order">
            Maintain tab order
          </label>
        </div>
        
        <div class="migration-preview">
          <h4>Migration Preview</h4>
          <div id="migration-plan">
            <!-- Dynamically populated migration plan -->
          </div>
        </div>
        
        <div class="dialog-actions">
          <button onclick="executeMigration()">Move Tabs</button>
          <button onclick="cancelMigration()">Cancel</button>
        </div>
      </div>
    `;
  },
  
  renderDragDropInterface() {
    return `
      <div class="drag-drop-area">
        <div class="drop-zones">
          ${this.windows.map(window => `
            <div class="drop-zone" 
                 data-window-id="${window.id}"
                 ondrop="handleTabDrop(event)"
                 ondragover="handleDragOver(event)">
              <h4>${this.getWindowTitle(window)}</h4>
              <div class="drop-indicator">Drop tabs here</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },
  
  renderMigrationHistory() {
    return `
      <div class="migration-history">
        <h3>Recent Migrations</h3>
        <div class="history-list">
          ${this.migrationHistory.slice(-10).map(migration => `
            <div class="migration-entry">
              <span class="migration-time">
                ${this.formatTime(migration.timestamp)}
              </span>
              <span class="migration-desc">
                Moved "${migration.sourceTab.title}" to ${migration.targetWindow}
              </span>
              <span class="migration-status ${migration.status}">
                ${migration.status}
              </span>
              ${migration.status === 'failed' ? 
                `<button onclick="retryMigration('${migration.id}')">Retry</button>` : 
                `<button onclick="undoMigration('${migration.id}')">Undo</button>`
              }
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};
```

#### Acceptance Criteria
- [ ] Drag & drop interface for intuitive tab movement
- [ ] Bulk migration supports up to 50 tabs simultaneously
- [ ] Tab groups are preserved or intelligently merged during migration
- [ ] Migration history allows undo operations
- [ ] Cross-workspace migration updates categorization appropriately
- [ ] Migration conflicts are detected and resolved

#### Dependencies
- Enhanced drag & drop API implementation
- Bulk operation optimization
- Transaction management for migration rollbacks
- Group management utilities

---

### 3.4 Session Management & Restoration

#### Description
Implement comprehensive session save and restore functionality that preserves workspace states, tab groupings, and categorizations across browser restarts.

#### Technical Requirements
- **Session Snapshots**: Capture complete browser state including all windows/tabs
- **Selective Restoration**: Restore specific workspaces or window sets
- **Scheduled Backups**: Automatic session backup at regular intervals
- **Cross-device Sync**: Synchronize sessions across multiple devices

#### Implementation Approach
```javascript
// Session management system
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.autoBackupInterval = 30 * 60 * 1000; // 30 minutes
    this.maxStoredSessions = 50;
    this.initializeAutoBackup();
  }
  
  async captureSession(name = null, options = {}) {
    const sessionId = generateUUID();
    const timestamp = Date.now();
    
    const session = {
      id: sessionId,
      name: name || `Session ${this.formatDate(timestamp)}`,
      timestamp,
      type: options.type || 'manual', // 'manual', 'auto', 'scheduled'
      windows: await this.captureAllWindows(),
      workspaces: await this.captureWorkspaces(),
      globalSettings: await this.captureGlobalSettings(),
      categories: await this.captureCategories(),
      rules: await this.captureRules(),
      metadata: {
        browserVersion: await this.getBrowserVersion(),
        extensionVersion: chrome.runtime.getManifest().version,
        platform: navigator.platform,
        totalTabs: 0,
        totalGroups: 0
      }
    };
    
    // Calculate metadata
    session.metadata.totalTabs = session.windows.reduce(
      (sum, window) => sum + window.tabs.length, 0
    );
    session.metadata.totalGroups = session.windows.reduce(
      (sum, window) => sum + window.groups.length, 0
    );
    
    this.sessions.set(sessionId, session);
    await this.persistSessions();
    
    return sessionId;
  }
  
  async captureAllWindows() {
    const windows = await chrome.windows.getAll({ populate: true });
    const capturedWindows = [];
    
    for (const window of windows) {
      if (window.type !== 'normal') continue;
      
      const capturedWindow = {
        id: window.id,
        state: window.state,
        type: window.type,
        focused: window.focused,
        workspace: await this.getWindowWorkspace(window.id),
        tabs: await this.captureWindowTabs(window.id),
        groups: await this.captureWindowGroups(window.id),
        bounds: {
          left: window.left,
          top: window.top,
          width: window.width,
          height: window.height
        }
      };
      
      capturedWindows.push(capturedWindow);
    }
    
    return capturedWindows;
  }
  
  async captureWindowTabs(windowId) {
    const tabs = await chrome.tabs.query({ windowId });
    
    return tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned,
      active: tab.active,
      index: tab.index,
      groupId: tab.groupId,
      category: this.getTabCategory(tab.id),
      lastAccessed: tab.lastAccessed || Date.now()
    }));
  }
  
  async captureWindowGroups(windowId) {
    const groups = await chrome.tabGroups.query({ windowId });
    
    return groups.map(group => ({
      id: group.id,
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
      tabIds: group.tabs || []
    }));
  }
  
  async restoreSession(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    const restoration = {
      id: generateUUID(),
      sessionId,
      timestamp: Date.now(),
      options,
      progress: 0,
      status: 'starting',
      errors: []
    };
    
    try {
      await this.executeRestoration(session, restoration, options);
      restoration.status = 'completed';
      restoration.progress = 100;
    } catch (error) {
      restoration.status = 'failed';
      restoration.errors.push(error.message);
      throw error;
    }
    
    return restoration;
  }
  
  async executeRestoration(session, restoration, options) {
    // Close existing windows if requested
    if (options.replaceExisting) {
      await this.closeExistingWindows();
    }
    
    // Restore workspaces first
    if (options.restoreWorkspaces) {
      await this.restoreWorkspaces(session.workspaces);
      restoration.progress = 20;
    }
    
    // Restore categories and rules
    if (options.restoreCategories) {
      await this.restoreCategories(session.categories);
      await this.restoreRules(session.rules);
      restoration.progress = 40;
    }
    
    // Restore windows
    const windowRestorationPromises = session.windows.map(
      (windowData, index) => this.restoreWindow(windowData, {
        ...options,
        progressCallback: (progress) => {
          restoration.progress = 40 + (progress * 0.6 * (index + 1) / session.windows.length);
        }
      })
    );
    
    await Promise.all(windowRestorationPromises);
    restoration.progress = 100;
  }
  
  async restoreWindow(windowData, options = {}) {
    // Create new window
    const newWindow = await chrome.windows.create({
      focused: windowData.focused,
      state: windowData.state,
      type: windowData.type,
      left: windowData.bounds.left,
      top: windowData.bounds.top,
      width: windowData.bounds.width,
      height: windowData.bounds.height
    });
    
    // Close the default tab
    const defaultTabs = await chrome.tabs.query({ windowId: newWindow.id });
    if (defaultTabs.length > 0) {
      await chrome.tabs.remove(defaultTabs[0].id);
    }
    
    // Restore tabs
    const tabRestorePromises = windowData.tabs.map(
      (tabData, index) => this.restoreTab(tabData, newWindow.id, index)
    );
    
    const restoredTabs = await Promise.all(tabRestorePromises);
    
    // Restore groups
    await this.restoreGroups(windowData.groups, restoredTabs, newWindow.id);
    
    // Assign to workspace
    if (windowData.workspace) {
      await this.assignWindowToWorkspace(newWindow.id, windowData.workspace);
    }
    
    return newWindow.id;
  }
  
  async restoreTab(tabData, windowId, index) {
    try {
      const newTab = await chrome.tabs.create({
        windowId,
        url: tabData.url,
        pinned: tabData.pinned,
        active: tabData.active,
        index
      });
      
      return {
        originalId: tabData.id,
        newId: newTab.id,
        groupId: tabData.groupId,
        category: tabData.category
      };
    } catch (error) {
      console.error(`Failed to restore tab: ${tabData.url}`, error);
      return null;
    }
  }
}
```

#### User Interface Components
```javascript
// Session management interface
const SessionManagementUI = {
  renderSessionManager() {
    return `
      <div class="session-manager">
        <div class="session-header">
          <h2>Session Management</h2>
          <div class="session-actions">
            <button onclick="captureCurrentSession()">Save Current Session</button>
            <button onclick="showAutoBackupSettings()">Auto-Backup Settings</button>
          </div>
        </div>
        
        <div class="session-list">
          <h3>Saved Sessions</h3>
          ${this.sessions.map(session => this.renderSessionCard(session)).join('')}
        </div>
        
        <div class="session-import-export">
          <h3>Import / Export</h3>
          <button onclick="exportSessions()">Export All Sessions</button>
          <input type="file" id="import-file" accept=".json" onchange="importSessions()">
          <button onclick="document.getElementById('import-file').click()">
            Import Sessions
          </button>
        </div>
      </div>
    `;
  },
  
  renderSessionCard(session) {
    return `
      <div class="session-card" data-session-id="${session.id}">
        <div class="session-info">
          <h4>${session.name}</h4>
          <div class="session-meta">
            <span>${this.formatDate(session.timestamp)}</span>
            <span>${session.metadata.totalTabs} tabs</span>
            <span>${session.windows.length} windows</span>
            <span>${session.metadata.totalGroups} groups</span>
          </div>
        </div>
        
        <div class="session-preview">
          ${session.windows.slice(0, 3).map(window => 
            this.renderWindowPreview(window)
          ).join('')}
          ${session.windows.length > 3 ? 
            `<div class="more-windows">+${session.windows.length - 3} more</div>` : 
            ''
          }
        </div>
        
        <div class="session-actions">
          <button onclick="restoreSession('${session.id}')">Restore</button>
          <button onclick="restoreSessionPartial('${session.id}')">Partial Restore</button>
          <button onclick="renameSession('${session.id}')">Rename</button>
          <button onclick="deleteSession('${session.id}')">Delete</button>
        </div>
      </div>
    `;
  },
  
  renderPartialRestoreDialog(session) {
    return `
      <div class="partial-restore-dialog">
        <h3>Partial Restore: ${session.name}</h3>
        
        <div class="restore-options">
          <h4>What to restore:</h4>
          <label>
            <input type="checkbox" name="windows" checked>
            Windows and Tabs (${session.metadata.totalTabs} tabs)
          </label>
          <label>
            <input type="checkbox" name="workspaces" checked>
            Workspaces (${Object.keys(session.workspaces).length})
          </label>
          <label>
            <input type="checkbox" name="categories">
            Categories and Rules
          </label>
          <label>
            <input type="checkbox" name="settings">
            Extension Settings
          </label>
        </div>
        
        <div class="window-selection">
          <h4>Select Windows:</h4>
          ${session.windows.map((window, index) => `
            <label>
              <input type="checkbox" name="window" value="${index}" checked>
              Window ${index + 1} (${window.tabs.length} tabs)
              ${window.workspace ? `- ${window.workspace}` : ''}
            </label>
          `).join('')}
        </div>
        
        <div class="restore-behavior">
          <h4>Restore Behavior:</h4>
          <label>
            <input type="radio" name="behavior" value="append" checked>
            Add to current session
          </label>
          <label>
            <input type="radio" name="behavior" value="replace">
            Replace current session
          </label>
          <label>
            <input type="radio" name="behavior" value="new-window">
            Restore in new windows only
          </label>
        </div>
        
        <div class="dialog-actions">
          <button onclick="executePartialRestore()">Restore Selected</button>
          <button onclick="closeDialog()">Cancel</button>
        </div>
      </div>
    `;
  }
};
```

#### Acceptance Criteria
- [ ] Capture and restore complete browser sessions with 99% accuracy
- [ ] Selective restoration allows choosing specific windows/workspaces
- [ ] Automatic backup runs every 30 minutes without user intervention
- [ ] Session export/import supports cross-device synchronization
- [ ] Session restoration handles missing URLs gracefully
- [ ] Maximum of 50 stored sessions with automatic cleanup

#### Dependencies
- Large data storage capabilities
- Cross-device synchronization infrastructure
- URL validation and error handling
- Automated backup scheduling system

## Implementation Priority

### Phase 1 (Foundation)
1. **Global Tab View & Management** - Essential unified interface
2. **Tab Migration Between Windows** - Core functionality for organization

### Phase 2 (Advanced)
3. **Workspace Concepts & Project Organization** - Advanced organizational features
4. **Session Management & Restoration** - Persistence and recovery features

## Technical Considerations

### Performance Optimization
- **Lazy Loading**: Load window/tab data only when needed
- **Virtual Scrolling**: Handle large numbers of tabs efficiently
- **Debounced Updates**: Batch real-time updates to prevent performance issues
- **Background Processing**: Perform heavy operations in background scripts

### Data Architecture
```javascript
// Cross-window data schema
const crossWindowSchema = {
  globalState: {
    windows: Map<windowId, WindowData>,
    workspaces: Map<workspaceId, WorkspaceData>,
    sessions: Map<sessionId, SessionData>,
    globalTabIndex: Map<tabId, TabData>
  },
  workspaces: {
    [workspaceId]: {
      id: String,
      name: String,
      description: String,
      windows: Set<windowId>,
      categories: Map<categoryId, CategoryData>,
      rules: Map<ruleId, RuleData>,
      settings: Object,
      stats: Object
    }
  },
  sessions: {
    [sessionId]: {
      id: String,
      name: String,
      timestamp: Number,
      windows: Array<WindowSnapshot>,
      workspaces: Object,
      globalSettings: Object,
      metadata: Object
    }
  }
};
```

### Memory Management
- **Cleanup Strategies**: Remove stale data and unused references
- **Storage Limits**: Implement data retention policies
- **Garbage Collection**: Regular cleanup of orphaned data
- **Cache Management**: Intelligent caching with size limits

## Risk Assessment

### High Priority Risks
- **Performance Impact**: Managing large numbers of windows/tabs
- **Data Corruption**: Session restoration failures
- **User Complexity**: Interface overwhelming for casual users

### Medium Priority Risks
- **Cross-browser Compatibility**: Chrome API limitations
- **Storage Limitations**: Browser storage quota issues
- **Sync Conflicts**: Cross-device synchronization problems

### Low Priority Risks
- **Feature Adoption**: Users may prefer simpler solutions
- **Migration Errors**: Tab movement failures
- **UI Complexity**: Advanced features may confuse users

## Success Metrics

### Quantitative Goals
- **Global View Usage**: 70% of users access global tab view monthly
- **Workspace Adoption**: 40% of users create at least one workspace
- **Migration Frequency**: Average 5 tab migrations per user per week
- **Session Restoration**: 95% success rate for session restoration

### Qualitative Goals
- **Improved Organization**: Users report better tab organization
- **Reduced Context Switching**: Faster project/context transitions
- **Enhanced Productivity**: Measurable improvement in workflow efficiency
- **User Satisfaction**: High ratings for advanced features

## Migration Strategy

### Backward Compatibility
- Maintain current single-window functionality
- Progressive enhancement of cross-window features
- Optional feature activation for existing users

### Data Migration
```javascript
// Cross-window migration utilities
const crossWindowMigration = {
  async upgradeToGlobalView() {
    // Migrate existing tab groups to global index
    const windows = await chrome.windows.getAll({ populate: true });
    for (const window of windows) {
      await this.indexWindowData(window);
    }
  },
  
  async createDefaultWorkspace() {
    // Create default workspace for existing users
    const defaultWorkspace = await workspaceManager.createWorkspace(
      'Default',
      'Your existing browser setup',
      { inheritGlobalRules: true }
    );
    
    // Assign all existing windows to default workspace
    const windows = await chrome.windows.getAll();
    for (const window of windows) {
      await workspaceManager.assignWindowToWorkspace(
        window.id, 
        defaultWorkspace
      );
    }
  }
};
``` 