# Iran Influence Watcher

A Chrome extension that identifies and tags accounts linked to Iranian influence networks on X.com (formerly Twitter).

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Overview

This extension helps users identify accounts that are part of documented Iranian online influence networks while browsing X.com. It covers three distinct networks:

- **IR Network** (Red badge): Accounts linked to Islamic Republic state media patterns
- **MEK Network** (Orange badge): Accounts linked to MEK opposition group patterns
- **White Internet** (Purple badge): Accounts from the White Internet database

Data is sourced from the [Islamic Republic Influence Networks](https://github.com/goldenowlosint/Islamic-Republic-Influence-Networks) research project.

## Features

- **Visual Badges**: Colored badges appear next to usernames from tracked networks
- **Rich Tooltips**: Hover over badges to see account statistics
- **Real-time Detection**: Automatically detects accounts as you scroll through your timeline
- **Performance Optimized**: Uses debouncing, batch processing, and idle callbacks
- **Toggle On/Off**: Easily enable or disable from the popup
- **Session Stats**: Track how many accounts have been tagged

## Screenshots

**Timeline View:**
```
@username [IR]     ← Red badge (Islamic Republic Network)
@username [MEK]    ← Orange badge (MEK Network)
@username [WI]     ← Purple badge (White Internet Database)
```

**Hover Tooltip (IR/MEK):**
- Follower/Following count
- Tweet count
- Account creation date
- Detected location

**Hover Tooltip (White Internet):**
- Account status (active/deleted)
- Primary device
- Location status
- Username change count
- Linked accounts (if detected)

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the extension folder
6. Visit [x.com](https://x.com) and browse

## Data

The extension includes bundled data files:

| Network | File | Accounts | Description |
|---------|------|----------|-------------|
| IR | `ir-network.json` | ~2,900 | Islamic Republic state-linked accounts |
| MEK | `mek.json` | ~1,900 | MEK opposition-linked accounts |
| WI | `white-internet.json` | ~2,400 | White Internet database accounts |

**Total: ~7,200 tracked accounts**

### White Internet Data Notes

The White Internet dataset includes account handles, display names, username-change history, account status, device type, location indicators, inferred gender, and permanent user IDs. Key fields:

- `location_status`: Reliability codes (`iran`, `non_iran_only`, `continent_only`)
- `same_person_account`: Linked handles when flagged
- `account_status`: Whether account is active or deleted

Note: This dataset is not actively maintained by the upstream source.

## Architecture

```
iran-influence-watcher/
├── manifest.json       # Extension config (Manifest V3)
├── background.js       # Service worker - data management
├── content.js          # DOM observation & badge injection
├── styles.css          # Badge styling
├── popup/
│   ├── popup.html      # Extension popup UI
│   └── popup.js        # Popup logic
├── icons/              # Extension icons
└── data/
    ├── ir-network.json
    ├── mek.json
    └── white-internet.json
```

## Performance

- **O(1) Lookup**: Username lookups use JavaScript objects
- **150ms Debounce**: DOM changes are batched
- **Idle Processing**: Uses `requestIdleCallback` for non-blocking updates
- **Batch Processing**: 50 elements per cycle
- **Visibility Aware**: Pauses when tab is hidden

## Privacy

- All data stored locally
- No external requests
- No data collection

## Responsible Use

This tool is intended for:
- Research and journalism
- OSINT analysis
- Public transparency

**Do not use for harassment, targeting, or discrimination.**

## Data Sources

- [Islamic Republic Influence Networks](https://github.com/goldenowlosint/Islamic-Republic-Influence-Networks)
- [White Internet Database](https://github.com/tasokait/white_internet_database)

## License

MIT License

## Disclaimer

This extension is provided for research and informational purposes only. Inclusion in the dataset does not imply wrongdoing. Users are responsible for ethical use.
