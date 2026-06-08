import {
  DEFAULT_SETTINGS,
  getTutorialComplete,
  normalizeSettings,
  settings,
  setTutorialComplete,
  type QueueEndBehavior,
} from '../../src/persistence/PersistenceManager';

interface MockStore {
  [key: string]: unknown;
}

function buildChromeMock(initialStore: MockStore = {}) {
  const store: MockStore = { ...initialStore };
  const changeListeners = new Set<
    (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
  >();
  return {
    runtime: { lastError: null as { message: string } | null },
    storage: {
      sync: {
        get(keys: string[], callback: (result: MockStore) => void) {
          const result: MockStore = {};
          for (const key of keys) {
            if (key in store) result[key] = store[key];
          }
          callback(result);
        },
        set(items: MockStore, callback: () => void) {
          Object.assign(store, items);
          callback();
        },
        _store: store,
      },
      onChanged: {
        addListener(
          listener: (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
          ) => void
        ) {
          changeListeners.add(listener);
        },
        removeListener(
          listener: (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
          ) => void
        ) {
          changeListeners.delete(listener);
        },
        emit(changes: { [key: string]: chrome.storage.StorageChange }, areaName = 'sync') {
          for (const listener of changeListeners) listener(changes, areaName);
        },
      },
    },
  };
}

function chromeStore(): MockStore {
  const chrome = (global as unknown as Record<string, ReturnType<typeof buildChromeMock>>).chrome;
  return chrome.storage.sync._store;
}

beforeEach(() => {
  (global as unknown as Record<string, unknown>).chrome = buildChromeMock();
});

afterEach(() => {
  delete (global as unknown as Record<string, unknown>).chrome;
});

describe('PersistenceManager.normalizeSettings()', () => {
  test('applies defaults and normalizes invalid stored values', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        shuffleEnabled: 'true',
        minChapters: 1,
        queueEndBehavior: 'loop',
      })
    ).toEqual(DEFAULT_SETTINGS);
  });

  test('preserves valid stored values', () => {
    expect(
      normalizeSettings({
        shuffleEnabled: true,
        minChapters: 2,
        queueEndBehavior: 'end-video',
      })
    ).toEqual({
      shuffleEnabled: true,
      minChapters: 2,
      queueEndBehavior: 'end-video',
    });
  });
});

describe('PersistenceManager.settings.subscribe()', () => {
  test('emits normalized sync changes and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = settings.subscribe(listener);
    const chromeMock = (global as unknown as Record<string, ReturnType<typeof buildChromeMock>>)
      .chrome;

    chromeMock.storage.onChanged.emit({
      shuffleEnabled: { oldValue: false, newValue: true },
      minChapters: { oldValue: 7, newValue: 1 },
      unrelated: { oldValue: 'old', newValue: 'new' },
    });

    expect(listener).toHaveBeenCalledWith({
      shuffleEnabled: true,
      minChapters: DEFAULT_SETTINGS.minChapters,
    });

    chromeMock.storage.onChanged.emit(
      { shuffleEnabled: { oldValue: true, newValue: false } },
      'local'
    );
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    chromeMock.storage.onChanged.emit({
      shuffleEnabled: { oldValue: true, newValue: false },
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('PersistenceManager.settings.read()', () => {
  test('reads and normalizes all settings in one call', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      shuffleEnabled: true,
      minChapters: 8,
      queueEndBehavior: 'end-video',
    });

    expect(await settings.read()).toEqual({
      shuffleEnabled: true,
      minChapters: 8,
      queueEndBehavior: 'end-video',
    });
  });

  test('applies defaults to missing and invalid values', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      shuffleEnabled: 'true',
      minChapters: 1,
      queueEndBehavior: 'loop',
    });
    expect(await settings.read()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('PersistenceManager.settings.update()', () => {
  test('writes a partial settings update', async () => {
    await settings.update({
      shuffleEnabled: true,
      minChapters: 7,
      queueEndBehavior: 'end-video',
    });
    expect(chromeStore().shuffleEnabled).toBe(true);
    expect(chromeStore().minChapters).toBe(7);
    expect(chromeStore().queueEndBehavior).toBe('end-video');
  });

  test('normalizes invalid values before writing', async () => {
    await settings.update({
      minChapters: 1,
      queueEndBehavior: 'invalid' as QueueEndBehavior,
    });
    expect(chromeStore().minChapters).toBe(DEFAULT_SETTINGS.minChapters);
    expect(chromeStore().queueEndBehavior).toBe(DEFAULT_SETTINGS.queueEndBehavior);
  });
});

describe('PersistenceManager.getTutorialComplete()', () => {
  test('defaults to false when storage is empty', async () => {
    expect(await getTutorialComplete()).toBe(false);
  });

  test('returns false when stored value is not exactly true', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      tutorialComplete: 'true',
    });
    expect(await getTutorialComplete()).toBe(false);
  });
});

describe('PersistenceManager.setTutorialComplete()', () => {
  test('persists and round-trips: set true then get returns true', async () => {
    await setTutorialComplete(true);
    expect(await getTutorialComplete()).toBe(true);
  });

  test('persists and round-trips: set false then get returns false', async () => {
    await setTutorialComplete(true);
    await setTutorialComplete(false);
    expect(await getTutorialComplete()).toBe(false);
  });
});
