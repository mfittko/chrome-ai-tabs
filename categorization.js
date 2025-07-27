import { timestamp, cosineSimilarity } from './utils.js';
import { getApiKey, getModel, getCategories, getMetaTags, fetchOpenAI, fetchEmbeddings } from './api.js';
import { clusterAndGroupTabs } from './hierarchical.js';

/**
 * getVectorCategory:
 *  - Uses embeddings to compare "combined info about the tab" vs. each known category.
 *  - combined info includes title, metaTags, domain, and a user-defined default description.
 */
async function getVectorCategory(apiKey, url, title, metaTags, categories) {
  const metaTagsString = Array.isArray(metaTags) ? metaTags.join(', ') : (metaTags || '');
  const textToEmbed = `${title}\n${url}\n${metaTagsString}`.toLowerCase();

  const embeddings = await fetchEmbeddings(apiKey, [textToEmbed, ...categories]);
  if (!embeddings) {
    console.log(timestamp(), 'getVectorCategory: No embeddings returned.');
    return null;
  }

  const [combinedEmbedding, ...categoryEmbeddings] = embeddings;

  let bestMatchCategory = null;
  let maxSimilarity = -1;

  categoryEmbeddings.forEach((embedding, i) => {
    const sim = cosineSimilarity(combinedEmbedding, embedding);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      bestMatchCategory = categories[i].toLowerCase();
    }
  });

  if (maxSimilarity > 0.6) {
    console.log(timestamp(), `getVectorCategory: url=${url}, bestMatch=${bestMatchCategory}, sim=${maxSimilarity}`);
    return bestMatchCategory;
  }

  console.log(timestamp(), `getVectorCategory: No confident match (url=${url}, bestMatch=${bestMatchCategory}, bestSim=${maxSimilarity})`);
  return null;
}

async function getCachedCategory(apiKey, model, url, title, metaTags, categories) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['categoryCache'], async (res) => {
      const cache = res.categoryCache || {};
      const cacheKey = JSON.stringify({ url, title, metaTags, categories });
      if (cache[cacheKey]) {
        return resolve(cache[cacheKey]);
      }

      let category = await getVectorCategory(apiKey, url, title, metaTags, categories);

      if (!category) {
        console.log(timestamp(), 'Vector-based categorization failed. Fallback to LLM.');
        category = await fetchOpenAI(apiKey, model, [
          {
            role: 'system',
            content: `Categorize the following URL, title, and meta tags into one of these categories: ${categories.join(', ')}. If it cannot be categorized, return "None".`
          },
          {
            role: 'user',
            content: `URL: ${url}\nTitle: ${title}\nMetaTags: ${metaTags}\nCategory:`
          }
        ], 10);
      }

      cache[cacheKey] = category;
      chrome.storage.local.set({ categoryCache: cache });
      resolve(category);
    });
  });
}

export async function categorizeTab(url, title, metaTags, categories) {
  console.log(timestamp(), `Starting categorizeTab for URL=${url}, Title=${title}, MetaTags=${metaTags}`);
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const model = await getModel();
  if (!model) return null;

  let normalizedMetaTags = [];
  if (Array.isArray(metaTags)) {
    normalizedMetaTags = metaTags.map(tag => tag.toLowerCase());
  } else if (typeof metaTags === 'string') {
    normalizedMetaTags = metaTags.toLowerCase().split(',').map(tag => tag.trim());
  }

  const category = await getCachedCategory(apiKey, model, url.toLowerCase(), title.toLowerCase(), normalizedMetaTags, categories.map(cat => cat.toLowerCase()));

  if (!category || category.toLowerCase() === 'none') {
    console.log(timestamp(), `CategorizeTab: ${url} => None`);
    return null;
  } else {
    console.log(timestamp(), `CategorizeTab: ${url} => ${category}`);
  }

  return category.trim();
}

/**
 * 2) groupTab:
 *    This tries to place the tab into an existing tab group if it’s highly similar
 *    to that group’s title. If no group is a good match, it returns false,
 *    which signals that we might handle it later (e.g. clustering).
 */
export async function groupTab(tabId, category) {
  if (typeof chrome === 'undefined' || !chrome.tabGroups || !chrome.tabGroups.update) {
    console.log(timestamp(), 'Tab grouping not supported in this environment.');
    return false;
  }

  return new Promise((resolve) => {
    chrome.tabGroups.query({}, async (groups) => {
      const apiKey = await getApiKey();
      if (!apiKey) return resolve(false);

      // If no groups exist, we can’t place it in an existing group
      if (!groups || groups.length === 0) {
        return resolve(false);
      }

      // Fetch embeddings for the category + existing group titles
      const groupTitles = groups.map(g => g.title.toLowerCase() || '');
      const embeddings = await fetchEmbeddings(apiKey, [category.toLowerCase(), ...groupTitles]);
      if (!embeddings) return resolve(false);

      const [categoryEmbedding, ...groupEmbeddings] = embeddings;

      let bestMatchGroup = null;
      let maxSimilarity = -1;

      groupEmbeddings.forEach((embedding, i) => {
        const sim = cosineSimilarity(categoryEmbedding, embedding);
        console.log(timestamp(), `Candidate group='${groups[i].title}', similarity=${sim}`);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          bestMatchGroup = groups[i];
        }
      });

      if (bestMatchGroup && maxSimilarity > 0.7) {
        console.log(timestamp(), `groupTab: best match group='${bestMatchGroup.title}', sim=${maxSimilarity}`);
        chrome.tabs.get(tabId, (tab) => {
          if (tab.groupId === bestMatchGroup.id) {
            console.log(timestamp(), `Tab ${tabId} is already in the best match group '${bestMatchGroup.title}'`);
            return resolve(true);
          }
          chrome.tabs.group({ tabIds: tabId, groupId: bestMatchGroup.id }, () => {
            if (chrome.runtime.lastError) {
              console.log(timestamp(), `Error grouping tab: ${chrome.runtime.lastError.message}`);
              return resolve(false);
            }
            console.log(timestamp(), `groupTab: placed tab ${tabId} into existing group '${bestMatchGroup.title}' (sim=${maxSimilarity})`);
            return resolve(true);
          });
        });
      } else {
        console.log(timestamp(), 'groupTab: No good match found for tab', tabId);
        return resolve(false);
      }
    });
  });
}

/**
 * 3) The main function: categorizeAndGroupUngroupedTabs
 *    - Attempt to match each ungrouped tab to known categories/ existing groups
 *    - If not matched, accumulate them in unassignedTabs
 *    - Then delegate to hierarchical.js for leftover tabs
 */
async function leftoversHaveChanged(unassignedTabs) {
  const leftoverSummary = unassignedTabs
    .map(tab => `${tab.id}|${tab.url}`)
    .sort()
    .join(',');
  return new Promise((resolve) => {
    chrome.storage.local.get(['leftoverTabsCache'], (res) => {
      const previous = res.leftoverTabsCache || '';
      const changed = leftoverSummary !== previous;
      if (changed) {
        chrome.storage.local.set({ leftoverTabsCache: leftoverSummary });
      }
      resolve(changed);
    });
  });
}

export async function categorizeAndGroupUngroupedTabs(ungroupedTabs) {
  if (!ungroupedTabs || ungroupedTabs.length === 0) {
    console.log(timestamp(), 'No ungrouped tabs to process.');
    return;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.log(timestamp(), 'No API key found. Aborting.');
    return;
  }

  const model = await getModel();
  if (!model) {
    console.log(timestamp(), 'No model found. Aborting.');
    return;
  }

  // 1) Fetch any known categories
  const knownCategories = await getCategories();
  console.log(timestamp(), 'Known categories:', knownCategories);

  // 2) Loop over ungrouped tabs, try to categorize, then try grouping in existing group
  const unassignedTabs = [];
  const categorizeAndGroupPromises = ungroupedTabs.map(async (tab) => {
    // skip internal Chrome tabs
    if (tab.url.startsWith('chrome://')) {
      return;
    }

    // Check if the tab is in a single tabbed window
    const window = await new Promise((resolve) => chrome.windows.get(tab.windowId, { populate: true }, resolve));
    if (window.tabs.length === 1) {
      console.log(timestamp(), `Skipping tab ID=${tab.id} in single tabbed window.`);
      return;
    }

    console.log(timestamp(), `Fetching meta tags for tab ID=${tab.id}, URL=${tab.url}`);
    const metaTags = await getMetaTags(tab.id, tab.url);
    console.log(timestamp(), `Fetched meta tags for tab ID=${tab.id}, URL=${tab.url}: ${metaTags}`);

    const cat = await categorizeTab(tab.url, tab.title, metaTags, knownCategories);

    if (cat) {
      // If a category was found, attempt to place it in an existing group
      const placedInGroup = await groupTab(tab.id, cat);
      if (!placedInGroup) {
        // If we couldn’t place in an existing group, create a new group right away
        chrome.tabs.group({ tabIds: tab.id }, groupId => {
          if (chrome.runtime.lastError) {
            console.log(timestamp(), 'Error grouping tab:', chrome.runtime.lastError.message);
            return;
          }
          chrome.tabGroups.update(groupId, { title: cat }, () => {
            if (chrome.runtime.lastError) {
              console.log(timestamp(), 'Error updating tab group:', chrome.runtime.lastError.message);
            }
          });
        });
      }
    } else {
      // If no known category was found, we will cluster it later
      unassignedTabs.push(tab);
    }
  });

  await Promise.all(categorizeAndGroupPromises);

  // 3) Hand off leftover tabs to hierarchical.js for clustering, but only if changed
  const changed = await leftoversHaveChanged(unassignedTabs);
  if (!changed) {
    console.log(timestamp(), 'No changes in leftover tabs. Skipping clustering.');
    return;
  }

  if (unassignedTabs.length >= 2) {
    await clusterAndGroupTabs(unassignedTabs, apiKey, model, 0.67);
  } else {
    console.log(timestamp(), 'No need to cluster. 0 or 1 leftover tab found.');
  }
}
