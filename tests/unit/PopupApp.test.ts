import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../../src/popup/popup';
import { ANALYTICS_CONSENT_KEY, INSTALL_ID_KEY } from '../../src/analytics/ConsentManager';

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

function setChrome(mock: ChromeMock): void {
  (global as unknown as { chrome: ChromeMock }).chrome = mock;
}

let container: HTMLDivElement;

async function mountApp(): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    render(h(App, null), container);
  });
  // second pass: initial getConsent()/settings.read() resolve as microtasks
  // after the first act flush, so their state updates need one more flush
  await act(async () => {});
}

function consentInput(): HTMLInputElement {
  const rows = Array.from(container.querySelectorAll('.row'));
  const row = rows.find(
    (r) => r.querySelector('.label')?.textContent === 'Share pseudonymous usage metrics'
  );
  if (!row) throw new Error('consent row not found');
  return row.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

async function toggleConsent(checked: boolean): Promise<void> {
  await act(async () => {
    const input = consentInput();
    input.checked = checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function emitExternalConsentChange(newValue: boolean): Promise<void> {
  await act(async () => {
    getChrome().storage.onChanged.emit({ [ANALYTICS_CONSENT_KEY]: { newValue } }, 'sync');
  });
}

beforeEach(() => {
  setChrome(buildChromeMock());
});

afterEach(() => {
  render(null, container);
  container.remove();
  delete (global as unknown as { chrome: unknown }).chrome;
});

describe('popup consent toggle', () => {
  test('defaults to off when no consent is stored', async () => {
    await mountApp();
    expect(consentInput().checked).toBe(false);
  });

  test('reflects stored consent when the popup opens', async () => {
    setChrome(buildChromeMock({ [ANALYTICS_CONSENT_KEY]: true }));
    await mountApp();
    expect(consentInput().checked).toBe(true);
  });

  test('enabling persists consent without creating an installation ID', async () => {
    await mountApp();
    await toggleConsent(true);

    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBe(true);
    expect(getChrome().storage.local._store[INSTALL_ID_KEY]).toBeUndefined();
    expect(consentInput().checked).toBe(true);
  });

  test('disabling persists revocation and deletes the installation ID', async () => {
    setChrome(
      buildChromeMock({ [ANALYTICS_CONSENT_KEY]: true }, { [INSTALL_ID_KEY]: 'existing-id' })
    );
    await mountApp();
    await toggleConsent(false);

    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBe(false);
    expect(getChrome().storage.local._store[INSTALL_ID_KEY]).toBeUndefined();
    expect(consentInput().checked).toBe(false);
  });

  test('external consent changes update an open popup', async () => {
    await mountApp();
    expect(consentInput().checked).toBe(false);

    await emitExternalConsentChange(true);
    expect(consentInput().checked).toBe(true);

    await emitExternalConsentChange(false);
    expect(consentInput().checked).toBe(false);
  });

  test('unsubscribes from consent changes on unmount', async () => {
    await mountApp();
    await act(async () => {
      render(null, container);
    });

    expect(() =>
      getChrome().storage.onChanged.emit({ [ANALYTICS_CONSENT_KEY]: { newValue: true } }, 'sync')
    ).not.toThrow();
  });
});
