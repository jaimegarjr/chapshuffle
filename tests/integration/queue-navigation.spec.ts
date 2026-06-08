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

  const targetRow = rows.nth(1);
  const targetSeconds = timestampToSeconds(
    await targetRow.locator('.chapshuffle-time').innerText()
  );
  await targetRow.click();

  await expect(targetRow).toHaveClass(/chapshuffle-active/);
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).currentTime))
    .toBe(targetSeconds);

  await toggle.click();
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});
