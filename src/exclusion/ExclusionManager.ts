const EXCLUSION_STORAGE_KEY = 'chapterExclusions';

type ExclusionStore = Record<string, number[]>;

function storageError(): Error {
  return new Error(chrome.runtime.lastError?.message ?? 'Unknown chrome storage error');
}

function readStore(): Promise<ExclusionStore> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([EXCLUSION_STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve((result[EXCLUSION_STORAGE_KEY] as ExclusionStore) ?? {});
    });
  });
}

function writeStore(store: ExclusionStore): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [EXCLUSION_STORAGE_KEY]: store }, () => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve();
    });
  });
}

export async function getExclusions(videoId: string): Promise<number[]> {
  const store = await readStore();
  return store[videoId] ?? [];
}

export async function setExclusions(videoId: string, seconds: number[]): Promise<void> {
  const store = await readStore();
  if (seconds.length === 0) {
    delete store[videoId];
  } else {
    store[videoId] = seconds;
  }
  await writeStore(store);
}

export async function clearExclusions(videoId: string): Promise<void> {
  const store = await readStore();
  delete store[videoId];
  await writeStore(store);
}
