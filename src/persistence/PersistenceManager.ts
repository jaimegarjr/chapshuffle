const STORAGE_KEY = 'shuffleEnabled';

/**
 * Reads the global shuffle toggle from chrome.storage.sync.
 * Resolves to false when the key is not yet stored.
 */
export function getShuffleEnabled(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(result[STORAGE_KEY] === true);
    });
  });
}

/**
 * Persists the global shuffle toggle to chrome.storage.sync.
 */
export function setShuffleEnabled(value: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: Boolean(value) }, () => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve();
    });
  });
}
