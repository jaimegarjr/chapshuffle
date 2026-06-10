import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../../src/popup/popup';
import { POPUP_LINKS } from '../../src/popup/popup';
import { ANALYTICS_CONSENT_KEY, INSTALL_ID_KEY } from '../../src/analytics/ConsentManager';
import { ANALYTICS_NOTICE_DISMISSED_KEY } from '../../src/analytics/AnalyticsNotice';

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
      getManifest: () => ({ version: '9.9.9-test' }),
      sendMessage: jest.fn().mockResolvedValue({}),
    },
    tabs: {
      create: jest.fn(),
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

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function consentInput(): HTMLInputElement {
  const rows = Array.from(container.querySelectorAll('.row'));
  const row = rows.find(
    (r) => r.querySelector('.label')?.textContent === 'Share anonymous usage metrics'
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

function noticeButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('.analytics-notice button')).find(
    (candidate) => candidate.textContent === label
  );
  if (!button) throw new Error(`${label} button not found`);
  return button as HTMLButtonElement;
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

describe('popup sections and help links', () => {
  test('renders Playback, Privacy, and Help with Auto-advance terminology', async () => {
    await mountApp();

    expect(
      Array.from(container.querySelectorAll('.section-title')).map((heading) => heading.textContent)
    ).toEqual(['Playback', 'Privacy', 'Help']);
    expect(container.textContent).toContain('Auto-advance');
    expect(container.textContent).not.toContain('Enable shuffle');
    expect(container.textContent).toContain('Send feedback');
    expect(container.textContent).toContain('Getting started');
    expect(container.textContent).toContain('Privacy policy');
    expect(container.textContent).toContain('Homepage');
  });

  test('opens every Help destination in a new tab', async () => {
    await mountApp();
    const labels = ['Send feedback', 'Getting started', 'Privacy policy', 'Homepage'];

    for (const label of labels) {
      const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
        candidate.textContent?.includes(label)
      );
      expect(button).toBeDefined();
      await act(async () => {
        button!.click();
        await flushMicrotasks();
      });
    }

    expect(getChrome().tabs.create).toHaveBeenCalledWith({ url: POPUP_LINKS.feedback });
    expect(getChrome().tabs.create).toHaveBeenCalledWith({ url: POPUP_LINKS.gettingStarted });
    expect(getChrome().tabs.create).toHaveBeenCalledWith({ url: POPUP_LINKS.privacy });
    expect(getChrome().tabs.create).toHaveBeenCalledWith({ url: POPUP_LINKS.homepage });
  });

  test('feedback analytics is emitted only with consent', async () => {
    setChrome(buildChromeMock({ [ANALYTICS_CONSENT_KEY]: true }));
    await mountApp();
    const feedbackButton = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Send feedback')
    );

    await act(async () => {
      feedbackButton!.click();
      await flushMicrotasks();
    });

    expect(getChrome().runtime.sendMessage).toHaveBeenCalledWith({
      type: 'ga4-deliver',
      payload: {
        client_id: expect.any(String),
        events: [
          {
            name: 'feedback_link_opened',
            params: { extension_version: '9.9.9-test' },
          },
        ],
      },
    });
  });
});

describe('existing-user analytics notice', () => {
  test('appears on first open without changing default-off consent', async () => {
    await mountApp();

    expect(container.querySelector('.analytics-notice')).not.toBeNull();
    expect(consentInput().checked).toBe(false);
    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBeUndefined();
  });

  test('Not now permanently dismisses the notice in sync storage', async () => {
    await mountApp();

    await act(async () => {
      noticeButton('Not now').click();
      await flushMicrotasks();
    });

    expect(container.querySelector('.analytics-notice')).toBeNull();
    expect(getChrome().storage.sync._store[ANALYTICS_NOTICE_DISMISSED_KEY]).toBe(true);
    expect(consentInput().checked).toBe(false);
  });

  test('Review setting dismisses the notice and focuses the disabled-by-default toggle', async () => {
    await mountApp();

    await act(async () => {
      noticeButton('Review setting').click();
      await flushMicrotasks();
    });

    expect(container.querySelector('.analytics-notice')).toBeNull();
    expect(document.activeElement).toBe(consentInput());
    expect(consentInput().checked).toBe(false);
    expect(getChrome().storage.sync._store[ANALYTICS_NOTICE_DISMISSED_KEY]).toBe(true);
  });

  test('stays hidden for new installations that onboarding marked complete', async () => {
    setChrome(buildChromeMock({ [ANALYTICS_NOTICE_DISMISSED_KEY]: true }));
    await mountApp();

    expect(container.querySelector('.analytics-notice')).toBeNull();
    expect(consentInput().checked).toBe(false);
  });
});
