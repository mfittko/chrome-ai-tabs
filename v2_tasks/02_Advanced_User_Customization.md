# Task 2: Advanced User Customization

## Overview
Implement comprehensive user customization capabilities that allow users to define their own categories, provide feedback on categorization decisions, create rules for specific domains/patterns, and build a personalization engine that learns from user behavior.

## Current State Analysis
- **Existing Capability**: Categories inferred only from existing Chrome tab groups
- **User Control**: Limited to enabling/disabling auto-categorization
- **Feedback Mechanism**: No way for users to correct misclassifications
- **Customization**: Basic per-domain default descriptions only
- **Learning**: No adaptation based on user behavior

## Proposed Enhancements

### 2.1 Custom Categories Management

#### Description
Allow users to create, edit, and manage their own categories independent of existing tab groups.

#### Technical Requirements
- **Category CRUD Operations**:
  - Create new categories with names and descriptions
  - Edit existing category properties
  - Delete categories (with confirmation and tab reassignment)
  - Organize categories hierarchically (parent/child relationships)

#### Implementation Approach
```javascript
// Category management system
class CategoryManager {
  constructor() {
    this.categories = new Map();
    this.hierarchy = new Map();
  }
  
  async createCategory(name, description, parentId = null) {
    const category = {
      id: generateUUID(),
      name: name.trim(),
      description: description.trim(),
      parentId,
      created: Date.now(),
      keywords: extractKeywords(description),
      examples: [],
      rules: []
    };
    
    this.categories.set(category.id, category);
    await this.persistCategories();
    return category.id;
  }
  
  async updateCategory(categoryId, updates) {
    const category = this.categories.get(categoryId);
    if (!category) throw new Error('Category not found');
    
    Object.assign(category, updates, { modified: Date.now() });
    await this.persistCategories();
  }
  
  async deleteCategory(categoryId, reassignToId = null) {
    // Handle tab reassignment
    await this.reassignTabsFromCategory(categoryId, reassignToId);
    
    // Remove from hierarchy
    this.removeFromHierarchy(categoryId);
    
    // Delete category
    this.categories.delete(categoryId);
    await this.persistCategories();
  }
}
```

#### User Interface Components
```javascript
// Category management UI
const CategoryManagementUI = {
  renderCategoryList() {
    return `
      <div class="category-management">
        <h2>Manage Categories</h2>
        <button class="add-category-btn">+ Add Category</button>
        <div class="category-list">
          ${this.categories.map(cat => this.renderCategoryItem(cat)).join('')}
        </div>
      </div>
    `;
  },
  
  renderCategoryForm(category = {}) {
    return `
      <form class="category-form">
        <input type="text" name="name" value="${category.name || ''}" 
               placeholder="Category Name" required>
        <textarea name="description" placeholder="Description and keywords">
          ${category.description || ''}
        </textarea>
        <select name="parentId">
          <option value="">No Parent</option>
          ${this.renderParentOptions(category.id)}
        </select>
        <button type="submit">Save Category</button>
      </form>
    `;
  }
};
```

#### Acceptance Criteria
- [ ] Users can create unlimited custom categories
- [ ] Categories support hierarchical organization (max 3 levels deep)
- [ ] Category names are unique within the same parent level
- [ ] Deleting categories provides options for tab reassignment
- [ ] Category changes take effect immediately for new tabs
- [ ] Export/import functionality for category configurations

#### Dependencies
- Enhanced options page UI framework
- UUID generation utility
- Data validation and sanitization
- Backup/restore functionality

---

### 2.2 Manual Corrections & Feedback Loop

#### Description
Implement a feedback system that allows users to correct categorization decisions and improve future accuracy.

#### Technical Requirements
- **Correction Interface**:
  - Right-click context menu on tab groups
  - Quick correction options in popup
  - Bulk correction for multiple tabs
  - Undo/redo functionality

#### Implementation Approach
```javascript
// Feedback and correction system
class CategorizationFeedback {
  constructor() {
    this.corrections = new Map();
    this.feedbackHistory = [];
  }
  
  async recordCorrection(tabId, originalCategory, correctedCategory, reason) {
    const correction = {
      id: generateUUID(),
      tabId,
      url: await this.getTabUrl(tabId),
      title: await this.getTabTitle(tabId),
      originalCategory,
      correctedCategory,
      reason,
      timestamp: Date.now(),
      applied: false
    };
    
    this.corrections.set(correction.id, correction);
    await this.applyCorrection(correction);
    await this.updateCategorizationModel(correction);
  }
  
  async applyCorrection(correction) {
    // Move tab to correct group
    await this.moveTabToCategory(correction.tabId, correction.correctedCategory);
    
    // Update correction status
    correction.applied = true;
    
    // Store for future reference
    await this.persistCorrections();
  }
  
  async updateCategorizationModel(correction) {
    // Add to training examples for this URL pattern
    const urlPattern = extractUrlPattern(correction.url);
    const trainingExample = {
      pattern: urlPattern,
      title: correction.title,
      correctCategory: correction.correctedCategory,
      confidence: 1.0, // User correction has high confidence
      source: 'user_feedback'
    };
    
    await this.addTrainingExample(trainingExample);
  }
}
```

#### User Interface Components
```javascript
// Correction UI elements
const CorrectionInterface = {
  createContextMenu() {
    chrome.contextMenus.create({
      id: 'correct-categorization',
      title: 'Correct Categorization',
      contexts: ['tab'],
      onclick: this.showCorrectionDialog
    });
  },
  
  showCorrectionDialog(tab) {
    const currentCategory = this.getCurrentTabCategory(tab.id);
    const availableCategories = this.getAllCategories();
    
    return `
      <div class="correction-dialog">
        <h3>Correct Categorization</h3>
        <p>Tab: ${tab.title}</p>
        <p>Current: ${currentCategory}</p>
        <select id="new-category">
          ${availableCategories.map(cat => 
            `<option value="${cat.id}">${cat.name}</option>`
          ).join('')}
        </select>
        <textarea placeholder="Why is this correction needed? (optional)">
        </textarea>
        <button onclick="applyCorrection()">Apply Correction</button>
        <button onclick="closeDialog()">Cancel</button>
      </div>
    `;
  },
  
  showBulkCorrectionInterface() {
    return `
      <div class="bulk-correction">
        <h3>Bulk Correction</h3>
        <div class="tab-selection">
          <!-- Multi-select tab list -->
        </div>
        <div class="category-assignment">
          <!-- Category selection -->
        </div>
        <button onclick="applyBulkCorrection()">Apply to Selected</button>
      </div>
    `;
  }
};
```

#### Acceptance Criteria
- [ ] Users can correct individual tab categorizations with 2 clicks
- [ ] Corrections immediately update tab grouping
- [ ] Correction reasons are collected for analysis
- [ ] Bulk correction supports up to 50 tabs at once
- [ ] Undo functionality available for last 10 corrections
- [ ] Learning system improves accuracy based on corrections

#### Dependencies
- Context menu API integration
- Enhanced popup UI framework
- Undo/redo state management
- Machine learning feedback integration

---

### 2.3 Rule-based Grouping System

#### Description
Allow users to define explicit rules for categorizing tabs based on domains, URL patterns, titles, or content patterns.

#### Technical Requirements
- **Rule Engine**:
  - Domain-based rules (exact domain, subdomain patterns)
  - URL pattern matching (regex support)
  - Title/content keyword rules
  - Rule priority and conflict resolution
  - Rule testing and validation

#### Implementation Approach
```javascript
// Rule-based categorization engine
class RuleEngine {
  constructor() {
    this.rules = new Map();
    this.ruleTypes = ['domain', 'url_pattern', 'title_keyword', 'content_keyword'];
  }
  
  createRule(name, type, pattern, categoryId, priority = 50) {
    const rule = {
      id: generateUUID(),
      name,
      type,
      pattern,
      categoryId,
      priority,
      enabled: true,
      created: Date.now(),
      matchCount: 0,
      lastMatched: null
    };
    
    this.validateRule(rule);
    this.rules.set(rule.id, rule);
    return rule.id;
  }
  
  async evaluateRules(tab) {
    const matchingRules = [];
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      
      const matches = await this.testRule(rule, tab);
      if (matches) {
        matchingRules.push({
          rule,
          confidence: this.calculateRuleConfidence(rule, tab)
        });
      }
    }
    
    // Sort by priority and confidence
    matchingRules.sort((a, b) => 
      (b.rule.priority - a.rule.priority) || (b.confidence - a.confidence)
    );
    
    return matchingRules[0]?.rule.categoryId || null;
  }
  
  async testRule(rule, tab) {
    switch (rule.type) {
      case 'domain':
        return this.testDomainRule(rule.pattern, tab.url);
      case 'url_pattern':
        return this.testUrlPatternRule(rule.pattern, tab.url);
      case 'title_keyword':
        return this.testTitleKeywordRule(rule.pattern, tab.title);
      case 'content_keyword':
        return await this.testContentKeywordRule(rule.pattern, tab);
      default:
        return false;
    }
  }
  
  testDomainRule(pattern, url) {
    const domain = new URL(url).hostname;
    
    if (pattern.startsWith('*.')) {
      // Subdomain wildcard
      const baseDomain = pattern.slice(2);
      return domain === baseDomain || domain.endsWith('.' + baseDomain);
    } else {
      // Exact domain match
      return domain === pattern;
    }
  }
}
```

#### User Interface Components
```javascript
// Rule management interface
const RuleManagementUI = {
  renderRuleBuilder() {
    return `
      <div class="rule-builder">
        <h3>Create New Rule</h3>
        <form class="rule-form">
          <input type="text" name="name" placeholder="Rule Name" required>
          
          <select name="type" onchange="updatePatternInput()">
            <option value="domain">Domain</option>
            <option value="url_pattern">URL Pattern</option>
            <option value="title_keyword">Title Keywords</option>
            <option value="content_keyword">Content Keywords</option>
          </select>
          
          <div class="pattern-input">
            <input type="text" name="pattern" placeholder="Enter pattern">
            <button type="button" onclick="testPattern()">Test</button>
          </div>
          
          <select name="categoryId" required>
            ${this.renderCategoryOptions()}
          </select>
          
          <input type="number" name="priority" value="50" min="1" max="100">
          
          <button type="submit">Create Rule</button>
        </form>
      </div>
    `;
  },
  
  renderRuleList() {
    return `
      <div class="rule-list">
        <h3>Active Rules</h3>
        <div class="rules">
          ${this.rules.map(rule => this.renderRuleItem(rule)).join('')}
        </div>
      </div>
    `;
  },
  
  renderRuleItem(rule) {
    return `
      <div class="rule-item ${rule.enabled ? 'enabled' : 'disabled'}">
        <div class="rule-header">
          <span class="rule-name">${rule.name}</span>
          <span class="rule-type">${rule.type}</span>
          <span class="rule-priority">Priority: ${rule.priority}</span>
        </div>
        <div class="rule-pattern">${rule.pattern}</div>
        <div class="rule-stats">
          Matches: ${rule.matchCount} | Last: ${rule.lastMatched || 'Never'}
        </div>
        <div class="rule-actions">
          <button onclick="editRule('${rule.id}')">Edit</button>
          <button onclick="toggleRule('${rule.id}')">
            ${rule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button onclick="deleteRule('${rule.id}')">Delete</button>
        </div>
      </div>
    `;
  }
};
```

#### Acceptance Criteria
- [ ] Users can create rules with regex pattern support
- [ ] Rules support priority-based conflict resolution
- [ ] Rule testing interface shows matches before saving
- [ ] Rules can be temporarily disabled without deletion
- [ ] Rule statistics show effectiveness metrics
- [ ] Export/import functionality for rule sets

#### Dependencies
- Regular expression engine
- Pattern validation utilities
- Rule conflict detection
- Performance optimization for rule evaluation

---

### 2.4 Personalization Engine

#### Description
Implement machine learning algorithms that adapt categorization based on user behavior patterns and preferences.

#### Technical Requirements
- **Learning Algorithms**:
  - Collaborative filtering for category preferences
  - Content-based recommendation for similar tabs
  - Temporal pattern recognition
  - User behavior clustering

#### Implementation Approach
```javascript
// Personalization and learning system
class PersonalizationEngine {
  constructor() {
    this.userProfile = new Map();
    this.behaviorHistory = [];
    this.preferenceModel = null;
  }
  
  async recordBehavior(event) {
    const behaviorEvent = {
      timestamp: Date.now(),
      type: event.type, // 'tab_focus', 'tab_close', 'group_switch', etc.
      tabId: event.tabId,
      category: event.category,
      duration: event.duration,
      context: event.context
    };
    
    this.behaviorHistory.push(behaviorEvent);
    await this.updatePreferenceModel();
  }
  
  async updatePreferenceModel() {
    // Analyze recent behavior patterns
    const recentBehavior = this.getRecentBehavior(7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Calculate category preferences
    const categoryPreferences = this.calculateCategoryPreferences(recentBehavior);
    
    // Identify temporal patterns
    const temporalPatterns = this.analyzeTemporalPatterns(recentBehavior);
    
    // Update preference model
    this.preferenceModel = {
      categoryPreferences,
      temporalPatterns,
      contextualPreferences: this.analyzeContextualPreferences(recentBehavior),
      lastUpdated: Date.now()
    };
    
    await this.persistPreferenceModel();
  }
  
  async getPersonalizedCategorySuggestions(tab, context = {}) {
    if (!this.preferenceModel) {
      return this.getDefaultCategorySuggestions(tab);
    }
    
    const suggestions = [];
    
    // Apply preference weights
    const baseCategories = await this.getCategorySuggestions(tab);
    for (const category of baseCategories) {
      const preference = this.preferenceModel.categoryPreferences.get(category.id) || 0.5;
      const temporalBoost = this.getTemporalBoost(category.id, context.timeOfDay);
      const contextualBoost = this.getContextualBoost(category.id, context);
      
      suggestions.push({
        ...category,
        score: category.score * preference * temporalBoost * contextualBoost
      });
    }
    
    return suggestions.sort((a, b) => b.score - a.score);
  }
  
  calculateCategoryPreferences(behaviorHistory) {
    const preferences = new Map();
    const categoryTime = new Map();
    const categoryInteractions = new Map();
    
    for (const event of behaviorHistory) {
      if (!event.category) continue;
      
      // Track time spent in each category
      if (event.type === 'tab_focus' && event.duration) {
        categoryTime.set(event.category, 
          (categoryTime.get(event.category) || 0) + event.duration
        );
      }
      
      // Track interaction frequency
      categoryInteractions.set(event.category,
        (categoryInteractions.get(event.category) || 0) + 1
      );
    }
    
    // Normalize preferences (0-1 scale)
    const maxTime = Math.max(...categoryTime.values());
    const maxInteractions = Math.max(...categoryInteractions.values());
    
    for (const [category, time] of categoryTime) {
      const timeWeight = time / maxTime;
      const interactionWeight = (categoryInteractions.get(category) || 0) / maxInteractions;
      preferences.set(category, (timeWeight + interactionWeight) / 2);
    }
    
    return preferences;
  }
}
```

#### Acceptance Criteria
- [ ] System learns from user corrections within 24 hours
- [ ] Personalized suggestions improve accuracy by 10% after 1 week of use
- [ ] Temporal patterns influence categorization appropriately
- [ ] User behavior tracking respects privacy settings
- [ ] Learning model can be reset/cleared by user
- [ ] Personalization works offline using cached models

#### Dependencies
- Machine learning algorithms
- Privacy-compliant behavior tracking
- Statistical analysis utilities
- Model persistence and versioning

## Implementation Priority

### Phase 1 (Foundation)
1. **Custom Categories Management** - Essential for user control
2. **Manual Corrections & Feedback Loop** - Critical for improving accuracy

### Phase 2 (Advanced)
3. **Rule-based Grouping System** - Power user features
4. **Personalization Engine** - Long-term learning and adaptation

## Technical Considerations

### Data Architecture
```javascript
// Enhanced storage schema
const customizationSchema = {
  categories: {
    [categoryId]: {
      id: String,
      name: String,
      description: String,
      parentId: String | null,
      keywords: Array<String>,
      examples: Array<Object>,
      rules: Array<String>, // Rule IDs
      created: Number,
      modified: Number
    }
  },
  rules: {
    [ruleId]: {
      id: String,
      name: String,
      type: String,
      pattern: String,
      categoryId: String,
      priority: Number,
      enabled: Boolean,
      matchCount: Number,
      created: Number
    }
  },
  corrections: {
    [correctionId]: {
      id: String,
      tabId: Number,
      url: String,
      originalCategory: String,
      correctedCategory: String,
      reason: String,
      timestamp: Number
    }
  },
  userPreferences: {
    categoryPreferences: Map,
    temporalPatterns: Object,
    behaviorHistory: Array,
    lastModelUpdate: Number
  }
};
```

### Performance Considerations
- **Rule Evaluation**: Optimize rule engine for <10ms evaluation time
- **Learning Model**: Update incrementally, not full recalculation
- **Storage Management**: Implement data retention policies
- **UI Responsiveness**: Lazy load category management interfaces

### Privacy & Security
- **Behavior Tracking**: Explicit user consent required
- **Data Retention**: Configurable retention periods
- **Export Controls**: Allow users to export all personal data
- **Anonymization**: Remove personal identifiers from analytics

## User Experience Design

### Onboarding Flow
1. **Introduction**: Explain customization benefits
2. **Category Setup**: Guide through creating first custom category
3. **Rule Creation**: Walk through simple rule creation
4. **Feedback Training**: Show how to provide corrections

### Progressive Disclosure
- **Basic Users**: Simple category management
- **Power Users**: Advanced rule creation and testing
- **Experts**: Full personalization control and analytics

## Testing Strategy

### Unit Testing
- Category CRUD operations
- Rule evaluation algorithms
- Personalization model calculations
- Data validation and sanitization

### Integration Testing
- End-to-end customization workflows
- Cross-component data consistency
- Performance under various data sizes
- Privacy compliance verification

### User Testing
- Usability testing of management interfaces
- A/B testing of personalization effectiveness
- Feedback collection on feature adoption
- Long-term user retention analysis

## Success Metrics

### Adoption Metrics
- **Category Creation**: Average custom categories per user
- **Rule Usage**: Percentage of users creating rules
- **Correction Frequency**: Corrections per user per week
- **Feature Engagement**: Time spent in customization interfaces

### Effectiveness Metrics
- **Accuracy Improvement**: Measured improvement in categorization
- **User Satisfaction**: Surveys on categorization quality
- **Reduced Manual Work**: Decrease in manual regrouping
- **Learning Speed**: Time to achieve personalization benefits

### Technical Metrics
- **Performance Impact**: Processing time increase
- **Storage Usage**: Data growth patterns
- **Error Rates**: Failed operations and recoveries
- **API Efficiency**: Reduced need for external API calls

## Risk Mitigation

### High Priority Risks
- **Complexity Overwhelm**: Progressive feature introduction
- **Performance Degradation**: Continuous performance monitoring
- **Data Privacy Concerns**: Transparent privacy controls

### Medium Priority Risks
- **Feature Adoption**: Clear value demonstration
- **Technical Debt**: Modular architecture design
- **User Error Recovery**: Comprehensive undo capabilities

## Migration Strategy

### Backward Compatibility
- Existing tab groups become default categories
- Current domain descriptions migrate to rules
- Gradual feature rollout with opt-in controls

### Data Migration
```javascript
// Migration utilities
const migrationUtils = {
  async migrateExistingGroups() {
    const existingGroups = await chrome.tabGroups.query({});
    for (const group of existingGroups) {
      await categoryManager.createCategory(
        group.title || 'Untitled',
        `Migrated from existing tab group`,
        null
      );
    }
  },
  
  async migrateDomainDescriptions() {
    const domainDescriptions = await chrome.storage.sync.get();
    for (const [domain, description] of Object.entries(domainDescriptions)) {
      if (this.isDomainDescription(domain, description)) {
        await ruleEngine.createRule(
          `Domain rule for ${domain}`,
          'domain',
          domain,
          await this.findOrCreateCategory(description)
        );
      }
    }
  }
};
``` 