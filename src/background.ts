import { getShuffleEnabled, settingsChangeFromChrome } from './persistence/PersistenceManager';

function applyBadge(enabled: boolean): void {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#cc0000' : '#888888' });
}

function applyLiveBadge(): void {
  chrome.action.setBadgeText({ text: 'LIVE' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff6600' });
}

getShuffleEnabled().then(applyBadge);

chrome.storage.onChanged.addListener((changes) => {
  const settingsChange = settingsChangeFromChrome(changes);
  const shuffleEnabled = settingsChange.shuffleEnabled;
  if (shuffleEnabled !== undefined) {
    applyBadge(shuffleEnabled);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'livestream-detected') {
    applyLiveBadge();
  } else if (msg?.type === 'livestream-left') {
    getShuffleEnabled().then(applyBadge);
  }
});
