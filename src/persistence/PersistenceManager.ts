const STORAGE_KEY = 'shuffleEnabled';
const MIN_CHAPTERS_KEY = 'minChapters';
export const DEFAULT_MIN_CHAPTERS = 5;

/**
 * Reads the global shuffle toggle from chrome.storage.sync.
 * Resolves to false when the key is not yet stored.
 */
export function getShuffleEnabled(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        return reject(
          new Error(chrome.runtime.lastError.message ?? 'Unknown chrome storage error')
        );
      }
      resolve(result[STORAGE_KEY] === true);
    });
  });
}

export function getMinChapters(): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([MIN_CHAPTERS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        return reject(
          new Error(chrome.runtime.lastError.message ?? 'Unknown chrome storage error')
        );
      }
      const val = result[MIN_CHAPTERS_KEY];
      resolve(typeof val === 'number' && val >= 2 ? val : DEFAULT_MIN_CHAPTERS);
    });
  });
}

export function setMinChapters(value: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [MIN_CHAPTERS_KEY]: value }, () => {
      if (chrome.runtime.lastError) {
        return reject(
          new Error(chrome.runtime.lastError.message ?? 'Unknown chrome storage error')
        );
      }
      resolve();
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
        return reject(
          new Error(chrome.runtime.lastError.message ?? 'Unknown chrome storage error')
        );
      }
      resolve();
    });
  });
}
