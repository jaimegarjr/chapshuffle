export type QueueEndBehavior = 'reshuffle' | 'end-video';

export interface Settings {
  shuffleEnabled: boolean;
  minChapters: number;
  queueEndBehavior: QueueEndBehavior;
}

export const SETTINGS_KEYS = {
  shuffleEnabled: 'shuffleEnabled',
  minChapters: 'minChapters',
  queueEndBehavior: 'queueEndBehavior',
} as const;

export const DEFAULT_SETTINGS: Settings = {
  shuffleEnabled: false,
  minChapters: 5,
  queueEndBehavior: 'reshuffle',
};

type SettingsKey = keyof Settings;
type SettingsStorageKey = (typeof SETTINGS_KEYS)[SettingsKey];
type RawSettings = Partial<Record<SettingsStorageKey, unknown>>;

function storageError(): Error {
  return new Error(chrome.runtime.lastError?.message ?? 'Unknown chrome storage error');
}

function normalizeMinChapters(value: unknown): number {
  return typeof value === 'number' && value >= 2 ? value : DEFAULT_SETTINGS.minChapters;
}

function normalizeQueueEndBehavior(value: unknown): QueueEndBehavior {
  return value === 'end-video' ? 'end-video' : DEFAULT_SETTINGS.queueEndBehavior;
}

export function normalizeSettings(raw: RawSettings): Settings {
  return {
    shuffleEnabled: raw[SETTINGS_KEYS.shuffleEnabled] === true,
    minChapters: normalizeMinChapters(raw[SETTINGS_KEYS.minChapters]),
    queueEndBehavior: normalizeQueueEndBehavior(raw[SETTINGS_KEYS.queueEndBehavior]),
  };
}

export function settingsChangeFromChrome(changes: {
  [key: string]: chrome.storage.StorageChange;
}): Partial<Settings> {
  const settingsChange: Partial<Settings> = {};

  if (SETTINGS_KEYS.shuffleEnabled in changes) {
    settingsChange.shuffleEnabled = changes[SETTINGS_KEYS.shuffleEnabled].newValue === true;
  }
  if (SETTINGS_KEYS.minChapters in changes) {
    settingsChange.minChapters = normalizeMinChapters(changes[SETTINGS_KEYS.minChapters].newValue);
  }
  if (SETTINGS_KEYS.queueEndBehavior in changes) {
    settingsChange.queueEndBehavior = normalizeQueueEndBehavior(
      changes[SETTINGS_KEYS.queueEndBehavior].newValue
    );
  }

  return settingsChange;
}

function readSettings(keys: SettingsStorageKey[]): Promise<RawSettings> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        return reject(storageError());
      }
      resolve(result);
    });
  });
}

function writeSettings(settings: RawSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        return reject(storageError());
      }
      resolve();
    });
  });
}

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(
    await readSettings([
      SETTINGS_KEYS.shuffleEnabled,
      SETTINGS_KEYS.minChapters,
      SETTINGS_KEYS.queueEndBehavior,
    ])
  );
}

export async function getShuffleEnabled(): Promise<boolean> {
  return (await getSettings()).shuffleEnabled;
}

export async function getMinChapters(): Promise<number> {
  return (await getSettings()).minChapters;
}

export function setMinChapters(value: number): Promise<void> {
  return writeSettings({ [SETTINGS_KEYS.minChapters]: value });
}

export async function getQueueEndBehavior(): Promise<QueueEndBehavior> {
  return (await getSettings()).queueEndBehavior;
}

export function setQueueEndBehavior(value: QueueEndBehavior): Promise<void> {
  return writeSettings({ [SETTINGS_KEYS.queueEndBehavior]: value });
}

export function setShuffleEnabled(value: boolean): Promise<void> {
  return writeSettings({ [SETTINGS_KEYS.shuffleEnabled]: Boolean(value) });
}
