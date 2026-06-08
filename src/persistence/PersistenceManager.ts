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
type SettingsListener = (changes: Partial<Settings>) => void;

export interface SettingsModule {
  read(): Promise<Settings>;
  update(changes: Partial<Settings>): Promise<void>;
  subscribe(listener: SettingsListener): () => void;
}

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

function normalizeSettingsChange(changes: {
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

async function readAllSettings(): Promise<Settings> {
  return normalizeSettings(
    await readSettings([
      SETTINGS_KEYS.shuffleEnabled,
      SETTINGS_KEYS.minChapters,
      SETTINGS_KEYS.queueEndBehavior,
    ])
  );
}

function normalizeSettingsUpdate(changes: Partial<Settings>): RawSettings {
  const normalized: RawSettings = {};
  if (changes.shuffleEnabled !== undefined) {
    normalized[SETTINGS_KEYS.shuffleEnabled] = changes.shuffleEnabled === true;
  }
  if (changes.minChapters !== undefined) {
    normalized[SETTINGS_KEYS.minChapters] = normalizeMinChapters(changes.minChapters);
  }
  if (changes.queueEndBehavior !== undefined) {
    normalized[SETTINGS_KEYS.queueEndBehavior] = normalizeQueueEndBehavior(
      changes.queueEndBehavior
    );
  }
  return normalized;
}

export const settings: SettingsModule = {
  read: readAllSettings,
  update(changes) {
    return writeSettings(normalizeSettingsUpdate(changes));
  },
  subscribe(listener) {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'sync') return;
      const normalized = normalizeSettingsChange(changes);
      if (Object.keys(normalized).length > 0) listener(normalized);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  },
};

export const TUTORIAL_COMPLETE_KEY = 'tutorialComplete';

export async function getTutorialComplete(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([TUTORIAL_COMPLETE_KEY], (result) => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve(result[TUTORIAL_COMPLETE_KEY] === true);
    });
  });
}

export function setTutorialComplete(value: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [TUTORIAL_COMPLETE_KEY]: Boolean(value) }, () => {
      if (chrome.runtime.lastError) return reject(storageError());
      resolve();
    });
  });
}
