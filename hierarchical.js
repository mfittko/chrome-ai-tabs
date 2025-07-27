import { timestamp, cosineSimilarity } from './utils.js';
import { fetchEmbeddings, fetchOpenAI } from './api.js';

/**
 * The main entry point for hierarchical grouping.
 * Pass in an array of "leftover" tabs, an apiKey, and a model.
 *
 * 1) Embeds each leftover tab
 * 2) Clusters them (bottom-up hierarchical clustering)
 * 3) Labels each cluster with the LLM
 * 4) Creates Chrome tab groups (for clusters of size > 1)
 */
export async function clusterAndGroupTabs(ungroupedTabs, apiKey, model, distanceThreshold = 0.3) {
  if (!ungroupedTabs || ungroupedTabs.length < 2) {
    console.log(timestamp(), 'Skipping hierarchical grouping: fewer than 2 tabs.');
    return;
  }

  console.log(timestamp(), `Clustering ${ungroupedTabs.length} leftover tabs with threshold = ${distanceThreshold}`);

  // 1) Build text array and fetch embeddings
  const textArray = ungroupedTabs.map(t => `${t.title}\n${t.url}`);
  const leftoverEmbeddings = await getCachedEmbeddings(apiKey, textArray);
  if (!leftoverEmbeddings) {
    console.log(timestamp(), 'Error fetching embeddings for leftover tabs. Aborting clustering.');
    return;
  }

  // 2) Prepare data objects: { tab, embedding }
  const leftoverTabData = ungroupedTabs.map((tab, idx) => ({
    tab,
    embedding: leftoverEmbeddings[idx],
  }));

  // 3) Perform hierarchical clustering
  const clusters = hierarchicalClustering(leftoverTabData, distanceThreshold);
  console.log(timestamp(), `Formed ${clusters.length} clusters from leftover tabs.`);

  // 4) Label each cluster
  const labeledClusters = await labelClusters(clusters, apiKey, model);

  // 5) Group tabs in Chrome
  groupTabsInChrome(labeledClusters);
}

/**
 * Performs a bottom-up hierarchical clustering with a given threshold.
 * By default, uses average linkage: merges if "average distance" < threshold.
 */
function hierarchicalClustering(tabData, distanceThreshold) {
  // Start with each tab in its own cluster
  let clusters = tabData.map((item, idx) => ({
    id: idx,
    items: [item],
  }));

  function distanceBetweenClusters(c1, c2) {
    // AVERAGE LINKAGE
    let totalDist = 0;
    let count = 0;
    for (const i1 of c1.items) {
      for (const i2 of c2.items) {
        const sim = cosineSimilarity(i1.embedding, i2.embedding);
        totalDist += (1 - sim);
        count++;
      }
    }
    return totalDist / count;
  }

  let merging = true;
  while (merging && clusters.length > 1) {
    merging = false;
    let bestDist = Infinity;
    let bestPair = [null, null];

    // Find the two closest clusters
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = distanceBetweenClusters(clusters[i], clusters[j]);
        console.debug(timestamp(), `Distance between cluster ${i} and ${j}`, dist);

        if (dist < bestDist) {
          bestDist = dist;
          bestPair = [i, j];
        }
      }
    }

    // Merge if bestDist < threshold
    if (bestDist < distanceThreshold) {
      const [i, j] = bestPair;
      clusters[i].items = clusters[i].items.concat(clusters[j].items);
      clusters.splice(j, 1);
      merging = true;
    }
  }

  return clusters;
}

/**
 * Uses the LLM to generate a short 1-2 word label for each cluster.
 */
async function labelClusters(clusters, apiKey, model) {
  const labeledClusters = [];
  const existingLabels = new Set();

  for (const cluster of clusters) {
    const titles = cluster.items.map(i => i.tab.title).join(', ');
    const urls = cluster.items.map(i => {
      try {
        return new URL(i.tab.url).hostname;
      } catch (e) {
        return i.tab.url;
      }
    }).join(', ');

    const promptMessages = [
      {
        role: 'system',
        content: 'Generate a short, distinctive tab group title with a maximum of two, but ideally a single word. Examples: "News", "Sports", "Tech", "Insurance".'
      },
      {
        role: 'user',
        content: `Titles: ${titles}\nURLs: ${urls}\nExisting Labels: ${[...existingLabels].join(', ')}\nGroup Title:`
      }
    ];

    let groupTitle = await fetchOpenAI(apiKey, model, promptMessages) || 'New Group';
    groupTitle = groupTitle.trim();

    // Ensure the label is unique
    while (existingLabels.has(groupTitle)) {
      promptMessages[1].content = `Titles: ${titles}\nURLs: ${urls}\nExisting Labels: ${[...existingLabels].join(', ')}\nGroup Title:`;
      groupTitle = await fetchOpenAI(apiKey, model, promptMessages) || 'New Group';
      groupTitle = groupTitle.trim();
    }

    existingLabels.add(groupTitle);

    labeledClusters.push({
      ...cluster,
      title: groupTitle,
    });
  }

  return labeledClusters;
}

/**
 * Groups the labeled clusters into Chrome tab groups (if they have >1 tab).
 */
function groupTabsInChrome(labeledClusters) {
  for (const cluster of labeledClusters) {
    if (cluster.items.length <= 1) {
      console.log(timestamp(), 'Skipping group creation for a single-tab cluster.');
      continue;
    }

    const tabIds = cluster.items.map(i => i.tab.id);
    const tabTitles = cluster.items.map(i => i.tab.title).join(', ');

    chrome.tabs.group({ tabIds }, groupId => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        console.log(timestamp(), `Error grouping tabs: ${errorMsg}`);
        console.log(timestamp(), `Affected tabs: ${tabTitles}`);

        // If it's a "not normal window" error, skip grouping
        if (errorMsg.includes('Tabs can only be moved to and from normal windows')) {
          console.log(timestamp(), 'Skipping these tabs, leaving them ungrouped.');
          return;
        }
        return;
      }

      // Update the group's title
      chrome.tabGroups.update(groupId, { title: cluster.title }, () => {
        if (chrome.runtime.lastError) {
          console.log(timestamp(), 'Error updating tab group:', chrome.runtime.lastError.message);
        }
      });
    });
  }
}

async function getCachedEmbeddings(apiKey, textArray) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['embeddingsCache'], async (res) => {
      const cache = res.embeddingsCache || {};
      const cacheKey = JSON.stringify({ textArray });
      if (cache[cacheKey]) {
        return resolve(cache[cacheKey]);
      }
      const fetched = await fetchEmbeddings(apiKey, textArray);
      if (fetched) {
        cache[cacheKey] = fetched;
        chrome.storage.local.set({ embeddingsCache: cache });
      }
      resolve(fetched);
    });
  });
}
