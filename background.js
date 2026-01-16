// X Influence Network Tagger - Service Worker
// Handles data loading, storage, and message passing

const DATA_VERSION = '1.0.0';

// Initialize data on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[NetTagger] Extension installed/updated:', details.reason);
  await initializeData();
});

// Also initialize on startup (service worker wake-up)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[NetTagger] Service worker starting up');
  await initializeData();
});

// Initialize data from bundled JSON files
async function initializeData() {
  try {
    console.log('[NetTagger] Initializing data...');

    // Load both JSON files
    const [irResponse, mekResponse] = await Promise.all([
      fetch(chrome.runtime.getURL('data/ir-network.json')),
      fetch(chrome.runtime.getURL('data/mek.json'))
    ]);

    if (!irResponse.ok || !mekResponse.ok) {
      throw new Error('Failed to load JSON data files');
    }

    const irData = await irResponse.json();
    const mekData = await mekResponse.json();

    // Build username -> user data maps (normalized lowercase keys)
    const irUserData = {};
    const mekUserData = {};

    for (const account of irData) {
      const key = account.username.toLowerCase();
      irUserData[key] = {
        username: account.username,
        name: account.name || '',
        follower_count: account.follower_count || 0,
        following_count: account.following_count || 0,
        number_of_tweets: account.number_of_tweets || 0,
        creation_date: account.creation_date || '',
        is_blue_verified: account.is_blue_verified || false,
        account_based_in: account.account_based_in || '',
        description: account.description || ''
      };
    }

    for (const account of mekData) {
      const key = account.username.toLowerCase();
      mekUserData[key] = {
        username: account.username,
        name: account.name || '',
        follower_count: account.follower_count || 0,
        following_count: account.following_count || 0,
        number_of_tweets: account.number_of_tweets || 0,
        creation_date: account.creation_date || '',
        is_blue_verified: account.is_blue_verified || false,
        account_based_in: account.account_based_in || '',
        description: account.description || ''
      };
    }

    // Store in chrome.storage.local
    await chrome.storage.local.set({
      irUserData: irUserData,
      mekUserData: mekUserData,
      dataVersion: DATA_VERSION,
      lastUpdated: Date.now(),
      enabled: true,
      stats: {
        irTagged: 0,
        mekTagged: 0,
        sessionStart: Date.now()
      }
    });

    console.log(`[NetTagger] Data loaded - IR: ${Object.keys(irUserData).length}, MEK: ${Object.keys(mekUserData).length}`);

  } catch (error) {
    console.error('[NetTagger] Error initializing data:', error);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_DATA') {
    handleGetData(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'UPDATE_STATS') {
    handleUpdateStats(message.network, sendResponse);
    return true;
  }

  if (message.type === 'GET_STATS') {
    handleGetStats(sendResponse);
    return true;
  }

  if (message.type === 'TOGGLE_ENABLED') {
    handleToggleEnabled(sendResponse);
    return true;
  }

  if (message.type === 'REFRESH_DATA') {
    handleRefreshData(sendResponse);
    return true;
  }
});

async function handleGetData(sendResponse) {
  try {
    const data = await chrome.storage.local.get(['irUserData', 'mekUserData', 'enabled']);

    // If data not loaded yet, initialize
    if (!data.irUserData || !data.mekUserData) {
      await initializeData();
      const freshData = await chrome.storage.local.get(['irUserData', 'mekUserData', 'enabled']);
      sendResponse({
        success: true,
        irUserData: freshData.irUserData || {},
        mekUserData: freshData.mekUserData || {},
        enabled: freshData.enabled !== false
      });
    } else {
      sendResponse({
        success: true,
        irUserData: data.irUserData,
        mekUserData: data.mekUserData,
        enabled: data.enabled !== false
      });
    }
  } catch (error) {
    console.error('[NetTagger] Error getting data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateStats(network, sendResponse) {
  try {
    const data = await chrome.storage.local.get(['stats']);
    const stats = data.stats || { irTagged: 0, mekTagged: 0, sessionStart: Date.now() };

    if (network === 'ir') {
      stats.irTagged++;
    } else if (network === 'mek') {
      stats.mekTagged++;
    }

    await chrome.storage.local.set({ stats });
    sendResponse({ success: true, stats });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetStats(sendResponse) {
  try {
    const data = await chrome.storage.local.get(['stats', 'irUserData', 'mekUserData', 'enabled', 'lastUpdated']);
    sendResponse({
      success: true,
      stats: data.stats || { irTagged: 0, mekTagged: 0, sessionStart: Date.now() },
      totalIR: data.irUserData ? Object.keys(data.irUserData).length : 0,
      totalMEK: data.mekUserData ? Object.keys(data.mekUserData).length : 0,
      enabled: data.enabled !== false,
      lastUpdated: data.lastUpdated
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleToggleEnabled(sendResponse) {
  try {
    const data = await chrome.storage.local.get(['enabled']);
    const newEnabled = data.enabled === false ? true : false;
    await chrome.storage.local.set({ enabled: newEnabled });
    sendResponse({ success: true, enabled: newEnabled });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleRefreshData(sendResponse) {
  try {
    // Reset stats on refresh
    await chrome.storage.local.set({
      stats: {
        irTagged: 0,
        mekTagged: 0,
        sessionStart: Date.now()
      }
    });
    await initializeData();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
