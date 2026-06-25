async function getEnabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('enabled');
    return result['enabled'] === true;
  } catch (err) {
    console.error('[ERROR] [BACKGROUND] Failed to read storage:', err);
    return false;
  }
}

async function setEnabled(value: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ enabled: value });
  } catch (err) {
    console.error('[ERROR] [BACKGROUND] Failed to write storage:', err);
  }
}

async function broadcastToTabs(message: object): Promise<void> {
  try {
    const patterns = [
      'https://www.youtube.com/*',
      'https://www.instagram.com/*',
      'https://www.tiktok.com/*'
    ];
    const tabs = await chrome.tabs.query({ url: patterns });
    for (const tab of tabs) {
      if (tab.id) {
        // We catch errors per tab because some tabs might be suspended or not have the content script injected yet
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[ERROR] [BACKGROUND] Broadcast failed:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[INIT] [BACKGROUND] Extension installed, setting initial state to disabled');
  setEnabled(false); // Start disabled so user explicitly turns on
});

// Use robust message handling
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TOGGLE') {
    getEnabled().then(async (current) => {
      const next = !current;
      await setEnabled(next);
      await broadcastToTabs({ type: 'EXTENSION_TOGGLE', enabled: next });
      sendResponse({ enabled: next });
    }).catch(err => {
      console.error('[ERROR] [BACKGROUND] Toggle logic failed:', err);
      sendResponse({ enabled: false });
    });
    return true; // Keep message channel open for async response
  }

  if (msg.type === 'GET_ENABLED') {
    getEnabled()
      .then((enabled) => sendResponse({ enabled }))
      .catch(() => sendResponse({ enabled: false }));
    return true;
  }

  if (msg.type === 'SET_ENABLED') {
    setEnabled(msg.enabled).then(async () => {
      await broadcastToTabs({ type: 'EXTENSION_TOGGLE', enabled: msg.enabled });
      sendResponse({ success: true });
    }).catch(() => sendResponse({ success: false }));
    return true;
  }
});
