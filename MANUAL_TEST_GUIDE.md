# Manual Testing Guide

## Testing the Chrome AI Tabs Extension

### Prerequisites
1. Chrome browser
2. OpenAI API key
3. Multiple tabs open for testing

### Installation
1. Load the extension in Chrome Developer Mode
2. Navigate to chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

### Configuration
1. Right-click the extension icon and select "Options"
2. Enter your OpenAI API key
3. Set the model (default: gpt-4o-mini)
4. Configure categories (optional - will use defaults if empty)
5. Save settings

### Testing Scenarios

#### Scenario 1: Basic Functionality Test
1. Open 10-15 tabs from different domains (news sites, GitHub, social media, etc.)
2. Click the extension icon to open popup
3. Enable "Enable Auto-Categorization" if desired
4. Click "Regroup All Tabs"
5. **Expected Result**: Tabs should be organized into logical groups within 2-5 seconds

#### Scenario 2: Large Dataset Test
1. Open 50+ tabs from various websites
2. Click "Regroup All Tabs"
3. **Expected Result**: Should complete in under 30 seconds with batch processing

#### Scenario 3: Error Handling Test
1. Configure extension with invalid API key
2. Try to regroup tabs
3. **Expected Result**: Should show error message without crashing

#### Scenario 4: Mixed Content Test
1. Open tabs including:
   - Chrome settings pages (chrome://)
   - Extension pages (chrome-extension://)
   - Regular websites
2. Click "Regroup All Tabs"
3. **Expected Result**: Only regular websites should be grouped

### Expected Performance
- **Small datasets (< 20 tabs)**: 2-5 seconds
- **Medium datasets (20-100 tabs)**: 5-15 seconds  
- **Large datasets (100+ tabs)**: 15-60 seconds

### Console Logging
Open Developer Tools and check console for:
- "Using batch processing approach" - indicates batch mode is active
- Step-by-step progress messages
- Error messages if any issues occur

### Troubleshooting
1. If batch processing fails, check console for error messages
2. Extension should automatically fall back to individual processing
3. Verify API key is correctly configured in options
4. Check that tabs are not in chrome:// or chrome-extension:// URLs