import { expect, openChapteredVideo, openQueue, resetExtensionStorage, test } from './fixtures';

test('injects a populated queue on a real YouTube video', async ({ page, extensionId }) => {
  test.setTimeout(90_000);

  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openChapteredVideo(page);
  await openQueue(page);
  const panel = page.locator('#chapshuffle-queue');
  await expect(panel.locator('#chapshuffle-queue-title')).toHaveText('Shuffle Queue');

  const chapterCount = await panel.locator('.chapshuffle-item').count();
  expect(chapterCount).toBeGreaterThanOrEqual(5);
});
