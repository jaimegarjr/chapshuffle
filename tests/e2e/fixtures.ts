import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve(__dirname, '../../dist');

export const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=pgQRcqh1u7U&si=4WQlXVnY1EqxFjFT';
export const SECOND_YOUTUBE_VIDEO_ID = 'hsnfBhCevUc';
export const NO_CHAPTER_VIDEO_URL =
  'https://www.youtube.com/watch?v=FeaZu3nSn9A&si=1jfawDzDa6eYb4lW';

interface StoredSettings {
  shuffleEnabled?: boolean;
  minChapters?: number;
  queueEndBehavior?: 'reshuffle' | 'end-video';
  tutorialComplete?: boolean;
}

export async function dismissYouTubeAd(page: Page): Promise<void> {
  const player = page.locator('#movie_player.html5-video-player');
  await expect(player).toBeVisible({ timeout: 60_000 });

  const deadline = Date.now() + 30_000;
  let contentReadySince: number | null = null;
  const skipButtons = page.locator(
    '.ytp-skip-ad-button, .ytp-ad-skip-button-modern, button.ytp-ad-skip-button'
  );

  while (Date.now() < deadline) {
    const adShowing = await player.evaluate((element) => element.classList.contains('ad-showing'));
    if (!adShowing) {
      contentReadySince ??= Date.now();
      if (Date.now() - contentReadySince >= 2_000) return;
    } else {
      contentReadySince = null;
    }

    const buttonCount = await skipButtons.count();
    for (let index = 0; index < buttonCount; index++) {
      const button = skipButtons.nth(index);
      if (await button.isVisible()) {
        await button.click();
        break;
      }
    }

    await page.waitForTimeout(500);
  }

  await expect(player).not.toHaveClass(/ad-showing/, { timeout: 5_000 });
}

export async function wakeYouTubePlayerControls(page: Page): Promise<void> {
  const player = page.locator('#movie_player.html5-video-player');
  await expect(player).toBeVisible({ timeout: 60_000 });

  await player.evaluate((element) => {
    element.classList.remove('ytp-autohide');
    element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  });

  const box = await player.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width - 32, box.y + box.height - 32);
  }
}

export async function resetExtensionStorage(
  page: Page,
  extensionId: string,
  settings: StoredSettings = {}
): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(
    (nextSettings) =>
      new Promise<void>((resolve) => {
        chrome.storage.sync.clear(() => {
          chrome.storage.local.clear(() => {
            chrome.storage.sync.set(nextSettings, resolve);
          });
        });
      }),
    settings
  );
  await page.reload();
}

export async function openChapteredVideo(page: Page): Promise<void> {
  await page.goto(YOUTUBE_VIDEO_URL, { waitUntil: 'domcontentloaded' });
  await dismissYouTubeAd(page);
  await wakeYouTubePlayerControls(page);
  await expect(page.locator('#chapshuffle-btn')).toBeVisible({ timeout: 60_000 });
}

export async function openQueue(page: Page): Promise<void> {
  const toggle = page.locator('#chapshuffle-btn');
  await wakeYouTubePlayerControls(page);
  await toggle.click();
  await expect(page.locator('#chapshuffle-queue')).toBeVisible();
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [
        '--disable-blink-features=AutomationControlled',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
