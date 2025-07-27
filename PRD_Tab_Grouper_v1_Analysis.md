# Product Requirements Document: Tab Grouper Chrome Extension v1 - Reverse Engineering Analysis

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Current Features & Functionality](#current-features--functionality)
4. [Technical Architecture](#technical-architecture)
5. [User Interface & Experience](#user-interface--experience)
6. [User Personas & Use Cases](#user-personas--use-cases)
7. [Performance & Constraints](#performance--constraints)
8. [Data Flow & Storage](#data-flow--storage)
9. [API Dependencies](#api-dependencies)
10. [Testing Strategy](#testing-strategy)
11. [Identified Limitations & Areas for Improvement](#identified-limitations--areas-for-improvement)
12. [Success Metrics](#success-metrics)
13. [Recommendations for v2](#recommendations-for-v2)

## Executive Summary

Tab Grouper is an intelligent Chrome extension that automatically organizes browser tabs using OpenAI's advanced language models and embedding technology. The extension provides both automatic tab categorization and manual grouping capabilities, leveraging AI to understand tab content and group similar tabs together for improved productivity and browser organization.

**Current Version:** 1.0.0  
**Target Users:** Knowledge workers, researchers, students, and power browser users  
**Core Value Proposition:** Reduce tab chaos through intelligent, AI-powered automatic tab organization

## Product Overview

### Vision
To eliminate browser tab clutter by providing intelligent, context-aware tab organization that learns from user behavior and content patterns.

### Mission
Empower users to maintain organized, productive browsing sessions through seamless AI-powered tab management that works automatically in the background.

### Product Category
Browser productivity tool / Tab management extension

## Current Features & Functionality

### 1. Automatic Tab Categorization
- **Real-time Processing**: Monitors tab updates and categorizes new tabs as they load
- **Content Analysis**: Analyzes URL, page title, and meta tags (og:description, og:title)
- **Multi-modal Classification**: Uses both vector embeddings and LLM-based categorization
- **Fallback Mechanisms**: Hierarchical approach from embeddings to LLM to clustering

### 2. Intelligent Tab Grouping
- **Existing Group Integration**: Places tabs into existing Chrome tab groups when similarity threshold is met (>0.7)
- **Dynamic Group Creation**: Creates new tab groups for unmatched tabs
- **Smart Labeling**: Generates concise 1-2 word group titles using LLM
- **Hierarchical Clustering**: Groups uncategorized tabs using bottom-up clustering with average linkage

### 3. User Configuration
- **API Settings**: OpenAI API key and model configuration
- **Auto-categorization Toggle**: User can enable/disable automatic processing
- **Custom Descriptions**: Per-domain default descriptions for improved categorization
- **Manual Regroup**: On-demand regrouping of all tabs

### 4. Performance Optimization
- **Multi-level Caching**: 
  - Category cache for repeated URL/title/meta combinations
  - Embeddings cache for text similarity calculations
  - Leftover tabs cache to avoid redundant clustering
- **Smart Tab Filtering**: Skips pinned tabs, Chrome internal pages, and single-tab windows
- **Threshold-based Decisions**: Configurable similarity thresholds for grouping decisions

### 5. Background Processing
- **Service Worker Architecture**: Manifest v3 compliant background processing
- **Event-driven Updates**: Responds to tab update events
- **Window Context Awareness**: Only processes normal windows, skips fullscreen/minimized states

## Technical Architecture

### Core Components

#### 1. Background Script (`background.js`)
- **Purpose**: Main orchestration layer
- **Key Functions**:
  - Tab event monitoring (`chrome.tabs.onUpdated`)
  - Initialization and cache management
  - Message handling for UI interactions
  - Window and tab filtering logic

#### 2. Categorization Engine (`categorization.js`)
- **Purpose**: Core AI-powered classification logic
- **Key Functions**:
  - `categorizeTab()`: Main categorization entry point
  - `groupTab()`: Places tabs in existing groups using similarity
  - `categorizeAndGroupUngroupedTabs()`: Processes multiple tabs
  - Vector-based category matching with embeddings

#### 3. API Layer (`api.js`)
- **Purpose**: OpenAI API integration and data fetching
- **Key Functions**:
  - `fetchOpenAI()`: Chat completions API calls
  - `fetchEmbeddings()`: Text embedding generation
  - `getMetaTags()`: Content scraping via content scripts
  - Settings management (API key, model selection)

#### 4. Hierarchical Clustering (`hierarchical.js`)
- **Purpose**: Advanced grouping for uncategorized tabs
- **Key Functions**:
  - `clusterAndGroupTabs()`: Main clustering orchestration
  - Bottom-up hierarchical clustering with average linkage
  - Automated cluster labeling via LLM
  - Distance threshold-based merging (default: 0.3)

#### 5. Utilities (`utils.js`)
- **Purpose**: Shared helper functions
- **Key Functions**:
  - `cosineSimilarity()`: Vector similarity calculations
  - `shouldSkipTab()`: Tab filtering logic
  - `timestamp()`: Logging utilities

### Data Flow Architecture

```
Tab Update Event → Background Script → Categorization Engine → API Layer
                                           ↓
                  Chrome Tab Groups ← Group Management ← AI Processing
                                           ↓
                              Hierarchical Clustering (if needed)
```

### Technology Stack
- **Runtime**: Chrome Extension Manifest v3
- **Language**: JavaScript (ES6+ modules)
- **AI Provider**: OpenAI (GPT-4o-mini, text-embedding-3-small)
- **Storage**: Chrome Storage API (sync and local)
- **Browser APIs**: Tabs, TabGroups, Scripting, Windows
- **Testing**: Jest with jest-chrome mocking

## User Interface & Experience

### 1. Popup Interface (`popup/`)
- **Size**: Compact popup window
- **Primary Controls**:
  - Auto-categorization toggle switch
  - Default description input field
  - Save button for settings
  - "Regroup All Tabs" button for manual operation
  - Status message display
- **Interaction Model**: Quick access for common operations

### 2. Options Page (`options/`)
- **Location**: Full-tab settings page
- **Configuration Options**:
  - OpenAI API Key input
  - Model selection input
  - Category configuration (inferred from current groups)
- **Access**: Via Chrome extension options or popup link

### 3. User Feedback
- **Status Messages**: Real-time feedback in popup
- **Console Logging**: Detailed operation logs for debugging
- **Error Handling**: Graceful degradation when API unavailable

## User Personas & Use Cases

### Primary Persona: The Research Professional
- **Profile**: Academic researchers, analysts, consultants
- **Pain Points**: Managing 20+ tabs across multiple research topics
- **Use Cases**:
  - Automatically group research papers by topic
  - Organize news articles by subject area
  - Maintain separate contexts for different projects

### Secondary Persona: The Knowledge Worker
- **Profile**: Software developers, product managers, designers
- **Pain Points**: Context switching between different work streams
- **Use Cases**:
  - Group documentation and tools by project
  - Separate learning resources from work tasks
  - Organize communication tools and references

### Tertiary Persona: The Information Consumer
- **Profile**: Students, general users with high tab volume
- **Pain Points**: Browser performance degradation, lost tabs
- **Use Cases**:
  - Group educational content by subject
  - Organize shopping and entertainment tabs
  - Reduce cognitive load from tab clutter

## Performance & Constraints

### Performance Characteristics
- **Categorization Latency**: ~100-500ms per tab (API dependent)
- **Embedding Cache Hit Rate**: High for repeated content patterns
- **Memory Usage**: Lightweight background script, moderate cache storage
- **API Rate Limiting**: Dependent on OpenAI tier and usage patterns

### Current Limitations
- **API Dependency**: Requires active OpenAI API key and internet connection
- **Chrome-specific**: Only works in Chrome browser with tab groups support
- **Processing Scope**: Only processes "normal" windows, skips incognito
- **Content Access**: Limited to publicly available meta tags and titles

### Resource Constraints
- **Storage**: Chrome extension storage limits
- **Permissions**: Requires broad host permissions for meta tag access
- **Processing**: Single-threaded JavaScript execution
- **Network**: API call frequency limited by rate limits and costs

## Data Flow & Storage

### Storage Architecture

#### Chrome Storage Sync
- **Purpose**: User settings that sync across devices
- **Contents**:
  - `openaiApiKey`: User's OpenAI API key
  - `openaiModel`: Selected model (default: gpt-4o-mini)
  - Domain-specific default descriptions

#### Chrome Storage Local
- **Purpose**: Performance caches and temporary data
- **Contents**:
  - `categoryCache`: URL/title/meta → category mappings
  - `embeddingsCache`: Text → embedding vector mappings
  - `leftoverTabsCache`: Snapshot of uncategorized tabs
  - `autoCategorize`: Auto-categorization toggle state
  - `tabCategoryAssignments`: Tab ID → category mappings

### Data Privacy & Security
- **User Data**: API keys stored locally, not transmitted to third parties
- **Content Processing**: Only titles, URLs, and meta tags processed
- **API Communication**: Direct connection to OpenAI, no intermediary servers
- **Cache Management**: Periodic cache clearing on extension updates

## API Dependencies

### OpenAI API Integration

#### Chat Completions API
- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Default Model**: `gpt-4o-mini`
- **Usage Patterns**:
  - Tab categorization (when embeddings insufficient)
  - Cluster labeling
  - Fallback classification
- **Token Limits**: 10 tokens max for categorization, variable for labeling

#### Embeddings API
- **Endpoint**: `https://api.openai.com/v1/embeddings`
- **Model**: `text-embedding-3-small`
- **Usage Patterns**:
  - Content similarity comparison
  - Group matching decisions
  - Hierarchical clustering distance calculations

### Chrome Extension APIs

#### Core APIs
- `chrome.tabs`: Tab monitoring and querying
- `chrome.tabGroups`: Group creation and management
- `chrome.storage`: Settings and cache persistence
- `chrome.scripting`: Meta tag content extraction
- `chrome.windows`: Window context awareness

#### Permissions Required
- `tabs`: Access to tab information
- `tabGroups`: Tab group manipulation
- `storage`: Data persistence
- `scripting`: Content script injection
- `activeTab`: Current tab access
- `host_permissions`: All URLs for meta tag access

## Testing Strategy

### Current Test Coverage

#### Unit Tests
- **Background Script Tests**: Core functionality validation
- **API Layer Tests**: OpenAI integration mocking
- **Popup Tests**: UI interaction testing
- **Options Tests**: Settings persistence testing

#### Test Framework
- **Runner**: Jest
- **Mocking**: jest-chrome for Chrome API simulation
- **Coverage Areas**:
  - Tab categorization logic
  - Storage operations
  - UI event handling
  - Error scenarios

#### Mock Strategy
- Chrome APIs fully mocked
- OpenAI API responses simulated
- Tab and window objects fabricated
- Storage operations intercepted

### Testing Gaps
- Integration testing with real Chrome environment
- Performance testing under high tab volumes
- API rate limiting and error handling
- Cross-browser compatibility (Edge, other Chromium browsers)

## Identified Limitations & Areas for Improvement

### Functional Limitations

#### 1. Content Analysis Depth
- **Current**: Limited to titles, URLs, and basic meta tags
- **Gap**: No full page content analysis or semantic understanding
- **Impact**: May misclassify tabs with misleading titles

#### 2. User Learning & Customization
- **Current**: No learning from user corrections or preferences
- **Gap**: Static categorization without adaptation
- **Impact**: Repeated misclassifications, user frustration

#### 3. Category Management
- **Current**: Categories inferred from existing tab groups
- **Gap**: No explicit category creation or management
- **Impact**: Limited control over classification taxonomy

#### 4. Multi-window Support
- **Current**: Processes only current window
- **Gap**: No cross-window organization or global view
- **Impact**: Fragmented organization across browser windows

### Technical Limitations

#### 1. Performance Scalability
- **Current**: Sequential processing of tabs
- **Gap**: No batch processing or parallel operations
- **Impact**: Slow processing with many tabs

#### 2. Offline Functionality
- **Current**: Requires internet for all operations
- **Gap**: No offline classification or basic grouping
- **Impact**: Complete feature unavailability without connectivity

#### 3. Error Recovery
- **Current**: Basic error logging
- **Gap**: No retry mechanisms or graceful degradation
- **Impact**: Failed operations without user notification

#### 4. Resource Management
- **Current**: Unbounded cache growth
- **Gap**: No cache size limits or cleanup strategies
- **Impact**: Potential memory issues with heavy usage

### User Experience Limitations

#### 1. Feedback & Transparency
- **Current**: Minimal user feedback on operations
- **Gap**: No progress indicators or operation explanations
- **Impact**: Users uncertain about extension status

#### 2. Manual Override Options
- **Current**: Limited manual control over categorization
- **Gap**: No easy way to correct or customize categories
- **Impact**: Users cannot improve accuracy through feedback

#### 3. Onboarding & Setup
- **Current**: Basic API key configuration
- **Gap**: No guided setup or feature explanation
- **Impact**: High barrier to entry for non-technical users

## Success Metrics

### Quantitative Metrics

#### Usage Metrics
- **Daily Active Users**: Extension usage frequency
- **Tabs Processed**: Total tabs categorized per day/week
- **Group Creation Rate**: New tab groups created vs. existing group usage
- **Auto-categorization Adoption**: Percentage of users with feature enabled

#### Performance Metrics
- **Categorization Accuracy**: User satisfaction with automatic grouping
- **Processing Speed**: Average time from tab load to grouping
- **Cache Hit Rate**: Efficiency of caching mechanisms
- **API Success Rate**: Successful API calls vs. failures

#### Engagement Metrics
- **Manual Regroup Usage**: Frequency of manual regroup operations
- **Settings Modification**: User engagement with configuration options
- **Retention Rate**: User continuation after initial setup

### Qualitative Metrics

#### User Satisfaction
- **Tab Organization Quality**: Perceived usefulness of groupings
- **Productivity Impact**: Reported improvement in browsing efficiency
- **Cognitive Load Reduction**: User-reported decrease in tab overwhelm

#### Technical Quality
- **Extension Reliability**: Crash rates and error frequency
- **Browser Performance Impact**: Effect on overall browser speed
- **Resource Efficiency**: Memory and CPU usage patterns

## Recommendations for v2

### High Priority Enhancements

#### 1. Enhanced Content Analysis
- **Full Page Content**: Extract and analyze page body content
- **Image Recognition**: Analyze page screenshots for visual categorization
- **Link Graph Analysis**: Consider outgoing/incoming links for context
- **Temporal Patterns**: Learn from user browsing patterns over time

#### 2. Advanced User Customization
- **Custom Categories**: User-defined category creation and management
- **Manual Corrections**: Feedback loop for improving categorization
- **Rule-based Grouping**: User-defined rules for specific domains/patterns
- **Personalization Engine**: Machine learning from user behavior

#### 3. Cross-window Management
- **Global Tab View**: Unified interface for all browser windows
- **Workspace Concepts**: Organize windows by project/context
- **Tab Migration**: Move tabs between windows/workspaces
- **Session Management**: Save and restore organized tab sessions

### Medium Priority Improvements

#### 4. Performance & Scalability
- **Batch Processing**: Group multiple tab operations
- **Progressive Loading**: Lazy categorization for background tabs
- **Local AI Models**: Offline capability with local embeddings
- **Smart Caching**: Intelligent cache eviction and preloading

#### 5. User Experience Enhancement
- **Visual Feedback**: Progress indicators and operation status
- **Onboarding Flow**: Guided setup and feature introduction
- **Keyboard Shortcuts**: Power user efficiency features
- **Group Visualization**: Enhanced visual representation of groups

#### 6. Integration & Ecosystem
- **Bookmark Integration**: Sync with browser bookmarks
- **External Services**: Integration with note-taking apps
- **Export/Import**: Backup and restore group configurations
- **Team Features**: Shared configurations for organizational use

### Low Priority Features

#### 7. Advanced Analytics
- **Usage Analytics**: Detailed insights into browsing patterns
- **Productivity Metrics**: Quantified impact on user efficiency
- **Group Health**: Quality metrics for tab group organization
- **Trend Analysis**: Long-term patterns in tab usage

#### 8. Extended Platform Support
- **Multi-browser Support**: Firefox, Safari, Edge extensions
- **Mobile Integration**: Sync with mobile browser sessions
- **Desktop Integration**: OS-level tab management
- **API Platform**: Third-party integration capabilities

### Technical Architecture Improvements

#### 9. Modernization & Reliability
- **TypeScript Migration**: Enhanced code quality and maintainability
- **Enhanced Testing**: Integration and end-to-end test coverage
- **Error Handling**: Comprehensive retry and fallback mechanisms
- **Performance Monitoring**: Real-time performance metrics

#### 10. Security & Privacy
- **Enhanced Privacy**: Minimize data collection and processing
- **Security Audit**: Comprehensive security review and improvements
- **Compliance**: GDPR/privacy regulation compliance
- **Local Processing**: Reduce dependency on external APIs

---

This PRD serves as a comprehensive analysis of the current Tab Grouper extension and provides a roadmap for v2 development. The document should be regularly updated based on user feedback, usage analytics, and evolving browser capabilities. 