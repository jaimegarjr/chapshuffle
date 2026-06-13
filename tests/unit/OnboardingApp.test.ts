import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import {
  completeOnboarding,
  getOnboardingMode,
  OnboardingApp,
  ONBOARDING_LINKS,
  ONBOARDING_TEST_VIDEO_URL,
} from '../../src/onboarding/onboarding';
import { ANALYTICS_CONSENT_KEY } from '../../src/analytics/ConsentManager';
import { ANALYTICS_NOTICE_DISMISSED_KEY } from '../../src/analytics/AnalyticsNotice';

function buildChromeMock(initialSync: Record<string, unknown> = {}) {
  const syncStore = { ...initialSync };
  const listeners = new Set<
    (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => void
  >();

  return {
    runtime: {
      lastError: null as { message: string } | null,
      sendMessage: jest.fn().mockResolvedValue({}),
    },
    storage: {
      sync: {
        get(keys: string[], callback: (result: Record<string, unknown>) => void) {
          const result: Record<string, unknown> = {};
          for (const key of keys) if (key in syncStore) result[key] = syncStore[key];
          callback(result);
        },
        set(items: Record<string, unknown>, callback: () => void) {
          const changes: { [key: string]: chrome.storage.StorageChange } = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: syncStore[key], newValue: value };
            syncStore[key] = value;
          }
          callback();
          for (const listener of listeners) listener(changes, 'sync');
        },
        _store: syncStore,
      },
      local: {
        remove(_keys: string | string[], callback: () => void) {
          callback();
        },
      },
      onChanged: {
        addListener(listener: Parameters<typeof listeners.add>[0]) {
          listeners.add(listener);
        },
        removeListener(listener: Parameters<typeof listeners.add>[0]) {
          listeners.delete(listener);
        },
      },
    },
  };
}

type ChromeMock = ReturnType<typeof buildChromeMock>;

function getChrome(): ChromeMock {
  return (global as unknown as { chrome: ChromeMock }).chrome;
}

let container: HTMLDivElement;

async function mountApp(navigate = jest.fn()): Promise<jest.Mock> {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    render(h(OnboardingApp, { navigate }), container);
  });
  await act(async () => {});
  return navigate;
}

function consentInput(): HTMLInputElement {
  return container.querySelector(
    'input[aria-label="Share anonymous usage metrics"]'
  ) as HTMLInputElement;
}

beforeEach(() => {
  (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock();
  window.history.replaceState({}, '', '/onboarding.html');
});

afterEach(() => {
  render(null, container);
  container?.remove();
  delete (global as unknown as { chrome?: ChromeMock }).chrome;
});

describe('onboarding state', () => {
  test('defaults analytics off and presents every secondary destination', async () => {
    await mountApp();

    expect(consentInput().checked).toBe(false);
    expect(Array.from(container.querySelectorAll('a')).map((link) => link.href)).toEqual(
      expect.arrayContaining(Object.values(ONBOARDING_LINKS))
    );
  });

  test('uses the synchronized consent value and saves the selected state before navigation', async () => {
    (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock({
      [ANALYTICS_CONSENT_KEY]: true,
    });
    const navigate = await mountApp();
    expect(consentInput().checked).toBe(true);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.button-primary')!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBe(true);
    expect(getChrome().storage.sync._store[ANALYTICS_NOTICE_DISMISSED_KEY]).toBe(true);
    expect(navigate).toHaveBeenCalledWith(ONBOARDING_TEST_VIDEO_URL);
  });

  test('persists the toggle immediately and dismisses the popup notice when enabling', async () => {
    await mountApp();

    await act(async () => {
      consentInput().click();
    });

    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBe(true);
    expect(getChrome().storage.sync._store[ANALYTICS_NOTICE_DISMISSED_KEY]).toBe(true);

    await act(async () => {
      consentInput().click();
    });

    expect(getChrome().storage.sync._store[ANALYTICS_CONSENT_KEY]).toBe(false);
    expect(getChrome().storage.sync._store[ANALYTICS_NOTICE_DISMISSED_KEY]).toBe(true);
  });

  test('revisit mode changes the welcome state without touching tutorial completion', async () => {
    window.history.replaceState({}, '', '/onboarding.html?mode=revisit');
    (global as unknown as { chrome: ChromeMock }).chrome = buildChromeMock({
      tutorialComplete: true,
    });
    await mountApp();

    expect(getOnboardingMode(window.location.search)).toBe('revisit');
    expect(container.textContent).toContain('Take another spin through the basics.');
    expect(getChrome().storage.sync._store.tutorialComplete).toBe(true);
  });
});

describe('completeOnboarding()', () => {
  test('saves consent and dismissal before replacing the current page', async () => {
    const order: string[] = [];

    await completeOnboarding(true, {
      async saveConsent(value) {
        order.push(`consent:${value}`);
      },
      async dismissAnalyticsNotice() {
        order.push('notice:dismissed');
      },
      navigate(url) {
        order.push(`navigate:${url}`);
      },
    });

    expect(order).toEqual([
      'consent:true',
      'notice:dismissed',
      `navigate:${ONBOARDING_TEST_VIDEO_URL}`,
    ]);
  });
});
