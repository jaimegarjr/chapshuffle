const STORAGE_KEY = 'shuffleEnabled';
const MIN_CHAPTERS_KEY = 'minChapters';
const QUEUE_END_KEY = 'queueEndBehavior';
export const DEFAULT_MIN_CHAPTERS = 5;

export type QueueEndBehavior = 'reshuffle' | 'end-video';

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

export function getQueueEndBehavior(): Promise<QueueEndBehavior> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([QUEUE_END_KEY], (result) => {
      if (chrome.runtime.lastError) {
        return reject(
          new Error(chrome.runtime.lastError.message ?? 'Unknown chrome storage error')
        );
      }
      const val = result[QUEUE_END_KEY];
      resolve(val === 'end-video' ? 'end-video' : 'reshuffle');
    });
  });
}

export function setQueueEndBehavior(value: QueueEndBehavior): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [QUEUE_END_KEY]: value }, () => {
      if (chrome.runtime.lastError) {
        return reject(
          new Error(chrome.runtime.lastError.message ?? 'Unknown chrome storage error')
        );
      }
      resolve();
    });
  });
}

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
