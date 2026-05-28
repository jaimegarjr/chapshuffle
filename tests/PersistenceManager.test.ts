import {
  getMinChapters,
  getQueueEndBehavior,
  getShuffleEnabled,
  setMinChapters,
  setQueueEndBehavior,
  setShuffleEnabled,
} from '../src/persistence/PersistenceManager';

interface MockStore {
  [key: string]: unknown;
}

function buildChromeMock(initialStore: MockStore = {}) {
  const store: MockStore = { ...initialStore };
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

describe('PersistenceManager.getShuffleEnabled()', () => {
  test('defaults to false when storage is empty', async () => {
    expect(await getShuffleEnabled()).toBe(false);
  });

  test('returns true when previously set to true', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      shuffleEnabled: true,
    });
    expect(await getShuffleEnabled()).toBe(true);
  });

  test('returns false when stored value is false', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      shuffleEnabled: false,
    });
    expect(await getShuffleEnabled()).toBe(false);
  });
});

describe('PersistenceManager.setShuffleEnabled()', () => {
  test('round-trips: set then get returns same value', async () => {
    await setShuffleEnabled(true);
    expect(await getShuffleEnabled()).toBe(true);
    await setShuffleEnabled(false);
    expect(await getShuffleEnabled()).toBe(false);
  });
});

describe('PersistenceManager.getMinChapters()', () => {
  test('defaults to 5 when storage is empty or below minimum', async () => {
    expect(await getMinChapters()).toBe(5);
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({ minChapters: 1 });
    expect(await getMinChapters()).toBe(5);
  });

  test('returns stored values at or above 2', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({ minChapters: 2 });
    expect(await getMinChapters()).toBe(2);
  });
});

describe('PersistenceManager.setMinChapters()', () => {
  test('writes the selected threshold to storage', async () => {
    await setMinChapters(7);
    expect(chromeStore().minChapters).toBe(7);
  });
});

describe('PersistenceManager.getQueueEndBehavior()', () => {
  test('defaults to reshuffle unless storage explicitly contains end-video', async () => {
    expect(await getQueueEndBehavior()).toBe('reshuffle');
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({
      queueEndBehavior: 'end-video',
    });
    expect(await getQueueEndBehavior()).toBe('end-video');
  });
});

describe('PersistenceManager.setQueueEndBehavior()', () => {
  test('writes the selected queue-end behavior to storage', async () => {
    await setQueueEndBehavior('end-video');
    expect(chromeStore().queueEndBehavior).toBe('end-video');
  });
});
