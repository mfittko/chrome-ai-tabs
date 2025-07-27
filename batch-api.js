/**
 * Batch API for OpenAI Categorization  
 * Handles efficient batch processing of tabs through OpenAI API
 */

/**
 * Creates a structured prompt for batch categorization
 * @param {Array} tabs - Array of tab metadata objects
 * @param {Array} existingCategories - Array of existing category names
 * @param {number} maxNewCategories - Maximum number of new categories to create
 * @returns {Object} Structured prompt object
 */
function createBatchPrompt(tabs, existingCategories = [], maxNewCategories = 5) {
  return {
    tabs: tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      domain: tab.domain,
      url: tab.url,
      description: tab.description || '',
      pathname: tab.pathname || ''
    })),
    existingCategories,
    maxNewCategories,
    instructions: "Categorize each tab into the most appropriate category. Use existing categories when possible, but create new ones if needed (up to the specified limit). Provide confidence scores and brief reasoning."
  };
}

/**
 * Builds the system prompt for OpenAI
 * @param {Array} existingCategories - Existing categories 
 * @param {number} maxNewCategories - Max new categories allowed
 * @returns {string} System prompt text
 */
function buildSystemPrompt(existingCategories, maxNewCategories) {
  const existingCategoriesText = existingCategories.length > 0 
    ? `Existing categories: ${existingCategories.join(', ')}`
    : 'No existing categories defined.';
    
  return `You are a tab categorization assistant. Your task is to categorize web browser tabs into logical groups.

${existingCategoriesText}

Rules:
1. Use existing categories when appropriate
2. Create new categories only when necessary (max ${maxNewCategories} new categories)
3. Categories should be clear, concise, and meaningful
4. Provide confidence scores (0.0-1.0) for each categorization
5. Include brief reasoning for your categorization decisions

Return your response as a valid JSON object with this exact structure:
{
  "categorizedTabs": [
    {
      "id": 12345,
      "category": "Category Name",
      "confidence": 0.95,
      "reasoning": "Brief explanation of why this category fits"
    }
  ],
  "newCategories": ["New Category 1", "New Category 2"],
  "summary": "Brief summary of the categorization process"
}`;
}

/**
 * Builds the user prompt with tab data
 * @param {Array} tabs - Tab metadata array
 * @returns {string} User prompt with tab data
 */
function buildUserPrompt(tabs) {
  const tabsText = tabs.map(tab => 
    `ID: ${tab.id}, Title: "${tab.title}", Domain: ${tab.domain}, URL: ${tab.url}`
  ).join('\n');
  
  return `Please categorize these ${tabs.length} tabs:\n\n${tabsText}`;
}

/**
 * Sends batch categorization request to OpenAI
 * @param {Array} tabs - Array of tab metadata
 * @param {Array} existingCategories - Existing categories
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - OpenAI model to use
 * @param {number} maxNewCategories - Max new categories to create
 * @returns {Promise<Object>} Categorization response
 */
async function sendBatchCategorizationRequest(tabs, existingCategories, apiKey, model, maxNewCategories = 5) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  
  if (!tabs || tabs.length === 0) {
    throw new Error('No tabs provided for categorization');
  }
  
  console.log(`Sending batch categorization request for ${tabs.length} tabs`);
  
  const systemPrompt = buildSystemPrompt(existingCategories, maxNewCategories);
  const userPrompt = buildUserPrompt(tabs);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user', 
            content: userPrompt
          }
        ],
        max_tokens: Math.min(4000, tabs.length * 50), // Scale tokens with number of tabs
        temperature: 0.3 // Lower temperature for more consistent categorization
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API');
    }
    
    const content = data.choices[0].message.content.trim();
    console.log('Received categorization response:', content);
    
    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.warn('Failed to parse JSON response, attempting to extract JSON:', parseError);
      // Try to extract JSON from the response if it's wrapped in other text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Response is not valid JSON');
      }
    }
    
    // Validate response structure
    if (!parsedResponse.categorizedTabs || !Array.isArray(parsedResponse.categorizedTabs)) {
      throw new Error('Response missing categorizedTabs array');
    }
    
    console.log(`Successfully categorized ${parsedResponse.categorizedTabs.length} tabs`);
    return parsedResponse;
    
  } catch (error) {
    console.error('Batch categorization request failed:', error);
    throw error;
  }
}

/**
 * Handles chunking of large tab sets to avoid API limits
 * @param {Array} tabs - All tabs to categorize
 * @param {Array} existingCategories - Existing categories  
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - OpenAI model
 * @param {number} maxTabsPerRequest - Max tabs per API request
 * @returns {Promise<Object>} Combined categorization results
 */
async function handleLargeDataset(tabs, existingCategories, apiKey, model, maxTabsPerRequest = 100) {
  if (tabs.length <= maxTabsPerRequest) {
    return sendBatchCategorizationRequest(tabs, existingCategories, apiKey, model);
  }
  
  console.log(`Chunking ${tabs.length} tabs into batches of ${maxTabsPerRequest}`);
  
  const chunks = [];
  for (let i = 0; i < tabs.length; i += maxTabsPerRequest) {
    chunks.push(tabs.slice(i, i + maxTabsPerRequest));
  }
  
  const allCategorizedTabs = [];
  const allNewCategories = new Set();
  let currentCategories = [...existingCategories];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} tabs)`);
    
    try {
      const result = await sendBatchCategorizationRequest(
        chunk, 
        currentCategories, 
        apiKey, 
        model
      );
      
      allCategorizedTabs.push(...result.categorizedTabs);
      
      // Add new categories to the set and current categories for next chunk
      if (result.newCategories) {
        result.newCategories.forEach(cat => allNewCategories.add(cat));
        currentCategories.push(...result.newCategories);
      }
      
      // Small delay between requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`Failed to process chunk ${i + 1}:`, error);
      // Continue with other chunks even if one fails
    }
  }
  
  return {
    categorizedTabs: allCategorizedTabs,
    newCategories: Array.from(allNewCategories),
    summary: `Processed ${tabs.length} tabs in ${chunks.length} chunks, created ${allNewCategories.size} new categories`
  };
}

/**
 * Main function to categorize a batch of tabs
 * @param {Array} tabs - Tab metadata array
 * @param {Array} categories - Existing categories
 * @param {string} apiKey - OpenAI API key  
 * @param {string} model - OpenAI model
 * @returns {Promise<Object>} Categorization results
 */
async function categorizeBatch(tabs, categories = [], apiKey = null, model = null) {
  try {
    console.log('Starting batch categorization...');
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No tabs provided for categorization');
    }
    
    // Use provided apiKey and model, or get from storage
    const finalApiKey = apiKey || await getApiKeyFromStorage();
    const finalModel = model || await getModelFromStorage();
    
    if (!finalApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    console.log(`Categorizing ${tabs.length} tabs using model ${finalModel}`);
    
    // Handle large datasets by chunking if necessary
    const result = await handleLargeDataset(tabs, categories, finalApiKey, finalModel);
    
    console.log('Batch categorization completed successfully');
    return result;
    
  } catch (error) {
    console.error('Batch categorization failed:', error);
    throw error;
  }
}

/**
 * Helper function to get API key from Chrome storage
 * @returns {Promise<string>} API key
 */
function getApiKeyFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['openaiApiKey'], (items) => {
      resolve(items.openaiApiKey || '');
    });
  });
}

/**
 * Helper function to get model from Chrome storage  
 * @returns {Promise<string>} Model name
 */
function getModelFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['openaiModel'], (items) => {
      resolve(items.openaiModel || 'gpt-4o-mini');
    });
  });
}

// Export functions for testing and module usage
const __test_exports = {
  createBatchPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  sendBatchCategorizationRequest,
  handleLargeDataset,
  categorizeBatch,
  getApiKeyFromStorage,
  getModelFromStorage
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createBatchPrompt,
    sendBatchCategorizationRequest,
    handleLargeDataset,
    categorizeBatch,
    __test_exports
  };
}