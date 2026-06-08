import { expect, openMockVideo, openQueue, resetExtensionStorage, test } from './fixtures';

function timestampToSeconds(timestamp: string): number {
  return timestamp
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

test('user can open, close, and seek through the shuffled queue', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openMockVideo(page);
  await openQueue(page);

  const panel = page.locator('#chapshuffle-queue');
  const toggle = page.locator('#chapshuffle-btn');
  const rows = panel.locator('.chapshuffle-item');
  await expect(rows).toHaveCount(6);

  const chapterTimes = (await rows.locator('.chapshuffle-time').allTextContents()).map(
    timestampToSeconds
  );
  const targetIndex = chapterTimes.findIndex((seconds) => seconds > 0);
  const targetRow = rows.nth(targetIndex);
  const targetSeconds = chapterTimes[targetIndex];
  await targetRow.click();

  await expect(targetRow).toHaveClass(/chapshuffle-active/);
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).currentTime))
    .toBe(targetSeconds);
  const duration = await page
    .locator('video')
    .evaluate((video) => (video as HTMLVideoElement).duration);
  const expectedProgress = (targetSeconds / duration) * 100;
  await expect
    .poll(() =>
      page
        .getByRole('slider', { name: 'Seek slider' })
        .getAttribute('aria-valuenow')
        .then((value) => Number(value))
    )
    .toBeCloseTo(expectedProgress, 1);
  await expect(page.locator('.ytp-time-current')).toHaveText(
    `${Math.floor(targetSeconds / 60)}:${String(targetSeconds % 60).padStart(2, '0')}`
  );

  await toggle.click();
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});
