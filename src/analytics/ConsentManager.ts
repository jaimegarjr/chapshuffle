import { createDebugLogger } from '../debug/DebugLogger';

const debug = createDebugLogger('analytics:consent');

export const ANALYTICS_CONSENT_KEY = 'analyticsConsent';
export const INSTALL_ID_KEY = 'chapshuffleInstallId';

type ConsentListener = (enabled: boolean) => void;

function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Format as UUID v4
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function storageError(): Error {
  return new Error(chrome.runtime.lastError?.message ?? 'Unknown chrome storage error');
}

export async function getConsent(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([ANALYTICS_CONSENT_KEY], (result) => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve(result[ANALYTICS_CONSENT_KEY] === true);
    });
  });
}

export async function setConsent(value: boolean): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set({ [ANALYTICS_CONSENT_KEY]: value === true }, () => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve();
    });
  });

  if (!value) {
    debug.log('consent revoked — deleting install ID');
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.remove(INSTALL_ID_KEY, () => {
        if (chrome.runtime.lastError) return reject(storageError());
        resolve();
      });
    });
  }
}

export async function getOrCreateInstallId(): Promise<string> {
  const stored = await new Promise<string | undefined>((resolve, reject) => {
    chrome.storage.local.get([INSTALL_ID_KEY], (result) => {
      if (chrome.runtime.lastError) return reject(storageError());
      const val = result[INSTALL_ID_KEY];
      resolve(typeof val === 'string' && val.length > 0 ? val : undefined);
    });
  });

  if (stored) return stored;

  const id = generateId();
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [INSTALL_ID_KEY]: id }, () => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve();
    });
  });
  debug.log('created new install ID');
  return id;
}

export function subscribeConsent(listener: ConsentListener): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ): void => {
    if (areaName !== 'sync' || !(ANALYTICS_CONSENT_KEY in changes)) return;
    listener(changes[ANALYTICS_CONSENT_KEY].newValue === true);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
