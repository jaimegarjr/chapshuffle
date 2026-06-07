import { expect, test } from './fixtures';

const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=pgQRcqh1u7U&si=4WQlXVnY1EqxFjFT';

test('injects a populated queue on a real YouTube video', async ({ page, extensionId }) => {
  test.setTimeout(90_000);

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        chrome.storage.sync.set({ tutorialComplete: true, minChapters: 5 }, resolve);
      })
  );

  await page.goto(YOUTUBE_VIDEO_URL, { waitUntil: 'domcontentloaded' });

  const toggle = page.locator('#chapshuffle-btn');
  await expect(toggle).toBeVisible({ timeout: 60_000 });
  await toggle.click();

  const panel = page.locator('#chapshuffle-queue');
  await expect(panel).toBeVisible();
  await expect(panel.locator('#chapshuffle-queue-title')).toHaveText('Shuffle Queue');

  const chapterCount = await panel.locator('.chapshuffle-item').count();
  expect(chapterCount).toBeGreaterThanOrEqual(5);
});
