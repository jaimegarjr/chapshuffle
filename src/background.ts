import {
  getShuffleEnabled,
  setShuffleEnabled,
  settingsChangeFromChrome,
} from './persistence/PersistenceManager';

function applyBadge(enabled: boolean): void {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#cc0000' : '#888888' });
}

function applyLiveBadge(): void {
  chrome.action.setBadgeText({ text: 'LIVE' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff6600' });
}

getShuffleEnabled().then(applyBadge);

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    setShuffleEnabled(true).then(() => applyBadge(true));
  }
});

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
