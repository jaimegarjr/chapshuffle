import { settings } from './persistence/PersistenceManager';

function applyBadge(enabled: boolean): void {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#cc0000' : '#888888' });
}

function applyLiveBadge(): void {
  chrome.action.setBadgeText({ text: 'LIVE' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff6600' });
}

settings.read().then(({ shuffleEnabled }) => applyBadge(shuffleEnabled));

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    settings.update({ shuffleEnabled: true }).then(() => applyBadge(true));
    chrome.tabs.create({ url: 'https://jaimegarjr.github.io/chapshuffle/' });
  }
});

settings.subscribe(({ shuffleEnabled }) => {
  if (shuffleEnabled !== undefined) {
    applyBadge(shuffleEnabled);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'livestream-detected') {
    applyLiveBadge();
  } else if (msg?.type === 'livestream-left') {
    settings.read().then(({ shuffleEnabled }) => applyBadge(shuffleEnabled));
  }
});
