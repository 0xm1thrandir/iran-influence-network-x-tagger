// X Influence Network Tagger - Content Script
// Handles DOM observation and badge injection on x.com

(function () {
  'use strict';

  // State
  let irUserData = null;  // Map: username -> user data
  let mekUserData = null; // Map: username -> user data
  let enabled = true;
  let observer = null;
  let debounceTimer = null;
  let taggedUsernames = new Set(); // Track which usernames we've tagged in this container

  // Configuration
  const DEBOUNCE_MS = 150;
  const BATCH_SIZE = 50;
  const PROCESSED_ATTR = 'data-net-tagged';
  const BADGE_MARKER = 'data-net-badge-for';

  // Badge configurations
  const BADGES = {
    ir: {
      label: 'IR',
      className: 'net-tag-ir',
      networkName: 'Islamic Republic Network'
    },
    mek: {
      label: 'MEK',
      className: 'net-tag-mek',
      networkName: 'MEK Opposition Network'
    }
  };

  // Initialize the content script
  async function init() {
    console.log('[NetTagger] Content script initializing...');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_DATA' });

      if (!response.success) {
        console.error('[NetTagger] Failed to get data:', response.error);
        return;
      }

      // Store user data maps
      irUserData = response.irUserData || {};
      mekUserData = response.mekUserData || {};
      enabled = response.enabled;

      console.log(`[NetTagger] Data loaded - IR: ${Object.keys(irUserData).length}, MEK: ${Object.keys(mekUserData).length}, Enabled: ${enabled}`);

      // Inject tooltip styles
      injectTooltipStyles();

      if (enabled) {
        // Initial scan
        scanPage();
        // Start observing
        startObserver();
      }

      // Listen for enable/disable changes
      chrome.storage.onChanged.addListener(handleStorageChange);

    } catch (error) {
      console.error('[NetTagger] Initialization error:', error);
    }
  }

  // Inject CSS for rich tooltips
  function injectTooltipStyles() {
    if (document.getElementById('net-tagger-tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'net-tagger-tooltip-styles';
    style.textContent = `
      .net-tag-tooltip {
        position: absolute;
        z-index: 10000;
        background: #1a1a2e;
        border: 1px solid #3a3a5a;
        border-radius: 8px;
        padding: 12px;
        min-width: 220px;
        max-width: 300px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        color: #e0e0e0;
        pointer-events: none;
        opacity: 0;
        transform: translateY(5px);
        transition: opacity 0.15s ease, transform 0.15s ease;
      }
      .net-tag-tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .net-tag-tooltip-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #3a3a5a;
      }
      .net-tag-tooltip-badge {
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 700;
        color: white;
      }
      .net-tag-tooltip-badge.ir { background: #dc2626; }
      .net-tag-tooltip-badge.mek { background: #ea580c; }
      .net-tag-tooltip-network {
        font-weight: 600;
        color: #ffffff;
      }
      .net-tag-tooltip-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 12px;
      }
      .net-tag-tooltip-stat {
        display: flex;
        flex-direction: column;
      }
      .net-tag-tooltip-stat-label {
        font-size: 10px;
        color: #8899a6;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .net-tag-tooltip-stat-value {
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
      }
      .net-tag-tooltip-location {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #3a3a5a;
        font-size: 11px;
        color: #8899a6;
      }
      .net-tag-tooltip-location strong {
        color: #e0e0e0;
      }
    `;
    document.head.appendChild(style);
  }

  // Handle storage changes (enable/disable toggle)
  function handleStorageChange(changes, areaName) {
    if (areaName === 'local' && changes.enabled) {
      enabled = changes.enabled.newValue;
      console.log('[NetTagger] Enabled changed to:', enabled);

      if (enabled) {
        scanPage();
        startObserver();
      } else {
        stopObserver();
        removeBadges();
      }
    }
  }

  // Start MutationObserver
  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      if (!enabled || document.hidden) return;

      // Debounce processing
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        scanPage();
      }, DEBOUNCE_MS);
    });

    // Observe the main content area
    const targetNode = document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });

    console.log('[NetTagger] Observer started');
  }

  // Stop observer
  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
      console.log('[NetTagger] Observer stopped');
    }
  }

  // Remove all badges and tooltip
  function removeBadges() {
    document.querySelectorAll('.net-tag').forEach(badge => badge.remove());
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => {
      el.removeAttribute(PROCESSED_ATTR);
    });
    const tooltip = document.getElementById('net-tag-tooltip');
    if (tooltip) tooltip.remove();
    taggedUsernames.clear();
    console.log('[NetTagger] Badges removed');
  }

  // Scan the page for usernames
  function scanPage() {
    if (!enabled) return;

    // Use requestIdleCallback for non-blocking processing
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => processUsernameElements(), { timeout: 1000 });
    } else {
      setTimeout(processUsernameElements, 0);
    }
  }

  // Process username elements
  function processUsernameElements() {
    if (!enabled || document.hidden) return;

    // Find all potential username containers (not already processed)
    const containers = document.querySelectorAll(
      '[data-testid="User-Name"]:not([' + PROCESSED_ATTR + ']), ' +
      '[data-testid="UserName"]:not([' + PROCESSED_ATTR + '])'
    );

    let processed = 0;
    for (const container of containers) {
      if (processed >= BATCH_SIZE) {
        // Schedule remaining for next idle callback
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => processUsernameElements(), { timeout: 1000 });
        } else {
          setTimeout(processUsernameElements, 16);
        }
        break;
      }

      processContainer(container);
      processed++;
    }
  }

  // Process a single username container
  function processContainer(container) {
    // Mark as processed immediately to prevent re-processing
    container.setAttribute(PROCESSED_ATTR, 'true');

    // Find the username element within this container
    const usernameEl = findUsernameElement(container);
    if (!usernameEl) return;

    // Extract and normalize username
    const usernameText = usernameEl.textContent.trim();
    if (!usernameText.startsWith('@')) return;

    const username = usernameText.slice(1).toLowerCase();

    // Check if this specific element already has a badge nearby
    if (hasBadgeNearby(usernameEl, username)) return;

    // Check against both networks
    let network = null;
    let userData = null;

    if (irUserData[username]) {
      network = 'ir';
      userData = irUserData[username];
    } else if (mekUserData[username]) {
      network = 'mek';
      userData = mekUserData[username];
    }

    if (network && userData) {
      injectBadge(usernameEl, network, userData);

      // Update stats (fire and forget)
      chrome.runtime.sendMessage({ type: 'UPDATE_STATS', network }).catch(() => { });
    }
  }

  // Find the @username element within a container
  function findUsernameElement(container) {
    // Look for links that contain @username
    const links = container.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const text = link.textContent.trim();
      if (text.startsWith('@') && /^@[a-zA-Z0-9_]{1,15}$/.test(text)) {
        return link;
      }
    }

    // Also check spans
    const spans = container.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.startsWith('@') && /^@[a-zA-Z0-9_]{1,15}$/.test(text)) {
        // Make sure this span doesn't contain child elements with the username
        // (to avoid selecting a parent span)
        if (span.children.length === 0 || span.querySelector('span') === null) {
          return span;
        }
      }
    }

    return null;
  }

  // Check if there's already a badge for this username nearby
  function hasBadgeNearby(element, username) {
    // Check siblings
    let sibling = element.nextElementSibling;
    while (sibling) {
      if (sibling.classList.contains('net-tag') &&
          sibling.getAttribute(BADGE_MARKER) === username) {
        return true;
      }
      sibling = sibling.nextElementSibling;
    }

    // Check parent's children
    const parent = element.parentElement;
    if (parent) {
      const existingBadge = parent.querySelector(`.net-tag[${BADGE_MARKER}="${username}"]`);
      if (existingBadge) return true;
    }

    return false;
  }

  // Inject badge after username element
  function injectBadge(usernameEl, network, userData) {
    const badge = BADGES[network];
    if (!badge) return;

    const username = userData.username.toLowerCase();

    // Create badge element
    const badgeEl = document.createElement('span');
    badgeEl.className = `net-tag ${badge.className}`;
    badgeEl.textContent = badge.label;
    badgeEl.setAttribute(BADGE_MARKER, username);

    // Store user data for tooltip
    badgeEl.dataset.network = network;
    badgeEl.dataset.username = username;

    // Add hover events for rich tooltip
    badgeEl.addEventListener('mouseenter', (e) => showTooltip(e, network, userData));
    badgeEl.addEventListener('mouseleave', hideTooltip);

    // Insert after the username element
    usernameEl.parentNode.insertBefore(badgeEl, usernameEl.nextSibling);
  }

  // Show rich tooltip
  function showTooltip(event, network, userData) {
    // Remove existing tooltip
    hideTooltip();

    const badge = BADGES[network];
    const tooltip = document.createElement('div');
    tooltip.id = 'net-tag-tooltip';
    tooltip.className = 'net-tag-tooltip';

    // Format numbers
    const formatNumber = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    };

    // Format date
    const formatDate = (dateStr) => {
      if (!dateStr) return 'Unknown';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } catch {
        return dateStr.split(' ').slice(1, 3).join(' ') + ' ' + dateStr.split(' ').slice(-1)[0];
      }
    };

    tooltip.innerHTML = `
      <div class="net-tag-tooltip-header">
        <span class="net-tag-tooltip-badge ${network}">${badge.label}</span>
        <span class="net-tag-tooltip-network">${badge.networkName}</span>
      </div>
      <div class="net-tag-tooltip-stats">
        <div class="net-tag-tooltip-stat">
          <span class="net-tag-tooltip-stat-label">Followers</span>
          <span class="net-tag-tooltip-stat-value">${formatNumber(userData.follower_count)}</span>
        </div>
        <div class="net-tag-tooltip-stat">
          <span class="net-tag-tooltip-stat-label">Following</span>
          <span class="net-tag-tooltip-stat-value">${formatNumber(userData.following_count)}</span>
        </div>
        <div class="net-tag-tooltip-stat">
          <span class="net-tag-tooltip-stat-label">Tweets</span>
          <span class="net-tag-tooltip-stat-value">${formatNumber(userData.number_of_tweets)}</span>
        </div>
        <div class="net-tag-tooltip-stat">
          <span class="net-tag-tooltip-stat-label">Created</span>
          <span class="net-tag-tooltip-stat-value">${formatDate(userData.creation_date)}</span>
        </div>
      </div>
      ${userData.account_based_in ? `
        <div class="net-tag-tooltip-location">
          <strong>Location:</strong> ${userData.account_based_in}
        </div>
      ` : ''}
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;

    // Adjust if goes off screen
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - tooltipRect.height - 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Trigger animation
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  }

  // Hide tooltip
  function hideTooltip() {
    const tooltip = document.getElementById('net-tag-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && enabled) {
      scanPage();
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
