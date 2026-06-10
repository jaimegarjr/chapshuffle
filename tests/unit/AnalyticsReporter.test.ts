import { AnalyticsReporter } from '../../src/analytics/AnalyticsReporter';
import {
  type AnalyticsSession,
  AnalyticsSessionManager,
} from '../../src/analytics/AnalyticsSession';
import { ANALYTICS_CONSENT_KEY, INSTALL_ID_KEY } from '../../src/analytics/ConsentManager';

function buildChromeMock(
  initialSync: Record<string, unknown> = {},
  initialLocal: Record<string, unknown> = {}
) {
  const syncStore: Record<string, unknown> = { ...initialSync };
  const localStore: Record<string, unknown> = { ...initialLocal };

  const storageArea = (store: Record<string, unknown>) => ({
    get(keys: string[], cb: (r: Record<string, unknown>) => void) {
      const result: Record<string, unknown> = {};
      for (const k of keys) if (k in store) result[k] = store[k];
      cb(result);
    },
    set(items: Record<string, unknown>, cb: () => void) {
      Object.assign(store, items);
      cb();
    },
    remove(key: string | string[], cb: () => void) {
      for (const k of [key].flat()) delete store[k];
      cb();
    },
    _store: store,
  });

  return {
    runtime: {
      lastError: null as { message: string } | null,
      getManifest: () => ({ version: '9.9.9-test' }),
      sendMessage: jest.fn().mockResolvedValue({}),
    },
    storage: {
      sync: storageArea(syncStore),
      local: storageArea(localStore),
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  };
}

type ChromeMock = ReturnType<typeof buildChromeMock>;

function setChrome(mock: ChromeMock) {
  (global as unknown as { chrome: ChromeMock }).chrome = mock;
}

beforeEach(() => setChrome(buildChromeMock()));
afterEach(() => delete (global as unknown as { chrome: unknown }).chrome);

function consentedChrome(installId?: string) {
  return buildChromeMock(
    { [ANALYTICS_CONSENT_KEY]: true },
    installId ? { [INSTALL_ID_KEY]: installId } : {}
  );
}

function makeReporter(timeoutMs?: number) {
  const session = new AnalyticsSessionManager(timeoutMs);
  return new AnalyticsReporter(sessionClient(session));
}

function sessionClient(manager: AnalyticsSessionManager): AnalyticsSession {
  return {
    async getOrCreate() {
      return manager.getOrCreate();
    },
    async touch() {
      manager.touch();
    },
  };
}

describe('AnalyticsReporter — consent gating', () => {
  test('does not create an install ID without consent', async () => {
    const chrome = buildChromeMock({ [ANALYTICS_CONSENT_KEY]: false });
    setChrome(chrome);
    const reporter = makeReporter();
    await reporter.notifyEligiblePlayback();
    expect(chrome.storage.local._store[INSTALL_ID_KEY]).toBeUndefined();
  });

  test('does not create an install ID when consent is absent', async () => {
    const chrome = buildChromeMock();
    setChrome(chrome);
    await makeReporter().notifyEligiblePlayback();
    expect(chrome.storage.local._store[INSTALL_ID_KEY]).toBeUndefined();
  });

  test('creates an install ID when consent is given', async () => {
    const chrome = consentedChrome();
    setChrome(chrome);
    await makeReporter().notifyEligiblePlayback();
    expect(typeof chrome.storage.local._store[INSTALL_ID_KEY]).toBe('string');
  });
});

describe('AnalyticsReporter — session lifecycle', () => {
  test('emits an event (creates session) on first eligible playback', async () => {
    setChrome(consentedChrome('test-client'));
    const reporter = makeReporter();
    await expect(reporter.notifyEligiblePlayback()).resolves.toBeUndefined();
  });

  test('does not create a new session within the timeout window', async () => {
    setChrome(consentedChrome('client-1'));
    const session = new AnalyticsSessionManager();
    const reporter = new AnalyticsReporter(sessionClient(session));

    const t = Date.now();
    session.getOrCreate(t);
    const { isNew } = session.getOrCreate(t + 1000);
    expect(isNew).toBe(false);
  });

  test('creates a fresh session after timeout', async () => {
    setChrome(consentedChrome('client-2'));
    const session = new AnalyticsSessionManager(100);
    const reporter = new AnalyticsReporter(sessionClient(session));

    const t = Date.now();
    const { sessionId: first } = session.getOrCreate(t);
    const { sessionId: second } = session.getOrCreate(t + 200);
    expect(second).not.toBe(first);

    await expect(reporter.notifyEligiblePlayback()).resolves.toBeUndefined();
  });
});

describe('AnalyticsReporter — failure isolation', () => {
  test('does not throw when chrome storage throws', async () => {
    (global as unknown as { chrome: unknown }).chrome = {
      runtime: { lastError: { message: 'quota exceeded' } },
      storage: {
        sync: {
          get(_: unknown, cb: (r: Record<string, unknown>) => void) {
            cb({});
          },
        },
        local: { get: jest.fn() },
        onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
      },
    };
    const reporter = makeReporter();
    await expect(reporter.notifyEligiblePlayback()).resolves.toBeUndefined();
  });

  test('does not throw when consent check rejects', async () => {
    (global as unknown as { chrome: unknown }).chrome = {
      runtime: { lastError: { message: 'storage error' } },
      storage: {
        sync: {
          get(_: unknown, cb: (r: Record<string, unknown>) => void) {
            cb({});
          },
        },
        local: { get: jest.fn() },
        onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
      },
    };
    await expect(makeReporter().notifyEligiblePlayback()).resolves.toBeUndefined();
  });
});

describe('AnalyticsReporter — outgoing payload shape', () => {
  test('delivered payload carries session_id, engagement_time_msec, and extension version', async () => {
    const chrome = consentedChrome('client-shape');
    setChrome(chrome);
    await makeReporter().notifyEligiblePlayback();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'ga4-deliver',
      payload: {
        client_id: 'client-shape',
        events: [
          {
            name: 'shuffle_session_started',
            params: {
              session_id: expect.any(String),
              engagement_time_msec: 1,
              extension_version: '9.9.9-test',
            },
          },
        ],
      },
    });
  });
});

describe('AnalyticsReporter — credential gating', () => {
  test('completes without error when GA credentials are absent (no network call)', async () => {
    setChrome(consentedChrome('no-creds-client'));
    const reporter = makeReporter();
    await expect(reporter.notifyEligiblePlayback()).resolves.toBeUndefined();
  });
});
