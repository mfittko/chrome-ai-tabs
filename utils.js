export function timestamp() {
  const timestamp = new Date().toISOString();
  return `[${timestamp}]`;
}

export function shouldSkipTab(tab) {
  return new Promise((resolve) => {
    let skip = tab.pinned || !tab.url || !tab.title || tab.url.startsWith('chrome://');
    chrome.windows.get(tab.windowId, { populate: true }, (window) => {
      if (window.type !== 'normal' || window.state === 'minimized') {
        console.log(timestamp(), 'Skipping grouping for non-normal or minimized window.');
        skip = true;
      }
      resolve(skip);
    });
  });
}

export function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
