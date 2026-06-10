import { chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, openChapteredVideo, resetExtensionStorage, test } from './fixtures';

const extensionPath = path.resolve(__dirname, '../../dist');
const CONSENT_LABEL = 'Share anonymous usage metrics';
const INSTALL_ID_KEY = 'chapshuffleInstallId';

interface CapturedRequest {
  url: string;
  body: string | null;
}

async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

// Patches fetch inside the extension service worker: GA4 requests are
// recorded and answered locally so no analytics traffic leaves the test.
async function captureGA4Requests(context: BrowserContext): Promise<Worker> {
  const serviceWorker = await getServiceWorker(context);
  await serviceWorker.evaluate(() => {
    const g = globalThis as unknown as {
      __ga4Requests?: { url: string; body: string | null }[];
      fetch: typeof fetch;
    };
    if (g.__ga4Requests) return;
    g.__ga4Requests = [];
    const original = g.fetch.bind(globalThis);
    g.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('google-analytics.com')) {
        g.__ga4Requests!.push({
          url,
          body: typeof init?.body === 'string' ? init.body : null,
        });
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return original(input, init);
    }) as typeof fetch;
  });
  return serviceWorker;
}

async function ga4Requests(serviceWorker: Worker): Promise<CapturedRequest[]> {
  return serviceWorker.evaluate(
    () => (globalThis as unknown as { __ga4Requests?: CapturedRequest[] }).__ga4Requests ?? []
  );
}

function sessionStartPayloads(requests: CapturedRequest[]) {
  return requests
    .map((request) => JSON.parse(request.body ?? '{}'))
    .filter((payload) => payload.events?.[0]?.name === 'shuffle_session_started');
}

function consentRow(page: Page) {
  return page.locator('.row', { hasText: CONSENT_LABEL });
}

async function setConsentViaPopup(
  page: Page,
  extensionId: string,
  enabled: boolean
): Promise<void> {
  if (!page.url().startsWith(`chrome-extension://${extensionId}`)) {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  }
  const checkbox = consentRow(page).getByRole('checkbox');
  if ((await checkbox.isChecked()) !== enabled) {
    await consentRow(page).locator('.switch').click();
  }
  await expect(checkbox).toBeChecked({ checked: enabled });
}

async function readInstallId(page: Page, extensionId: string): Promise<string | null> {
  if (!page.url().startsWith(`chrome-extension://${extensionId}`)) {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  }
  return page.evaluate(
    (key) =>
      new Promise<string | null>((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(typeof result[key] === 'string' ? (result[key] as string) : null);
        });
      }),
    INSTALL_ID_KEY
  );
}

async function forcePlayback(page: Page): Promise<void> {
  await page
    .locator('video')
    .first()
    .evaluate((video) => (video as HTMLVideoElement).play());
}

test('no analytics request occurs before consent is given', async ({ page, extensionId }) => {
  test.setTimeout(120_000);

  await resetExtensionStorage(page, extensionId, { shuffleEnabled: true, tutorialComplete: true });
  const serviceWorker = await captureGA4Requests(page.context());

  await openChapteredVideo(page);
  await forcePlayback(page);
  await page.waitForTimeout(5_000);

  expect(await ga4Requests(serviceWorker)).toHaveLength(0);
  expect(await readInstallId(page, extensionId)).toBeNull();
});

test('qualifying playback with consent produces exactly one shuffle_session_started', async ({
  page,
  extensionId,
}) => {
  test.setTimeout(120_000);

  await resetExtensionStorage(page, extensionId, { shuffleEnabled: true, tutorialComplete: true });
  const serviceWorker = await captureGA4Requests(page.context());
  await setConsentViaPopup(page, extensionId, true);

  await openChapteredVideo(page);
  await forcePlayback(page);
  await expect.poll(async () => (await ga4Requests(serviceWorker)).length).toBe(1);

  const payloads = sessionStartPayloads(await ga4Requests(serviceWorker));
  expect(payloads).toHaveLength(1);
  expect(payloads[0].client_id).toBeTruthy();
  expect(payloads[0].events[0].params.session_id).toBeTruthy();

  // Pause/resume fires further playing events; the session guard must dedupe them.
  await page
    .locator('video')
    .first()
    .evaluate((video) => (video as HTMLVideoElement).pause());
  await forcePlayback(page);
  await page.waitForTimeout(5_000);
  expect(await ga4Requests(serviceWorker)).toHaveLength(1);
});

test('revoking consent deletes the install ID and stops requests; re-consent mints a new client_id', async ({
  page,
  extensionId,
  context,
}) => {
  test.setTimeout(180_000);

  await resetExtensionStorage(page, extensionId, { shuffleEnabled: true, tutorialComplete: true });
  const serviceWorker = await captureGA4Requests(context);
  await setConsentViaPopup(page, extensionId, true);

  await openChapteredVideo(page);
  await forcePlayback(page);
  await expect.poll(async () => (await ga4Requests(serviceWorker)).length).toBe(1);
  const firstClientId = sessionStartPayloads(await ga4Requests(serviceWorker))[0].client_id;

  // Revoke from a second tab so the video page keeps playing.
  const popupPage = await context.newPage();
  await setConsentViaPopup(popupPage, extensionId, false);
  await expect.poll(() => readInstallId(popupPage, extensionId)).toBeNull();

  await page
    .locator('video')
    .first()
    .evaluate((video) => (video as HTMLVideoElement).pause());
  await forcePlayback(page);
  await page.waitForTimeout(5_000);
  expect(await ga4Requests(serviceWorker)).toHaveLength(1);

  // Re-consent: identity is created lazily on the next qualifying playback.
  await setConsentViaPopup(popupPage, extensionId, true);
  expect(await readInstallId(popupPage, extensionId)).toBeNull();

  await page.reload();
  await openChapteredVideo(page);
  await forcePlayback(page);
  await expect
    .poll(async () => (await ga4Requests(serviceWorker)).length, { timeout: 60_000 })
    .toBe(2);

  const payloads = sessionStartPayloads(await ga4Requests(serviceWorker));
  expect(payloads).toHaveLength(2);
  expect(payloads[1].client_id).toBeTruthy();
  expect(payloads[1].client_id).not.toBe(firstClientId);
});

test('consent persists across browser restarts within the same profile', async () => {
  test.setTimeout(120_000);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapshuffle-consent-'));
  const launch = () =>
    chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [
        '--disable-blink-features=AutomationControlled',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

  try {
    const firstRun = await launch();
    const firstWorker = await getServiceWorker(firstRun);
    const extensionId = new URL(firstWorker.url()).host;
    const firstPage = await firstRun.newPage();
    await setConsentViaPopup(firstPage, extensionId, true);
    await firstRun.close();

    const secondRun = await launch();
    const secondPage = await secondRun.newPage();
    await secondPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(consentRow(secondPage).getByRole('checkbox')).toBeChecked();
    await secondRun.close();
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
