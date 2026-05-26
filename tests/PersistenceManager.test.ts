import { getShuffleEnabled, setShuffleEnabled } from '../src/persistence/PersistenceManager';

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
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({ shuffleEnabled: true });
    expect(await getShuffleEnabled()).toBe(true);
  });

  test('returns false when stored value is false', async () => {
    (global as unknown as Record<string, unknown>).chrome = buildChromeMock({ shuffleEnabled: false });
    expect(await getShuffleEnabled()).toBe(false);
  });
});

describe('PersistenceManager.setShuffleEnabled()', () => {
  test('writes true to storage', async () => {
    await setShuffleEnabled(true);
    const chrome = (global as unknown as Record<string, ReturnType<typeof buildChromeMock>>).chrome;
    expect(chrome.storage.sync._store.shuffleEnabled).toBe(true);
  });

  test('writes false to storage', async () => {
    await setShuffleEnabled(false);
    const chrome = (global as unknown as Record<string, ReturnType<typeof buildChromeMock>>).chrome;
    expect(chrome.storage.sync._store.shuffleEnabled).toBe(false);
  });

  test('round-trips: set then get returns same value', async () => {
    await setShuffleEnabled(true);
    expect(await getShuffleEnabled()).toBe(true);
    await setShuffleEnabled(false);
    expect(await getShuffleEnabled()).toBe(false);
  });
});
