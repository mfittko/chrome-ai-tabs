import { timestamp } from './utils.js';

export function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['openaiApiKey'], (items) => {
      resolve(items.openaiApiKey || '');
    });
  });
}

export function getModel() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['openaiModel'], (items) => {
      resolve(items.openaiModel || 'gpt-4.1-mini');
    });
  });
}

export function getCategories() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.tabGroups) {
      chrome.tabGroups.query({}, (groups) => {
        const groupTitles = [...new Set(groups.map(group => group.title).filter(title => title))];
        resolve(groupTitles);
      });
    } else {
      resolve([]);
    }
  });
}

export async function getMetaTags(tabId, url) {
  try {
    if (url.startsWith('chrome://')) return '';

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve('');
      }, 100);

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          func: () => {
            const metaTags = Array.from(document.getElementsByTagName('meta'))
              .filter(meta => meta.getAttribute('property') === 'og:description' || meta.getAttribute('property') === 'og:title')
              .map(meta => meta.content)
              .join(' ');
            return metaTags;
          }
        },
        async (results) => {
          clearTimeout(timeout);
          const domain = new URL(url).hostname;
          const defaultDescription = await new Promise((resolve) => {
            chrome.storage.sync.get(domain, (data) => {
              resolve(data[domain] || '');
            });
          });
          let descriptions = [defaultDescription];
          if (results && results[0] && results[0].result) {
            descriptions += results[0].result;
          }
          console.log(timestamp(), 'Fetched meta tags:', descriptions);
          resolve(descriptions);
        }
      );
    });
  } catch (error) {
    return '';
  }
}

export async function fetchOpenAI(apiKey, model, messages, maxTokens = 10) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    console.log(timestamp(), 'Error fetching OpenAI response: ' + response.statusText);
    return null;
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.log(timestamp(), 'Invalid response format: ' + JSON.stringify(data));
    return null;
  }

  return data.choices[0].message.content.trim();
}

export async function fetchEmbeddings(apiKey, input) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: input
    })
  });

  if (!response.ok) {
    console.log(timestamp(), 'Error fetching embeddings: ' + response.statusText);
    return null;
  }

  const data = await response.json();
  if (!data.data) {
    console.log(timestamp(), 'Error fetching embeddings: ' + JSON.stringify(data));
    return null;
  }

  return data.data.map(item => item.embedding);
}
