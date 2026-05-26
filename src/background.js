// Background service worker stub (Manifest V3)
// Handles extension lifecycle events; logic added in subsequent issues.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChapShuffle] extension installed');
});
