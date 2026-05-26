'use strict';

const { getShuffleEnabled, setShuffleEnabled } = require('../src/persistence/PersistenceManager');

// Minimal chrome.storage.sync mock backed by an in-memory store.
function buildChromeMock(initialStore = {}) {
  const store = { ...initialStore };
  return {
    runtime: { lastError: null },
    storage: {
      sync: {
        get(keys, callback) {
          const result = {};
          for (const key of keys) {
            if (key in store) result[key] = store[key];
          }
          callback(result);
        },
        set(items, callback) {
          Object.assign(store, items);
          callback();
        },
        _store: store,
      },
    },
  };
}

beforeEach(() => {
  global.chrome = buildChromeMock();
});

afterEach(() => {
  delete global.chrome;
});

describe('PersistenceManager.getShuffleEnabled()', () => {
  test('defaults to false when storage is empty', async () => {
    expect(await getShuffleEnabled()).toBe(false);
  });

  test('returns true when previously set to true', async () => {
    global.chrome = buildChromeMock({ shuffleEnabled: true });
    expect(await getShuffleEnabled()).toBe(true);
  });

  test('returns false when stored value is false', async () => {
    global.chrome = buildChromeMock({ shuffleEnabled: false });
    expect(await getShuffleEnabled()).toBe(false);
  });
});

describe('PersistenceManager.setShuffleEnabled()', () => {
  test('writes true to storage', async () => {
    await setShuffleEnabled(true);
    expect(global.chrome.storage.sync._store.shuffleEnabled).toBe(true);
  });

  test('writes false to storage', async () => {
    await setShuffleEnabled(false);
    expect(global.chrome.storage.sync._store.shuffleEnabled).toBe(false);
  });

  test('coerces truthy value to boolean true', async () => {
    await setShuffleEnabled(1);
    expect(global.chrome.storage.sync._store.shuffleEnabled).toBe(true);
  });

  test('round-trips: set then get returns same value', async () => {
    await setShuffleEnabled(true);
    expect(await getShuffleEnabled()).toBe(true);
    await setShuffleEnabled(false);
    expect(await getShuffleEnabled()).toBe(false);
  });
});
