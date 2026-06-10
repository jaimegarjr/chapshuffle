export const ANALYTICS_NOTICE_DISMISSED_KEY = 'analyticsNoticeDismissed';

type AnalyticsNoticeListener = (dismissed: boolean) => void;

function storageError(): Error {
  return new Error(chrome.runtime.lastError?.message ?? 'Unknown chrome storage error');
}

export function getAnalyticsNoticeDismissed(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([ANALYTICS_NOTICE_DISMISSED_KEY], (result) => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve(result[ANALYTICS_NOTICE_DISMISSED_KEY] === true);
    });
  });
}

export function setAnalyticsNoticeDismissed(dismissed = true): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [ANALYTICS_NOTICE_DISMISSED_KEY]: dismissed === true }, () => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve();
    });
  });
}

export function subscribeAnalyticsNotice(listener: AnalyticsNoticeListener): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ): void => {
    if (areaName !== 'sync' || !(ANALYTICS_NOTICE_DISMISSED_KEY in changes)) return;
    listener(changes[ANALYTICS_NOTICE_DISMISSED_KEY].newValue === true);
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
