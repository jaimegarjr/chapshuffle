const STORAGE_KEY = 'shuffleEnabled';

function applyBadge(enabled: boolean): void {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#cc0000' : '#888888' });
}

function applyLiveBadge(): void {
  chrome.action.setBadgeText({ text: 'LIVE' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff6600' });
}

chrome.storage.sync.get([STORAGE_KEY], (result) => {
  applyBadge(result[STORAGE_KEY] === true);
});

chrome.storage.onChanged.addListener((changes) => {
  if (STORAGE_KEY in changes) {
    applyBadge(Boolean(changes[STORAGE_KEY].newValue));
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'livestream-detected') {
    applyLiveBadge();
  } else if (msg?.type === 'livestream-left') {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      applyBadge(result[STORAGE_KEY] === true);
    });
  }
});
