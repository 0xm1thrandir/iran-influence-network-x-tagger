// X Influence Network Tagger - Service Worker
// Handles data loading, storage, and message passing

const DATA_VERSION = '1.1.0';

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

    // Load all JSON files
    const [irResponse, mekResponse, wiResponse] = await Promise.all([
      fetch(chrome.runtime.getURL('data/ir-network.json')),
      fetch(chrome.runtime.getURL('data/mek.json')),
      fetch(chrome.runtime.getURL('data/white-internet.json'))
    ]);

    if (!irResponse.ok || !mekResponse.ok || !wiResponse.ok) {
      throw new Error('Failed to load JSON data files');
    }

    const irData = await irResponse.json();
    const mekData = await mekResponse.json();
    const wiData = await wiResponse.json();

    // Build username -> user data maps (normalized lowercase keys)
    const irUserData = {};
    const mekUserData = {};
    const wiUserData = {};

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

    // White Internet has different schema - username has @ prefix
    for (const account of wiData) {
      // Remove @ prefix from username
      const rawUsername = account.username || '';
      const username = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername;
      const key = username.toLowerCase();

      wiUserData[key] = {
        username: username,
        name: account.display_name || '',
        account_status: account.account_status || 'unknown',
        primary_device: account.primary_device || 'unknown',
        location_status: account.location_status || 'unknown',
        gender: account.gender || 'unknown',
        creation_date: account.account_creation_date || '',
        username_change_count: account.username_change_count || 0,
        last_username_change: account.last_username_change || '',
        same_person_account: account.same_person_account || null,
        same_person_detected: account.same_person_detected || false
      };
    }

    // Store in chrome.storage.local
    await chrome.storage.local.set({
      irUserData: irUserData,
      mekUserData: mekUserData,
      wiUserData: wiUserData,
      dataVersion: DATA_VERSION,
      lastUpdated: Date.now(),
      enabled: true,
      stats: {
        irTagged: 0,
        mekTagged: 0,
        wiTagged: 0,
        sessionStart: Date.now()
      }
    });

    console.log(`[NetTagger] Data loaded - IR: ${Object.keys(irUserData).length}, MEK: ${Object.keys(mekUserData).length}, WI: ${Object.keys(wiUserData).length}`);

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
    const data = await chrome.storage.local.get(['irUserData', 'mekUserData', 'wiUserData', 'enabled']);

    // If data not loaded yet, initialize
    if (!data.irUserData || !data.mekUserData || !data.wiUserData) {
      await initializeData();
      const freshData = await chrome.storage.local.get(['irUserData', 'mekUserData', 'wiUserData', 'enabled']);
      sendResponse({
        success: true,
        irUserData: freshData.irUserData || {},
        mekUserData: freshData.mekUserData || {},
        wiUserData: freshData.wiUserData || {},
        enabled: freshData.enabled !== false
      });
    } else {
      sendResponse({
        success: true,
        irUserData: data.irUserData,
        mekUserData: data.mekUserData,
        wiUserData: data.wiUserData,
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
    const stats = data.stats || { irTagged: 0, mekTagged: 0, wiTagged: 0, sessionStart: Date.now() };

    if (network === 'ir') {
      stats.irTagged++;
    } else if (network === 'mek') {
      stats.mekTagged++;
    } else if (network === 'wi') {
      stats.wiTagged++;
    }

    await chrome.storage.local.set({ stats });
    sendResponse({ success: true, stats });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetStats(sendResponse) {
  try {
    const data = await chrome.storage.local.get(['stats', 'irUserData', 'mekUserData', 'wiUserData', 'enabled', 'lastUpdated']);
    sendResponse({
      success: true,
      stats: data.stats || { irTagged: 0, mekTagged: 0, wiTagged: 0, sessionStart: Date.now() },
      totalIR: data.irUserData ? Object.keys(data.irUserData).length : 0,
      totalMEK: data.mekUserData ? Object.keys(data.mekUserData).length : 0,
      totalWI: data.wiUserData ? Object.keys(data.wiUserData).length : 0,
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
        wiTagged: 0,
        sessionStart: Date.now()
      }
    });
    await initializeData();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
