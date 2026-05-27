const STORAGE_KEY = 'shuffleEnabled';

function applyBadge(enabled: boolean): void {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#cc0000' : '#888888' });
}

// Apply badge on install and on every service worker startup
chrome.storage.sync.get([STORAGE_KEY], (result) => {
  applyBadge(result[STORAGE_KEY] === true);
});

chrome.storage.onChanged.addListener((changes) => {
  if (STORAGE_KEY in changes) {
    applyBadge(Boolean(changes[STORAGE_KEY].newValue));
  }
});
