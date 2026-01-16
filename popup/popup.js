// X Influence Network Tagger - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');
  const toggleEl = document.getElementById('toggle');
  const statusDotEl = document.getElementById('status-dot');
  const irTaggedEl = document.getElementById('ir-tagged');
  const mekTaggedEl = document.getElementById('mek-tagged');
  const totalIrEl = document.getElementById('total-ir');
  const totalMekEl = document.getElementById('total-mek');
  const lastUpdatedEl = document.getElementById('last-updated');
  const refreshBtn = document.getElementById('refresh-btn');
  const resetBtn = document.getElementById('reset-btn');

  // Load stats
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

      if (response.success) {
        // Update UI
        irTaggedEl.textContent = response.stats.irTagged.toLocaleString();
        mekTaggedEl.textContent = response.stats.mekTagged.toLocaleString();
        totalIrEl.textContent = response.totalIR.toLocaleString();
        totalMekEl.textContent = response.totalMEK.toLocaleString();

        // Format last updated
        if (response.lastUpdated) {
          const date = new Date(response.lastUpdated);
          lastUpdatedEl.textContent = date.toLocaleDateString();
        }

        // Update toggle state
        updateToggleUI(response.enabled);
      }

      // Show content
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';

    } catch (error) {
      console.error('Error loading stats:', error);
      loadingEl.textContent = 'Error loading data';
    }
  }

  // Update toggle UI
  function updateToggleUI(enabled) {
    if (enabled) {
      toggleEl.classList.add('active');
      statusDotEl.classList.add('active');
      statusDotEl.classList.remove('inactive');
    } else {
      toggleEl.classList.remove('active');
      statusDotEl.classList.remove('active');
      statusDotEl.classList.add('inactive');
    }
  }

  // Toggle handler
  toggleEl.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED' });
      if (response.success) {
        updateToggleUI(response.enabled);

        // Notify active tabs to update
        const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_CHANGED', enabled: response.enabled });
          } catch (e) {
            // Tab might not have content script loaded
          }
        }
      }
    } catch (error) {
      console.error('Error toggling:', error);
    }
  });

  // Refresh data handler
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';

    try {
      await chrome.runtime.sendMessage({ type: 'REFRESH_DATA' });
      await loadStats();
      refreshBtn.textContent = 'Refreshed!';
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh Data';
        refreshBtn.disabled = false;
      }, 1500);
    } catch (error) {
      console.error('Error refreshing:', error);
      refreshBtn.textContent = 'Error';
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh Data';
        refreshBtn.disabled = false;
      }, 1500);
    }
  });

  // Reset stats handler
  resetBtn.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({
        stats: {
          irTagged: 0,
          mekTagged: 0,
          sessionStart: Date.now()
        }
      });
      irTaggedEl.textContent = '0';
      mekTaggedEl.textContent = '0';
    } catch (error) {
      console.error('Error resetting stats:', error);
    }
  });

  // Initial load
  await loadStats();

  // Auto-refresh stats every 2 seconds while popup is open
  setInterval(loadStats, 2000);
});
