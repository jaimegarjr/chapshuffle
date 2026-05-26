'use strict';

const STORAGE_KEY = 'shuffleEnabled';

/**
 * Reads the global shuffle toggle from chrome.storage.sync.
 * Resolves to false when the key is not yet stored.
 *
 * @returns {Promise<boolean>}
 */
function getShuffleEnabled() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(result[STORAGE_KEY] === true ? true : false);
    });
  });
}

/**
 * Persists the global shuffle toggle to chrome.storage.sync.
 *
 * @param {boolean} value
 * @returns {Promise<void>}
 */
function setShuffleEnabled(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: Boolean(value) }, () => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve();
    });
  });
}

module.exports = { getShuffleEnabled, setShuffleEnabled };
