import {
  ANALYTICS_CONSENT_KEY,
  INSTALL_ID_KEY,
  getConsent,
  getOrCreateInstallId,
  setConsent,
  subscribeConsent,
} from '../../src/analytics/ConsentManager';

function buildChromeMock(
  initialSync: Record<string, unknown> = {},
  initialLocal: Record<string, unknown> = {}
) {
  const syncStore: Record<string, unknown> = { ...initialSync };
  const localStore: Record<string, unknown> = { ...initialLocal };

  const changeListeners = new Set<
    (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => void
  >();

  const storageArea = (store: Record<string, unknown>, areaName: string) => ({
    get(keys: string[], cb: (r: Record<string, unknown>) => void) {
      const result: Record<string, unknown> = {};
      for (const k of keys) if (k in store) result[k] = store[k];
      cb(result);
    },
    set(items: Record<string, unknown>, cb: () => void) {
      const changes: { [key: string]: chrome.storage.StorageChange } = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: store[k], newValue: v };
        store[k] = v;
      }
      cb();
      for (const listener of changeListeners) listener(changes, areaName);
    },
    remove(key: string | string[], cb: () => void) {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) delete store[k];
      cb();
    },
    _store: store,
  });

  return {
    runtime: {
      lastError: null as { message: string } | null,
      sendMessage: jest.fn().mockResolvedValue({}),
    },
    storage: {
      sync: storageArea(syncStore, 'sync'),
      local: storageArea(localStore, 'local'),
      onChanged: {
        addListener(fn: Parameters<typeof changeListeners.add>[0]) {
          changeListeners.add(fn);
        },
        removeListener(fn: Parameters<typeof changeListeners.add>[0]) {
          changeListeners.delete(fn);
        },
        emit(changes: { [key: string]: chrome.storage.StorageChange }, area = 'sync') {
          for (const listener of changeListeners) listener(changes, area);
        },
      },
    },
  };
}

type ChromeMock = ReturnType<typeof buildChromeMock>;

function getChrome(): ChromeMock {
  return (global as unknown as { chrome: ChromeMock }).chrome;
}

beforeEach(() => {
  (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock();
});
afterEach(() => {
  delete (global as unknown as { chrome: unknown }).chrome;
});

describe('getConsent()', () => {
  test('returns false when storage is empty', async () => {
    expect(await getConsent()).toBe(false);
  });

  test('returns false when stored value is not exactly true', async () => {
    (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock({
      [ANALYTICS_CONSENT_KEY]: 'true',
    });
    expect(await getConsent()).toBe(false);
  });

  test('returns true when stored value is true', async () => {
    (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock({
      [ANALYTICS_CONSENT_KEY]: true,
    });
    expect(await getConsent()).toBe(true);
  });
});

describe('setConsent()', () => {
  test('persists true to sync storage', async () => {
    await setConsent(true);
    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBe(true);
  });

  test('persists false to sync storage', async () => {
    await setConsent(false);
    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBe(false);
  });

  test('deletes install ID from local storage when consent is revoked', async () => {
    (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock(
      { [ANALYTICS_CONSENT_KEY]: true },
      { [INSTALL_ID_KEY]: 'existing-id' }
    );
    await setConsent(false);
    expect(getChrome().storage.local._store[INSTALL_ID_KEY]).toBeUndefined();
  });

  test('resets the in-memory analytics session when consent is revoked', async () => {
    await setConsent(false);

    expect(getChrome().runtime.sendMessage).toHaveBeenCalledWith({
      type: 'analytics-session-reset',
    });
  });

  test('does not touch local storage when enabling consent', async () => {
    (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock(
      {},
      { [INSTALL_ID_KEY]: 'keep-me' }
    );
    await setConsent(true);
    expect(getChrome().storage.local._store[INSTALL_ID_KEY]).toBe('keep-me');
  });
});

describe('getOrCreateInstallId()', () => {
  test('creates and persists a new ID when none exists', async () => {
    const id = await getOrCreateInstallId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(getChrome().storage.local._store[INSTALL_ID_KEY]).toBe(id);
  });

  test('returns the existing ID without overwriting it', async () => {
    (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock(
      {},
      { [INSTALL_ID_KEY]: 'my-existing-id' }
    );
    const id = await getOrCreateInstallId();
    expect(id).toBe('my-existing-id');
  });

  test('two consecutive calls without an existing ID return the same ID', async () => {
    const first = await getOrCreateInstallId();
    const second = await getOrCreateInstallId();
    expect(first).toBe(second);
  });

  test('re-enabling consent after revocation creates a new distinct ID', async () => {
    const originalId = await getOrCreateInstallId();
    await setConsent(false); // deletes the ID
    const newId = await getOrCreateInstallId();
    expect(newId).not.toBe(originalId);
  });
});

describe('subscribeConsent()', () => {
  test('calls listener when analyticsConsent changes in sync storage', () => {
    const listener = jest.fn();
    subscribeConsent(listener);

    getChrome().storage.onChanged.emit({ [ANALYTICS_CONSENT_KEY]: { newValue: true } }, 'sync');
    expect(listener).toHaveBeenCalledWith(true);

    getChrome().storage.onChanged.emit({ [ANALYTICS_CONSENT_KEY]: { newValue: false } }, 'sync');
    expect(listener).toHaveBeenCalledWith(false);
  });

  test('ignores changes in local storage area', () => {
    const listener = jest.fn();
    subscribeConsent(listener);
    getChrome().storage.onChanged.emit({ [ANALYTICS_CONSENT_KEY]: { newValue: true } }, 'local');
    expect(listener).not.toHaveBeenCalled();
  });

  test('ignores unrelated key changes', () => {
    const listener = jest.fn();
    subscribeConsent(listener);
    getChrome().storage.onChanged.emit({ unrelated: { newValue: 'x' } }, 'sync');
    expect(listener).not.toHaveBeenCalled();
  });

  test('stops firing after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeConsent(listener);
    unsubscribe();
    getChrome().storage.onChanged.emit({ [ANALYTICS_CONSENT_KEY]: { newValue: true } }, 'sync');
    expect(listener).not.toHaveBeenCalled();
  });
});
